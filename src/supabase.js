import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const USER_ID = 'jiyul';

/** entries 전체 불러오기 */
export async function loadEntries() {
    const { data, error } = await supabase
        .from('entries')
        .select('*')
        .eq('user_id', USER_ID)
        .order('created_at', { ascending: false });
    if (error) { console.error('loadEntries:', error); return []; }
    return data.map(r => ({
        id: r.id,
        date: r.date,
        newsId: r.news_id,
        newsTitle: r.news_title,
        newsCategory: r.news_category,
        summary: r.summary,
        choice: r.choice,
        reason: r.reason,
        word: r.word,
        opinionOptions: r.opinion_options ?? ['찬성한다', '반대한다', '기타 의견이 있다'],
    }));
}

/** entry 저장 (upsert: 같은 news_id면 덮어쓰기) */
export async function saveEntry(entry) {
    const { error } = await supabase
        .from('entries')
        .upsert({
            user_id: USER_ID,
            date: entry.date,
            news_id: entry.newsId,
            news_title: entry.newsTitle,
            news_category: entry.newsCategory,
            summary: entry.summary,
            choice: entry.choice,
            reason: entry.reason,
            word: entry.word,
            opinion_options: entry.opinionOptions,
        }, { onConflict: 'user_id,news_id' });
    if (error) console.error('saveEntry:', error);
}

/** stats 불러오기 */
export async function loadStats() {
    const { data, error } = await supabase
        .from('stats')
        .select('*')
        .eq('user_id', USER_ID)
        .single();
    if (error) { console.error('loadStats:', error); return null; }
    return {
        streak: data.streak,
        total: data.total,
        xp: data.xp,
        level: data.level,
        lastDate: data.last_date ?? '',
    };
}

/** stats 저장 */
export async function saveStats(stats) {
    const { error } = await supabase
        .from('stats')
        .upsert({
            user_id: USER_ID,
            streak: stats.streak,
            total: stats.total,
            xp: stats.xp,
            level: stats.level,
            last_date: stats.lastDate ?? '',
        }, { onConflict: 'user_id' });
    if (error) console.error('saveStats:', error);
}
