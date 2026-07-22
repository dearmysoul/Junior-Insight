/**
 * generate-content.js — 요일제 콘텐츠 생성기
 *
 *  요일 → pickPlan → lesson(교과) or news(뉴스)
 *   · lesson: 성취기준 고정 → Claude 생성 → 팩트체크(사실+한자) → 저장
 *   · news / 키 미등록 / 미온보딩 교과 → buildNews() 뉴스 폴백
 *
 *  ANTHROPIC_API_KEY 없으면 교과 생성을 건너뛰고 뉴스로 폴백(안전).
 *  GitHub Actions에서는 secrets.ANTHROPIC_API_KEY 로 주입.
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import Anthropic from '@anthropic-ai/sdk';
import { pickPlan, planForSubject, kstDateStr } from './curriculum.js';
import { buildNews, fetchWeather } from './fetch-news.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── 지문 생성 스키마 (구조화 출력) ─────────────────────────────
const LESSON_SCHEMA = {
    type: 'object',
    additionalProperties: false,
    properties: {
        title_kor: { type: 'string', description: "훅 형식 제목 — '어? 왜?' 하게" },
        summary_kor: { type: 'string', description: '지문 3단락(배경/사실/의미), \\n\\n 구분, 중상 난이도' },
        keywords: { type: 'array', items: { type: 'string' } },
        hanja_terms: {
            type: 'array',
            items: {
                type: 'object', additionalProperties: false,
                properties: {
                    word: { type: 'string' },
                    hanja: { type: 'string' },
                    gloss: { type: 'string', description: '훈음 · 훈음 → 뜻' },
                },
                required: ['word', 'hanja', 'gloss'],
            },
        },
        check_question: { type: 'string', description: '답을 묻지 말고 지문 근거로 생각하게' },
        argument: {
            type: 'object', additionalProperties: false,
            description: '"나의 주장" 미션용 — 지문 내용에 맞는 열린 질문 + 선택지 (억지 찬반 금지)',
            properties: {
                claim: { type: 'string', description: '지문 내용에 맞는, 정답이 하나로 정해지지 않는 한 줄 질문. 지문 성격에 따라 쟁점(찬반)·판단·해석 어느 형태든 가능 (예: "게임 확률 공개, 꼭 필요할까?" / "예측과 대응 중 무엇이 더 중요할까?")' },
                options: {
                    type: 'array', items: { type: 'string' },
                    description: '질문에 맞는 선택지 2~3개. 질문이 찬반이면 찬/반, 판단·선택형이면 실제 선택지. 마지막에 "잘 모르겠다"·"둘 다 중요" 같은 유보 선택지를 둘 수 있다(필수 아님).',
                },
            },
            required: ['claim', 'options'],
        },
    },
    required: ['title_kor', 'summary_kor', 'keywords', 'hanja_terms', 'check_question', 'argument'],
};

// ── 팩트체크 스키마 ──────────────────────────────────────────
const FACTCHECK_SCHEMA = {
    type: 'object',
    additionalProperties: false,
    properties: {
        ok: { type: 'boolean', description: '지문에 사실 오류가 전혀 없는가' },
        severe: { type: 'boolean', description: '아이가 명백히 잘못 배울 수준의 핵심 오류가 있는가(주체·존재 여부·인과가 반대, 세기 단위의 연대 착오 등). 표현상 근사·시대 구분의 애매함·사소한 뉘앙스는 severe 아님' },
        anchor: { type: 'string', description: '지문이 근거한 검증 가능한 핵심 사실' },
        issues: { type: 'array', items: { type: 'string' } },
        hanja_ok: { type: 'boolean', description: '모든 한자·훈음이 정확한가' },
    },
    required: ['ok', 'severe', 'anchor', 'issues', 'hanja_ok'],
};

/* ── 교과 통과 정책 (완화) ──────────────────────────────────
   팩트체크에서 문제가 나와도 바로 뉴스로 버리지 않는다:
     1) 지적된 부분만 1회 수정 재생성 → 재검사
     2) 그래도 '심각한(severe)' 사실오류면 그때만 뉴스 폴백
     3) 한자만 틀리면 지문은 살리고 한자 풀이(hanja_terms)만 제거
   옛 동작(사소한 오류도 폴백)으로 되돌리려면 STRICT_FACTCHECK=true. */
const STRICT_FACTCHECK = false;
const MAX_FIX_PASSES = 1;

