import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // 환경 변수 로드 (로컬 .env 파일 및 시스템 환경 변수)
  const env = loadEnv(mode, '.', '');
  
  // 우선순위: 1. loadEnv(.env파일) -> 2. process.env(시스템/CI환경변수)
  // 변수명 호환성: API_KEY -> VITE_GEMINI_API_KEY -> GEMINI_API_KEY 순서로 체크
  const apiKey = env.API_KEY || process.env.API_KEY || 
                 env.VITE_GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY ||
                 env.GEMINI_API_KEY || process.env.GEMINI_API_KEY;

  const supabaseUrl = env.SUPABASE_URL || process.env.SUPABASE_URL ||
                      env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL;

  const supabaseKey = env.SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY ||
                      env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  return {
    plugins: [react()],
    // 커스텀 도메인(www.oppajeom.com)이 루트이므로 절대 경로 '/'를 사용합니다.
    base: '/', 
    define: {
      // 코드 내의 process.env.API_KEY를 실제 값으로 치환
      'process.env.API_KEY': JSON.stringify(apiKey),
      'process.env.SUPABASE_URL': JSON.stringify(supabaseUrl),
      'process.env.SUPABASE_ANON_KEY': JSON.stringify(supabaseKey)
    }
  };
});
