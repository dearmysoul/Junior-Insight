import { useState, useEffect, useCallback } from 'react';
import {
    BookOpen, PenTool, BarChart2, TrendingUp, Award,
    CheckCircle, Brain, Save, ExternalLink, Highlighter,
    Flame, BookMarked, Star, Sparkles, ArrowLeft,
    Zap, Target, Trophy, Clock, ChevronDown, ChevronUp,
} from 'lucide-react';
import { loadEntries, loadStats, saveEntry, saveStats } from './supabase.js';

/* ──────────────────────────────────────────────
   앱 버전 — 코드 변경 시 이 숫자만 올리면
   브라우저 캐시가 자동으로 무효화됩니다
   ────────────────────────────────────────────── */
const APP_VERSION = '35';
const CACHE_KEY = `ji_news_cache_v${APP_VERSION}`;

// 이전 버전 캐시 자동 삭제
(() => {
    try {
        // 뉴스 캐시: 현재 버전 외 모두 삭제
        Object.keys(localStorage)
            .filter(k => k.startsWith('ji_news_cache') && k !== CACHE_KEY)
            .forEach(k => localStorage.removeItem(k));
        // entries의 newsId가 숫자였던 구버전 데이터 초기화
        const entries = JSON.parse(localStorage.getItem('ji_entries') || '[]');
        if (entries.length > 0 && typeof entries[0].newsId === 'number') {
            localStorage.removeItem('ji_entries');
            localStorage.removeItem('ji_stats');
        }
    } catch { /* 무시 */ }
})();

/* ──────────────────────────────────────────────
   Google News RSS → 뉴스 데이터
   ────────────────────────────────────────────── */
const CATEGORIES = ['Tech & Economy', 'Environment', 'Economy', 'Society', 'World'];

/** 카테고리 키워드 매핑 */
function detectCategory(title) {
    const t = title.toLowerCase();
    // Environment: 날씨·기상 최우선 — 단어가 짧아 부분 매칭 필요
    if (/날씨|기상|기온|강수|강우|강설|호우|대설|태풍|장마|폭염|한파|황사|미세먼지|폭우|홍수|가뭄|흐리|맑음|구름|소나기|안개|천둥|번개|눈비|눈 예보|비 예보|전국.*비|전국.*눈|비.*전국|최고.*도|최저.*도|낮 최고|밤 최저|아침 기온|나들이|나들이 날씨|주말 날씨|오늘 날씨|내일 날씨|이번 주 날씨|기후|환경|탄소|온난화|재활용|에너지|원전|신재생|풍력|태양광|탄소중립|해수면|오염|생태/.test(t)) return 'Environment';
    // Tech: IT·AI·플랫폼·서비스
    if (/ai|인공지능|반도체|로봇|챗gpt|gpt|소프트웨어|테크|디지털|플랫폼|스타트업|빅테크|메타|구글|애플|네이버|카카오|유튜브|먹통|서비스장애|스트리밍|넷플릭스|틱톡|인스타그램|트위터|오픈ai|클라우드|사이버|해킹/.test(t)) return 'Tech & Economy';
    // Economy: 경제·금융·시장
    if (/경제|금리|주가|환율|무역|gdp|물가|부동산|투자|주식|채권|증시|코스피|코스닥|원화|달러|수출|수입|관세|대출|금융|은행|보험|펀드|집값|전세|월세|세금|재정|예산|적자|흑자|성장률|소비|인플레|디플레|매출|영업이익|ipo|상장|합병|인수/.test(t)) return 'Economy';
    // Society: 국내 정치·사회·범죄·의료·교육·입법·교통·문화·연예·스포츠
    if (/사회|교육|복지|안전|노동|건강|의료|급여|비급여|본인부담|건강보험|병원|수술|약값|출산|저출산|육아|학교|대학|입시|수능|청년|노인|고령|장애|빈곤|범죄|절도|강도|검거|체포|구속|탈주|마약|살인|폭행|성범죄|사고|화재|재난|소방|경찰|법원|재판|판결|선고|구형|징역|집행유예|무죄|유죄|벌금|항소|상고|헌재|헌법재판소|선거|투표|정치|정부|국회|대통령|대선|총선|장관|의원|여야|탄핵|내란|계엄|특검|수사|기소|행정|공무원|차별|인권|여성|아동|가족|주민|시민|서울|부산|경기|인천|대구|광주|대전|울산|세종|민주당|국민의힘|정당|국무|시장|도지사|국방|외교|통일|북한|남북|입법|법안|개정|시행|조례|지자체|귀경|귀성|귀향|정체|교통|고속도로|도로|열차|버스|지하철|공항|항공|철도|지연|결항|연휴|명절|설|추석|연예|스포츠|야구|축구|농구|배구|올림픽|월드컵|경기|선수|감독|드라마|영화|음악|콘서트|공연|시상식|배우|가수|아이돌|먹방|유튜브|채널|방송|예능|뉴스|기자|취재|인터뷰|사망|부고|장례|기념|추모|수상|대상|수상자|개막|폐막|전시|박람회|스타|유명인|충주|빈사리|추노|먹방/.test(t)) return 'Society';
    return 'World';
}

/** news.json의 다양한 category 값을 앱 내부 카테고리로 정규화 */
function normalizeCategory(raw) {
    if (!raw) return 'World';
    const r = raw.toLowerCase();
    if (['tech & economy', 'tech', 'technology', 'science', 'it', 'ai', '기술', '과학'].includes(r)) return 'Tech & Economy';
    if (['environment', 'climate', 'nature', '환경', '기후'].includes(r)) return 'Environment';
    if (['economy', 'business', 'finance', 'market', '경제', '금융', '비즈니스'].includes(r)) return 'Economy';
    if (['society', 'social', 'culture', 'education', 'health', 'sports', '사회', '문화', '교육', '건강', '스포츠', '정치', 'politics'].includes(r)) return 'Society';
    // International, World, 국제 → World
    return 'World';
}

