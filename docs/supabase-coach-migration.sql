-- AI 코치(Phase 3) 컬럼 추가
-- Supabase 대시보드 → SQL Editor 에서 1회 실행.
-- ※ Anthropic 키를 Vercel에 등록하기 "전에" 먼저 실행하세요.
--   (키가 켜졌는데 컬럼이 없으면 저장 시 오류가 납니다.)

alter table entries add column if not exists feedback       text;
alter table entries add column if not exists followup       text;
alter table entries add column if not exists score_clarity  int;
alter table entries add column if not exists score_evidence int;
alter table entries add column if not exists score_vocab    int;

-- 스파링 재반박 저장 (Phase 5)
alter table entries add column if not exists rebuttal       text;
