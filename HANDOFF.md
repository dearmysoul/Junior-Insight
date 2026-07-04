# Junior Insight — 프로젝트 핸드오프 문서 (v1)

> 이 문서 하나로 **어떤 AI/개발자든** 프로젝트를 이해하고 이어갈 수 있도록 작성했습니다.
> (백업 겸 인수인계 문서. 최종 갱신: 2026-07-04)

---

## 1. 한 줄 정의 & 목표

**읽기를 싫어하는 한국 중학생이, 매일 뉴스·교과 지문을 읽고 → 요약·주장·핵심단어를 쓰면 → AI 코치가 되물어주고 채점하며 "생각의 근육(문해력 + 자기 논리)"을 기르는 웹앱.**

- 대상: 한국 중등(중1~3 통합), 읽기 저항형
- 핵심 철학: **답을 주지 않고 되묻는다(산파) · 글자 수가 아니라 논리를 채점한다 · 반말·짧게·즉시**
- 배포: https://junior-insight.vercel.app · Repo: `dearmysoul/Junior-Insight`

---

## 2. 기술 스택

| 영역 | 스택 |
|---|---|
| 프론트 | React 19 + Vite 7 + Tailwind 4 (단일 파일 `src/App.jsx`) |
| 데이터 | Supabase (entries·stats 테이블), 클라이언트는 anon key 사용 |
| AI | Anthropic **claude-opus-4-8** (Vercel 서버리스 함수 경유) |
| 콘텐츠 | 데일리 생성기 → `public/news.json` (앱이 fetch) |
| 배포 | Vercel (main 푸시 → 자동 배포) |
| 자동화 | GitHub Actions (`.github/workflows/fetch-news.yml`) 매일 콘텐츠 생성 |

**단일 사용자**: 현재 `USER_ID = 'jiyul'` 하드코딩(`src/supabase.js`). 다중 사용자는 v1 제외.

---

## 3. 핵심 학습 루프 (엔진)

뉴스든 교과든 **동일 엔진**을 통과한다:

```
[지문 읽기/듣기] → ①한 문장 요약 → ②주장(찬반+이유) → ③핵심 단어
   → [제출] → 🤖 AI 코치: 되묻기 + 채점(명료성·근거·어휘 0~5)
   → [🥊 스파링]: AI 반박 → 재반박 → 🏆 판정
   → [다시 쓰기 / 완료]
성장 탭: 🌱 성장 미러 (처음 vs 최근 글 비교 + AI 성장 코멘트)
```

**XP = 코치 점수 합(명료성+근거+어휘)**. 과거 "글자 수 기반 XP"는 폐기(20자 채우기 꼼수 방지).

---

## 4. 파일 지도

```
src/
  App.jsx           # 전체 앱(단일 파일): NewsFeed·WriteView·Dashboard·
                    #   Badge/SubjectBadge·SparPanel·GrowthMirror
  supabase.js       # entries/stats 로드·저장 (코치 컬럼 조건부)
  main.jsx, index.css
api/                # Vercel 서버리스 (Anthropic 키 서버 보관)
  coach.js          # 제출 채점 + 되묻기   (feedback·followup·scores)
  spar.js           # 스파링 challenge/judge
  growth.js         # 성장 미러 코멘트
scripts/
  curriculum.js     # 요일→교과 매핑 + 성취기준 + 온보딩 게이트
  generate-content.js # 요일 인지 생성기: lesson(Claude+팩트체크) or news
  fetch-news.js     # 뉴스 생성(buildNews) + 카테고리 균형/날씨 배너
docs/
  supabase-coach-migration.sql  # DB 컬럼 추가 SQL
.github/workflows/fetch-news.yml # 매일 콘텐츠 자동 생성
public/news.json    # 오늘의 콘텐츠 (앱이 읽음)
HANDOFF.md          # ← 이 문서
```

---

## 5. 데이터 스키마

