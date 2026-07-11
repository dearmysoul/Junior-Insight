-- 학습 기록(타임라인) 컬럼 추가
-- Supabase 대시보드 → SQL Editor 에서 1회 실행.
--
-- history: 미션의 버전별 스냅샷 배열(JSON).
--   각 버전 = 작성 내용(요약·의견·이유·단어) + 코치 피드백/점수
--            + followup 답장/반응 + 스파링(AI 반박·재반박·판정).
--   "다시 쓰기"로 발전한 과정을 버전으로 보존한다.
-- ※ 이 컬럼이 없어도 앱은 동작한다(saveEntry가 history 없이 재시도).
--   기록을 남기려면 이 마이그레이션을 실행하세요.

alter table entries add column if not exists history jsonb;