const GEN_SYSTEM = `너는 한국 중학교 2022 개정 교육과정 기반 학습 콘텐츠 작가다.
규칙(위반 금지):
1. 반드시 주어진 성취기준 단원 범위 안에서만 쓴다.
2. 검증 가능한 사실만. 연도·수치·인명은 확실한 것만(불확실하면 쓰지 마라).
3. 교과서 문체 금지. 읽기 싫어하는 중학생 남학생이 "어? 왜?" 하게 만드는
   실화·사건·미스터리 형식. 지문은 3단락(배경→사실→의미), 각 100~180자, 총 400자 이상.
4. 난이도 '중상'. 한자어를 자연스럽게 쓰고, 그중 3~4개를 hanja_terms로 풀이(한자·훈음·뜻).
5. check_question은 답을 묻지 말고 지문 근거로 생각하게 하라.
6. argument는 '나의 주장' 미션용 질문이다. 지문 내용에 맞는, 정답이 하나로
   정해지지 않는 열린 질문 하나(claim)와 아이가 고를 선택지 2~3개(options)를 만든다.
   지문 성격에 맞춰라(억지 찬반 금지):
   · 쟁점형(비문학·사회 등): 찬반이 갈리는 질문 + 찬/반/유보 선택지
     (예: '확률 공개, 꼭 필요할까?' → 필요하다/필요없다/잘 모르겠다)
   · 판단·선택형(과학·설명문 등): 지문 근거로 판단·선택하는 질문 + 실제 선택지
     (예: '재해를 줄이려면 예측과 대응 중 무엇이 더 중요할까?' → 예측/대응/둘 다 중요)
   · 해석·공감형(문학): 인물·화자에 대한 해석/입장 질문 + 선택지
   어떤 형태든 아이가 지문 근거로 자기 입장을 고르고 이유를 댈 수 있어야 한다
   (단순 사실 확인 질문 금지).`;

const FACT_SYSTEM = `너는 교육 콘텐츠 팩트체커다. 주어진 지문에서
(1) 사실 오류(연도·수치·인명·인과), (2) 한자어의 한자·훈음 오류를 검사한다.
확실히 검증되는 앵커 사실을 anchor에, 발견한 문제를 issues에 나열한다.
- ok: 사실 오류가 하나도 없으면 true, 하나라도 있으면 false.
- severe: 아이가 그 문장 때문에 명백히 틀린 사실을 배울 정도의 핵심 오류일 때만 true.
  (사건 주체·존재 여부·인과가 반대이거나, 세기 단위의 연대 착오 등)
  표현상의 근사·시대 구분의 애매함·사소한 뉘앙스 차이는 issues에 적되 severe=false로 둔다.
- hanja_ok: 한자·훈음이 모두 정확하면 true.`;

const clampArr = (a, n) => (Array.isArray(a) ? a.slice(0, n) : []);
const parse = (msg) => {
    const t = (msg.content.find((c) => c.type === 'text') || {}).text || '{}';
    try { return JSON.parse(t); } catch { return {}; }
};

// 토큰 사용량 누적(모니터링용). msg.usage는 API가 돌려주는 실측값.
const addUsage = (metrics, msg) => {
    const u = (msg && msg.usage) || {};
    metrics.tokensIn = (metrics.tokensIn || 0) + (u.input_tokens || 0);
    metrics.tokensOut = (metrics.tokensOut || 0) + (u.output_tokens || 0);
};

/** 지문 1편을 팩트체크(사실+한자)한다. */
async function runFactcheck(client, d, metrics) {
    const fc = await client.messages.create({
        model: 'claude-opus-4-8',
        max_tokens: 1024,
        output_config: { format: { type: 'json_schema', schema: FACTCHECK_SCHEMA } },
        system: FACT_SYSTEM,
        messages: [{
            role: 'user',
            content: `[제목] ${d.title_kor}
[지문] ${d.summary_kor}
[한자어] ${JSON.stringify(d.hanja_terms)}`,
        }],
    });
    addUsage(metrics, fc);
    return parse(fc);
}

