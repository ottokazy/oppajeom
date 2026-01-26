import { createClient } from '@supabase/supabase-js';

// 환경 변수에서 Supabase URL과 Key를 가져옵니다.
// Vite에서는 import.meta.env를 사용하거나 process.env를 설정하여 사용합니다.
const supabaseUrl = process.env.SUPABASE_URL || 'https://YOUR_PROJECT_ID.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'YOUR_ANON_KEY';

export const supabase = createClient(supabaseUrl, supabaseKey);