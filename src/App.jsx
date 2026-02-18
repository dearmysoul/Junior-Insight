import { useState, useEffect, useCallback } from 'react';
import {
    BookOpen, PenTool, BarChart2, TrendingUp, Award,
    CheckCircle, Brain, Save, ExternalLink, Highlighter,
    Flame, BookMarked, Star, Sparkles, ArrowLeft,
    Zap, Target, Trophy, Clock, ChevronDown, ChevronUp,
} from 'lucide-react';

/* ──────────────────────────────────────────────
   앱 버전 — 코드 변경 시 이 숫자만 올리면
   브라우저 캐시가 자동으로 무효화됩니다
   ────────────────────────────────────────────── */
const APP_VERSION = '11';
const CACHE_KEY = `ji_news_cache_v${APP_VERSION}`;

// 이전 버전 캐시 자동 삭제
(() => {
    try {
        Object.keys(localStorage)
            .filter(k => k.startsWith('ji_news_cache') && k !== CACHE_KEY)
            .forEach(k => localStorage.removeItem(k));
    } catch { /* 무시 */ }
})();

/* ──────────────────────────────────────────────
   Google News RSS → 뉴스 데이터
   ────────────────────────────────────────────── */
const CATEGORIES = ['Tech & Economy', 'Environment', 'Economy', 'Society', 'World'];

/** 카테고리 키워드 매핑 */
function detectCategory(title) {
    const t = title.toLowerCase();
    // Tech: IT·AI·플랫폼·서비스 (먼저: 유튜브/앱 등이 Society보다 우선)
    if (/ai|인공지능|반도체|로봇|챗gpt|gpt|소프트웨어|테크|디지털|플랫폼|스타트업|빅테크|메타|구글|애플|네이버|카카오|유튜브|먹통|서비스장애|스트리밍|넷플릭스|틱톡|인스타그램|트위터|오픈ai|클라우드|사이버|해킹|보안취약/.test(t)) return 'Tech & Economy';
    // Environment: 기후·날씨·환경·에너지
    if (/기후|환경|탄소|해수면|온난화|재활용|태풍|홍수|가뭄|미세먼지|오염|생태|날씨|기상|폭염|한파|원전|신재생|풍력|태양광|녹색|탄소중립|황사|강수|기온|호우|대설|한파|장마/.test(t)) return 'Environment';
    // Economy: 경제·금융·시장
    if (/경제|금리|주가|환율|무역|gdp|물가|부동산|투자|주식|채권|증시|코스피|코스닥|원화|달러|수출|수입|관세|대출|금융|은행|보험|펀드|집값|전세|월세|세금|재정|예산|적자|흑자|성장률|소비|인플레|디플레|매출|영업이익|ipo|상장|합병|인수|무역전쟁|수출규제/.test(t)) return 'Economy';
    // Society: 국내 정치·사회·범죄·의료·교육·입법·날씨 이외 나머지
    if (/사회|교육|복지|안전|노동|건강|의료|급여|비급여|본인부담|건강보험|병원|수술|약값|출산|저출산|육아|학교|대학|입시|수능|청년|노인|고령|장애|빈곤|범죄|절도|강도|검거|체포|구속|탈주|마약|살인|폭행|성범죄|사고|화재|재난|소방|경찰|법원|재판|판결|선고|구형|징역|집행유예|무죄|유죄|벌금|항소|상고|헌재|헌법재판소|선거|투표|정치|정부|국회|대통령|대선|총선|장관|의원|여야|탄핵|내란|계엄|특검|수사|기소|행정|공무원|이민|난민|차별|인권|여성|아동|가족|주민|시민|서울|부산|경기|인천|대구|광주|대전|울산|세종|민주당|국민의힘|정당|국무|시장|도지사|구청|국방|외교|통일|북한|남북|입법|법안|개정|시행|조례|규정|지자체|지방/.test(t)) return 'Society';
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

    items.forEach((item, i) => {
        if (i >= 6) return;
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

        articles.push({
            id: i + 1, date, title, source, category, url: link,
            detail,
            opinionOptions: makeOpinionOptions(),
            importance: Math.max(60, 100 - i * 5),
        });
    });

    return articles;
}

const LEVEL_TITLES = [
    '', '견습생', '탐구자', '주니어 분석가', '성장하는 독자',
    '시니어 분석가', '논객', '칼럼니스트', '사설위원', '편집장', '미디어 리더',
];

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