### 5-1. `public/news.json`
```jsonc
{
  "date": "YYYY-MM-DD",        // 반드시 UTC. 앱이 new Date().toISOString().slice(0,10)와 비교
  "weekday": "월",
  "subject_of_day": "국어 · 비문학",   // lesson일 때
  "weather": { "emoji": "🌦️", "summary": "오후 소나기" },  // 상단 배너 전용(학습 아님)
  "articles": [{
    "id": "lesson-YYYYMMDD-01",
    "type": "lesson",           // "lesson" | "news"
    "subject": "국어 · 비문학",
    "unit": "설명하는 글 읽기 [9국02-04]",
    "title_kor": "훅 제목",
    "summary_kor": "배경\n\n사실\n\n의미",   // 3단락, \n\n 구분
    "keywords": ["...", "..."],
    "hanja_terms": [{ "word":"확률","hanja":"確率","gloss":"確 확실할 확 · 率 비율 률 → 뜻" }],
    "check_question": "코치 되물음 시드",
    "factcheck": { "status":"verified", "anchor":"검증 사실", "hanja_checked":true },
    "difficulty": 3, "date":"YYYY-MM-DD", "importance": 100
  }]
}
```
**앱 렌더 규칙(위반 시 오작동):** `date`=UTC · `summary_kor` HTML 태그 금지 · `detail`≠`title`(뉴스) · 날씨는 `articles`에 넣지 말고 `weather`로.

### 5-2. Supabase `entries` (주요 컬럼)
`user_id, date, news_id, news_title, news_category, summary, choice, reason, word, opinion_options`
**+ 코치/스파링:** `feedback, followup, score_clarity, score_evidence, score_vocab, rebuttal`
(마이그레이션: `docs/supabase-coach-migration.sql`)

`stats`: `user_id, streak, total, xp, level, last_date`

---

## 6. AI 엔드포인트 (공통 설계)

| 엔드포인트 | 역할 | 출력(구조화) |
|---|---|---|
| `/api/coach` | 제출 채점 + 되묻기 | `feedback, followup, scores{clarity,evidence,vocab}` |
| `/api/spar` | `challenge`(반박) / `judge`(판정) | `rebuttal` / `{won, reply}` |
| `/api/growth` | 초기 vs 최근 글 성장 코멘트 | `comment, focus` |

**공통 보안 가드(모든 엔드포인트 동일):**
1. `origin` 화이트리스트(`*.vercel.app`·localhost) → 아니면 403
2. 입력 길이 상한 + 필수값 검증 → 없으면 400
3. `ANTHROPIC_API_KEY` 미설정 → `{disabled:true}` 반환(앱이 기존 동작으로 폴백, 안 깨짐)
4. 모델 `claude-opus-4-8`, `output_config.format`(json_schema)로 파싱 안정화

**코치 3원칙(시스템 프롬프트):** ①답 대신 되묻기 ②길이 아닌 논리 채점 ③반말·2문장·즉시.

---

## 7. 요일제 교과 시스템

| 요일 | 교과 | 성취기준 상태 |
|---|---|---|
| 월 | 국어 · 비문학 | ✅ 검증 코드 `9국02-03/04/05/06/07` |
| 화 | 과학 | 영역·주제 기반(코드 교체 필요) |
| 수 | 역사 | 영역·주제 기반 |
| 목 | 국어 · 문학 | 영역·주제 기반 · **창작 지문만**(저작권) |
| 금 | 사회 | 영역·주제 기반 |
| 토·일 | 시사(뉴스) | 기존 엔진, 날씨 제외 |

**생성 흐름(`generate-content.js`):**
```
pickPlan(오늘) → lesson? → 성취기준 고정 → Claude 생성 → 팩트체크(사실+한자) → 저장
                  ↳ 실패/키없음/미온보딩 → buildNews() 뉴스 폴백
```
- **문학**: 실제 작품 인용 금지 → AI 창작 시/이야기. 팩트체크는 한자만.
- **온보딩 게이트**: `curriculum.js`의 `active:false`면 그 교과 요일은 뉴스로 폴백(코드 날조 방지).

### ▶ 정확한 성취기준 코드로 교체하는 법 (권장 후속)
비국어 교과의 `units[].code`는 현재 **영역 라벨**(예: `사회·정치`). 정확도를 높이려면:
1. NCIC(ncic.re.kr) 또는 교과서에서 해당 학년 성취기준 코드 확인
2. `scripts/curriculum.js`의 `code`를 실제 코드(예: `9사(일사)02-01`)로, `statement`를 원문으로 교체
3. 커밋 → 자동 반영. (앱/생성기 코드 변경 불필요 — 데이터만 바꾸면 됨)