/** 의견 선택지: 모든 기사에 찬성/반대/기타 고정 */
function makeOpinionOptions() {
    return ['찬성한다', '반대한다', '기타 의견이 있다'];
}

/** RSS description에서 본문 텍스트 추출 (HTML 태그 제거) */
function extractDescription(descHtml) {
    const tmp = document.createElement('div');
    tmp.innerHTML = descHtml;
    tmp.querySelectorAll('ul, li').forEach(el => el.remove());
    const text = tmp.textContent.trim();
    return text.length > 10 ? text : null;
}

/**
 * news.json 우선 로드 → 오늘 날짜와 일치하면 바로 반환
 * 없거나 날짜 불일치 시 RSS fallback
 */
async function fetchNewsJson() {
    try {
        const res = await fetch(`${import.meta.env.BASE_URL}news.json?t=${Date.now()}`);
        if (!res.ok) return null;
        const data = await res.json();
        const today = new Date().toISOString().slice(0, 10);
        // 오늘 날짜 기사이면 사용, 아니면 RSS fallback
        if (data?.date === today && Array.isArray(data.articles) && data.articles.length > 0) {
            return data.articles.map((a, idx) => ({
                // ChatGPT 필드 → 앱 내부 필드 정규화
                id: a.id || a.url || `${a.title}_${a.date}`,
                title: a.title_kor || a.title,           // 한국어 제목 우선
                title_orig: a.title,                      // 원문 제목 보존
                source: a.source,
                country: a.country || '',
                category: normalizeCategory(a.category),
                detail: a.summary_kor || a.detail || a.title, // ChatGPT 요약 우선
                summary_kor: a.summary_kor || null,
                keywords: a.keywords || [],
                difficulty: a.difficulty || 1,
                url: a.url,
                date: a.date || today,
                importance: a.importance || Math.max(60, 100 - idx * 5),
                opinionOptions: makeOpinionOptions(),
            }));
        }
        return null;
    } catch {
        return null;
    }
}

