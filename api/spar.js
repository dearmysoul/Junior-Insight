/**
 * /api/spar — AI 스파링 (반박 → 재반박 → 판정)
 *
 *  action 'challenge' : 아이 의견의 반대 입장에서 AI가 반박(생각 유도용)
 *  action 'judge'     : 아이의 재반박을 평가 → 이겼는지 + 최종 반응
 *
 *  보안·graceful 정책은 /api/coach와 동일(키 없으면 disabled).
 */

import Anthropic from '@anthropic-ai/sdk';

const CHALLENGE_SCHEMA = {
    type: 'object', additionalProperties: false,
    properties: {
        rebuttal: { type: 'string', description: '반말 2~3문장. 반대 입장에서 아이 근거의 약점을 콕 찌르되, 이기려 말고 생각하게.' },
    },
    required: ['rebuttal'],
};
const JUDGE_SCHEMA = {
    type: 'object', additionalProperties: false,
    properties: {
        won: { type: 'boolean', description: '아이 재반박에 진짜 근거가 있으면 true' },
        reply: { type: 'string', description: '반말 2문장. won이면 시원하게 인정(네가 이겼다). 아니면 기 살리며 한 번 더 밀되 끝은 격려.' },
    },
    required: ['won', 'reply'],
};

const SYSTEM = `너는 한국 중학생의 토론 스파링 파트너 "형"이다.
목적은 이기는 게 아니라 아이가 자기 근거를 끝까지 밀어붙이게 만드는 것.
원칙: 반말. 짧게(2~3문장). 인신공격 금지. 아이가 좋은 근거를 대면 시원하게 인정해서 이긴 기분을 줘라.`;

const ALLOWED_ORIGIN = [/\.vercel\.app$/, /^https?:\/\/localhost(:\d+)?$/, /^https?:\/\/127\.0\.0\.1(:\d+)?$/];
const OPINIONS = ['찬성', '반대', '기타'];
const parse = (msg) => {
    const t = (msg.content.find((c) => c.type === 'text') || {}).text || '{}';
    try { return JSON.parse(t); } catch { return {}; }
};

export default async function handler(req, res) {
    const origin = req.headers.origin || '';
    if (origin && !ALLOWED_ORIGIN.some((re) => re.test(origin))) {
        return res.status(403).json({ error: 'forbidden_origin' });
    }
    if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
    if (!process.env.ANTHROPIC_API_KEY) return res.status(200).json({ disabled: true });

    const b = (req.body && typeof req.body === 'object') ? req.body : {};
    const action = b.action === 'judge' ? 'judge' : 'challenge';
    const title = String(b.articleTitle || '').slice(0, 300);
    const passage = String(b.summaryKor || b.detail || '').slice(0, 4000);
    const choice = Number.isInteger(b.choice) ? b.choice : null;
    const reason = String(b.reason || '').slice(0, 500).trim();

    try {
        const client = new Anthropic();

        if (action === 'challenge') {
            if (choice === null || !reason) return res.status(400).json({ error: 'missing_fields' });
            const msg = await client.messages.create({
                model: 'claude-opus-4-8', max_tokens: 512,
                output_config: { format: { type: 'json_schema', schema: CHALLENGE_SCHEMA } },
                system: SYSTEM,
                messages: [{
                    role: 'user',
                    content: `[지문] ${title}\n${passage ? passage + '\n' : ''}[아이 의견] ${OPINIONS[choice] ?? '기타'} / 이유: ${reason}\n\n아이 의견의 반대 입장에서 한 번 반박해봐.`,
                }],
            });
            const d = parse(msg);
            return res.status(200).json({ rebuttal: String(d.rebuttal || '').slice(0, 400) });
        }

        // judge
        const aiRebuttal = String(b.aiRebuttal || '').slice(0, 500);
        const kidRebuttal = String(b.kidRebuttal || '').slice(0, 500).trim();
        if (!kidRebuttal) return res.status(400).json({ error: 'missing_fields' });
        const msg = await client.messages.create({
            model: 'claude-opus-4-8', max_tokens: 512,
            output_config: { format: { type: 'json_schema', schema: JUDGE_SCHEMA } },
            system: SYSTEM,
            messages: [{
                role: 'user',
                content: `[지문] ${title}\n[네(AI) 반박] ${aiRebuttal}\n[아이 재반박] ${kidRebuttal}\n\n아이 재반박에 진짜 근거가 있는지 판정해라.`,
            }],
        });
        const d = parse(msg);
        return res.status(200).json({ won: d.won === true, reply: String(d.reply || '').slice(0, 400) });
    } catch (e) {
        console.error('spar error:', e && e.message);
        return res.status(200).json({ error: 'spar_failed' });
    }
}
