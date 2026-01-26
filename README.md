<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# 오빠가 점바주까 (Oppajeom)

주역의 지혜와 AI의 통찰을 결합한 디지털 점술 서비스입니다.

## 🚀 GitHub 배포 가이드

이 프로젝트는 GitHub Actions를 통해 GitHub Pages로 자동 배포됩니다.
정상적인 작동을 위해 아래 **Secrets**를 GitHub 저장소 설정에 등록해야 합니다.

### 1. Secrets 등록 방법
1. GitHub 저장소에서 **Settings** 탭 클릭
2. 좌측 메뉴에서 **Secrets and variables** > **Actions** 클릭
3. **New repository secret** 버튼 클릭하여 아래 키들을 하나씩 추가

### 2. 필요한 Secrets 목록
| Name | Value (Description) |
|------|---------------------|
| `API_KEY` | Google Gemini API Key |
| `SUPABASE_URL` | Supabase Project URL (예: https://xyz.supabase.co) |
| `SUPABASE_ANON_KEY` | Supabase Project Anon/Public Key |

## 💻 로컬 실행 방법

**Prerequisites:** Node.js 20+

1. 의존성 설치:
   ```bash
   npm install
   ```

2. 환경 변수 설정:
   `.env.local` 파일을 생성하고 키를 입력하세요.
   ```env
   GEMINI_API_KEY=your_gemini_key
   SUPABASE_URL=your_supabase_url
   SUPABASE_ANON_KEY=your_supabase_anon_key
   ```
   *(참고: 로컬에서는 `GEMINI_API_KEY`를 `vite.config.ts`가 `API_KEY`로 매핑하여 사용합니다)*

3. 개발 서버 실행:
   ```bash
   npm run dev
   ```

## 🛠 기술 스택
- **Frontend**: React, TypeScript, Vite, Tailwind CSS
- **AI**: Google Gemini API (`@google/genai`)
- **Backend/DB**: Supabase (Auth, DB, Edge Functions)
- **Deployment**: GitHub Pages