---

## 8. 보안 모델

- **Anthropic 키는 서버 전용**: `process.env.ANTHROPIC_API_KEY` (Vercel 환경변수). **절대 `VITE_` 접두사 금지**(붙이면 클라이언트 번들에 노출). Supabase anon key는 공개 의도라 `VITE_`로 노출돼도 정상.
- 공개 엔드포인트 남용 대비: origin 체크 + 입력 상한 + **Anthropic 지출 한도**(콘솔)로 최악의 손실 상한 고정.
- 키가 이미지/로그에 노출되면 폐기·재발급.

---

## 9. 활성화 체크리스트 (배포 시)

| # | 항목 | 방법 | 상태 |
|---|---|---|---|
| 1 | Anthropic 키 | Vercel env `ANTHROPIC_API_KEY`(Production, Sensitive, VITE_ 금지) | ✅ |
| 2 | 지출 한도 | Anthropic Console | ✅ |
| 3 | DB 컬럼 | `docs/supabase-coach-migration.sql` 실행 | ✅ |
| 4 | 교과 자동 생성 | 워크플로가 `generate-content.js` 실행 + Actions secret `ANTHROPIC_API_KEY` | v1에서 전환 |

---

## 10. 설계 원칙 (바꾸지 말 것)

1. **코치는 산파** — 정답을 주지 않고 아이 안의 논리를 질문으로 끌어낸다.
2. **XP는 사고의 질** — 글자 수·접속 횟수는 성공 지표 아님. 명료성·근거·어휘 점수로.
3. **스파링은 이기는 게 목적이 아님** — 아이가 근거를 대면 시원하게 인정(🏆). 좌절 금지.
4. **정확성 > 완성도** — 사실·한자 훈음은 팩트체크 패스 통과 필수. 불확실하면 뉴스 폴백.
5. **읽기 저항 배려** — 지문 300~400자·훅 형식·중상 난이도(기간 후 상승). (오디오 TTS는 추후)
6. **날씨는 학습 아님** — 상단 배너 알림으로만.

---

## 11. 확장 가이드 (자주 하는 작업)

- **교과 추가/수정**: `scripts/curriculum.js`의 `CURRICULUM`만 편집(active·units·topicPool).
- **난이도 상승**: `curriculum.js`의 `difficulty`(1~4) 조정. 앱은 `difficulty` 필드 렌더만.
- **코치 톤/채점 바꾸기**: `api/coach.js`의 `SYSTEM`·`RUBRIC_SCHEMA`.
- **로컬 실행**: `npm i && npm run dev`. 빌드 `npm run build`. (env: `VITE_SUPABASE_URL/ANON_KEY`, 서버함수는 `ANTHROPIC_API_KEY`)
- **콘텐츠 수동 생성 테스트**: `ANTHROPIC_API_KEY=... node scripts/generate-content.js` → `public/news.json` 갱신.

---

## 12. 로드맵

**완료(v1):** 뉴스 카테고리 균형 · 날씨 배너 · 교과 렌더(한자어) · AI 코치 · 요일제 교과 생성(전 교과) · 스파링 · 성장미러 · 팩트체크 가드레일.

**v1 제외(추후):** 오디오 브리핑(TTS) · 부모/교사 뷰 · 다중 사용자.

**후속 권장:** 비국어 교과 정확 성취기준 코드 교체 · 주간 성장 리포트 자동화 · 문학/역사 소재 다양화 · 팩트체크/비용 모니터링.

**측정 지표(허영→학습):** 재반박률 · 근거 구체성 추이 · 요약 명료성 추이. (글자 수·접속 횟수 폐기)

---

## 13. 이 프로젝트의 유래

Anthropic **"Claude Council"**(5고문: 전략가·회의론자·크리에이티브·운영자·청중 옹호자) 토론으로 진단 → 요일제 하이브리드 설계 → Phase 1~5 구현. 근본 통찰: **"쓰고 끝나는 일기장"을 "되물어주는 교과 코치"로.** 이미 붙어 있던 Claude를 뉴스 생성이 아니라 *아이의 사고 코칭*에 쓴 것이 전환점.
