/**
 * curriculum.js — 요일제 교과 편성 + 성취기준 (2022 개정 교육과정)
 *
 * 온보딩 순서: 비문학 → 사회 → 과학 (합의됨).
 * 아직 온보딩 안 된 교과는 active:false → 뉴스로 폴백(성취기준 코드 날조 방지).
 * 학년: 중1~3 통합, 난이도 중상(3).
 */

// 요일(0=일~6=토) → 교과. 주말(토·일)은 일반상식(예술·금융 등 교양).
export const SUBJECT_BY_WEEKDAY = {
    1: '국어 · 비문학',
    2: '과학',
    3: '역사',
    4: '국어 · 문학',
    5: '사회',
    6: '일반상식',   // 토
    0: '일반상식',   // 일
};

export const CURRICULUM = {
    '국어 · 비문학': {
        active: true,                 // ✅ 온보딩 완료 (시작 교과)
        difficulty: 3,                // 중상
        topicCategory: 'Tech & Economy',
        topicPool: ['게임/IT', '과학기술', '사회 쟁점', '스포츠', '생활·소비'], // 랜덤 소재
        // 2022 개정 중학교 국어 '읽기(9국02)' — 검증된 실제 성취기준
        units: [
            { code: '9국02-03', statement: '읽기 목적이나 글의 특성을 고려하여 글 내용을 요약한다' },
            { code: '9국02-04', statement: '글에 사용된 다양한 설명 방법을 파악하며 읽는다' },
            { code: '9국02-05', statement: '글에 사용된 다양한 논증 방법을 파악하며 읽는다' },
            { code: '9국02-06', statement: '동일한 화제를 다룬 여러 글을 읽으며 관점과 형식의 차이를 파악한다' },
            { code: '9국02-07', statement: '매체에 드러난 다양한 표현 방법과 의도를 평가하며 읽는다' },
        ],
    },
    // 사회·과학·역사·문학 — v1 온보딩.
    // 국어(9국02)는 검증된 성취기준 코드, 나머지는 2022 개정 교육과정 '영역·단원 주제' 기반
    // (정확한 성취기준 코드는 교과서/NCIC로 확정해 code에 교체 — HANDOFF.md 참조).
    '사회': {
        active: true, difficulty: 3, topicCategory: 'Society',
        topicPool: ['인권·법', '민주주의·정치', '경제생활', '사회문제', '문화·다양성'],
        units: [
            { code: '사회·정치', statement: '민주주의와 시민의 참여, 정치 과정을 이해한다' },
            { code: '사회·경제', statement: '합리적 선택과 시장·소비 생활을 이해한다' },
            { code: '사회·인권', statement: '인권과 법, 헌법이 보장하는 기본권을 이해한다' },
            { code: '사회·문화', statement: '문화의 다양성과 사회 변동을 이해한다' },
            { code: '사회·쟁점', statement: '사회적 쟁점을 다양한 관점에서 분석·평가한다' },
        ],
    },
    '과학': {
        active: true, difficulty: 3, topicCategory: 'Society',
        topicPool: ['생활 속 현상', '실험·관찰', '자연재해', '첨단 기술'],
        units: [
            { code: '과학·물질', statement: '물질의 상태 변화와 성질을 이해한다' },
            { code: '과학·에너지', statement: '힘과 운동, 에너지의 전환을 이해한다' },
            { code: '과학·생명', statement: '생명체의 구조와 생태계의 상호작용을 이해한다' },
            { code: '과학·지구', statement: '지구와 우주의 변화, 기후 현상을 이해한다' },
        ],
    },
    '역사': {
        active: true, difficulty: 3, topicCategory: 'Society',
        topicPool: ['사건의 원인·결과', '인물', '제도·생활', '교류', '문화·예술', '전쟁·평화', '경제·무역'],
        units: [
            { code: '역사·고대', statement: '문명의 형성과 고대 국가의 성립을 이해한다' },
            { code: '역사·고려조선', statement: '고려·조선의 제도와 사회 변화를 이해한다' },
            { code: '역사·근현대', statement: '근현대의 격동과 오늘날에 미친 영향을 이해한다' },
            { code: '역사·세계', statement: '세계사의 교류와 상호 영향을 이해한다' },
        ],
    },
    '국어 · 문학': {
        active: true, difficulty: 3, topicCategory: 'Society',
        // 저작권: 실제 작품 인용 금지 → AI 창작 짧은 지문(시·이야기)만 사용
        literaryOriginal: true,
        topicPool: ['성장', '우정', '가족', '자연', '용기', '도전', '희망', '상실'],
        units: [
            { code: '문학·화자정서', statement: '창작 시를 읽고 화자의 처지와 정서를 파악한다' },
            { code: '문학·인물갈등', statement: '창작 이야기를 읽고 인물의 마음과 갈등을 파악한다' },
            { code: '문학·주제', statement: '작품이 전하려는 주제와 의미를 해석한다' },
            { code: '문학·표현', statement: '비유·상징 등 표현의 효과를 파악한다' },
        ],
    },
    // 주말(토·일) — 학교 교과가 아닌 '일반상식'(예술·금융 중심 교양).
    // 실존 사실 기반이므로 팩트체크는 사실+한자 모두 적용(문학처럼 창작 아님).
    // units와 topicPool을 같은 길이·같은 순서로 정렬 → 요일 회전 시 주제가 어긋나지 않음.
    // 예술·금융을 번갈아 배치해 매 주말 다른 세부 소재가 나오도록 함.
    '일반상식': {
        active: true, difficulty: 3, topicCategory: 'Society', generalKnowledge: true,
        topicPool: ['명화·미술', '돈·화폐', '음악·악기', '투자·시장', '건축·디자인', '소비·저축'],
        units: [
            { code: '상식·예술', statement: '명화와 화가의 삶 속 이야기를 이해한다' },
            { code: '상식·금융', statement: '돈과 화폐의 역사·원리를 이해한다' },
            { code: '상식·예술', statement: '음악과 음악가의 세계를 이해한다' },
            { code: '상식·금융', statement: '투자와 시장이 움직이는 원리를 이해한다' },
            { code: '상식·예술', statement: '건축·디자인에 담긴 아이디어를 이해한다' },
            { code: '상식·금융', statement: '소비·저축 등 합리적 경제생활을 판단한다' },
        ],
    },
};

