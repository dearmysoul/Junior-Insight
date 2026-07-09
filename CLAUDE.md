# Junior Insight 콘텐츠 상태 점검

**앱**: https://junior-insight.vercel.app | **Repo**: `dearmysoul/Junior-Insight` | **점검 대상**: `public/news.json`

> 이 루틴의 역할: 콘텐츠 생성은 GitHub Actions 워크플로 "Daily Content Generate"
> (`.github/workflows/fetch-news.yml`)가 매일 자동으로 담당합니다.
> **이 루틴은 콘텐츠를 만들지 않습니다.**
> 이 루틴은 그 파이프라인이 정상 작동했는지 **점검하고, 문제가 있을 때만
> 사용자에게 알리는** 감시자 역할만 합니다.

---

## 절대 금지 (위반 시 앱 콘텐츠 파괴)

| 금지 | 이유 |
|---|---|
| `news.json` 생성·수정·덮어쓰기 | GitHub Actions가 만든 교과 지문·날씨 배너를 지워버림 |
| `news.json`을 커밋·푸시 | 위와 동일. 두 파이프라인이 충돌함 |
| 웹검색으로 뉴스 기사 작성 | 더 이상 이 루틴의 일이 아님 |
| GitHub 토큰 사용·저장 | 이 루틴은 읽기 전용. 쓰기 권한 불필요 |

**이 루틴은 어떤 파일도 저장소에 쓰지 않는다. 읽기·점검·알림만 한다.**

---

## 실행 절차 (읽기 전용)

### STEP 1: 오늘 날짜(UTC) 확인

```
TODAY=$(date -u +%Y-%m-%d)
DOW=$(date -u +%u)   # 1=월 … 7=일
```

### STEP 2: 라이브 news.json 가져오기 (웹 fetch, 토큰 불필요)

- URL: `https://junior-insight.vercel.app/news.json`
- 실패하면(캐시/배포 지연) 30초 뒤 1회 재시도. 그래도 실패면 STEP 3의 "가져오기 실패"로 알림.

### STEP 3: 상태 점검 (아래 표 순서대로)

| # | 점검 | 정상 | 이상 시 의미 |
|---|---|---|---|
| 1 | `data.date === TODAY(UTC)` | 오늘 날짜 | 오늘 파이프라인이 아직 안 돌았거나 실패 |
| 2 | `data.source !== "cowork-search"` | 아님 | **옛 뉴스 루틴이 되살아나 덮어씀** (긴급) |
| 3 | `data.weather` 존재 (emoji·summary) | 있음 | 날씨 배너가 안 뜸 |
| 4 | 평일(DOW 1~5)이면 `subject_of_day` 존재 또는 첫 기사 `type==="lesson"` | 있음 | 교과 지문 대신 뉴스 폴백됨(키/팩트체크 확인 필요) |
| 5 | 주말(DOW 6~7)이면 뉴스 + 날씨면 OK | OK | — |
| 6 | 모든 `summary_kor`에 HTML 태그(`<`, `>`) 없음 | 없음 | 렌더링 깨짐 |

### STEP 4: 알림 (문제가 있을 때만)

- **모든 점검 통과** → 아무것도 하지 않고 조용히 종료. (사용자에게 알리지 않음)
- **하나라도 실패** → 사용자에게 알림. 무엇이/왜 틀렸는지 + 권장 조치를 한눈에:
  - 점검 #2 실패(옛 루틴 부활) → "긴급: 옛 뉴스 루틴이 news.json을 다시 덮어썼습니다. 그 루틴을 완전히 중지하세요."
  - 점검 #1 실패(오늘 날짜 아님) → "GitHub Actions 'Daily Content Generate'가 오늘 실행 안 됐거나 실패. Actions 탭에서 확인/재실행하세요."
  - 점검 #3·#4 실패 → "날씨 배너 또는 교과 지문 누락. ANTHROPIC_API_KEY(Actions Secret)와 최근 워크플로 로그를 확인하세요."
  - 가져오기 실패 → "라이브 news.json을 못 불러옴. 배포(Vercel/Pages) 상태 확인 필요."

---

## 완료 기준

점검 6항목 실행 완료 / 문제 없으면 무알림 종료 / 문제 있으면 원인·조치 담은 알림 1건.  
**저장소 쓰기·커밋·푸시 0건 (반드시).**
