/**
 * fetch-news.js  (ESM)
 * GitHub Actions에서 매일 자동 실행 — Google News RSS → public/news.json
 */

import { DOMParser } from '@xmldom/xmldom';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { kstDateStr } from './curriculum.js';   // KST 기준 날짜(요일제와 동일 기준)

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── 순수 '날씨' 기사 판별 (기후·에너지 등 실질 환경 기사와 구분) ──
// 아이가 가장 쉽게 도망가는 단발성 일기예보 기사를 별도로 표시해 선정 단계에서 제한한다.
const WEATHER_RE = /날씨|기상|기온|강수|강우|강설|호우|대설|태풍|장마|폭염|한파|황사|미세먼지|폭우|소나기|안개|천둥|번개|눈 예보|비 예보|낮 최고|밤 최저|아침 기온|나들이|주말 날씨|오늘 날씨|내일 날씨|이번 주 날씨/;
function isWeather(title) {
    return WEATHER_RE.test(title.toLowerCase());
}

// 날씨 제목 → 배너용 이모지 (학습 카드 아님, 상단 알림 전용)
function weatherEmoji(title) {
    const t = (title || '').toLowerCase();
    if (/눈|대설|한파|영하/.test(t)) return '❄️';
    if (/태풍/.test(t)) return '🌀';
    if (/폭우|호우|장마/.test(t)) return '🌧️';
    if (/비|소나기|강수/.test(t)) return '🌦️';
    if (/미세먼지|황사/.test(t)) return '😷';
    if (/구름|흐림|흐리/.test(t)) return '⛅';
    if (/폭염|무더위|맑음|맑고|더위/.test(t)) return '☀️';
    return '🌤️';
}
function buildWeatherBanner(item) {
    if (!item) return null;
    return { emoji: weatherEmoji(item.title), summary: item.title };
}

// ── 실제 날씨(무료·키 불필요, open-meteo) ─────────────────────
// 뉴스 헤드라인을 '날씨'로 쓰면 클릭베이트 제목이 배너에 뜨는 문제가 있어,
// 실제 서울 현재 날씨를 조회해 "서울 맑음, 28°C" 형태의 알림으로 만든다.
// WMO weather_code → [이모지, 한글 설명]
function wmoToWeather(code) {
    const M = {
        0: ['☀️', '맑음'],
        1: ['🌤️', '대체로 맑음'], 2: ['⛅', '구름 조금'], 3: ['☁️', '흐림'],
        45: ['🌫️', '안개'], 48: ['🌫️', '짙은 안개'],
        51: ['🌦️', '약한 이슬비'], 53: ['🌦️', '이슬비'], 55: ['🌧️', '짙은 이슬비'],
        56: ['🌧️', '얼어붙는 이슬비'], 57: ['🌧️', '얼어붙는 이슬비'],
        61: ['🌦️', '약한 비'], 63: ['🌧️', '비'], 65: ['🌧️', '강한 비'],
        66: ['🌧️', '얼어붙는 비'], 67: ['🌧️', '얼어붙는 비'],
        71: ['🌨️', '약한 눈'], 73: ['🌨️', '눈'], 75: ['❄️', '강한 눈'], 77: ['🌨️', '싸락눈'],
        80: ['🌦️', '소나기'], 81: ['🌧️', '소나기'], 82: ['⛈️', '강한 소나기'],
        85: ['🌨️', '소나기눈'], 86: ['❄️', '강한 소나기눈'],
        95: ['⛈️', '천둥번개'], 96: ['⛈️', '천둥번개·우박'], 99: ['⛈️', '강한 천둥번개'],
    };
    return M[code] || ['🌤️', '오늘의 하늘'];
}

