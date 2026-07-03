/**
 * fetch-news.js  (ESM)
 * GitHub Actions에서 매일 자동 실행 — Google News RSS → public/news.json
 */

import { DOMParser } from '@xmldom/xmldom';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── 순수 '날씨' 기사 판별 (기후·에너지 등 실질 환경 기사와 구분) ──
// 아이가 가장 쉽게 도망가는 단발성 일기예보 기사를 별도로 표시해 선정 단계에서 제한한다.
const WEATHER_RE = /날씨|기상|기온|강수|강우|강설|호우|대설|태풍|장마|폭염|한파|황사|미세먼지|폭우|소나기|안개|천둥|번개|눈 예보|비 예보|낮 최고|밤 최저|아침 기온|나들이|주말 날씨|오늘 날씨|내일 날씨|이번 주 날씨/;
function isWeather(title) {
    return WEATHER_RE.test(title.toLowerCase());
}

// ── 카테고리 분류 ─────────────────────────────────────────────
// Tech & Economy를 Environment보다 먼저 매칭 → 게임·IT 기사가 날씨/환경 키워드에
// 우선 매칭되지 않도록 하고, 게임/e스포츠 등 아이 관심 소재를 IT로 편입한다.
function detectCategory(title) {
    const t = title.toLowerCase();
    if (/ai|인공지능|반도체|로봇|챗gpt|gpt|소프트웨어|테크|디지털|플랫폼|스타트업|빅테크|메타|구글|애플|네이버|카카오|유튜브|먹통|서비스장애|스트리밍|넷플릭스|틱톡|인스타그램|트위터|오픈ai|클라우드|사이버|해킹|게임|e스포츠|e-스포츠|게이밍|콘솔|플레이스테이션|엑스박스|닌텐도|스팀|가챠|확률형|메타버스|가상현실/.test(t)) return 'Tech & Economy';
    if (/기후|환경|탄소|온난화|재활용|에너지|원전|신재생|풍력|태양광|탄소중립|해수면|생태|날씨|기상|기온|강수|강우|강설|호우|대설|태풍|장마|폭염|한파|황사|미세먼지|폭우|홍수|가뭄|소나기|안개|천둥|번개|눈 예보|비 예보|낮 최고|밤 최저|아침 기온|나들이|주말 날씨|오늘 날씨|내일 날씨|이번 주 날씨/.test(t)) return 'Environment';
    if (/경제|금리|주가|환율|무역|gdp|물가|부동산|투자|주식|채권|증시|코스피|코스닥|원화|달러|수출|수입|관세|대출|금융|은행|보험|펀드|집값|전세|월세|세금|재정|예산|적자|흑자|성장률|소비|인플레|디플레|매출|영업이익|ipo|상장|합병|인수/.test(t)) return 'Economy';
    if (/사회|교육|복지|안전|노동|건강|의료|급여|비급여|본인부담|건강보험|병원|수술|약값|출산|저출산|육아|학교|대학|입시|수능|청년|노인|고령|장애|빈곤|범죄|절도|강도|검거|체포|구속|탈주|마약|살인|폭행|성범죄|사고|화재|재난|소방|경찰|법원|재판|판결|선고|구형|징역|집행유예|무죄|유죄|벌금|항소|상고|헌재|헌법재판소|선거|투표|정치|정부|국회|대통령|대선|총선|장관|의원|여야|탄핵|내란|계엄|특검|수사|기소|행정|공무원|차별|인권|여성|아동|가족|주민|시민|서울|부산|경기|인천|대구|광주|대전|울산|세종|민주당|국민의힘|정당|국무|시장|도지사|국방|외교|통일|북한|남북|입법|법안|개정|시행|조례|지자체|귀경|귀성|귀향|정체|교통|고속도로|도로|열차|버스|지하철|공항|항공|철도|지연|결항|연휴|명절|설|추석|연예|스포츠|야구|축구|농구|배구|올림픽|월드컵|경기|선수|감독|드라마|영화|음악|콘서트|공연|시상식|배우|가수|아이돌|먹방|채널|방송|예능|기자|취재|인터뷰|사망|부고|장례|기념|추모|수상|대상|개막|폐막|전시|박람회|스타|유명인/.test(t)) return 'Society';
    return 'World';
}

