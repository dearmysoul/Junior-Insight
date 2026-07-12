-- 그날 콘텐츠 스냅샷 컬럼 추가
-- Supabase 대시보드 → SQL Editor 에서 1회 실행.
--
-- source: 미션을 푼 그 시점의 지문/기사 원본 스냅샷(JSON).
--   { title, type, subject, unit, category, summaryKor, hanjaTerms,
--     keywords, checkQuestion, argument, url, sourceName }
--   news.json은 매일 새로 생성되므로, 과거 지문·한자어를 보존하려면
--   미션 저장 시 함께 스냅샷해 둔다. → 한자 퀴즈·성장 포트폴리오에 사용.
-- ※ 이 컬럼이 없어도 앱은 동작한다(saveEntry가 source 없이 재시도).

alter table entries add column if not exists source jsonb;