function SkillRow({ label, score, from, to }) {
    return (
        <div className="mb-4 last:mb-0">
            <div className="flex justify-between text-[13px] mb-1.5">
                <span className="text-muted-foreground font-medium tracking-tight">{label}</span>
                <span className="font-bold text-card-foreground tabular-nums">{score}/100</span>
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
    // mission: 'summary' | 'opinion' | 'word' (3가지 중 1개 선택)
    const [form, setForm] = useState({ missionType: null, summary: '', choice: null, reason: '', word: '' });

    /* ── Google News 실시간 fetch ── */
    const [news, setNews] = useState([]);
    const [newsLoading, setNewsLoading] = useState(true);
    const [newsError, setNewsError] = useState(null);

    useEffect(() => {
        let cancelled = false;
        const now = new Date();
        const todaySix = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 6, 0, 0, 0);
        try {
            const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
            if (cached && cached.fetchedAt >= todaySix.getTime() && cached.articles?.length > 0) {
                if (!cancelled) { setNews(cached.articles); setNewsLoading(false); return; }
            }
        } catch { /* 무시 */ }

        setNewsLoading(true);
        fetchGoogleNews()
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

    const [entries, setEntries] = useState(() => {
        try { return JSON.parse(localStorage.getItem('ji_entries') || '[]'); } catch { return []; }
    });
    const [stats, setStats] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem('ji_stats') || '{"streak":5,"total":12,"xp":1450,"level":3}');
        } catch { return { streak: 5, total: 12, xp: 1450, level: 3 }; }
    });

    useEffect(() => {
        try { localStorage.setItem('ji_entries', JSON.stringify(entries)); } catch { /* 무시 */ }
    }, [entries]);
    useEffect(() => {
        try { localStorage.setItem('ji_stats', JSON.stringify(stats)); } catch { /* 무시 */ }
    }, [stats]);

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
                missionType: existing.missionType || null,
                summary: existing.summary,
                choice: existing.choice,
                reason: existing.reason,
                word: existing.word,
            });
        } else {
            setForm({ missionType: null, summary: '', choice: null, reason: '', word: '' });
        }
        setTab('write');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, [entries]);

    const submit = useCallback(() => {
        if (!form.missionType) { flash('미션을 하나 선택해주세요'); return; }
        if (form.missionType === 'summary' && !form.summary.trim()) { flash('요약을 작성해주세요'); return; }
        if (form.missionType === 'opinion' && form.choice === null) { flash('의견을 선택해주세요'); return; }
        if (form.missionType === 'opinion' && !form.reason.trim()) { flash('이유를 적어주세요'); return; }
        if (form.missionType === 'word' && !form.word.trim()) { flash('단어를 적어주세요'); return; }

        const newEntry = {
            id: Date.now(), date: new Date().toLocaleDateString('ko-KR'),
            newsId: selected.id, newsTitle: selected.title, newsCategory: selected.category,
            missionType: form.missionType,
            summary: form.summary.trim(), choice: form.choice,
            reason: form.reason.trim(), word: form.word.trim(),
            opinionOptions: selected.opinionOptions,
        };

        // 기존 항목이 있으면 업데이트, 없으면 추가
        setEntries((p) => {
            const existing = p.findIndex(e => e.newsId === selected.id);
            if (existing >= 0) {
                const updated = [...p];
                updated[existing] = newEntry;
                return updated;
            }
            return [newEntry, ...p];
        });

        const xp = 10 + (form.summary.length > 20 ? 5 : 2) + (form.reason.length > 15 ? 5 : 2) + 5;
        setStats((p) => {
            const nx = p.xp + xp;
            const nl = Math.floor(nx / 500) + 1;
            const up = nl > p.level;
            setTimeout(() => flash(up ? `레벨 업! LV.${nl} (+${xp} XP)` : `미션 완료! +${xp} XP`), 100);
            return { ...p, total: p.total + 1, xp: nx, level: nl };
        });
        setForm({ missionType: null, summary: '', choice: null, reason: '', word: '' });
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

            <main className="
        pb-20 md:pb-8 md:ml-16
        px-4 pt-4 sm:px-6 sm:pt-6 md:px-8 md:pt-8
        max-w-3xl mx-auto
      ">
                <header className="flex items-center justify-between mb-6 md:mb-8">
                    <div>
                        <h1 className="text-[18px] sm:text-xl md:text-2xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
                            Junior Insight
                            <span className="bg-primary text-primary-foreground text-[9px] px-1.5 py-px rounded font-bold uppercase tracking-widest">Beta</span>
                        </h1>
                        <p className="text-muted-foreground text-[12px] sm:text-[13px] mt-0.5 tracking-tight">세상을 보는 눈을 키우는 문해력 성장소</p>
                    </div>
                    <div className="flex items-center gap-2 bg-card px-3 py-1.5 rounded-full border border-border">
                        <div className="w-7 h-7 rounded-full bg-primary shrink-0" aria-hidden="true" />
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
    const doneIds = new Set(entries.map(e => e.newsId));

    return (
        <div className="animate-fade-in space-y-4">
            {/* Hero */}
            <div className="bg-primary text-primary-foreground p-5 sm:p-6 rounded-xl">
                <div className="flex flex-col sm:flex-row justify-between items-start gap-3">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <BookOpen size={18} aria-hidden="true" className="opacity-80" />
                            <h2 className="text-[17px] sm:text-xl font-bold tracking-tight">오늘의 뉴스</h2>
                        </div>
                        <p className="text-primary-foreground/60 text-[12px] flex items-center gap-1">
                            <Clock size={12} aria-hidden="true" />실시간 · Google 뉴스 기반
                        </p>
                    </div>
                    <div className="sm:text-right">
                        <time className="text-xl sm:text-2xl font-bold tabular-nums opacity-90">{today}</time>
                        <p className="text-[11px] mt-0.5">
                            {doneIds.size > 0
                                ? <span className="inline-flex items-center gap-1 bg-white/20 text-white px-2 py-0.5 rounded-full font-bold"><CheckCircle size={11} aria-hidden="true" /> 오늘 미션 완료</span>
                                : <span className="text-primary-foreground/50">오늘 미션을 완료해보세요</span>
                            }
                        </p>
                    </div>
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
                            ${done ? 'border-secondary/40 bg-secondary/5' : 'border-border'}`}
                        style={{ animationDelay: `${i * 60}ms` }}
                    >
                        {/* 상단: 뱃지 + 출처 + 완료표시 */}
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                            <Badge category={n.category} />
                            <span className="text-[11px] text-muted-foreground">{n.source}</span>
                            {done && (
                                <span className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-secondary/15 text-secondary border border-secondary/30">
                                    <CheckCircle size={11} aria-hidden="true" /> 완료
                                </span>
                            )}
                        </div>

                        {/* 제목 → 원문 링크 */}
                        <a href={n.url} target="_blank" rel="noreferrer"
                            className="block text-[15px] sm:text-[16px] font-bold text-card-foreground leading-snug tracking-tight hover:text-primary transition-colors duration-200 mb-3 group"
                            aria-label={`${n.title} 원문 보기`}>
                            {n.title}
                            <ExternalLink size={12} className="inline ml-1.5 opacity-0 group-hover:opacity-60 transition-opacity" aria-hidden="true" />
                        </a>

                        {/* 하단: 날짜 + 미션 버튼 */}
                        <div className="flex items-center justify-between">
                            <time className="text-[11px] text-muted-foreground">{n.date}</time>
                            <button
                                onClick={() => onMission(n)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-bold transition-colors duration-200 cursor-pointer
                                    ${done
                                        ? 'bg-secondary/15 text-secondary hover:bg-secondary/25'
                                        : 'bg-primary text-primary-foreground hover:bg-grad-mid'}`}
                                style={!done ? { boxShadow: '0 2px 8px -2px oklch(0.457 0.24 277 / .35)' } : {}}
                            >
                                <PenTool size={12} aria-hidden="true" />
                                {done ? '수정하기' : '미션하기'}
                            </button>
                        </div>
                    </article>
                );
            })}
        </div>
    );
}

