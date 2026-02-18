import React, { useState, useEffect } from 'react';
import { 
  BookOpen, 
  PenTool, 
  BarChart2, 
  TrendingUp, 
  Globe, 
  Award, 
  CheckCircle, 
  Calendar,
  ChevronRight,
  Brain,
  ShieldAlert,
  Save,
  Link as LinkIcon,
  MessageSquare,
  Highlighter
} from 'lucide-react';

// --- Mock Data Generator (뉴스 데이터 시뮬레이션) ---

const MOCK_NEWS = [
  {
    id: 1,
    date: "2026-02-18",
    title: "AI 기술의 급격한 발전, 일자리에 미치는 영향은?",
    source: "BBC (Translated) & 매일경제 종합",
    category: "Tech & Economy",
    url: "https://news.bbc.co.uk/ai-future",
    detail: "최근 인공지능(AI) 기술인 '챗GPT'와 같은 생성형 AI가 그림을 그리고 소설을 쓰는 등 창작의 영역까지 진출하며 전 세계적으로 큰 충격을 주고 있습니다. 과거의 산업 혁명이 육체노동을 기계로 대체했다면, 이번 AI 혁명은 인간의 고유 영역이라 여겨졌던 지적 노동까지 대신할 수 있다는 점에서 차이가 큽니다. 이러한 변화는 기업들에게는 비용 절감과 생산성 향상이라는 기회를 제공하지만, 동시에 사무직 근로자들의 일자리를 위협할 수 있다는 우려를 낳고 있습니다. 전문가들은 단순 반복적인 업무는 AI가 빠르게 대체하겠지만, AI를 도구로 활용하여 새로운 가치를 만들어내는 직업들은 오히려 늘어날 것이라고 전망합니다. 우리 사회는 이제 'AI와 경쟁하는 시대'가 아닌 'AI와 협력하는 시대'를 준비해야 합니다. 학교 교육 또한 암기 위주에서 벗어나 창의적인 문제 해결 능력을 키우는 방향으로 변화해야 한다는 목소리가 높아지고 있습니다. 앞으로 10년 뒤, AI를 얼마나 잘 다루느냐가 개인의 능력을 평가하는 가장 중요한 척도가 될 것으로 예상됩니다.",
    opinionOptions: ["AI는 인간을 돕는 훌륭한 도구가 될 것이다", "AI 때문에 많은 사람들이 일자리를 잃을 것이다", "아직은 판단하기 어렵다"],
    importance: 95
  },
  {
    id: 2,
    date: "2026-02-18",
    title: "기후 위기로 인한 해수면 상승, 도시 계획 전면 수정 불가피",
    source: "Reuters (Translated) & KBS",
    category: "Environment",
    url: "https://reuters.com/climate-crisis",
    detail: "남극의 거대한 빙하가 과학자들의 예상보다 훨씬 빠른 속도로 녹아내리고 있다는 충격적인 연구 결과가 발표되었습니다. 지구 온난화로 인해 바닷물의 온도가 올라가고 빙하가 녹으면서, 전 세계적으로 해수면이 매년 조금씩 상승하고 있습니다. 특히 바다와 인접한 해안가 도시들은 침수 피해를 입을 위험이 매우 커졌으며, 일부 저지대 국가들은 국토가 물에 잠길 위기에 처해 있습니다. 전문가들은 지금 당장 탄소 배출을 줄이지 않는다면, 2050년에는 서울의 일부 지역을 포함한 세계 주요 도시들이 물에 잠길 수 있다고 경고합니다. 이에 따라 정부는 해안가 방파제를 더 높이 쌓거나, 위험 지역의 주민들을 안전한 곳으로 이주시킬 도시 계획을 전면적으로 다시 세워야 하는 상황입니다. 기후 위기는 더 이상 먼 미래의 이야기가 아니며, 우리의 생존을 위협하는 현실적인 문제가 되었습니다. 지금이라도 에너지를 아끼고 친환경 기술을 개발하는 등 전 인류적인 노력이 시급합니다.",
    opinionOptions: ["지금 당장 강력한 환경 규제가 필요하다", "경제 발전이 우선이므로 천천히 해결해야 한다", "과학 기술이 이 문제를 해결해 줄 것이다"],
    importance: 92
  },
  {
    id: 3,
    date: "2026-02-18",
    title: "글로벌 금리 인하 기조, 한국 경제에 청신호일까?",
    source: "NYT (Translated) & 조선일보",
    category: "Economy",
    url: "https://nytimes.com/economy",
    detail: "미국 중앙은행인 연방준비제도(Fed)가 그동안 높게 유지했던 금리를 내릴 가능성이 제기되면서 세계 경제가 들썩이고 있습니다. 금리가 내려가면 기업들은 은행에서 돈을 빌리기 쉬워져 투자를 늘리고, 사람들은 대출 이자 부담이 줄어 소비를 더 많이 하게 됩니다. 한국 경제 또한 미국의 금리 인하에 큰 영향을 받는데, 수출이 늘어나고 경기가 살아날 것이라는 긍정적인 전망이 나오고 있습니다. 하지만 일각에서는 금리가 낮아지면 사람들이 빚을 내서 집을 사거나 주식에 투자하는 일이 늘어나 가계 부채가 심각해질 수 있다고 경고합니다. 또한 환율이 불안정해지면 수입 물가가 올라 장바구니 물가에 부담을 줄 수도 있습니다. 정부는 이러한 긍정적인 효과와 부정적인 위험을 모두 고려하여 신중하게 경제 정책을 결정해야 합니다. 우리 청소년들도 금리와 환율이 내 용돈과 우리 가족의 경제생활에 어떤 영향을 미치는지 관심을 가지고 지켜볼 필요가 있습니다.",
    opinionOptions: ["경기를 살리기 위해 금리를 빨리 내려야 한다", "부채 문제 해결을 위해 금리를 유지해야 한다", "상황을 더 지켜봐야 한다"],
    importance: 88
  }
];

