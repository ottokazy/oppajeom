import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // 환경 변수 로드 (로컬 .env 파일 및 시스템 환경 변수)
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react()],
    // 커스텀 도메인(www.oppajeom.com)이 루트이므로 절대 경로 '/'를 사용합니다.
    base: '/', 
    define: {
      // 깃허브 시크릿 또는 로컬 환경변수를 우선순위에 따라 적용
      'process.env.API_KEY': JSON.stringify(env.API_KEY || process.env.API_KEY),
      'process.env.SUPABASE_URL': JSON.stringify(env.SUPABASE_URL || process.env.SUPABASE_URL),
      'process.env.SUPABASE_ANON_KEY': JSON.stringify(env.SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY)
    }
  };
});