/** 팩트체커가 지적한 부분만 고쳐 지문을 1회 재생성. 실패하면 원본 유지. */
async function correctLesson(client, d, issues, plan, metrics) {
    const res = await client.messages.create({
        model: 'claude-opus-4-8',
        max_tokens: 2048,
        output_config: { format: { type: 'json_schema', schema: LESSON_SCHEMA } },
        system: GEN_SYSTEM,
        messages: [{
            role: 'user',
            content: `아래 지문에서 팩트체커가 지적한 문제만 정확히 고쳐 다시 써라.
지적되지 않은 부분·구성·형식·난이도는 그대로 유지한다.
확실하지 않은 사실은 단정하지 말고 안전한 표현으로 바꾼다.

[교과] ${plan.subject}
[주제] ${plan.unit.code} · ${plan.unit.statement}

[원본 제목] ${d.title_kor}
[원본 지문] ${d.summary_kor}
[원본 한자어] ${JSON.stringify(d.hanja_terms)}

[팩트체커 지적]
${(issues || []).map((s, i) => `${i + 1}. ${s}`).join('\n')}`,
        }],
    });
    addUsage(metrics, res);
    const fixed = parse(res);
    return (fixed.title_kor && fixed.summary_kor) ? fixed : d;
}

/**
 * 교과 지문 생성 + 팩트체크. 키 없으면 null(→뉴스 폴백).
 * @param {object} [metrics] 있으면 model·토큰·팩트체크 결과를 채워 넣는다(모니터링).
 * @returns {Promise<object|null>} lesson article
 */
export async function generateLesson(plan, today, metrics = {}) {
    metrics.model = 'claude-opus-4-8';
    if (!process.env.ANTHROPIC_API_KEY) { metrics.factcheck = 'no_key'; return null; }
    const client = new Anthropic();

    // 1) 생성
    const gen = await client.messages.create({
        model: 'claude-opus-4-8',
        max_tokens: 2048,
        output_config: { format: { type: 'json_schema', schema: LESSON_SCHEMA } },
        system: GEN_SYSTEM,
        messages: [{
            role: 'user',
            content: `[교과] ${plan.subject}
[주제] ${plan.unit.code} · ${plan.unit.statement}
[소재] ${plan.topic || '자유(아이 관심)'}
${plan.generalKnowledge
    ? '※ 일반상식: 학교 교과가 아니라 청소년이 알아두면 좋은 흥미로운 교양(예술·금융 등)이다. 반드시 실존하는 검증 가능한 사실(실제 명화·예술가·금융 개념·경제 상식 등)만 다뤄라. "어? 그렇구나!" 하게 3단락(배경→사실→의미)으로 쓰고, hanja_terms는 지문 속 한자어로 풀이하라.'
    : plan.literaryOriginal
        ? '※ 문학: 실제 작품(시·소설) 인용 절대 금지. 저작권 문제 없는 AI 창작 짧은 지문(시 또는 이야기, 300~400자)을 직접 지어라. hanja_terms는 지문 속 한자어로.'
        : '위 성취기준에 맞는 지문 1편을 규칙대로 써라.'}`,
        }],
    });
    addUsage(metrics, gen);
    const d = parse(gen);
    if (!d.title_kor || !d.summary_kor) { metrics.factcheck = 'gen_fail'; return null; }

    // 2) 팩트체크 (사실 + 한자)
    let v = await runFactcheck(client, d, metrics);

    // 문학(창작 지문)은 검증할 '사실'이 없으므로 사실 판정은 통과, 한자만 본다.
    const factBad = (fc) => !plan.literaryOriginal && fc.ok === false;
    const factSevere = (fc) => STRICT_FACTCHECK ? factBad(fc) : (factBad(fc) && fc.severe === true);
    const hanjaBad = (fc) => fc.hanja_ok === false;

    // 3) 문제가 있으면 지적된 부분만 1회 수정 → 재검사 (웬만하면 통과시키기)
    let fixed = false;
    if ((factBad(v) || hanjaBad(v)) && MAX_FIX_PASSES > 0) {
        console.warn('🔧 팩트체크 지적 → 수정 재생성:', (v.issues || []).join('; '));
        d = await correctLesson(client, d, v.issues, plan, metrics);
        v = await runFactcheck(client, d, metrics);
        fixed = true;
    }

    // 4) 최종 판정: '심각한' 사실오류일 때만 뉴스 폴백. 나머지는 지문을 살린다.
    if (factSevere(v)) {
        metrics.factcheck = 'fact_fail';
        metrics.issues = (v.issues || []).slice(0, 5);
        console.warn('⚠️ 심각한 사실오류 → 뉴스 폴백:', (v.issues || []).join('; '));
        return null;
    }

    // 5) 한자만 여전히 틀리면 지문은 살리고 한자 풀이만 제거(오답 노출 방지, 지문 유지)
    let hanjaChecked = true;
    if (hanjaBad(v)) {
        d.hanja_terms = [];
        hanjaChecked = false;
        console.warn('✂️ 한자 검증 실패 → 한자 풀이만 제거하고 지문 유지');
    }

    // 통과 — 경미한 이슈는 로그로 남기되 지문을 유지한다.
    const minorIssues = (v.issues || []).filter(Boolean);
    metrics.factcheck = fixed ? 'verified_after_fix' : (minorIssues.length ? 'passed_minor' : 'verified');
    if (minorIssues.length) metrics.issues = minorIssues.slice(0, 5);

    return {
        id: `lesson-${today.replace(/-/g, '')}-01`,
        type: 'lesson',
        subject: plan.subject,
        unit: `${plan.unit.statement} [${plan.unit.code}]`,
        title_kor: d.title_kor,
        source: `교육과정 학습 · ${plan.subject}`,
        country: 'KR',
        category: plan.topicCategory || 'Society',
        summary_kor: d.summary_kor,
        keywords: clampArr(d.keywords, 6),
        hanja_terms: clampArr(d.hanja_terms, 5),
        check_question: d.check_question || '',
        argument: (d.argument && d.argument.claim && Array.isArray(d.argument.options))
            ? { claim: d.argument.claim, options: clampArr(d.argument.options, 3) }
            : null,
        factcheck: { status: metrics.factcheck, anchor: v.anchor || '', hanja_checked: hanjaChecked },
        difficulty: plan.difficulty || 3,
        date: today,
        importance: 100,
    };
}

