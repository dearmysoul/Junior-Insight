import { useState, useEffect, useCallback } from 'react';
import {
    BookOpen, PenTool, BarChart2, TrendingUp, Award,
    CheckCircle, Brain, Save, ExternalLink, Highlighter,
    Flame, BookMarked, Star, Sparkles, ArrowLeft,
    Zap, Target, Trophy, Clock,
} from 'lucide-react';

/* ──────────────────────────────────────────────
   Google News RSS → 뉴스 데이터
   ────────────────────────────────────────────── */
const CATEGORIES = ['Tech & Economy', 'Environment', 'Economy', 'Society', 'World'];

/** 카테고리 키워드 매핑 */
function detectCategory(title) {
    const t = title.toLowerCase();
    if (/ai|인공지능|기술|반도체|it|로봇|챗gpt|소프트웨어|테크|디지털|플랫폼|앱|스타트업|빅테크|메타|구글|애플|삼성|네이버|카카오/.test(t)) return 'Tech & Economy';
    if (/기후|환경|탄소|해수면|온난화|재활용|에너지|태풍|홍수|가뭄|미세먼지|오염|생태|날씨|기상|폭염|한파|원전|신재생|풍력|태양광/.test(t)) return 'Environment';
    if (/경제|금리|주가|환율|무역|gdp|물가|부동산|투자|주식|채권|증시|코스피|코스닥|원화|달러|수출|수입|관세|대출|금융|은행|보험|펀드|임대|가격|집값|전세|월세|세금|재정|예산|적자|흑자|성장률|소비|경기|인플레|디플레|산업|기업|매출|영업이익|ipo|상장|합병|인수/.test(t)) return 'Economy';
    if (/사회|교육|인구|복지|안전|노동|건강|의료|출산|저출산|육아|학교|대학|입시|청년|노인|고령|장애|빈곤|범죄|사고|재난|소방|경찰|법원|재판|판결|선고|구형|헌재|헌법재판소|선거|투표|정치|정부|국회|대통령|장관|행정|공무원|이민|난민|차별|인권|여성|아동|가족/.test(t)) return 'Society';
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
    // <ul> 목록(관련기사 링크)은 제거하고 순수 텍스트만 추출
    tmp.querySelectorAll('ul, li').forEach(el => el.remove());
    const text = tmp.textContent.trim();
    return text.length > 10 ? text : null;
}

