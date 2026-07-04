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
import { pickPlan, planForSubject } from './curriculum.js';
import { buildNews } from './fetch-news.js';

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
    },
    required: ['title_kor', 'summary_kor', 'keywords', 'hanja_terms', 'check_question'],
};

// ── 팩트체크 스키마 ──────────────────────────────────────────
const FACTCHECK_SCHEMA = {
    type: 'object',
    additionalProperties: false,
    properties: {
        ok: { type: 'boolean' },
        anchor: { type: 'string', description: '지문이 근거한 검증 가능한 핵심 사실' },
        issues: { type: 'array', items: { type: 'string' } },
        hanja_ok: { type: 'boolean', description: '모든 한자·훈음이 정확한가' },
    },
    required: ['ok', 'anchor', 'issues', 'hanja_ok'],
};

const GEN_SYSTEM = `너는 한국 중학교 2022 개정 교육과정 기반 학습 콘텐츠 작가다.
규칙(위반 금지):
1. 반드시 주어진 성취기준 단원 범위 안에서만 쓴다.
2. 검증 가능한 사실만. 연도·수치·인명은 확실한 것만(불확실하면 쓰지 마라).
3. 교과서 문체 금지. 읽기 싫어하는 중학생 남학생이 "어? 왜?" 하게 만드는
   실화·사건·미스터리 형식. 지문은 3단락(배경→사실→의미), 각 100~180자, 총 400자 이상.
4. 난이도 '중상'. 한자어를 자연스럽게 쓰고, 그중 3~4개를 hanja_terms로 풀이(한자·훈음·뜻).
5. check_question은 답을 묻지 말고 지문 근거로 생각하게 하라.`;

const FACT_SYSTEM = `너는 교육 콘텐츠 팩트체커다. 주어진 지문에서
(1) 사실 오류(연도·수치·인명·인과), (2) 한자어의 한자·훈음 오류를 엄격히 검사한다.
확실히 검증되는 앵커 사실을 anchor에 적고, 문제를 issues에 나열한다.
의심스러우면 ok=false.`;

const clampArr = (a, n) => (Array.isArray(a) ? a.slice(0, n) : []);
const parse = (msg) => {
    const t = (msg.content.find((c) => c.type === 'text') || {}).text || '{}';
    try { return JSON.parse(t); } catch { return {}; }
};

/**
 * 교과 지문 생성 + 팩트체크. 키 없으면 null(→뉴스 폴백).
 * @returns {Promise<object|null>} lesson article
 */
export async function generateLesson(plan, today) {
    if (!process.env.ANTHROPIC_API_KEY) return null;
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
[성취기준] ${plan.unit.code} · ${plan.unit.statement}
[소재] ${plan.topic || '자유(아이 관심)'}
${plan.literaryOriginal
    ? '※ 문학: 실제 작품(시·소설) 인용 절대 금지. 저작권 문제 없는 AI 창작 짧은 지문(시 또는 이야기, 300~400자)을 직접 지어라. hanja_terms는 지문 속 한자어로.'
    : '위 성취기준에 맞는 지문 1편을 규칙대로 써라.'}`,
        }],
    });
    const d = parse(gen);
    if (!d.title_kor || !d.summary_kor) return null;

    // 2) 팩트체크 (사실 + 한자)
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
    const v = parse(fc);
    // 문학(창작 지문)은 검증할 '사실'이 없으므로 한자만 검사, 그 외는 사실+한자 모두 검사.
    const factFail = plan.literaryOriginal ? false : v.ok === false;
    // 검증 실패 시 이 날은 뉴스로 폴백(오답 노출 방지)
    if (factFail || v.hanja_ok === false) {
        console.warn('⚠️ 팩트체크 실패 → 뉴스 폴백:', (v.issues || []).join('; '));
        return null;
    }

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
        factcheck: { status: 'verified', anchor: v.anchor || '', hanja_checked: v.hanja_ok !== false },
        difficulty: plan.difficulty || 3,
        date: today,
        importance: 100,
    };
}

async function main() {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    // FORCE_SUBJECT 있으면 요일 무관하게 그 교과 강제(수동 테스트). 없거나 미온보딩이면 요일 편성.
    const forced = (process.env.FORCE_SUBJECT || '').trim();
    const plan = (forced && planForSubject(forced, now)) || pickPlan(now);
    if (forced) console.log(`🔧 FORCE_SUBJECT="${forced}" → ${plan.mode}${plan.subject ? ` · ${plan.subject}` : ''}`);
    console.log(`📅 ${today} (${plan.weekday}) → ${plan.mode}${plan.subject ? ` · ${plan.subject}` : ''}`);

    // 날씨 배너는 항상 뉴스 파이프라인에서 추출
    let weather = null, articles = null, subjectOfDay = null;

    if (plan.mode === 'lesson') {
        const lesson = await generateLesson(plan, today);
        if (lesson) {
            articles = [lesson];
            subjectOfDay = plan.subject;
            try { ({ weather } = await buildNews()); } catch { weather = null; } // 날씨만
            console.log(`📘 교과 생성 완료 — ${plan.subject} · ${plan.unit.code}`);
        } else {
            console.log('↩️ 교과 생성 불가(키 미등록/검증 실패) → 뉴스 폴백');
        }
    }

    if (!articles) {
        ({ weather, articles } = await buildNews());
    }

    const payload = { fetchedAt: new Date().toISOString(), date: today, weekday: plan.weekday, weather, articles };
    if (subjectOfDay) payload.subject_of_day = subjectOfDay;

    const outPath = join(__dirname, '..', 'public', 'news.json');
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf-8');
    console.log(`✅ news.json 저장 — ${articles.length}개 (${articles[0]?.type})${weather ? ` + 날씨 배너` : ''}`);
}

// 직접 실행 시에만 구동
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch((err) => { console.error('❌ 오류:', err); process.exit(1); });
}