/* ── 뉴스 재해석 (교과 미통과 시에만) ─────────────────────────
   뉴스는 교과 지문이 통과하지 못한 날에만 노출한다. 그 뉴스만 Haiku로
   아이 눈높이 본문(summary_kor)+키워드를 붙인다(제목만 나오던 문제 해결).
   교과 지문은 지금처럼 Opus. */
const NEWS_MODEL = 'claude-haiku-4-5';
const NEWS_SCHEMA = {
    type: 'object', additionalProperties: false,
    properties: {
        items: {
            type: 'array',
            items: {
                type: 'object', additionalProperties: false,
                properties: {
                    summary_kor: { type: 'string', description: '아이 눈높이 2~3문단, 쉬운 말. 한자어는 괄호로 뜻풀이' },
                    keywords: { type: 'array', items: { type: 'string' } },
                    difficulty: { type: 'integer', enum: [1, 2, 3] },
                },
                required: ['summary_kor', 'keywords', 'difficulty'],
            },
        },
    },
    required: ['items'],
};
const NEWS_SYSTEM = `너는 청소년(중학생) 눈높이 뉴스 해설가다. 각 뉴스 '제목'을 받아
아이가 배경과 요지를 이해하도록 2~3문단으로 쉽게 풀어 쓴다.
- 한 문장에 한 가지 정보. 짧고 쉬운 말.
- 한자어는 괄호로 뜻을 덧붙인다. 예: 쟁의(다툼)
- 제목이 말하는 범위 안에서만 설명하고, 확실하지 않은 세부 사실은 단정하지 않는다.
- keywords: 핵심어 2~4개. difficulty: 1(쉬움)~3(어려움).`;

/** 뉴스 기사들에 Haiku로 아이용 본문(summary_kor)+키워드를 붙인다. 키 없거나 실패하면 원본(제목만) 유지. */
export async function summarizeNews(articles, metrics = {}) {
    if (!process.env.ANTHROPIC_API_KEY || !articles.length) return articles;
    try {
        const client = new Anthropic();
        const list = articles.map((a, i) => `[${i + 1}] (${a.category}) ${a.title}`).join('\n');
        const res = await client.messages.create({
            model: NEWS_MODEL,
            max_tokens: 2048,
            output_config: { format: { type: 'json_schema', schema: NEWS_SCHEMA } },
            system: NEWS_SYSTEM,
            messages: [{ role: 'user', content: `다음 뉴스 ${articles.length}개를 순서대로 해설하라. items 길이는 정확히 ${articles.length}개여야 한다.\n${list}` }],
        });
        metrics.newsModel = NEWS_MODEL;
        addUsage(metrics, res);
        const items = parse(res).items || [];
        return articles.map((a, i) => {
            const s = items[i] || {};
            return s.summary_kor
                ? { ...a, summary_kor: s.summary_kor, detail: s.summary_kor, keywords: clampArr(s.keywords, 4), difficulty: s.difficulty || 1, country: '대한민국' }
                : a;   // 해당 항목 해설 실패 시 원본(제목) 유지
        });
    } catch (e) {
        console.warn('⚠️ 뉴스 해설 실패(제목만 유지):', e && e.message);
        return articles;
    }
}