// --- Components ---

const Badge = ({ children, color = "blue" }) => {
  const colors = {
    blue: "bg-blue-100 text-blue-800",
    green: "bg-green-100 text-green-800",
    purple: "bg-purple-100 text-purple-800",
    red: "bg-red-100 text-red-800",
  };
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${colors[color]}`}>
      {children}
    </span>
  );
};

// --- Main App Component ---

export default function App() {
  const [activeTab, setActiveTab] = useState('news'); // news, write, dashboard
  const [selectedNews, setSelectedNews] = useState(null);
  
  // 훈련용 입력 상태 (구조화된 데이터)
  const [trainingData, setTrainingData] = useState({
    summary: '',
    opinionChoice: null, // 0, 1, 2 index
    reason: '',
    word: ''
  });

  const [savedEntries, setSavedEntries] = useState([]);
  
  // 사용자 stats (성장 지표)
  const [stats, setStats] = useState({
    streak: 5,
    totalArticles: 12,
    vocabularyScore: 1450, // 경험치 개념
    level: 3
  });

  // 날짜 포맷
  const today = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long'
  });

  // 글 저장 핸들러
  const handleSaveOpinion = () => {
    // 유효성 검사 (모든 항목 필수)
    if (!trainingData.summary.trim()) { alert("기사를 한 문장으로 요약해주세요."); return; }
    if (trainingData.opinionChoice === null) { alert("의견을 선택해주세요."); return; }
    if (!trainingData.reason.trim()) { alert("선택한 이유를 한 문장으로 적어주세요."); return; }
    if (!trainingData.word.trim()) { alert("기억에 남는 단어를 적어주세요."); return; }

    const newEntry = {
      id: Date.now(),
      date: new Date().toLocaleDateString(),
      newsTitle: selectedNews.title,
      newsCategory: selectedNews.category,
      ...trainingData,
    };

    setSavedEntries([newEntry, ...savedEntries]);
    
    // 성장 지표 업데이트 로직 (활동 충실도 반영)
    let xpGained = 10; // 기본 점수
    xpGained += trainingData.summary.length > 20 ? 5 : 2; // 요약 충실도
    xpGained += trainingData.reason.length > 15 ? 5 : 2; // 이유 충실도
    xpGained += 5; // 단어 수집 점수

    setStats(prev => ({
      ...prev,
      totalArticles: prev.totalArticles + 1,
      vocabularyScore: prev.vocabularyScore + xpGained,
      streak: prev.streak // 실제 앱에서는 날짜 비교 로직 필요
    }));

    // 초기화 및 이동
    setTrainingData({ summary: '', opinionChoice: null, reason: '', word: '' });
    setActiveTab('dashboard');
    alert(`미션 완료! +${xpGained} XP 획득! 📈`);
  };

  // --- Views ---

  const NewsFeed = () => (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 text-white p-6 rounded-2xl shadow-lg">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold mb-2">오늘의 브리핑 📰</h2>
            <p className="text-slate-300 text-sm">오전 6:00 기준 • AI 큐레이션</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-yellow-400">{MOCK_NEWS[0].date}</div>
            <div className="text-sm text-slate-400">10개 언론사 분석 완료</div>
          </div>
        </div>
      </div>

      <div className="grid gap-4">
        {MOCK_NEWS.map((news) => (
          <div 
            key={news.id} 
            className="group bg-white border border-slate-200 p-5 rounded-xl shadow-sm hover:shadow-md transition-all cursor-pointer hover:border-blue-300"
            onClick={() => {
              setSelectedNews(news);
              setTrainingData({ summary: '', opinionChoice: null, reason: '', word: '' }); // 초기화
              setActiveTab('write');
            }}
          >
            <div className="flex justify-between items-start mb-3">
              <Badge color={news.category === 'Economy' ? 'green' : news.category === 'Environment' ? 'green' : 'blue'}>
                {news.category}
              </Badge>
              <span className="text-xs text-slate-500 font-medium">{news.source}</span>
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2 group-hover:text-blue-600">
              {news.title}
            </h3>
            <p className="text-slate-600 text-sm leading-relaxed mb-4 line-clamp-2">
              {news.detail}
            </p>
            <div className="flex items-center text-xs text-slate-400 gap-2">
               <span>DATE: {news.date}</span>
               <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
               <span>읽기 추천</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const WriteView = () => (
    <div className="animate-in slide-in-from-right duration-300 pb-20">
      <button 
        onClick={() => setActiveTab('news')}
        className="text-slate-500 hover:text-slate-800 mb-4 flex items-center text-sm font-medium"
      >
        ← 뉴스 목록으로 돌아가기
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* 왼쪽: 뉴스 본문 (읽기 영역) */}
        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm h-fit">
          <div className="flex items-center gap-2 mb-4">
            <Badge color="purple">News Detail</Badge>
            <span className="text-xs text-slate-400">{selectedNews.date}</span>
          </div>
          <h2 className="text-2xl font-bold mb-2 text-slate-900 leading-tight">{selectedNews.title}</h2>
          <div className="text-xs text-slate-500 mb-6 pb-6 border-b border-slate-100 flex justify-between items-center">
             <span>SOURCE: {selectedNews.source}</span>
             <a href={selectedNews.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-blue-500 hover:underline">
               <LinkIcon size={12}/> 원문보기
             </a>
          </div>
          
          <div className="prose prose-slate max-w-none">
            <p className="text-lg leading-loose text-slate-700 font-medium whitespace-pre-wrap">
              {selectedNews.detail}
            </p>
          </div>
          
          <div className="mt-8 bg-slate-50 p-4 rounded-xl border border-slate-100">
            <div className="flex items-center gap-2 font-bold text-slate-700 mb-2">
              <Brain size={18} className="text-blue-500"/>
              생각해보기
            </div>
            <p className="text-sm text-slate-600">
              이 기사의 핵심은 무엇일까요? 아래 미션칸에 여러분의 생각을 정리해보세요.
            </p>
          </div>
        </div>

        {/* 오른쪽: 미션 워크북 (쓰기 영역) */}
        <div className="space-y-6">
          <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl flex items-center gap-3">
             <div className="p-2 bg-white rounded-lg shadow-sm">
               <PenTool size={20} className="text-blue-600"/>
             </div>
             <div>
               <h3 className="font-bold text-blue-900">문해력 탐구 미션</h3>
               <p className="text-xs text-blue-700">모든 항목은 필수입니다! 빈칸을 채워주세요.</p>
             </div>
          </div>

          <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
            {/* 1. 요약하기 */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <label className="flex items-center gap-2 font-bold text-slate-800 mb-3">
                <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-xs">1</span>
                한 문장 요약 <span className="text-red-500 text-xs ml-1">(필수)</span>
              </label>
              <textarea 
                className="w-full p-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-sm bg-slate-50"
                placeholder="기사의 내용을 친구에게 말해준다고 생각하고 한 문장으로 줄여보세요."
                rows={3}
                value={trainingData.summary}
                onChange={(e) => setTrainingData({...trainingData, summary: e.target.value})}
              />
            </div>

            {/* 2. 의견 선택 */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <label className="flex items-center gap-2 font-bold text-slate-800 mb-3">
                <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-xs">2</span>
                나의 의견 선택 <span className="text-red-500 text-xs ml-1">(필수)</span>
              </label>
              <div className="space-y-2">
                {selectedNews.opinionOptions.map((option, idx) => (
                  <button
                    key={idx}
                    onClick={() => setTrainingData({...trainingData, opinionChoice: idx})}
                    className={`w-full text-left p-4 rounded-xl border transition-all text-sm font-medium flex items-center justify-between
                      ${trainingData.opinionChoice === idx 
                        ? 'border-blue-500 bg-blue-50 text-blue-700 ring-1 ring-blue-500' 
                        : 'border-slate-200 hover:border-slate-300 text-slate-600'}`}
                  >
                    {option}
                    {trainingData.opinionChoice === idx && <CheckCircle size={16} className="text-blue-500"/>}
                  </button>
                ))}
              </div>
            </div>

            {/* 3. 이유 쓰기 */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <label className="flex items-center gap-2 font-bold text-slate-800 mb-3">
                <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-xs">3</span>
                이유 한 문장 <span className="text-red-500 text-xs ml-1">(필수)</span>
              </label>
              <input 
                type="text"
                className="w-full p-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-slate-50"
                placeholder="위에서 그 의견을 선택한 이유는 무엇인가요?"
                value={trainingData.reason}
                onChange={(e) => setTrainingData({...trainingData, reason: e.target.value})}
              />
            </div>

            {/* 4. 단어 채집 */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <label className="flex items-center gap-2 font-bold text-slate-800 mb-3">
                <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-xs">4</span>
                기억에 남는 단어 1개 <span className="text-red-500 text-xs ml-1">(필수)</span>
              </label>
              <div className="relative">
                <Highlighter size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"/>
                <input 
                  type="text"
                  className="w-full pl-10 p-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-slate-50"
                  placeholder="모르거나 핵심이라고 생각되는 단어를 적어주세요."
                  value={trainingData.word}
                  onChange={(e) => setTrainingData({...trainingData, word: e.target.value})}
                />
              </div>
            </div>

            <div className="pt-4">
              <button 
                onClick={handleSaveOpinion}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white py-4 rounded-xl font-bold shadow-lg transition-transform active:scale-95 flex items-center justify-center gap-2"
              >
                <Save size={20} />
                오늘의 미션 완료하기
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );

  const DashboardView = () => (
    <div className="animate-in zoom-in-95 duration-300">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100">
          <div className="text-slate-500 text-xs font-bold uppercase mb-1">Total Streak</div>
          <div className="text-3xl font-black text-slate-800 flex items-end gap-2">
            {stats.streak} <span className="text-sm font-medium text-slate-400 mb-1">Days 🔥</span>
          </div>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100">
          <div className="text-slate-500 text-xs font-bold uppercase mb-1">Articles Completed</div>
          <div className="text-3xl font-black text-blue-600 flex items-end gap-2">
            {stats.totalArticles} <span className="text-sm font-medium text-slate-400 mb-1">건</span>
          </div>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100">
          <div className="text-slate-500 text-xs font-bold uppercase mb-1">Insight Level</div>
          <div className="text-3xl font-black text-purple-600 flex items-end gap-2">
            LV.{stats.level} <span className="text-sm font-medium text-slate-400 mb-1">주니어 분석가</span>
          </div>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100">
          <div className="text-slate-500 text-xs font-bold uppercase mb-1">Total XP</div>
          <div className="text-3xl font-black text-green-600 flex items-end gap-2">
            {Math.floor(stats.vocabularyScore)} <span className="text-sm font-medium text-slate-400 mb-1">XP</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 성장 그래프 (Visual Only for Demo) */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
            <TrendingUp size={20} className="text-blue-500"/>
            일일 활동 성취도
          </h3>
          <div className="h-48 flex items-end justify-between px-4 gap-2">
            {[30, 45, 35, 60, 50, 75, 80].map((h, i) => (
              <div key={i} className="w-full flex flex-col items-center gap-2 group">
                <div className="text-xs text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">{h}XP</div>
                <div 
                  className="w-full bg-blue-100 rounded-t-md relative overflow-hidden group-hover:bg-blue-200 transition-all"
                  style={{ height: `${h}%` }}
                >
                  <div className="absolute bottom-0 w-full bg-blue-500 h-1"></div>
                </div>
                <div className="text-xs text-slate-400">{['월', '화', '수', '목', '금', '토', '일'][i]}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 활동 현황 */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
            <Award size={20} className="text-purple-500"/>
            영역별 활동 점수
          </h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-slate-600">요약 능력 (Summary)</span>
                <span className="font-bold text-slate-800">85/100</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div className="bg-purple-500 h-2 rounded-full" style={{ width: '85%' }}></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-slate-600">비판적 사고 (Reasoning)</span>
                <span className="font-bold text-slate-800">70/100</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div className="bg-blue-500 h-2 rounded-full" style={{ width: '70%' }}></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-slate-600">어휘 습득 (Vocabulary)</span>
                <span className="font-bold text-slate-800">92/100</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div className="bg-green-500 h-2 rounded-full" style={{ width: '92%' }}></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 기록 히스토리 */}
      <div className="mt-6 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <h3 className="font-bold text-lg mb-4">최근 활동 기록</h3>
        {savedEntries.length === 0 ? (
          <div className="text-center py-8 text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-300">
            아직 활동 기록이 없습니다. <br/>오늘의 뉴스를 읽고 미션을 완료해보세요!
          </div>
        ) : (
          <div className="space-y-4">
            {savedEntries.map((entry) => (
              <div key={entry.id} className="p-5 bg-slate-50 rounded-xl border border-slate-100">
                <div className="flex justify-between items-start mb-3">
                   <div>
                      <div className="text-xs text-slate-500 mb-1">{entry.date} • {entry.newsCategory}</div>
                      <div className="font-bold text-slate-800">{entry.newsTitle}</div>
                   </div>
                   <Badge color="green">완료함</Badge>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mt-2">
                   <div className="bg-white p-3 rounded-lg border border-slate-100">
                      <span className="text-xs text-slate-400 block mb-1">요약</span>
                      {entry.summary}
                   </div>
                   <div className="bg-white p-3 rounded-lg border border-slate-100">
                      <span className="text-xs text-slate-400 block mb-1">선택한 의견 & 이유</span>
                      <span className="font-semibold text-blue-600 mr-2">
                        {MOCK_NEWS.find(n => n.title === entry.newsTitle)?.opinionOptions[entry.opinionChoice]}
                      </span>
                      <span className="text-slate-600 block mt-1">{entry.reason}</span>
                   </div>
                </div>
                <div className="mt-2 text-xs text-right text-slate-400">
                   수집한 단어: <span className="text-slate-600 font-medium bg-yellow-100 px-1 rounded">{entry.word}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-blue-100">
      {/* Sidebar / Navigation */}
      <nav className="fixed bottom-0 w-full md:w-20 md:h-full bg-white md:flex-col flex justify-around items-center py-3 md:py-8 border-t md:border-r border-slate-200 z-50">
        <div className="hidden md:block mb-8 text-blue-600 font-black text-2xl">J.</div>
        
        <button 
          onClick={() => setActiveTab('news')}
          className={`p-3 rounded-xl transition-all ${activeTab === 'news' ? 'bg-blue-100 text-blue-600' : 'text-slate-400 hover:bg-slate-50'}`}
        >
          <BookOpen size={24} />
          <span className="text-[10px] md:hidden block mt-1">뉴스</span>
        </button>
        
        <button 
          onClick={() => {
             if(!selectedNews) {
                alert("먼저 뉴스를 선택해주세요!");
                setActiveTab('news');
             } else {
                setActiveTab('write');
             }
          }}
          className={`p-3 rounded-xl transition-all ${activeTab === 'write' ? 'bg-blue-100 text-blue-600' : 'text-slate-400 hover:bg-slate-50'}`}
        >
          <PenTool size={24} />
          <span className="text-[10px] md:hidden block mt-1">미션</span>
        </button>

        <button 
          onClick={() => setActiveTab('dashboard')}
          className={`p-3 rounded-xl transition-all ${activeTab === 'dashboard' ? 'bg-blue-100 text-blue-600' : 'text-slate-400 hover:bg-slate-50'}`}
        >
          <BarChart2 size={24} />
          <span className="text-[10px] md:hidden block mt-1">성장</span>
        </button>
      </nav>

      {/* Main Content Area */}
      <main className="pb-24 md:pl-20 md:pb-0 p-4 md:p-8 max-w-6xl mx-auto">
        <header className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
              Junior Insight
              <span className="bg-blue-600 text-white text-xs px-2 py-0.5 rounded-md font-medium">BETA</span>
            </h1>
            <p className="text-slate-500 text-sm">세상을 보는 눈을 키우는 문해력 성장소</p>
          </div>
          <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-full shadow-sm border border-slate-100">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-400 to-purple-500"></div>
            <div className="text-sm font-bold text-slate-700">김학생님</div>
          </div>
        </header>

        {activeTab === 'news' && <NewsFeed />}
        {activeTab === 'write' && <WriteView />}
        {activeTab === 'dashboard' && <DashboardView />}
      </main>
    </div>
  );
}