/**
 * curriculum.js — 요일제 교과 편성 + 성취기준 (2022 개정 교육과정)
 *
 * 온보딩 순서: 비문학 → 사회 → 과학 (합의됨).
 * 아직 온보딩 안 된 교과는 active:false → 뉴스로 폴백(성취기준 코드 날조 방지).
 * 학년: 중1~3 통합, 난이도 중상(3).
 */

// 요일(0=일~6=토) → 교과. 주말은 뉴스.
export const SUBJECT_BY_WEEKDAY = {
    1: '국어 · 비문학',
    2: '과학',
    3: '역사',
    4: '국어 · 문학',
    5: '사회',
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
    // 아래 교과는 각 온보딩 시점에 성취기준을 조회·확정하여 active:true 로 전환
    '사회':        { active: false, difficulty: 3, units: [] }, // 다음 온보딩
    '과학':        { active: false, difficulty: 3, units: [] },
    '역사':        { active: false, difficulty: 3, units: [] },
    '국어 · 문학': { active: false, difficulty: 3, units: [] }, // 저작권 소멸 작품·창작 지문만
};

const WEEKDAY_KOR = ['일', '월', '화', '수', '목', '금', '토'];

/** 날짜 기반 결정적 회전 인덱스 (같은 날 = 같은 단원, 날마다 다름) */
function dayIndex(date) {
    return Math.floor(date.getTime() / 86400000);
}

/**
 * 오늘의 편성 계획.
 *  주말 → {mode:'news'}
 *  미온보딩 교과 요일 → {mode:'news', subject}  (성취기준 확정 전까지 뉴스)
 *  온보딩된 교과 요일 → {mode:'lesson', subject, unit, difficulty, topicPool}
 */
export function pickPlan(date) {
    const dow = date.getDay();
    const weekday = WEEKDAY_KOR[dow];
    const subject = SUBJECT_BY_WEEKDAY[dow];
    if (!subject) return { mode: 'news', weekday };            // 토·일
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
        topic,
    };
}