async function main() {
    const now = new Date();
    const today = kstDateStr(now);   // KST 기준 날짜(요일 편성과 동일 기준)
    // FORCE_SUBJECT 있으면 요일 무관하게 그 교과 강제(수동 테스트). 없거나 미온보딩이면 요일 편성.
    const forced = (process.env.FORCE_SUBJECT || '').trim();
    const plan = (forced && planForSubject(forced, now)) || pickPlan(now);
    if (forced) console.log(`🔧 FORCE_SUBJECT="${forced}" → ${plan.mode}${plan.subject ? ` · ${plan.subject}` : ''}`);
    console.log(`📅 ${today} (${plan.weekday}) → ${plan.mode}${plan.subject ? ` · ${plan.subject}` : ''}`);

    let weather = null, articles = null, subjectOfDay = null;
    const metrics = {};   // 생성 모니터링(모델·토큰·팩트체크 결과)

    if (plan.mode === 'lesson') {
        const lesson = await generateLesson(plan, today, metrics);
        if (lesson) {
            subjectOfDay = plan.subject;
            // 교과가 통과하면 지문만 제공(뉴스는 붙이지 않는다). 날씨 배너만 별도 조회.
            articles = [lesson];
            try { weather = await fetchWeather(); } catch { weather = null; }
            console.log(`📘 교과 생성 완료 — ${plan.subject} · ${plan.unit.code} (지문만, 뉴스 미부착)`);
        } else {
            console.log('↩️ 교과 생성 불가(키 미등록/검증 실패) → 뉴스 폴백');
        }
    }

    if (!articles) {
        // 교과 미통과 → 이때만 뉴스 노출. 선정된 뉴스에 Haiku로 아이용 본문을 붙인다.
        const nb = await buildNews();
        weather = nb.weather;
        articles = await summarizeNews(nb.articles, metrics);
    }

    const payload = { fetchedAt: new Date().toISOString(), date: today, weekday: plan.weekday, weather, articles };
    if (subjectOfDay) payload.subject_of_day = subjectOfDay;

    // 생성 모니터링 메타 — 앱은 무시, CLAUDE.md 감시 루틴/운영자가 팩트체크·비용 확인용.
    // factcheck: verified | verified_after_fix | passed_minor | fact_fail | gen_fail | no_key | (lesson 아니면 news_only)
    const tokensTotal = (metrics.tokensIn || 0) + (metrics.tokensOut || 0);
    payload.generation = {
        mode: plan.mode,
        subject: plan.subject || null,
        factcheck: metrics.factcheck || (plan.mode === 'lesson' ? 'unknown' : 'news_only'),
        fell_back_to_news: plan.mode === 'lesson' && articles[0]?.type !== 'lesson',
        model: metrics.model || null,
        ...(metrics.newsModel ? { news_model: metrics.newsModel } : {}),
        tokens: { input: metrics.tokensIn || 0, output: metrics.tokensOut || 0, total: tokensTotal },
        ...(metrics.issues && metrics.issues.length ? { factcheck_issues: metrics.issues } : {}),
    };

    const outPath = join(__dirname, '..', 'public', 'news.json');
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf-8');
    console.log(`✅ news.json 저장 — ${articles.length}개 (${articles[0]?.type})${weather ? ` + 날씨 배너` : ''}`);
    console.log(`📊 모니터링 — 팩트체크:${payload.generation.factcheck} | 토큰:${tokensTotal.toLocaleString()}(in ${metrics.tokensIn || 0}/out ${metrics.tokensOut || 0})${payload.generation.fell_back_to_news ? ' | ⚠️뉴스폴백' : ''}`);
}

// 직접 실행 시에만 구동
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch((err) => { console.error('❌ 오류:', err); process.exit(1); });
}