/* ============================================
   WRITE (MISSION) VIEW — 3개 중 1개 선택
   ============================================ */
function WriteView({ news, form, setForm, submit, goBack, isDone }) {
    const missions = [
        { key: 'summary', icon: Brain, color: 'bg-primary', label: '한 문장 요약', desc: '기사의 핵심을 한 문장으로' },
        { key: 'opinion', icon: PenTool, color: 'bg-grad-mid', label: '나의 의견', desc: '찬성·반대·기타 + 이유 한 줄' },
        { key: 'word', icon: Highlighter, color: 'bg-secondary', label: '핵심 단어', desc: '기억에 남는 단어 하나' },
    ];

    return (
        <div className="animate-slide-right pb-20 md:pb-0 max-w-lg mx-auto">
            <button onClick={goBack}
                className="flex items-center gap-1 text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors duration-200 mb-4 cursor-pointer h-11"
                aria-label="뉴스 목록으로 돌아가기">
                <ArrowLeft size={15} aria-hidden="true" /> 뉴스 목록으로
            </button>

            {/* 기사 정보 요약 */}
            <div className="bg-card border border-border rounded-lg p-4 mb-4">
                <div className="flex items-center gap-2 mb-2">
                    <Badge category={news.category} />
                    <time className="text-[11px] text-muted-foreground">{news.date}</time>
                </div>
                <p className="text-[14px] font-bold text-card-foreground leading-snug tracking-tight mb-2">{news.title}</p>
                <a href={news.url} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[12px] text-primary hover:underline font-medium">
                    <ExternalLink size={11} aria-hidden="true" /> 원문 읽기
                </a>
            </div>

            {/* 미션 안내 */}
            <div className="bg-primary/8 border border-primary/20 p-3.5 rounded-lg flex items-center gap-3 mb-4">
                <span className="w-9 h-9 bg-card rounded-lg flex items-center justify-center shadow-sm shrink-0">
                    <Sparkles size={16} className="text-primary" aria-hidden="true" />
                </span>
                <div>
                    <h3 className="font-bold text-foreground text-[14px] tracking-tight">오늘의 미션</h3>
                    <p className="text-[11px] text-primary">아래 3가지 중 <span className="font-bold">하나만</span> 골라 완료하면 성공! 🎉</p>
                </div>
            </div>

            {/* 미션 선택 카드 3개 */}
            <div className="space-y-2 mb-4">
                {missions.map(({ key, icon: Icon, color, label, desc }) => {
                    const selected = form.missionType === key;
                    return (
                        <button key={key} type="button"
                            onClick={() => setForm({ ...form, missionType: key })}
                            className={`w-full text-left p-4 rounded-lg border-2 transition-all duration-200 cursor-pointer
                                ${selected ? 'border-primary bg-primary/6' : 'border-border bg-card hover:border-ring hover:bg-accent/10'}`}>
                            <div className="flex items-center gap-3">
                                <span className={`w-8 h-8 rounded-md ${color} flex items-center justify-center shrink-0`}>
                                    <Icon size={15} className="text-white" aria-hidden="true" />
                                </span>
                                <div className="flex-1">
                                    <p className="font-bold text-[14px] text-card-foreground tracking-tight">{label}</p>
                                    <p className="text-[11px] text-muted-foreground">{desc}</p>
                                </div>
                                {selected && <CheckCircle size={18} className="text-primary shrink-0" aria-hidden="true" />}
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* 선택된 미션 입력 영역 */}
            {form.missionType === 'summary' && (
                <div className="bg-card p-4 rounded-lg border border-primary/30 mb-4">
                    <StepLabel n="✏️" text="한 문장 요약" color="bg-primary" required />
                    <textarea rows={3}
                        className="w-full p-3 rounded-md border border-input bg-background text-[14px] leading-relaxed tracking-tight text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none transition-shadow duration-200"
                        placeholder="기사의 핵심을 한 문장으로 줄여보세요."
                        value={form.summary}
                        onChange={(e) => setForm({ ...form, summary: e.target.value })}
                    />
                </div>
            )}

            {form.missionType === 'opinion' && (
                <div className="bg-card p-4 rounded-lg border border-primary/30 mb-4 space-y-3">
                    <StepLabel n="💬" text="나의 의견 선택" color="bg-grad-mid" required />
                    <div className="space-y-2" role="radiogroup" aria-label="의견 선택">
                        {news.opinionOptions.map((opt, i) => {
                            const on = form.choice === i;
                            return (
                                <button key={i} type="button" role="radio" aria-checked={on}
                                    onClick={() => setForm({ ...form, choice: i })}
                                    className={`w-full text-left p-3 rounded-md border-2 text-[13px] font-medium flex items-center justify-between cursor-pointer transition-all duration-200 min-h-[44px] tracking-tight
                                        ${on ? 'border-primary bg-primary/8 text-accent-foreground' : 'border-border text-muted-foreground hover:border-ring hover:bg-accent/15'}`}>
                                    <span>{opt}</span>
                                    {on && <CheckCircle size={16} className="text-primary shrink-0 ml-2" aria-hidden="true" />}
                                </button>
                            );
                        })}
                    </div>
                    <input type="text"
                        className="w-full p-3 rounded-md border border-input bg-background text-[14px] tracking-tight text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-grad-mid focus:border-transparent transition-shadow duration-200"
                        placeholder="그 의견을 선택한 이유 한 줄"
                        value={form.reason}
                        onChange={(e) => setForm({ ...form, reason: e.target.value })}
                    />
                </div>
            )}

            {form.missionType === 'word' && (
                <div className="bg-card p-4 rounded-lg border border-primary/30 mb-4">
                    <StepLabel n="🔑" text="핵심 단어" color="bg-secondary" required />
                    <div className="relative">
                        <Highlighter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                        <input type="text"
                            className="w-full pl-9 p-3 rounded-md border border-input bg-background text-[14px] tracking-tight text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent transition-shadow duration-200"
                            placeholder="기사에서 가장 중요한 단어 하나"
                            value={form.word}
                            onChange={(e) => setForm({ ...form, word: e.target.value })}
                        />
                    </div>
                </div>
            )}

            {/* Submit */}
            <button type="button" onClick={submit}
                className={`w-full py-3.5 rounded-lg font-bold tracking-tight transition-colors duration-200 flex items-center justify-center gap-2 cursor-pointer press min-h-[52px]
                    ${form.missionType ? 'bg-primary hover:bg-grad-mid text-primary-foreground' : 'bg-muted text-muted-foreground cursor-not-allowed'}`}
                style={form.missionType ? { boxShadow: '0 4px 14px -4px oklch(0.457 0.24 277 / .35)' } : {}}>
                <Save size={17} aria-hidden="true" />
                {isDone ? '수정 저장하기' : '미션 완료하기'}
            </button>
        </div>
    );
}

/* ============================================
   DASHBOARD
   ============================================ */
function Dashboard({ stats, entries, lvlTitle }) {
    const [expandedId, setExpandedId] = useState(null);
    const days = ['월', '화', '수', '목', '금', '토', '일'];
    const bars = [30, 45, 35, 60, 50, 75, 80];
    const s1 = Math.min(85 + entries.length * 2, 100);
    const s2 = Math.min(70 + entries.length * 3, 100);
    const s3 = Math.min(92 + entries.length, 100);

    return (
        <div className="animate-scale-in space-y-5">
            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <Stat icon={Flame} label="Streak" value={stats.streak} unit="Days" color="bg-destructive" />
                <Stat icon={BookMarked} label="Articles" value={stats.total} unit="건" color="bg-primary" />
                <Stat icon={Star} label="Level" value={`LV.${stats.level}`} unit={lvlTitle} color="bg-grad-mid" />
                <Stat icon={Zap} label="Total XP" value={stats.xp} unit="XP" color="bg-secondary" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Chart */}
                <div className="bg-card p-4 sm:p-5 rounded-lg border border-border">
                    <h3 className="font-bold text-[14px] tracking-tight mb-4 flex items-center gap-2 text-card-foreground">
                        <TrendingUp size={16} className="text-primary" aria-hidden="true" /> 일일 활동 성취도
                    </h3>
                    <div className="h-40 flex items-end gap-2" role="img" aria-label="주간 활동 차트">
                        {bars.map((h, i) => (
                            <div key={i} className="flex-1 flex flex-col items-center gap-1 group cursor-default">
                                <span className="text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity font-semibold tabular-nums">{h}</span>
                                <div className="chart-grow w-full rounded-t-md bg-accent/30" style={{ height: `${h}%` }}>
                                    <div className="w-full h-full rounded-t-md bg-primary/50" />
                                </div>
                                <span className="text-[10px] text-muted-foreground font-medium">{days[i]}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Skills */}
                <div className="bg-card p-4 sm:p-5 rounded-lg border border-border">
                    <h3 className="font-bold text-[14px] tracking-tight mb-1 flex items-center gap-2 text-card-foreground">
                        <Award size={16} className="text-grad-mid" aria-hidden="true" /> 영역별 활동 점수
                    </h3>
                    <p className="text-[11px] text-muted-foreground mb-4">미션을 완료할수록 점수가 올라갑니다.</p>
                    <SkillRow label="요약 능력 (Summary)" score={s1} from="bg-primary" to="" />
                    <p className="text-[11px] text-muted-foreground -mt-2 mb-4 pl-0.5">기사를 <span className="font-semibold text-foreground">20자 이상</span>으로 요약하면 +5 XP</p>
                    <SkillRow label="비판적 사고 (Reasoning)" score={s2} from="bg-secondary" to="" />
                    <p className="text-[11px] text-muted-foreground -mt-2 mb-4 pl-0.5">이유를 <span className="font-semibold text-foreground">15자 이상</span> 작성하면 +5 XP</p>
                    <SkillRow label="어휘 습득 (Vocabulary)" score={s3} from="bg-chart-4" to="" />
                    <p className="text-[11px] text-muted-foreground -mt-2 pl-0.5">단어를 <span className="font-semibold text-foreground">1개 이상</span> 수집하면 +5 XP</p>
                </div>
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
