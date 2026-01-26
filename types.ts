// 6 = Old Yin (Changing) - 노음
// 7 = Young Yang (Static) - 소양
// 8 = Young Yin (Static) - 소음
// 9 = Old Yang (Changing) - 노양
export type LineValue = 6 | 7 | 8 | 9;

export interface DivinationStep {
  lines: LineValue[];
  isComplete: boolean;
}

export interface UserContext {
  name: string;
  question: string;
  situation: string;
  mbti?: string;
}

export interface LineInfo {
  position: number;
  hanja: string;
  translation: string;
  explanation: string;
  isChanging: boolean;
}

export interface HexagramInfo {
  name: string; // e.g. "건위천 (乾爲天)"
  hanja: string; // Name Hanja (e.g. 重天乾)
  statement_hanja: string; // Hexagram Statement Original Text (e.g. 元亨利貞)
  statement_translation: string; // Literal translation of the statement
  explanation: string; // Detailed traditional explanation
}

export interface AnalysisResult {
  hexagram: HexagramInfo;
  lines: LineInfo[]; // Array of 6 lines
  changedHexagramName?: string; // Name of the resulting hexagram if there are changing lines
  advice: string; // Personalized advice (~1500-2000 chars)
  coreSummary: string[]; // 3 lines of actionable summary
}

export interface JournalFeedback {
    title: string; // e.g., "The Wisdom of Silence"
    quote: string; // A short Stoic or I Ching quote
    reflection: string; // Deep philosophical feedback (~1000 chars)
    actionItem: string; // One concrete action
}

// --- NEW TYPES FOR SUBSCRIPTION SERVICE ---

export interface WeeklyContent {
    week: number;
    koan: string; // 이번 주의 화두 (핵심 문장)
    reflection: string; // 해설 및 철학적 통찰
    action_item: string; // 구체적 실천 과제
    koan_card_url?: string; // (Optional) 생성된 카드 이미지 URL
}

export interface Subscription {
    id: string; // UUID
    user_name: string;
    phone: string;
    hexagram_code: string; // "111000"
    moving_lines: number[]; // [0, 5] (1효, 6효가 동효인 경우 인덱스 저장)
    situation: string; // 초기 상황
    started_at: string; // ISO Timestamp
    current_week: number; // 1 ~ 4
    status: 'active' | 'completed';
}

export interface WeeklyLog {
    id?: string;
    subscription_id: string;
    week_number: number;
    user_emotion: string; // 사용자의 피드백/감정 일기
    content: WeeklyContent; // AI가 생성한 내용
    created_at?: string;
}

// Window declaration for Portone (Iamport) & Google Analytics (gtag) & Kakao
declare global {
  interface Window {
    IMP: any;
    gtag: (...args: any[]) => void;
    Kakao: any;
  }
}