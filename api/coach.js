/**
 * /api/coach — AI 논술 코치 (Vercel 서버리스 함수, Node)
 *
 * 보안 설계:
 *  · Anthropic 키는 서버 환경변수(process.env.ANTHROPIC_API_KEY)에서만 읽는다.
 *    절대 VITE_ 접두사 금지 — 클라이언트 번들에 노출되면 안 됨.
 *  · 가드 ② origin 화이트리스트 (스크립트 남용 문턱↑)
 *  · 가드 ④ 입력 길이·필수값 검증 (대형 페이로드 비용 폭탄 방지)
 *  · 키 미등록 시 { disabled:true } 반환 → 앱이 깨지지 않고 기존 동작으로 폴백
 */

import Anthropic from '@anthropic-ai/sdk';

// 구조화 출력 스키마 — 채점을 JSON으로 강제 (파싱 안정성)
const RUBRIC_SCHEMA = {
    type: 'object',
    additionalProperties: false,
    properties: {
        feedback: { type: 'string', description: '반말 2문장 이내. 답 대신 되묻기.' },
        followup: { type: 'string', description: '다시 생각하게 만드는 질문 1개' },
        scores: {
            type: 'object',
            additionalProperties: false,
            properties: {
                clarity: { type: 'integer' },   // 요약 명료성 0~5
                evidence: { type: 'integer' },  // 근거 구체성 0~5
                vocab: { type: 'integer' },     // 어휘 정확성 0~5
            },
            required: ['clarity', 'evidence', 'vocab'],
        },
    },
    required: ['feedback', 'followup', 'scores'],
};

const SYSTEM = `너는 한국 중학생의 논술 코치 "형"이다.
원칙(절대 위반 금지):
1. 답을 대신 써주지 마라. 아이 안의 생각을 질문으로 끌어내라(산파).
2. 글자 수가 아니라 근거의 구체성과 논리를 본다. "그냥","좋아서" 같은 빈 근거는 반드시 되물어라.
3. 반말. 2문장 이내. 짧고 즉각적으로. 훈계 금지, 기 살리기.
scores는 실제 사고의 질로 매겨라(길다고 무조건 고점 아님).`;

const ALLOWED_ORIGIN = [/\.vercel\.app$/, /^https?:\/\/localhost(:\d+)?$/, /^https?:\/\/127\.0\.0\.1(:\d+)?$/];
const clampScore = (n) => Math.max(0, Math.min(5, Math.round(Number(n) || 0)));
const OPINIONS = ['찬성', '반대', '기타'];

export default async function handler(req, res) {
    // 가드 ② origin — 헤더가 있을 때만 검사(없으면 서버-서버/개발 호출로 간주)
    const origin = req.headers.origin || '';
    if (origin && !ALLOWED_ORIGIN.some((re) => re.test(origin))) {
        return res.status(403).json({ error: 'forbidden_origin' });
    }
    if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

    // 키 미등록 → graceful disabled (앱이 폴백 동작)
    if (!process.env.ANTHROPIC_API_KEY) {
        return res.status(200).json({ disabled: true });
    }

    // 가드 ④ 입력 검증 + 길이 상한
    const b = (req.body && typeof req.body === 'object') ? req.body : {};
    const summary = String(b.summary || '').slice(0, 500).trim();
    const reason = String(b.reason || '').slice(0, 500).trim();
    const word = String(b.word || '').slice(0, 100).trim();
    const title = String(b.articleTitle || '').slice(0, 300);
    const passage = String(b.summaryKor || b.detail || '').slice(0, 4000);
    const checkQ = String(b.checkQuestion || '').slice(0, 500);
    const choice = Number.isInteger(b.choice) ? b.choice : null;
    const opinionOptions = Array.isArray(b.opinionOptions) ? b.opinionOptions : null;
    if (!summary || choice === null || !reason || !word) {
        return res.status(400).json({ error: 'missing_fields' });
    }

    try {
        const client = new Anthropic(); // 키는 env에서 자동
        const msg = await client.messages.create({
            model: 'claude-opus-4-8',
            max_tokens: 1024,
            output_config: { format: { type: 'json_schema', schema: RUBRIC_SCHEMA } },
            system: SYSTEM,
            messages: [{
                role: 'user',
                content: `[지문/기사] ${title}
${passage ? `[본문] ${passage}\n` : ''}${checkQ ? `[되물음 시드] ${checkQ}\n` : ''}--- 아이가 쓴 것 ---
① 한 문장 요약: ${summary}
② 의견(선택): ${(opinionOptions ?? OPINIONS)[choice] ?? '기타'} / 이유: ${reason}
③ 핵심 단어: ${word}

세 가지를 채점하고, 가장 약한 부분 하나만 골라 되물어라.`,
            }],
        });

        const text = (msg.content.find((c) => c.type === 'text') || {}).text || '{}';
        let data;
        try { data = JSON.parse(text); } catch { data = {}; }

        return res.status(200).json({
            feedback: String(data.feedback || '').slice(0, 400),
            followup: String(data.followup || '').slice(0, 400),
            scores: {
                clarity: clampScore(data.scores && data.scores.clarity),
                evidence: clampScore(data.scores && data.scores.evidence),
                vocab: clampScore(data.scores && data.scores.vocab),
            },
        });
    } catch (e) {
        console.error('coach error:', e && e.message);
        // 실패해도 앱이 미션을 완료할 수 있게 폴백 신호
        return res.status(200).json({ error: 'coach_failed' });
    }
}