/** Google News RSS 파싱 (Vite proxy 경유) */
async function fetchGoogleNews() {
    const rssUrl = '/api/gnews/rss?hl=ko&gl=KR&ceid=KR:ko';
    const res = await fetch(rssUrl);
    if (!res.ok) throw new Error(`RSS fetch failed: ${res.status}`);
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
        'Tech & Economy': { Icon: Zap, cls: 'bg-primary/10 text-primary border-primary/25' },
        'Environment': { Icon: Target, cls: 'bg-secondary/10 text-secondary border-secondary/25' },
        'Economy': { Icon: TrendingUp, cls: 'bg-chart-5/10 text-chart-5 border-chart-5/25' },
    };
    const { Icon, cls } = map[category] ?? map['Tech & Economy'];
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold tracking-tight border ${cls}`}>
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
                <div className={`h-full rounded-full progress-fill bg-gradient-to-r ${from} ${to}`} style={{ width: `${score}%` }} />
            </div>
        </div>
    );
}

function StepLabel({ n, text, color }) {
    return (
        <div className="flex items-center gap-2 mb-2">
            <span className={`w-6 h-6 rounded-md ${color} text-white flex items-center justify-center text-[11px] font-bold shrink-0`}>{n}</span>
            <span className="font-bold text-card-foreground text-[14px] tracking-tight">{text}</span>
            <span className="text-destructive text-[11px] font-semibold">필수</span>
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
    const [form, setForm] = useState({ summary: '', choice: null, reason: '', word: '' });

    /* ── Google News 실시간 fetch ── */
    const [news, setNews] = useState([]);
    const [newsLoading, setNewsLoading] = useState(true);
    const [newsError, setNewsError] = useState(null);

    useEffect(() => {
        let cancelled = false;

        // 오늘 오전 6시 타임스탬프 계산
        const now = new Date();
        const todaySix = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 6, 0, 0, 0);
        const cacheKey = 'ji_news_cache_v3';

        try {
            const cached = JSON.parse(localStorage.getItem(cacheKey) || 'null');
            // 캐시가 있고, 오늘 6시 이후에 저장된 경우 재사용
            if (cached && cached.fetchedAt >= todaySix.getTime() && cached.articles?.length > 0) {
                if (!cancelled) {
                    setNews(cached.articles);
                    setNewsLoading(false);
                    return;
                }
            }
        } catch { /* 캐시 파싱 실패 시 무시 */ }

        setNewsLoading(true);
        fetchGoogleNews()
            .then((articles) => {
                if (!cancelled) {
                    setNews(articles);
                    setNewsError(null);
                    // 오늘 6시 이후라면 캐시 저장, 아직 6시 이전이면 저장하지 않음
                    if (now >= todaySix) {
                        try {
                            localStorage.setItem(cacheKey, JSON.stringify({ fetchedAt: Date.now(), articles }));
                        } catch { /* localStorage 용량 초과 시 캐시 저장 실패 — 활동 기록에는 영향 없음 */ }
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
        try { localStorage.setItem('ji_entries', JSON.stringify(entries)); } catch { /* 저장 실패 무시 */ }
    }, [entries]);
    useEffect(() => {
        try { localStorage.setItem('ji_stats', JSON.stringify(stats)); } catch { /* 저장 실패 무시 */ }
    }, [stats]);

    const flash = useCallback((msg) => {
        setToast({ show: true, msg });
        setTimeout(() => setToast((p) => ({ ...p, show: false })), 2800);
    }, []);

    const go = useCallback((t) => {
        if (t === 'write' && !selected) { flash('먼저 뉴스를 선택해주세요'); return; }
        setTab(t);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, [selected, flash]);

    const pick = useCallback((n) => {
        setSelected(n);
        setForm({ summary: '', choice: null, reason: '', word: '' });
        setTab('write');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, []);

    const submit = useCallback(() => {
        if (!form.summary.trim()) { flash('기사를 요약해주세요'); return; }
        if (form.choice === null) { flash('의견을 선택해주세요'); return; }
        if (!form.reason.trim()) { flash('이유를 적어주세요'); return; }
        if (!form.word.trim()) { flash('단어를 적어주세요'); return; }

        setEntries((p) => [{
            id: Date.now(), date: new Date().toLocaleDateString('ko-KR'),
            newsId: selected.id, newsTitle: selected.title, newsCategory: selected.category,
            summary: form.summary.trim(), choice: form.choice, reason: form.reason.trim(), word: form.word.trim(),
        }, ...p]);

        const xp = 10 + (form.summary.length > 20 ? 5 : 2) + (form.reason.length > 15 ? 5 : 2) + 5;
        setStats((p) => {
            const nx = p.xp + xp;
            const nl = Math.floor(nx / 500) + 1;
            const up = nl > p.level;
            setTimeout(() => flash(up ? `레벨 업! LV.${nl} (+${xp} XP)` : `미션 완료! +${xp} XP`), 100);
            return { ...p, total: p.total + 1, xp: nx, level: nl };
        });
        setForm({ summary: '', choice: null, reason: '', word: '' });
        setTab('dashboard');
    }, [form, selected, flash]);

    const lvlTitle = LEVEL_TITLES[Math.min(stats.level, LEVEL_TITLES.length - 1)] || '미디어 리더';

    /* ---- NAV ---- */
    const navItems = [
        { id: 'news', Icon: BookOpen, label: '뉴스' },
        { id: 'write', Icon: PenTool, label: '미션' },
        { id: 'dashboard', Icon: BarChart2, label: '성장' },
    ];

    return (
        <div className="min-h-screen bg-background text-foreground">
            <Toast message={toast.msg} show={toast.show} />

            {/* ─── Bottom-nav (mobile) / Left-sidebar (≥768) ─── */}
            <nav className="
        fixed z-40
        bottom-0 left-0 right-0 h-14
        md:top-0 md:bottom-0 md:right-auto md:w-16 md:h-screen
        bg-card/95 backdrop-blur-md
        border-t border-border md:border-t-0 md:border-r
        flex md:flex-col items-center justify-around md:justify-start md:pt-6 md:gap-2
      " role="navigation" aria-label="메인 내비게이션">

                {/* Logo — desktop only */}
                <span className="hidden md:flex items-center justify-center w-9 h-9 rounded-lg bg-primary text-primary-foreground font-black text-base mb-6">J</span>

                {navItems.map(({ id, Icon, label }) => {
                    const active = tab === id;
                    return (
                        <button key={id} onClick={() => go(id)}
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

            {/* ─── MAIN CONTENT ─── */}
            <main className="
        pb-20 md:pb-8 md:ml-16
        px-4 pt-4 sm:px-6 sm:pt-6 md:px-8 md:pt-8
        max-w-5xl mx-auto
      ">
                {/* Header */}
                <header className="flex items-center justify-between mb-6 md:mb-8">
                    <div>
                        <h1 className="text-[18px] sm:text-xl md:text-2xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
                            Junior Insight
                            <span className="bg-primary text-primary-foreground text-[9px] px-1.5 py-px rounded font-bold uppercase tracking-widest">Beta</span>
                        </h1>
                        <p className="text-muted-foreground text-[12px] sm:text-[13px] mt-0.5 tracking-tight">세상을 보는 눈을 키우는 문해력 성장소</p>
                    </div>
                    <div className="flex items-center gap-2 bg-card px-3 py-1.5 rounded-full border border-border">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-primary to-grad-mid shrink-0" aria-hidden="true" />
                        <span className="text-[13px] font-bold text-card-foreground tracking-tight hidden sm:inline">김학생님</span>
                    </div>
                </header>

                {/* Views */}
                {tab === 'news' && <NewsFeed pick={pick} news={news} loading={newsLoading} error={newsError} />}
                {tab === 'write' && selected && <WriteView news={selected} form={form} setForm={setForm} submit={submit} goBack={() => setTab('news')} />}
                {tab === 'dashboard' && <Dashboard stats={stats} entries={entries} lvlTitle={lvlTitle} />}
            </main>
        </div>
    );
}

/* ============================================
   NEWS FEED
   ============================================ */
function NewsFeed({ pick, news, loading, error }) {
    const today = new Date().toISOString().slice(0, 10);

    return (
        <div className="animate-fade-in space-y-5">
            {/* Hero */}
            <div className="relative bg-gradient-to-br from-grad-start via-grad-mid to-grad-end text-primary-foreground p-5 sm:p-7 rounded-xl overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(255,255,255,.08)_0%,transparent_60%)]" aria-hidden="true" />
                <div className="relative flex flex-col sm:flex-row justify-between items-start gap-3">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <BookOpen size={18} aria-hidden="true" className="opacity-80" />
                            <h2 className="text-[17px] sm:text-xl font-bold tracking-tight">오늘의 브리핑</h2>
                        </div>
                        <p className="text-primary-foreground/50 text-[12px] flex items-center gap-1">
                            <Clock size={12} aria-hidden="true" />실시간 · Google 뉴스 기반
                        </p>
                    </div>
                    <div className="sm:text-right">
                        <time className="text-xl sm:text-2xl font-bold tabular-nums opacity-90">{today}</time>
                        <p className="text-[11px] text-primary-foreground/40 mt-0.5">{news.length > 0 ? `${news.length}개 기사 로드 완료` : '뉴스 불러오는 중...'}</p>
                    </div>
                </div>
            </div>

            {/* Loading */}
            {loading && (
                <div className="space-y-4">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="bg-card border border-border p-5 rounded-lg animate-pulse">
                            <div className="h-3 bg-accent/40 rounded w-20 mb-3" />
                            <div className="h-5 bg-accent/40 rounded w-3/4 mb-2" />
                            <div className="h-3 bg-accent/30 rounded w-full mb-1" />
                            <div className="h-3 bg-accent/30 rounded w-5/6" />
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
            {!loading && news.map((n, i) => (
                <article key={n.id}
                    className="group bg-card border border-border p-4 sm:p-5 rounded-lg card-lift press cursor-pointer animate-slide-up"
                    style={{ animationDelay: `${i * 70}ms` }}
                    onClick={() => pick(n)}
                    role="button" tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && pick(n)}
                    aria-label={`${n.title} 읽기`}
                >
                    <div className="flex flex-wrap justify-between items-center gap-2 mb-2">
                        <Badge category={n.category} />
                        <span className="text-[11px] text-muted-foreground">{n.source}</span>
                    </div>
                    <h3 className="text-[15px] sm:text-[17px] font-bold text-card-foreground mb-1.5 leading-snug tracking-tight group-hover:text-primary transition-colors duration-200">
                        {n.title}
                    </h3>
                    <p className="text-muted-foreground text-[13px] leading-[1.75] mb-3 line-clamp-2">{Array.isArray(n.detail) ? n.detail.join(' ') : n.detail}</p>
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                            <time>{n.date}</time>
                            <span className="w-0.5 h-0.5 bg-border rounded-full" aria-hidden="true" />
                            <span>{n.source}</span>
                        </div>
                        <span className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-primary font-semibold text-[12px]">
                            읽고 미션하기 <ArrowLeft size={11} className="rotate-180" aria-hidden="true" />
                        </span>
                    </div>
                </article>
            ))}
        </div>
    );
}

/* ============================================
   WRITE (MISSION) VIEW
   ============================================ */
function WriteView({ news, form, setForm, submit, goBack }) {
    return (
        <div className="animate-slide-right pb-20 md:pb-0">
            <button onClick={goBack}
                className="flex items-center gap-1 text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors duration-200 mb-4 cursor-pointer h-11"
                aria-label="뉴스 목록으로 돌아가기">
                <ArrowLeft size={15} aria-hidden="true" /> 뉴스 목록으로
            </button>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 lg:gap-7">
                {/* ── Article ── */}
                <article className="bg-card p-5 sm:p-6 rounded-lg border border-border">
                    <div className="flex items-center gap-2 mb-3">
                        <Badge category={news.category} />
                        <time className="text-[11px] text-muted-foreground">{news.date}</time>
                    </div>
                    <h2 className="text-[17px] sm:text-xl font-bold text-card-foreground leading-snug tracking-tight mb-2">{news.title}</h2>
                    <div className="flex flex-wrap justify-between text-[11px] text-muted-foreground mb-5 pb-4 border-b border-border">
                        <span>{news.source}</span>
                        <a href={news.url} target="_blank" rel="noreferrer"
                            className="flex items-center gap-1 text-primary hover:underline cursor-pointer font-medium">
                            <ExternalLink size={11} aria-hidden="true" /> 원문보기
                        </a>
                    </div>
                    <div>
                        <p className="text-[14px] text-card-foreground/80 leading-[1.85] tracking-tight">{Array.isArray(news.detail) ? news.detail.join(' ') : news.detail}</p>
                    </div>
                    <div className="mt-6 bg-accent/30 p-4 rounded-lg border border-accent/50">
                        <div className="flex items-center gap-2 font-bold text-accent-foreground mb-1 text-[14px]">
                            <Brain size={16} className="text-primary" aria-hidden="true" /> 생각해보기
                        </div>
                        <p className="text-[13px] text-muted-foreground leading-relaxed">이 기사의 핵심은 무엇일까요? 오른쪽 미션칸에 정리해보세요.</p>
                    </div>
                </article>

                {/* ── Mission ── */}
                <div className="space-y-4">
                    <div className="bg-primary/8 border border-primary/20 p-3.5 rounded-lg flex items-center gap-3">
                        <span className="w-9 h-9 bg-card rounded-lg flex items-center justify-center shadow-sm shrink-0">
                            <PenTool size={16} className="text-primary" aria-hidden="true" />
                        </span>
                        <div>
                            <h3 className="font-bold text-foreground text-[14px] tracking-tight">문해력 탐구 미션</h3>
                            <p className="text-[11px] text-primary">4가지 항목을 모두 완성해주세요</p>
                        </div>
                    </div>

                    {/* Step 1 */}
                    <div className="bg-card p-4 sm:p-5 rounded-lg border border-border">
                        <StepLabel n={1} text="한 문장 요약" color="bg-primary" />
                        <textarea rows={3}
                            className="w-full p-3 rounded-md border border-input bg-background text-[14px] leading-relaxed tracking-tight text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none transition-shadow duration-200"
                            placeholder="기사의 핵심을 한 문장으로 줄여보세요."
                            value={form.summary}
                            onChange={(e) => setForm({ ...form, summary: e.target.value })}
                        />
                    </div>

                    {/* Step 2 */}
                    <div className="bg-card p-4 sm:p-5 rounded-lg border border-border">
                        <StepLabel n={2} text="나의 의견 선택" color="bg-grad-mid" />
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
                    </div>

                    {/* Step 3 */}
                    <div className="bg-card p-4 sm:p-5 rounded-lg border border-border">
                        <StepLabel n={3} text="이유 한 문장" color="bg-secondary" />
                        <input type="text"
                            className="w-full p-3 rounded-md border border-input bg-background text-[14px] tracking-tight text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent transition-shadow duration-200"
                            placeholder="위에서 그 의견을 선택한 이유는?"
                            value={form.reason}
                            onChange={(e) => setForm({ ...form, reason: e.target.value })}
                        />
                    </div>

                    {/* Step 4 */}
                    <div className="bg-card p-4 sm:p-5 rounded-lg border border-border">
                        <StepLabel n={4} text="기억에 남는 단어" color="bg-chart-5" />
                        <div className="relative">
                            <Highlighter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                            <input type="text"
                                className="w-full pl-9 p-3 rounded-md border border-input bg-background text-[14px] tracking-tight text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-chart-5 focus:border-transparent transition-shadow duration-200"
                                placeholder="핵심이라고 생각되는 단어를 적어주세요"
                                value={form.word}
                                onChange={(e) => setForm({ ...form, word: e.target.value })}
                            />
                        </div>
                    </div>

                    {/* Submit */}
                    <button type="button" onClick={submit}
                        className="w-full bg-primary hover:bg-grad-mid text-primary-foreground py-3.5 rounded-lg font-bold tracking-tight transition-colors duration-200 flex items-center justify-center gap-2 cursor-pointer press min-h-[52px]"
                        style={{ boxShadow: '0 4px 14px -4px oklch(0.457 0.24 277 / .35)' }}>
                        <Save size={17} aria-hidden="true" /> 오늘의 미션 완료하기
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
                                <div className="chart-grow w-full rounded-t-md bg-accent/30"
                                    style={{ height: `${h}%` }}>
                                    <div className="w-full h-full rounded-t-md bg-gradient-to-t from-primary/30 to-primary/60" />
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
                    <SkillRow label="요약 능력 (Summary)" score={s1} from="from-primary" to="to-grad-mid" />
                    <p className="text-[11px] text-muted-foreground -mt-2 mb-4 pl-0.5">기사를 <span className="font-semibold text-foreground">20자 이상</span>으로 요약하면 +5 XP · 미만이면 +2 XP</p>
                    <SkillRow label="비판적 사고 (Reasoning)" score={s2} from="from-secondary" to="to-chart-5" />
                    <p className="text-[11px] text-muted-foreground -mt-2 mb-4 pl-0.5">의견 선택 이유를 <span className="font-semibold text-foreground">15자 이상</span> 작성하면 +5 XP · 미만이면 +2 XP</p>
                    <SkillRow label="어휘 습득 (Vocabulary)" score={s3} from="from-chart-3" to="to-chart-4" />
                    <p className="text-[11px] text-muted-foreground -mt-2 pl-0.5">기억에 남는 단어를 <span className="font-semibold text-foreground">1개 이상</span> 수집하면 +5 XP</p>
                </div>
            </div>

            {/* History */}
            <section className="bg-card p-4 sm:p-5 rounded-lg border border-border">
                <h3 className="font-bold text-[14px] tracking-tight mb-4 flex items-center gap-2 text-card-foreground">
                    <Trophy size={16} className="text-chart-1" aria-hidden="true" /> 최근 활동 기록
                </h3>
                {entries.length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground bg-background rounded-lg border border-dashed border-border">
                        <BookOpen size={28} className="mx-auto mb-2 text-border" aria-hidden="true" />
                        <p className="font-medium text-[13px]">아직 활동 기록이 없습니다</p>
                        <p className="text-[12px] mt-0.5">뉴스를 읽고 미션을 완료해보세요</p>
                    </div>
                ) : entries.map((e) => {
                    const n = MOCK_NEWS.find((x) => x.id === e.newsId);
                    const opText = n ? n.opinionOptions[e.choice] : '—';
                    return (
                        <div key={e.id} className="p-4 bg-background rounded-lg border border-border mb-3 last:mb-0 hover:bg-accent/10 transition-colors duration-200">
                            <div className="flex flex-wrap justify-between items-start gap-2 mb-2">
                                <div>
                                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mb-0.5">
                                        <time>{e.date}</time>
                                        <span className="w-0.5 h-0.5 bg-border rounded-full" aria-hidden="true" />
                                        <span>{e.newsCategory}</span>
                                    </div>
                                    <h4 className="font-bold text-card-foreground text-[13px] tracking-tight">{e.newsTitle}</h4>
                                </div>
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-secondary/10 text-secondary border border-secondary/25">
                                    <CheckCircle size={11} aria-hidden="true" /> 완료
                                </span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[13px]">
                                <div className="bg-card p-3 rounded-md border border-border">
                                    <span className="text-[11px] text-muted-foreground font-medium block mb-0.5">요약</span>
                                    <span className="text-card-foreground tracking-tight">{e.summary}</span>
                                </div>
                                <div className="bg-card p-3 rounded-md border border-border">
                                    <span className="text-[11px] text-muted-foreground font-medium block mb-0.5">의견 & 이유</span>
                                    <span className="font-semibold text-primary block tracking-tight">{opText}</span>
                                    <span className="text-muted-foreground block mt-0.5 tracking-tight">{e.reason}</span>
                                </div>
                            </div>
                            <div className="mt-2 text-[11px] text-right text-muted-foreground">
                                수집 단어: <span className="text-card-foreground font-semibold bg-accent/40 px-1.5 py-0.5 rounded">{e.word}</span>
                            </div>
                        </div>
                    );
                })}
            </section>
        </div>
    );
}
