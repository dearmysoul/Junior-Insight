/**
 * /api/growth — 성장 미러: 초기 글 vs 최근 글을 비교해 성장을 짚어준다.
 *  코치 "형"이 구체적으로 뭐가 늘었는지 반말로 격려.
 *  보안·graceful 정책은 /api/coach와 동일.
 */

import Anthropic from '@anthropic-ai/sdk';

const SCHEMA = {
    type: 'object', additionalProperties: false,
    properties: {
        comment: { type: 'string', description: '반말 2~3문장. 초기→최근 사이 무엇이 구체적으로 늘었는지 격려.' },
        focus: { type: 'string', description: '가장 성장한 한 가지(예: 근거가 구체적으로 변함)' },
    },
    required: ['comment', 'focus'],
};

const SYSTEM = `너는 한국 중학생의 논술 코치 "형"이다.
아이의 초기 글과 최근 글을 비교해 성장을 짚어준다.
원칙: 반말. 2~3문장. 막연한 칭찬 금지 — 무엇이 어떻게 달라졌는지 구체적으로.
데이터가 성장을 뚜렷이 보여주지 않으면 솔직하되 기 살리는 방향으로.`;

const ALLOWED_ORIGIN = [/\.vercel\.app$/, /^https?:\/\/localhost(:\d+)?$/, /^https?:\/\/127\.0\.0\.1(:\d+)?$/];
const parse = (msg) => {
    const t = (msg.content.find((c) => c.type === 'text') || {}).text || '{}';
    try { return JSON.parse(t); } catch { return {}; }
};
const clean = (arr) => (Array.isArray(arr) ? arr : []).map((s) => String(s || '').slice(0, 300)).filter(Boolean).slice(0, 5);

export default async function handler(req, res) {
    const origin = req.headers.origin || '';
    if (origin && !ALLOWED_ORIGIN.some((re) => re.test(origin))) {
        return res.status(403).json({ error: 'forbidden_origin' });
    }
    if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
    if (!process.env.ANTHROPIC_API_KEY) return res.status(200).json({ disabled: true });

    const b = (req.body && typeof req.body === 'object') ? req.body : {};
    const early = clean(b.early);
    const recent = clean(b.recent);
    if (early.length === 0 || recent.length === 0) return res.status(400).json({ error: 'missing_fields' });
    const earlyScore = Number.isFinite(b.earlyScore) ? b.earlyScore : null;
    const recentScore = Number.isFinite(b.recentScore) ? b.recentScore : null;

    try {
        const client = new Anthropic();
        const msg = await client.messages.create({
            model: 'claude-opus-4-8', max_tokens: 700,
            output_config: { format: { type: 'json_schema', schema: SCHEMA } },
            system: SYSTEM,
            messages: [{
                role: 'user',
                content: `[초기에 쓴 요약들]\n${early.map((s, i) => `${i + 1}. ${s}`).join('\n')}
${earlyScore != null ? `(초기 평균 점수 ${earlyScore}/15)` : ''}

[최근에 쓴 요약들]\n${recent.map((s, i) => `${i + 1}. ${s}`).join('\n')}
${recentScore != null ? `(최근 평균 점수 ${recentScore}/15)` : ''}

초기와 최근을 비교해 무엇이 성장했는지 짚어줘.`,
            }],
        });
        const d = parse(msg);
        return res.status(200).json({
            comment: String(d.comment || '').slice(0, 400),
            focus: String(d.focus || '').slice(0, 120),
        });
    } catch (e) {
        console.error('growth error:', e && e.message);
        return res.status(200).json({ error: 'growth_failed' });
    }
}