// ── 하루치 기사 선정 ──────────────────────────────────────────
// 규칙: 날씨 기사 최대 1개 / 아이 관심(Tech & Economy) 최소 1개 보장 /
//       World 최소 1개 / 동일 카테고리 최대 2개 / 총 6개.
function selectDaily(pool) {
    const TARGET = 6, MAX_WEATHER = 1, MAX_PER_CAT = 2;
    const out = [];
    const catCount = {};
    let weather = 0;

    const take = (a) => {
        out.push(a);
        catCount[a.category] = (catCount[a.category] || 0) + 1;
        if (a.isWeather) weather++;
    };
    const canTake = (a) => !out.includes(a)
        && !(a.isWeather && weather >= MAX_WEATHER)
        && (catCount[a.category] || 0) < MAX_PER_CAT;

    // 1) 아이 관심 소재(Tech & Economy) 1개 우선 확보 — 날씨 도피로 대체
    const interest = pool.find(a => a.category === 'Tech & Economy' && !a.isWeather);
    if (interest) take(interest);

    // 2) World 1개 확보
    const world = pool.find(a => a.category === 'World' && canTake(a));
    if (world) take(world);

    // 3) 풀 순서(중요도)대로 캡을 지키며 채움
    for (const a of pool) {
        if (out.length >= TARGET) break;
        if (canTake(a)) take(a);
    }

    // 4) 그래도 부족하면(희귀) 카테고리 캡만 완화, 날씨 캡은 유지
    if (out.length < TARGET) {
        for (const a of pool) {
            if (out.length >= TARGET) break;
            if (out.includes(a)) continue;
            if (a.isWeather && weather >= MAX_WEATHER) continue;
            take(a);
        }
    }
    return out.slice(0, TARGET);
}

function stripHtml(html) {
    return (html || '')
        .replace(/<[^>]*>/g, '')
        .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
        .trim();
}

async function main() {
    const gnewsUrl = 'https://news.google.com/rss?hl=ko&gl=KR&ceid=KR:ko';
    console.log('📡 Google News RSS 수집 중...');

    const res = await fetch(gnewsUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; JuniorInsight/1.0)' }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);

    const xml = await res.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, 'text/xml');
    const items = doc.getElementsByTagName('item');

    const today = new Date().toISOString().slice(0, 10);
    const pool = [];

    for (let i = 0; i < Math.min(items.length, 20); i++) {
        const item = items[i];
        const rawTitle = item.getElementsByTagName('title')[0]?.textContent || '';
        const dashIdx = rawTitle.lastIndexOf(' - ');
        const title = dashIdx > 0 ? rawTitle.slice(0, dashIdx).trim() : rawTitle.trim();
        const source = dashIdx > 0 ? rawTitle.slice(dashIdx + 3).trim() : 'Google 뉴스';
        const link = item.getElementsByTagName('link')[0]?.textContent?.trim() || '';
        const pubDate = item.getElementsByTagName('pubDate')[0]?.textContent || '';
        const descRaw = item.getElementsByTagName('description')[0]?.textContent || '';
        const detail = stripHtml(descRaw).slice(0, 200) || title;
        const date = pubDate ? new Date(pubDate).toISOString().slice(0, 10) : today;
        const category = detectCategory(title);

        if (title) pool.push({ title, source, link, date, detail, category, isWeather: isWeather(title) });
    }

    // 날씨 캡·관심 카테고리 보장 선정
    const selected = selectDaily(pool);

    const articles = selected.map((a, idx) => ({
        id: a.link || `${a.title}_${a.date}`,
        title: a.title,
        source: a.source,
        category: a.category,
        url: a.link,
        detail: a.detail,
        date: a.date,
        importance: Math.max(60, 100 - idx * 5),
    }));

    const outPath = join(__dirname, '..', 'public', 'news.json');
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, JSON.stringify({ fetchedAt: new Date().toISOString(), date: today, articles }, null, 2), 'utf-8');

    console.log(`✅ news.json 저장 완료 — ${articles.length}개 기사 (${today})`);
    articles.forEach((a, i) => console.log(`  ${i + 1}. [${a.category}] ${a.title}`));
}

export { detectCategory, isWeather, selectDaily };

// 직접 실행 시에만 수집 파이프라인 구동 (테스트에서 import할 땐 자동 실행 방지)
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(err => { console.error('❌ 오류:', err); process.exit(1); });
}