// 서울 현재 날씨 배너. 실패하면 null(배너 미표시) — 혼란스러운 헤드라인보다 안전.
async function fetchWeather() {
    try {
        const url = 'https://api.open-meteo.com/v1/forecast'
            + '?latitude=37.57&longitude=126.98&current=temperature_2m,weather_code&timezone=Asia%2FSeoul';
        const res = await fetch(url, { headers: { 'User-Agent': 'JuniorInsight/1.0' } });
        if (!res.ok) return null;
        const j = await res.json();
        const c = j.current;
        if (!c || typeof c.temperature_2m !== 'number') return null;
        const [emoji, cond] = wmoToWeather(c.weather_code);
        return { emoji, summary: `서울 ${cond}, ${Math.round(c.temperature_2m)}°C` };
    } catch {
        return null;
    }
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
// 시사(Society)·세계(World)·경제(Economy)만 노출. Tech·Environment는 제외.
// (노출 카테고리/개수를 바꾸려면 ALLOWED_CATEGORIES / NEWS_TARGET 만 수정)
// 규칙: 세계(World) 최소 1개 보장 / 동일 카테고리 최대 2개 / 총 NEWS_TARGET개.
const ALLOWED_CATEGORIES = ['Society', 'World', 'Economy'];
const NEWS_TARGET = 4;

function selectDaily(pool) {
    const MAX_PER_CAT = 2;
    // 허용 카테고리 + 날씨 제외 기사만 후보로.
    const eligible = pool.filter(a => ALLOWED_CATEGORIES.includes(a.category) && !a.isWeather);
    const out = [];
    const catCount = {};
    const take = (a) => { out.push(a); catCount[a.category] = (catCount[a.category] || 0) + 1; };
    const canTake = (a) => !out.includes(a) && (catCount[a.category] || 0) < MAX_PER_CAT;

    // 1) 세계(World) 1개 확보 — 시야를 국내로만 좁히지 않도록
    const world = eligible.find(a => a.category === 'World');
    if (world) take(world);

    // 2) 중요도(풀 순서)대로 카테고리 캡을 지키며 채움
    for (const a of eligible) {
        if (out.length >= NEWS_TARGET) break;
        if (canTake(a)) take(a);
    }

    // 3) 그래도 부족하면 카테고리 캡만 완화
    if (out.length < NEWS_TARGET) {
        for (const a of eligible) {
            if (out.length >= NEWS_TARGET) break;
            if (!out.includes(a)) take(a);
        }
    }
    return out.slice(0, NEWS_TARGET);
}

// HTML 태그 제거 + 엔티티 디코딩.
// 태그는 공백으로 치환(단어 붙음 방지). &nbsp;·숫자 엔티티까지 디코딩해
// 화면에 '&nbsp;'가 코드처럼 노출되는 문제를 막는다. &amp;는 마지막에 처리(중복 디코딩 방지).
function stripHtml(html) {
    return (html || '')
        .replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
        .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
        .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCodePoint(parseInt(n, 16)))
        .replace(/&amp;/g, '&')
        .trim();
}

/**
 * Google News RSS → { weather, articles } (뉴스 경로)
 * 주말·미온보딩 교과일의 폴백으로 generate-content.js에서도 재사용.
 */
async function buildNews() {
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

    const today = kstDateStr();
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
        // Google News 설명은 연관 헤드라인 나열(구분자 &nbsp;&nbsp; → 여러 공백)이라
        // 첫 조각만 취하고, 비거나 제목과 같으면 제목으로 폴백(코드 같은 덩어리 방지).
        let detail = stripHtml(descRaw).split(/\s{2,}/)[0].trim();
        if (detail.length < 15 || detail === title) detail = title;
        detail = detail.slice(0, 200);
        const date = pubDate ? new Date(pubDate).toISOString().slice(0, 10) : today;
        const category = detectCategory(title);

        if (title) pool.push({ title, source, link, date, detail, category, isWeather: isWeather(title) });
    }

    // 날씨 배너는 실제 서울 날씨(open-meteo). 조회 실패 시 null(배너 미표시).
    const weather = await fetchWeather();
    // 관심 카테고리 보장 선정 (날씨 제외한 풀에서)
    const selected = selectDaily(pool.filter(a => !a.isWeather));

    const articles = selected.map((a, idx) => ({
        id: a.link || `${a.title}_${a.date}`,
        type: 'news',
        title: a.title,
        source: a.source,
        category: a.category,
        url: a.link,
        detail: a.detail,
        date: a.date,
        importance: Math.max(60, 100 - idx * 5),
    }));

    return { weather, articles };
}

async function main() {
    const today = kstDateStr();
    const { weather, articles } = await buildNews();

    const outPath = join(__dirname, '..', 'public', 'news.json');
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, JSON.stringify({ fetchedAt: new Date().toISOString(), date: today, weather, articles }, null, 2), 'utf-8');

    console.log(`✅ news.json 저장 완료 — ${articles.length}개 기사${weather ? ` + 날씨 배너("${weather.summary}")` : ''} (${today})`);
    articles.forEach((a, i) => console.log(`  ${i + 1}. [${a.category}] ${a.title}`));
}

export { detectCategory, isWeather, selectDaily, weatherEmoji, buildWeatherBanner, buildNews, fetchWeather };

// 직접 실행 시에만 수집 파이프라인 구동 (테스트에서 import할 땐 자동 실행 방지)
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(err => { console.error('❌ 오류:', err); process.exit(1); });
}