/** Google News RSS 파싱 (CORS proxy 순차 시도) */
async function fetchGoogleNews() {
    const gnews = 'https://news.google.com/rss?hl=ko&gl=KR&ceid=KR:ko';
    const proxies = [
        `https://corsproxy.io/?url=${encodeURIComponent(gnews)}`,
        `https://api.allorigins.win/raw?url=${encodeURIComponent(gnews)}`,
        `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(gnews)}`,
    ];
    let res, lastErr;
    for (const rssUrl of proxies) {
        try {
            res = await fetch(rssUrl);
            if (res.ok) break;
        } catch (e) { lastErr = e; }
    }
    if (!res || !res.ok) throw new Error(`RSS fetch failed: ${lastErr?.message || 'all proxies failed'}`);
    const xml = await res.text();
    const doc = new DOMParser().parseFromString(xml, 'text/xml');
    const items = doc.querySelectorAll('item');
    const articles = [];

    // 상위 20개 파싱 (World 보장을 위해 여유 있게 수집)
    const pool = [];
    items.forEach((item, i) => {
        if (i >= 20) return;
        const rawTitle = item.querySelector('title')?.textContent || '';
        const dashIdx = rawTitle.lastIndexOf(' - ');
        const title = dashIdx > 0 ? rawTitle.slice(0, dashIdx).trim() : rawTitle.trim();
        const source = dashIdx > 0 ? rawTitle.slice(dashIdx + 3).trim() : 'Google 뉴스';
        const link = item.querySelector('link')?.textContent || '';
        const pubDate = item.querySelector('pubDate')?.textContent || '';
        const descHtml = item.querySelector('description')?.textContent || '';
        const date = pubDate ? new Date(pubDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
        const category = detectCategory(title);
        const detail = extractDescription(descHtml) || title;
        pool.push({ i, date, title, source, category, url: link, detail });
    });

    // 상위 5개 우선 선택
    const top5 = pool.slice(0, 5);
    const hasWorld = top5.some(a => a.category === 'World');

    // World가 없으면 pool[5..] 에서 World 후보 1개를 찾아 추가, 없으면 pool[5]로 대체
    let selected6;
    if (hasWorld) {
        selected6 = pool.slice(0, 6);
    } else {
        const worldCandidate = pool.slice(5).find(a => a.category === 'World');
        if (worldCandidate) {
            selected6 = [...top5, worldCandidate];
        } else {
            // World 후보가 없으면 그냥 6번째 기사
            selected6 = pool.slice(0, 6);
        }
    }

    selected6.forEach((a, idx) => {
        articles.push({
            // id = URL 기반 고유 식별자 (날마다 같은 숫자가 다른 기사에 재사용되는 버그 방지)
            id: a.url || `${a.title}_${a.date}`,
            date: a.date, title: a.title, source: a.source,
            category: a.category, url: a.url, detail: a.detail,
            opinionOptions: makeOpinionOptions(),
            importance: Math.max(60, 100 - idx * 5),
        });
    });

    return articles;
}

// 레벨 칭호 (SVG 기획 기반 5단계)
// Lv.1 새싹: 가입즉시 | Lv.2 탐험가: XP 200+, 7일 연속 | Lv.3 기자: XP 1000+, 25일+
// Lv.4 논설가: XP 2500+, 50일+ | Lv.5 편집장: XP 4000+, 85일+
const LEVEL_TITLES = ['', '새싹', '탐험가', '기자', '논설가', '편집장'];

/* ──────────────────────────────────────────────
   SMALL COMPONENTS
   ────────────────────────────────────────────── */
function Badge({ category }) {
    const map = {
        'Tech & Economy': { Icon: Zap,        bg: '#fff7ed', text: '#c2410c', border: '#fed7aa' },
        'Environment':    { Icon: Target,      bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0' },
        'Economy':        { Icon: TrendingUp,  bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' },
        'Society':        { Icon: BookOpen,    bg: '#f5f3ff', text: '#6d28d9', border: '#ddd6fe' },
        'World':          { Icon: Clock,       bg: '#f9fafb', text: '#4b5563', border: '#e5e7eb' },
    };
    const { Icon, bg, text, border } = map[category] ?? map['World'];
    return (
        <span style={{ backgroundColor: bg, color: text, borderColor: border }}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold tracking-tight border">
            <Icon size={11} aria-hidden="true" />
            {category}
        </span>
    );
}

function Toast({ message, show }) {
    return (
        <div className={`toast-wrap ${show ? 'show' : ''}`} role="status" aria-live="polite">
            <div className="flex items-center gap-2 bg-foreground text-background px-5 py-3 rounded-xl text-[13px] font-semibold tracking-tight"
                style={{ boxShadow: '0 8px 30px -6px rgba(0,0,0,.25)' }}>
                <Sparkles size={15} aria-hidden="true" className="text-chart-1 shrink-0" />
                {message}
            </div>
        </div>
    );
}

function Stat({ icon: Icon, label, value, unit, color }) {
    return (
        <div className="bg-card rounded-lg border border-border p-4">
            <div className="flex items-center gap-2 mb-2">
                <span className={`w-7 h-7 rounded-md flex items-center justify-center ${color}`}>
                    <Icon size={14} className="text-white" aria-hidden="true" />
                </span>
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{label}</span>
            </div>
            <p className="text-2xl font-extrabold tracking-tight text-card-foreground leading-none">{value}
                <span className="text-xs font-medium text-muted-foreground ml-1">{unit}</span>
            </p>
        </div>
    );
}

function SkillRow({ label, score, xp, from }) {
    return (
        <div className="mb-4 last:mb-0">
            <div className="flex justify-between text-[13px] mb-1.5">
                <span className="text-muted-foreground font-medium tracking-tight">{label}</span>
                <span className="font-bold text-card-foreground tabular-nums">
                    {xp !== undefined ? `${xp} XP` : `${score}%`}
                </span>
            </div>
            <div className="w-full h-2 bg-accent/40 rounded-full overflow-hidden">
                <div className={`h-full rounded-full progress-fill ${from}`} style={{ width: `${score}%` }} />
            </div>
        </div>
    );
}

function StepLabel({ n, text, color, required }) {
    return (
        <div className="flex items-center gap-2 mb-2">
            <span className={`w-6 h-6 rounded-md ${color} text-white flex items-center justify-center text-[11px] font-bold shrink-0`}>{n}</span>
            <span className="font-bold text-card-foreground text-[14px] tracking-tight">{text}</span>
            {required
                ? <span className="text-destructive text-[11px] font-semibold">필수</span>
                : <span className="text-muted-foreground text-[11px]">선택</span>}
        </div>
    );
}

/* ──────────────────────────────────────────────
   MAIN APP
   ────────────────────────────────────────────── */
export default function App() {
    const [tab, setTab] = useState('news');
    const [selected, setSelected] = useState(null);
    const [toast, setToast] = useState({ show: false, msg: '' });
    // 3가지 입력 모두 필수
    const [form, setForm] = useState({ summary: '', choice: null, reason: '', word: '' });

    /* ── Google News 실시간 fetch ── */
    const [news, setNews] = useState([]);
    const [newsLoading, setNewsLoading] = useState(true);
    const [newsError, setNewsError] = useState(null);

    useEffect(() => {
        let cancelled = false;
        const now = new Date();
        const todaySix = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 6, 0, 0, 0);

        // 로컬 캐시 확인
        try {
            const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
            if (cached && cached.fetchedAt >= todaySix.getTime() && cached.articles?.length > 0) {
                if (!cancelled) { setNews(cached.articles); setNewsLoading(false); return; }
            }
        } catch { /* 무시 */ }

        setNewsLoading(true);

        // ① news.json 우선 시도 (GitHub Actions가 매일 생성)
        // ② 없거나 날짜 불일치 시 RSS proxy fallback
        const loadNews = async () => {
            const jsonArticles = await fetchNewsJson();
            if (jsonArticles) return jsonArticles;
            return fetchGoogleNews();
        };

        loadNews()
            .then((articles) => {
                if (!cancelled) {
                    setNews(articles);
                    setNewsError(null);
                    if (now >= todaySix) {
                        try { localStorage.setItem(CACHE_KEY, JSON.stringify({ fetchedAt: Date.now(), articles })); } catch { /* 무시 */ }
                    }
                }
            })
            .catch((err) => { if (!cancelled) setNewsError(err.message); })
            .finally(() => { if (!cancelled) setNewsLoading(false); });
        return () => { cancelled = true; };
    }, []);

    const [entries, setEntries] = useState([]);
    const [stats, setStats] = useState({ streak: 0, total: 0, xp: 0, level: 1, lastDate: '' });
    const [dbLoading, setDbLoading] = useState(true);

    // Supabase에서 초기 데이터 로드
    useEffect(() => {
        Promise.all([loadEntries(), loadStats()]).then(([e, s]) => {
            setEntries(e);
            if (s) {
                // 마지막 활동일이 어제/오늘이 아니면 streak 초기화
                const todayKr = new Date().toLocaleDateString('ko-KR');
                const yd = new Date(); yd.setDate(yd.getDate() - 1);
                const yesterdayKr = yd.toLocaleDateString('ko-KR');
                const last = s.lastDate || '';
                const correctedStreak = (last === todayKr || last === yesterdayKr) ? s.streak : 0;
                setStats({ ...s, streak: correctedStreak });
            }
            setDbLoading(false);
        });
    }, []);

    const flash = useCallback((msg) => {
        setToast({ show: true, msg });
        setTimeout(() => setToast((p) => ({ ...p, show: false })), 2800);
    }, []);

    const goTab = useCallback((t) => {
        setTab(t);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, []);

    // 미션하기 버튼 클릭
    const startMission = useCallback((n) => {
        setSelected(n);
        // 이미 완료한 기사면 기존 입력값 불러오기
        const existing = entries.find(e => e.newsId === n.id);
        if (existing) {
            setForm({
                summary: existing.summary,
                choice: existing.choice,
                reason: existing.reason,
                word: existing.word,
            });
        } else {
            setForm({ summary: '', choice: null, reason: '', word: '' });
        }
        setTab('write');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, [entries]);

    const submit = useCallback(() => {
        // 3개 미션 입력값 모두 필수
        if (!form.summary.trim()) { flash('① 한 문장 요약을 작성해주세요'); return; }
        if (form.choice === null) { flash('② 나의 의견을 선택해주세요'); return; }
        if (!form.reason.trim()) { flash('② 의견의 이유를 적어주세요'); return; }
        if (!form.word.trim()) { flash('③ 핵심 단어를 입력해주세요'); return; }

        const todayStr = new Date().toLocaleDateString('ko-KR');
        const newEntry = {
            id: Date.now(), date: todayStr,
            newsId: selected.id, newsTitle: selected.title, newsCategory: selected.category,
            summary: form.summary.trim(), choice: form.choice,
            reason: form.reason.trim(), word: form.word.trim(),
            opinionOptions: selected.opinionOptions,
        };

        // Supabase에 저장 (upsert)
        saveEntry(newEntry);

        // 로컬 state 업데이트
        setEntries((p) => {
            const existing = p.findIndex(e => e.newsId === selected.id);
            if (existing >= 0) {
                const updated = [...p];
                updated[existing] = newEntry;
                return updated;
            }
            return [newEntry, ...p];
        });

        // XP 계산
        const summaryXp = form.summary.trim().length >= 20 ? 5 : form.summary.trim().length > 0 ? 1 : 0;
        const reasonXp  = form.reason.trim().length >= 15  ? 5 : form.reason.trim().length > 0  ? 1 : 0;
        const xp = summaryXp + reasonXp + 5;

        // 유일 활동일 수 (오늘 포함) — 레벨 계산에 사용
        const activeDates = new Set([...entries.map(e => e.date), todayStr]);
        const uniqueDays = activeDates.size;

        setStats((p) => {
            const nx = p.xp + xp;
            const lastDate = p.lastDate || '';
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = yesterday.toLocaleDateString('ko-KR');
            let newStreak = lastDate === todayStr ? p.streak
                : lastDate === yesterdayStr     ? p.streak + 1
                : 1;
            // SVG 기획 기반 레벨 계산 (XP + 출석일 조건)
            let nl = 1;
            if      (nx >= 4000 && uniqueDays >= 85) nl = 5; // 편집장
            else if (nx >= 2500 && uniqueDays >= 50) nl = 4; // 논설가
            else if (nx >= 1000 && uniqueDays >= 25) nl = 3; // 기자
            else if (nx >= 200  && newStreak  >= 7 ) nl = 2; // 탐험가
            const up = nl > p.level;
            const next = { ...p, total: p.total + 1, xp: nx, level: nl, streak: newStreak, lastDate: todayStr };
            // Supabase에 stats 저장
            saveStats(next);
            const title = LEVEL_TITLES[nl] || '';
            setTimeout(() => flash(up ? `레벨 업! LV.${nl} ${title} (+${xp} XP)` : `미션 완료! +${xp} XP`), 100);
            return next;
        });
        setForm({ summary: '', choice: null, reason: '', word: '' });
        // 미션 완료 후 뉴스 목록으로
        setTab('news');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, [form, selected, flash]);

    const lvlTitle = LEVEL_TITLES[Math.min(stats.level, LEVEL_TITLES.length - 1)] || '미디어 리더';

    const navItems = [
        { id: 'news', Icon: BookOpen, label: '뉴스' },
        { id: 'dashboard', Icon: BarChart2, label: '성장' },
    ];

    return (
        <div className="min-h-screen bg-background text-foreground">
            <Toast message={toast.msg} show={toast.show} />

            <nav className="
        fixed z-40
        bottom-0 left-0 right-0 h-14
        md:top-0 md:bottom-0 md:right-auto md:w-16 md:h-screen
        bg-card/95 backdrop-blur-md
        border-t border-border md:border-t-0 md:border-r
        flex md:flex-col items-center justify-around md:justify-start md:pt-6 md:gap-2
      " role="navigation" aria-label="메인 내비게이션">
                <span className="hidden md:flex items-center justify-center w-9 h-9 rounded-lg bg-primary text-primary-foreground font-black text-base mb-6">J</span>
                {navItems.map(({ id, Icon, label }) => {
                    const active = tab === id || (id === 'news' && tab === 'write');
                    return (
                        <button key={id} onClick={() => goTab(id)}
                            className={`
                flex flex-col items-center justify-center gap-0.5 rounded-lg cursor-pointer
                w-14 h-11 md:w-12 md:h-11 transition-colors duration-200
                ${active ? 'bg-primary/12 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-accent/30'}
              `}
                            aria-label={label} aria-current={active ? 'page' : undefined}
                        >
                            <Icon size={20} strokeWidth={active ? 2.4 : 1.8} aria-hidden="true" />
                            <span className="text-[10px] font-medium leading-none md:sr-only">{label}</span>
                        </button>
                    );
                })}
            </nav>

            <main className={`
        pb-20 md:pb-8 md:ml-16
        px-4 pt-4 sm:px-6 sm:pt-6 md:px-8 md:pt-8
        mx-auto transition-all duration-300
        ${tab === 'write' ? 'max-w-5xl' : 'max-w-3xl'}
      `}>
                <header className="flex items-center justify-between mb-6 md:mb-8">
                    <div>
                        <h1 className="text-[18px] sm:text-xl md:text-2xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
                            Junior Insight
                            <span className="bg-primary text-primary-foreground text-[9px] px-1.5 py-px rounded font-bold uppercase tracking-widest">Beta</span>
                        </h1>
                        <p className="text-muted-foreground text-[12px] sm:text-[13px] mt-0.5 tracking-tight">세상을 보는 눈을 키우는 문해력 성장소</p>
                    </div>
                    <div className="flex items-center gap-2 bg-card px-3 py-1.5 rounded-full border border-border">
                        <img src={`${import.meta.env.BASE_URL}avatar.png`} alt="지율이 아바타"
                            className="w-7 h-7 rounded-full shrink-0 object-cover bg-accent" />
                        <span className="text-[13px] font-bold text-card-foreground tracking-tight hidden sm:inline">지율이</span>
                    </div>
                </header>

                {tab === 'news' && (
                    <NewsFeed
                        news={news}
                        loading={newsLoading}
                        error={newsError}
                        entries={entries}
                        onMission={startMission}
                    />
                )}
                {tab === 'write' && selected && (
                    <WriteView
                        news={selected}
                        form={form}
                        setForm={setForm}
                        submit={submit}
                        goBack={() => goTab('news')}
                        isDone={entries.some(e => e.newsId === selected.id)}
                    />
                )}
                {tab === 'dashboard' && (
                    <Dashboard stats={stats} entries={entries} lvlTitle={lvlTitle} />
                )}
            </main>
        </div>
    );
}

/* ============================================
   NEWS FEED
   ============================================ */
function NewsFeed({ news, loading, error, entries, onMission }) {
    const today = new Date().toISOString().slice(0, 10);
    const todayKr = new Date().toLocaleDateString('ko-KR');
    // 오늘 완료한 모든 entries
    const todayEntries = entries.filter(e => e.date === todayKr);
    // 카드 완료 표시: 오늘 날짜 + newsId 매칭
    const doneIds = new Set(todayEntries.map(e => e.newsId));
    // 배너 완료 여부: 오늘 완료한 항목이 1개라도 있으면 true
    const isTodayDone = todayEntries.length > 0;

    return (
        <div className="animate-fade-in space-y-4">
            {/* Hero */}
            <div className="bg-primary text-primary-foreground p-5 sm:p-6 rounded-xl">
                {/* 상단: 타이틀 + 날짜 + 툴팁 */}
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <BookOpen size={18} aria-hidden="true" className="opacity-80" />
                        <h2 className="text-[17px] sm:text-xl font-bold tracking-tight">오늘의 뉴스</h2>
                        <time className="text-[15px] sm:text-[17px] font-semibold tabular-nums opacity-80 ml-1">{today}</time>
                    </div>
                    {/* 툴팁 */}
                    <div className="relative group cursor-default">
                        <span className="text-[12px] text-primary-foreground/60 border border-primary-foreground/30 rounded-full px-2 py-0.5 hover:text-primary-foreground transition-colors">?</span>
                        <div className="absolute right-0 top-7 z-50 hidden group-hover:block w-64 bg-foreground text-background text-[11px] leading-relaxed p-3 rounded-lg shadow-lg pointer-events-none">
                            <p className="font-bold mb-1">📰 뉴스 제공 안내</p>
                            <p>· Google 뉴스 RSS에서 한국 최신 기사 6개를 가져옵니다.</p>
                            <p>· 매일 오전 6시 이후 첫 접속 시 새 뉴스로 업데이트됩니다.</p>
                            <p>· 뉴스 클릭 시 원문 기사로 이동합니다.</p>
                        </div>
                    </div>
                </div>

                {/* 하단: 미션 안내 영역 */}
                <div className={`rounded-lg p-3 flex items-center gap-3 ${isTodayDone ? 'bg-white/15' : 'bg-white/10'}`}>
                    {isTodayDone ? (
                        <>
                            <CheckCircle size={22} className="shrink-0 text-white" aria-hidden="true" />
                            <div>
                                <p className="font-bold text-[14px] tracking-tight">오늘 미션 완료! 🎉</p>
                                <p className="text-[11px] text-primary-foreground/70">훌륭해요! 내일도 도전해보세요.</p>
                            </div>
                        </>
                    ) : (
                        <>
                            <Target size={22} className="shrink-0 opacity-90" aria-hidden="true" />
                            <div>
                                <p className="font-bold text-[14px] tracking-tight">오늘의 미션을 완료하세요</p>
                                <p className="text-[11px] text-primary-foreground/70">뉴스 1개를 읽고 · 요약 · 의견 · 핵심단어를 작성하면 완료!</p>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Loading */}
            {loading && (
                <div className="space-y-3">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="bg-card border border-border p-4 rounded-lg animate-pulse">
                            <div className="h-3 bg-accent/40 rounded w-20 mb-3" />
                            <div className="h-5 bg-accent/40 rounded w-3/4 mb-2" />
                            <div className="h-8 bg-accent/20 rounded w-24 mt-3" />
                        </div>
                    ))}
                </div>
            )}

            {/* Error */}
            {error && (
                <div className="bg-destructive/10 border border-destructive/30 text-destructive p-4 rounded-lg text-[13px]">
                    뉴스를 불러오지 못했습니다: {error}
                </div>
            )}

            {/* Cards */}
            {!loading && news.map((n, i) => {
                const done = doneIds.has(n.id);
                return (
                    <article key={n.id}
                        className={`bg-card border rounded-lg p-4 sm:p-5 animate-slide-up transition-colors duration-200
                            ${done ? 'border-secondary/40 bg-secondary/5' : 'border-border hover:border-primary/30'}`}
                        style={{ animationDelay: `${i * 60}ms` }}
                    >
                        {/* 상단: 뱃지 + 완료표시 */}
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                            <Badge category={n.category} />
                            {done && (
                                <span className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-secondary/15 text-secondary border border-secondary/30">
                                    <CheckCircle size={11} aria-hidden="true" /> 완료
                                </span>
                            )}
                        </div>

                        {/* 제목 → 클릭 시 상세(요약+미션) 화면으로 이동 */}
                        <button
                            onClick={() => onMission(n)}
                            className="block w-full text-left text-[15px] sm:text-[16px] font-bold text-card-foreground leading-snug tracking-tight hover:text-primary transition-colors duration-200 mb-3 cursor-pointer"
                            aria-label={`${n.title} 읽기 및 미션`}
                        >
                            {n.title}
                        </button>

                        {/* 하단: 출처 */}
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] text-muted-foreground">
                                {n.source}{n.country ? ` · ${n.country}` : ''}
                            </span>
                            <span className="text-[11px] text-primary/70 font-medium flex items-center gap-1">
                                <PenTool size={11} aria-hidden="true" />
                                {done ? '수정하기' : '미션하기'}
                            </span>
                        </div>
                    </article>
                );
            })}
        </div>
    );
}

/* ============================================
   WRITE (MISSION) VIEW
   3개 미션 모두 필수 입력, 6개 뉴스 중 1개 완료 = 오늘 미션 완료
   ============================================ */
function WriteView({ news, form, setForm, submit, goBack, isDone }) {
    return (
        <div className="animate-slide-right pb-20 md:pb-0">
            {/* 뒤로가기 */}
            <button onClick={goBack}
                className="flex items-center gap-1 text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors duration-200 mb-4 cursor-pointer h-11"
                aria-label="뉴스 목록으로 돌아가기">
                <ArrowLeft size={15} aria-hidden="true" /> 뉴스 목록으로
            </button>

            {/* ── 2분할 레이아웃: 모바일=세로, md 이상=좌우 ── */}
            <div className="flex flex-col md:flex-row gap-4 items-start">

                {/* ══ 좌측: 기사 요약 영역 ══ */}
                <div className="w-full md:w-[46%] md:sticky md:top-6 flex-shrink-0">
                    <div className="bg-card border border-border rounded-xl p-5">
                        {/* 뱃지 + 국가 */}
                        <div className="flex items-center gap-2 mb-3">
                            <Badge category={news.category} />
                            {news.country && (
                                <span className="text-[11px] text-muted-foreground">· {news.country}</span>
                            )}
                        </div>

                        {/* 제목 */}
                        <p className="text-[15px] font-bold text-card-foreground leading-snug tracking-tight mb-4">
                            {news.title}
                        </p>

                        {/* 요약 본문 */}
                        {news.summary_kor ? (
                            <div className="mb-4">
                                <p className="text-[11px] font-bold text-primary mb-2 uppercase tracking-wider flex items-center gap-1">
                                    <BookOpen size={11} aria-hidden="true" /> 기사 요약
                                </p>
                                <div className="text-[14px] text-foreground leading-[1.8] tracking-tight space-y-3">
                                    {news.summary_kor.split('\n').filter(p => p.trim()).map((para, pi) => (
                                        <p key={pi}>{para.trim()}</p>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            news.detail && news.detail !== news.title && (
                                <p className="text-[14px] text-muted-foreground leading-[1.8] mb-4 tracking-tight">
                                    {news.detail}
                                </p>
                            )
                        )}

                        {/* 키워드 */}
                        {news.keywords?.length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-4">
                                <span className="text-[10px] text-muted-foreground font-medium self-center mr-0.5">핵심어:</span>
                                {news.keywords.map((kw, ki) => (
                                    <span key={ki} className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold border border-primary/20">
                                        #{kw}
                                    </span>
                                ))}
                            </div>
                        )}

                        {/* 원문 링크 */}
                        <a href={news.url} target="_blank" rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[12px] text-primary hover:underline font-medium">
                            <ExternalLink size={11} aria-hidden="true" /> 원문 읽기
                        </a>
                    </div>
                </div>

                {/* ══ 우측: 미션 입력 영역 ══ */}
                <div className="w-full md:flex-1 space-y-3">
                    {/* 미션 안내 배너 */}
                    <div className="bg-accent border border-border p-3 rounded-lg flex items-center gap-3">
                        <Sparkles size={16} className="text-primary shrink-0" aria-hidden="true" />
                        <div>
                            <p className="font-bold text-foreground text-[13px] tracking-tight">오늘의 미션</p>
                            <p className="text-[11px] text-muted-foreground">3가지를 모두 작성하면 완료! 🎉</p>
                        </div>
                    </div>

                    {/* 미션 1: 한 문장 요약 */}
                    <div className="bg-card border border-border rounded-lg p-4">
                        <div className="flex items-center gap-2.5 mb-3">
                            <span className="w-7 h-7 rounded-md bg-primary flex items-center justify-center shrink-0">
                                <Brain size={13} className="text-white" aria-hidden="true" />
                            </span>
                            <p className="font-bold text-[13px] text-card-foreground tracking-tight flex-1">미션 1 · 한 문장 요약</p>
                            {form.summary.trim() && <CheckCircle size={16} className="text-primary shrink-0" />}
                        </div>
                        <p className="text-[12px] font-semibold text-foreground mb-2">이 기사의 핵심 내용은? <span className="text-destructive">*</span></p>
                        <textarea rows={3}
                            className="w-full p-3 rounded-md border border-input bg-background text-[13px] leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
                            placeholder="기사의 핵심을 한 문장으로 줄여보세요."
                            value={form.summary}
                            onChange={(e) => setForm({ ...form, summary: e.target.value })}
                        />
                    </div>

                    {/* 미션 2: 나의 의견 */}
                    <div className="bg-card border border-border rounded-lg p-4">
                        <div className="flex items-center gap-2.5 mb-3">
                            <span className="w-7 h-7 rounded-md bg-primary flex items-center justify-center shrink-0">
                                <PenTool size={13} className="text-white" aria-hidden="true" />
                            </span>
                            <p className="font-bold text-[13px] text-card-foreground tracking-tight flex-1">미션 2 · 나의 의견</p>
                            {form.choice !== null && form.reason.trim() && <CheckCircle size={16} className="text-primary shrink-0" />}
                        </div>
                        <p className="text-[12px] font-semibold text-foreground mb-2">이 기사에 대해 어떻게 생각하나요? <span className="text-destructive">*</span></p>
                        <div className="space-y-1.5 mb-3" role="radiogroup" aria-label="의견 선택">
                            {news.opinionOptions.map((opt, i) => {
                                const on = form.choice === i;
                                return (
                                    <button key={i} type="button" role="radio" aria-checked={on}
                                        onClick={() => setForm({ ...form, choice: i })}
                                        className={`w-full text-left p-2.5 rounded-md border-2 text-[12px] font-medium flex items-center justify-between cursor-pointer transition-all duration-200 min-h-[40px] tracking-tight
                                            ${on ? 'border-primary bg-primary/8 text-foreground' : 'border-border text-muted-foreground hover:border-ring hover:bg-accent/30'}`}>
                                        <span>{opt}</span>
                                        {on && <CheckCircle size={14} className="text-primary shrink-0 ml-2" aria-hidden="true" />}
                                    </button>
                                );
                            })}
                        </div>
                        <p className="text-[12px] font-semibold text-foreground mb-2">그 의견을 선택한 이유는? <span className="text-destructive">*</span></p>
                        <input type="text"
                            className="w-full p-3 rounded-md border border-input bg-background text-[13px] tracking-tight text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                            placeholder="이유를 한 줄로 적어주세요"
                            value={form.reason}
                            onChange={(e) => setForm({ ...form, reason: e.target.value })}
                        />
                    </div>

                    {/* 미션 3: 핵심 단어 */}
                    <div className="bg-card border border-border rounded-lg p-4">
                        <div className="flex items-center gap-2.5 mb-3">
                            <span className="w-7 h-7 rounded-md bg-primary flex items-center justify-center shrink-0">
                                <Highlighter size={13} className="text-white" aria-hidden="true" />
                            </span>
                            <p className="font-bold text-[13px] text-card-foreground tracking-tight flex-1">미션 3 · 핵심 단어</p>
                            {form.word.trim() && <CheckCircle size={16} className="text-primary shrink-0" />}
                        </div>
                        <p className="text-[12px] font-semibold text-foreground mb-2">이 기사에서 가장 중요한 단어는? <span className="text-destructive">*</span></p>
                        <input type="text"
                            className="w-full p-3 rounded-md border border-input bg-background text-[13px] tracking-tight text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                            placeholder="핵심 단어를 하나 적어주세요"
                            value={form.word}
                            onChange={(e) => setForm({ ...form, word: e.target.value })}
                        />
                    </div>

                    {/* Submit */}
                    <button type="button" onClick={submit}
                        className="w-full py-3.5 rounded-lg font-bold tracking-tight transition-opacity duration-200 flex items-center justify-center gap-2 cursor-pointer press min-h-[52px] bg-primary text-primary-foreground hover:opacity-90">
                        <Save size={17} aria-hidden="true" />
                        {isDone ? '수정 저장하기' : '미션 완료하기'}
                    </button>
                </div>

            </div>
        </div>
    );
}

/* ============================================
   DASHBOARD
   ============================================ */
function Dashboard({ stats, entries, lvlTitle }) {
    const [expandedId, setExpandedId] = useState(null);

    // 영역별 XP 계산 — 실제 누적 XP 기반
    const summaryXpTotal = entries.reduce((acc, e) => {
        const len = (e.summary || '').trim().length;
        return acc + (len >= 20 ? 5 : len > 0 ? 1 : 0);
    }, 0);
    const reasonXpTotal = entries.reduce((acc, e) => {
        const len = (e.reason || '').trim().length;
        return acc + (len >= 15 ? 5 : len > 0 ? 1 : 0);
    }, 0);
    const wordXpTotal = entries.reduce((acc, e) => {
        return acc + ((e.word || '').trim().length > 0 ? 5 : 0);
    }, 0);
    const maxXpPerSkill = Math.max(entries.length * 5, 1);
    const s1 = Math.min(Math.round(summaryXpTotal / maxXpPerSkill * 100), 100);
    const s2 = Math.min(Math.round(reasonXpTotal  / maxXpPerSkill * 100), 100);
    const s3 = Math.min(Math.round(wordXpTotal    / maxXpPerSkill * 100), 100);

    return (
        <div className="animate-scale-in space-y-5">
            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <Stat icon={Flame} label="Streak" value={stats.streak} unit="일 연속" color="bg-destructive" />
                <Stat icon={BookMarked} label="완료 기사" value={entries.length} unit="건" color="bg-primary" />
                <Stat icon={Star} label="레벨" value={`LV.${stats.level}`} unit={lvlTitle} color="bg-grad-mid" />
                <Stat icon={Zap} label="Total XP" value={stats.xp} unit="XP" color="bg-secondary" />
            </div>

            {/* Skills */}
            <div className="bg-card p-4 sm:p-5 rounded-lg border border-border">
                <h3 className="font-bold text-[14px] tracking-tight mb-1 flex items-center gap-2 text-card-foreground">
                    <Award size={16} className="text-grad-mid" aria-hidden="true" /> 영역별 활동 점수
                </h3>
                <p className="text-[11px] text-muted-foreground mb-4">미션을 완료할수록 XP가 누적됩니다.</p>
                <SkillRow label="요약 능력 (Summary)" score={s1} xp={summaryXpTotal} from="bg-primary" />
                <p className="text-[11px] text-muted-foreground -mt-2 mb-4 pl-0.5">입력 시 <span className="font-semibold text-foreground">+1 XP</span> · <span className="font-semibold text-foreground">20자 이상</span> 요약 시 +5 XP</p>
                <SkillRow label="비판적 사고 (Reasoning)" score={s2} xp={reasonXpTotal} from="bg-secondary" />
                <p className="text-[11px] text-muted-foreground -mt-2 mb-4 pl-0.5">입력 시 <span className="font-semibold text-foreground">+1 XP</span> · <span className="font-semibold text-foreground">15자 이상</span> 작성 시 +5 XP</p>
                <SkillRow label="어휘 습득 (Vocabulary)" score={s3} xp={wordXpTotal} from="bg-chart-4" />
                <p className="text-[11px] text-muted-foreground -mt-2 pl-0.5">단어를 <span className="font-semibold text-foreground">1개 이상</span> 수집하면 +5 XP</p>
            </div>

            {/* History */}
            <section className="bg-card p-4 sm:p-5 rounded-lg border border-border">
                <h3 className="font-bold text-[14px] tracking-tight mb-4 flex items-center gap-2 text-card-foreground">
                    <Trophy size={16} className="text-chart-1" aria-hidden="true" /> 활동 기록
                </h3>
                {entries.length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground bg-background rounded-lg border border-dashed border-border">
                        <BookOpen size={28} className="mx-auto mb-2 text-border" aria-hidden="true" />
                        <p className="font-medium text-[13px]">아직 활동 기록이 없습니다</p>
                        <p className="text-[12px] mt-0.5">뉴스를 읽고 미션을 완료해보세요</p>
                    </div>
                ) : entries.map((e) => {
                    const opText = e.opinionOptions ? e.opinionOptions[e.choice] : ['찬성한다', '반대한다', '기타 의견이 있다'][e.choice] ?? '—';
                    const isOpen = expandedId === e.id;
                    return (
                        <div key={e.id} className="mb-3 last:mb-0 rounded-lg border border-border overflow-hidden">
                            {/* 헤더 — 클릭으로 펼치기 */}
                            <button
                                className="w-full flex items-center justify-between p-4 bg-background hover:bg-accent/10 transition-colors duration-200 cursor-pointer text-left"
                                onClick={() => setExpandedId(isOpen ? null : e.id)}
                                aria-expanded={isOpen}
                            >
                                <div className="flex-1 min-w-0 pr-3">
                                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mb-0.5">
                                        <time>{e.date}</time>
                                        <span className="w-0.5 h-0.5 bg-border rounded-full" aria-hidden="true" />
                                        <span>{e.newsCategory}</span>
                                    </div>
                                    <p className="font-bold text-card-foreground text-[13px] tracking-tight truncate">{e.newsTitle}</p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-secondary/15 text-secondary border border-secondary/30">
                                        <CheckCircle size={10} aria-hidden="true" /> 완료
                                    </span>
                                    {isOpen
                                        ? <ChevronUp size={15} className="text-muted-foreground" />
                                        : <ChevronDown size={15} className="text-muted-foreground" />}
                                </div>
                            </button>

                            {/* 상세 내용 — 펼쳐질 때 */}
                            {isOpen && (
                                <div className="px-4 pb-4 bg-background border-t border-border">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3 text-[13px]">
                                        <div className="bg-card p-3 rounded-md border border-border">
                                            <span className="text-[11px] text-muted-foreground font-medium block mb-1">📝 요약</span>
                                            <span className="text-card-foreground tracking-tight">{e.summary}</span>
                                        </div>
                                        <div className="bg-card p-3 rounded-md border border-border">
                                            <span className="text-[11px] text-muted-foreground font-medium block mb-1">💬 의견</span>
                                            <span className="font-semibold text-primary block tracking-tight">{opText}</span>
                                            <span className="text-muted-foreground block mt-1 tracking-tight text-[12px]">{e.reason}</span>
                                        </div>
                                    </div>
                                    <div className="mt-2 text-[12px] text-muted-foreground">
                                        🔑 수집 단어: <span className="text-card-foreground font-semibold bg-accent/40 px-1.5 py-0.5 rounded">{e.word}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </section>
        </div>
    );
}