const WEEKDAY_KOR = ['일', '월', '화', '수', '목', '금', '토'];

// ── KST(Asia/Seoul) 기준 시각 유틸 ───────────────────────────
// GitHub Actions는 UTC로 돈다(22:00 UTC cron = 07:00 KST 다음 날).
// 요일·회전·날짜를 KST로 계산해야 요일제가 KST 요일에 정확히 맞는다.
const KST_OFFSET = 9 * 3600 * 1000;
/** 입력 시각을 KST 벽시계로 옮긴 Date (UTC 필드가 KST 값이 됨) */
function toKst(date) {
    return new Date(date.getTime() + KST_OFFSET);
}
/** KST 기준 요일(0=일~6=토) */
function kstDow(date) {
    return toKst(date).getUTCDay();
}
/** KST 기준 오늘 날짜 YYYY-MM-DD */
export function kstDateStr(date = new Date()) {
    return toKst(date).toISOString().slice(0, 10);
}

/** KST 날짜 기반 결정적 회전 인덱스 (같은 KST 날 = 같은 단원, 날마다 다름) */
function dayIndex(date) {
    return Math.floor(toKst(date).getTime() / 86400000);
}

/**
 * 오늘의 편성 계획.
 *  평일 → 교과 / 주말 → 일반상식(예술·금융). 둘 다 온보딩되면 lesson.
 *  미온보딩 교과 요일 → {mode:'news', subject}  (성취기준 확정 전까지 뉴스)
 *  온보딩된 요일 → {mode:'lesson', subject, unit, difficulty, topicPool}
 */
export function pickPlan(date) {
    const dow = kstDow(date);
    const weekday = WEEKDAY_KOR[dow];
    const subject = SUBJECT_BY_WEEKDAY[dow];
    if (!subject) return { mode: 'news', weekday };            // 편성 없음(안전망)
    const cfg = CURRICULUM[subject];
    if (!cfg || !cfg.active || cfg.units.length === 0) {
        return { mode: 'news', weekday, subject };             // 미온보딩 → 뉴스 폴백
    }
    const unit = cfg.units[dayIndex(date) % cfg.units.length]; // 단원 회전
    const topic = cfg.topicPool
        ? cfg.topicPool[dayIndex(date) % cfg.topicPool.length]
        : null;
    return {
        mode: 'lesson', weekday, subject, unit,
        difficulty: cfg.difficulty,
        topicCategory: cfg.topicCategory || null,
        literaryOriginal: cfg.literaryOriginal || false,
        generalKnowledge: cfg.generalKnowledge || false,
        topic,
    };
}

/**
 * 특정 교과를 요일 무관하게 강제 편성 (수동 테스트/FORCE_SUBJECT용).
 * 미온보딩/미존재 교과면 null 반환(호출부에서 pickPlan 폴백).
 */
export function planForSubject(subject, date) {
    const cfg = CURRICULUM[subject];
    if (!cfg || !cfg.active || cfg.units.length === 0) return null;
    const weekday = WEEKDAY_KOR[kstDow(date)];
    const unit = cfg.units[dayIndex(date) % cfg.units.length];
    const topic = cfg.topicPool ? cfg.topicPool[dayIndex(date) % cfg.topicPool.length] : null;
    return {
        mode: 'lesson', weekday, subject, unit,
        difficulty: cfg.difficulty,
        topicCategory: cfg.topicCategory || null,
        literaryOriginal: cfg.literaryOriginal || false,
        generalKnowledge: cfg.generalKnowledge || false,
        topic,
    };
}
