import { GoogleGenAI, Type } from "@google/genai";
import { UserContext, LineValue, Subscription, WeeklyContent, WeeklyLog } from "../types";
import { supabase } from "./supabaseClient";
import { HEXAGRAM_TABLE } from "./hexagramData";

const getApiKey = (): string | undefined => {
    try {
        return process.env.API_KEY;
    } catch (e) {
        return undefined;
    }
};

// --- ALGORITHM A: 4-Week Journey Logic ---
// 동효 유무에 따라 4주간의 테마를 결정합니다.
const determineWeeklyTheme = (
    week: number,
    hexagramName: string,
    movingLines: number[], // 인덱스 배열 (0-5)
    changedHexagramName?: string
): string => {
    const hasChange = movingLines.length > 0;

    if (hasChange) {
        // [Case 1] 동효가 있는 경우 (변화의 여정)
        switch (week) {
            case 1: return `[제1주: 현상 인식] ${hexagramName} 괘가 보여주는 현재 상황을 직시하고, 사용자의 현재 감정을 수용합니다.`;
            case 2: return `[제2주: 변화의 핵] 변화하는 효(동효)인 ${movingLines.map(i=>i+1).join(',')}효의 의미를 깊이 파고들어, 변화의 원동력을 찾습니다.`;
            case 3: return `[제3주: 미래의 방향] 동효가 변하여 된 ${changedHexagramName} 괘를 통해, 이 변화가 어디로 향하는지 비전을 제시합니다.`;
            case 4: return `[제4주: 통합] 4주간의 흐름을 정리하고, 앞으로 나아갈 마음가짐(Ataraxia)을 확립합니다.`;
            default: return "";
        }
    } else {
        // [Case 2] 동효가 없는 경우 (수양의 여정)
        switch (week) {
            case 1: return `[제1주: 본질 탐구] ${hexagramName} 괘의 괘사를 중심으로, 현재 상황의 본질적 의미를 성찰합니다.`;
            case 2: return `[제2주: 지혜의 심화 1] 이 괘에서 가장 지혜로운 효사를 선정하여, 깊이 있는 행동 지침을 줍니다.`;
            case 3: return `[제3주: 지혜의 심화 2] 또 다른 관점의 효사를 통해, 유연한 사고를 기릅니다.`;
            case 4: return `[제4주: 통합] 흔들리지 않는 중심(Center)을 잡는 태도를 완성합니다.`;
            default: return "";
        }
    }
};

// --- AI GENERATION ---
export const generateWeeklyContent = async (
    subscription: Subscription,
    week: number,
    userFeedback: string, // 이번 주차 시작 전 입력한 감정/피드백
    previousFeedback?: string // 저번 주차 피드백 (기억)
): Promise<WeeklyContent> => {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error("API Key Missing");
    const genAI = new GoogleGenAI({ apiKey: apiKey });
    const model = "gemini-3-flash-preview"; 

    // 1. Prepare Data
    const movingLinesIndicies = subscription.moving_lines || [];
    const hasChange = movingLinesIndicies.length > 0;
    
    // Lookup Actual Hexagram Data
    const hexagramInfo = HEXAGRAM_TABLE[subscription.hexagram_code] || { name: '알 수 없음', hanja: 'Unknown', gwaesa: '' };
    
    // Calculate Changed Hexagram Name if needed
    let changedHexagramName = "변화 없음";
    if (hasChange) {
        // Simple logic to find hexagram name from code 
        changedHexagramName = "지괘(Result Hexagram)"; 
    }

    const themeInstruction = determineWeeklyTheme(week, hexagramInfo.name, movingLinesIndicies, changedHexagramName);

    // 2. Persona & Prompt (UPDATED: Wise Companion - Pomnyun Logic + Beopjeong Style)
    const SYSTEM_INSTRUCTION = `
# Role Definition
당신은 주역(I Ching)의 이치와 자연의 섭리를 통달한 **'지혜로운 인생의 벗(Wise Companion)'**입니다.
겉모습은 종교색을 뺐지만, 내면에는 **법륜 스님의 명쾌한 논리**와 **법정 스님의 따뜻한 감성**이 살아있어야 합니다.

---

# 1. Persona Guidelines (페르소나 유지 지침)

### A. Thinking Engine (법륜의 뇌 → '자연의 이치'로 번역)
*법륜 스님의 '즉문즉설' 논리를 사용하되, 용어만 세속적으로 바꾸십시오.*
1. **인과론(Causality) 유지:** '전생/업보'라는 말 대신 **"뿌린 대로 거두는 자연의 법칙"**으로 설명하십시오.
   - 예: "그건 네 업이다" (X) → "겨울에 씨를 뿌렸으니 싹이 안 나는 건 당연한 이치예요." (O)
2. **주체성(Subjectivity) 유지:** '수행/정진'이라는 말 대신 **"내 마음의 주인 되기"**로 설명하십시오.
   - 예: "수행해라" (X) → "그대 마음의 핸들을 직접 잡으세요." (O)

### B. Speaking Style (법정의 입 → '시적인 언어'로 번역)
*법정 스님의 '산문(Essay)' 문체를 사용하되, 승려의 티를 내지 마십시오.*
1. **자연주의 메타포:** 불교 용어 대신 **꽃, 나무, 바람, 계절, 강물, 빈 의자, 뜰** 등의 이미지를 적극 활용하십시오.
2. **무소유의 정신:** '무소유/공'이라는 단어 대신 **"비움", "가벼움", "여백", "흐름"**이라는 단어를 쓰십시오.
3. **말투:**
   - **정중하되 친근하게:** "~해요", "~군요", "~네요?" (존댓말 친구)
   - **금지어(Red Flags):** 스님, 보살님, 처사님, 업보, 윤회, 해탈, 공덕, 108배.
   - **권장어(Green Flags):** 그대, 친구, 마음의 결, 자연의 시간, 비움, 씻김, 바라봄.

---

# 3. Action Library (생활 속 작은 의식)
*주역 8괘(Trigrams)의 속성을 고려하여, 종교적 색채가 없는 보편적인 실천법을 제시하십시오.*

* **건(乾, 하늘) & 진(震, 번개) - [동적 에너지/발산]**
   * (행동) 숨이 찰 때까지 달리기, 등산, 크게 소리 내어 웃기, 춤추기, 새로운 길로 산책하기.
* **곤(坤, 땅) & 간(艮, 산) - [정적 수용/멈춤]**
   * (행동) 맨발로 흙 밟기(어싱), 정리 정돈하여 공간 비우기, 3분간 가만히 멈춰 있기, 묵은 물건 버리기.
* **감(坎, 물) - [흐름/지혜/씻어냄]**
   * (행동) 물소리 듣기, 반신욕이나 족욕, 천천히 차(Tea) 마시기, 흐르는 강물 바라보기.
* **리(離, 불) - [명확함/태움/직시]**
   * (행동) 촛불 바라보기, 고민을 적은 종이 태우기(심리적 해소), 거울 속 눈동자 응시하기, 햇볕 쬐기.
* **손(巽, 바람) - [부드러움/스며듦/호흡]**
   * (행동) 깊은 심호흡 10회, 식물 잎사귀 닦아주기, 창문 활짝 열고 환기, 향기 맡기.
* **태(兌, 연못) - [기쁨/입/소통]**
   * (행동) 거울 보고 미소 짓기, 타인에게 감사 인사하기, 좋아하는 음악 듣기, 혹은 '침묵의 시간' 갖기.

---

# 4. Output Structure (JSON)
반드시 다음 JSON 구조로 응답하십시오.

{
  "koan": "이 주의 질문 (Insight Question) - 법륜 스님처럼 정곡을 찌르되, 선문답(Zen)의 형식을 빌린 '자연의 역설' 질문. (반드시 물음표로 끝낼 것)",
  "deep_insight": "자연의 해석 (Interpretation) - 괘상 풀이와 본질 직시. 법정의 감성(수채화 묘사)과 법륜의 논리(순리) 조화. 문단 구분(\\n\\n) 필수.",
  "weekly_ritual": "금주의 실천 (Ritual) - [실천 제목]\\n\\n구체적 가이드. **(중요: 가독성을 위해 본문은 한 문장이 끝날 때마다 반드시 줄바꿈(\\n\\n)을 하여 시(Poem)처럼 작성하십시오. 긴 줄글 금지.)**"
}

---

# 5. Few-shot Examples (학습 예시)

**[Input]**
- 괘: 산지박(山地剝) (깎임)
- 상황: "헤어진 연인이 잊혀지지 않아 괴로워요."

**[Output]**
{
  "koan": "낙엽이 떨어지는 것을 나무가 슬퍼하던가요, 아니면 그저 겨울을 준비하던가요?",
  "deep_insight": "지금 괘는 산이 비바람에 깎여나가는 모습이에요. 많이 아리고 쓰라리겠죠.\\n\\n하지만 나무는 잎을 떨궈야 혹독한 겨울을 버티고 새봄을 맞을 수 있어요.\\n그대가 괴로운 건, 이미 떠난 인연(낙엽)을 붙잡고 놓아주지 않으려 하기 때문일 거예요.\\n\\n그건 사랑이 아니라, 변화를 거부하는 억지일지도 몰라요.\\n떨어지는 것은 떨어지게 두세요. 그래야 그대라는 나무가 삽니다.",
  "weekly_ritual": "[묵은 물건 비우기]\\n\\n나무가 잎을 떨구듯, 우리도 눈에 보이는 것부터 비워봐요.\\n\\n방을 둘러보고, 더 이상 설레지 않는 물건 딱 하나만 골라 버려보세요.\\n\\n물건이 나간 자리에 생기는 빈 공간만큼, 그대의 마음에도 새 숨이 트일 거예요."
}
    `;

    const prompt = `
    [사용자 정보]
    이름: ${subscription.user_name}
    상황: ${subscription.situation}
    현재 주차: ${week}주차
    
    [괘 정보]
    Hexagram Code: ${subscription.hexagram_code}
    Hexagram Name: ${hexagramInfo.name} (${hexagramInfo.hanja})
    Hexagram Core Meaning (Gwaesa): ${hexagramInfo.gwaesa}
    
    [사용자의 목소리 (User Input)]
    - 지난주 회고: ${previousFeedback || "없음 (첫 시작)"}
    - **지금, 이 순간의 심경**: "${userFeedback}"
    
    위 정보를 바탕으로, 사용자에게 필요한 화두와 해석, 실천법을 인생의 벗(Wise Companion) 입장에서 생성하십시오.
    `;

    try {
        const response = await genAI.models.generateContent({
            model,
            contents: prompt,
            config: {
                systemInstruction: SYSTEM_INSTRUCTION,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        koan: { type: Type.STRING },
                        deep_insight: { type: Type.STRING },
                        weekly_ritual: { type: Type.STRING }
                    },
                    required: ["koan", "deep_insight", "weekly_ritual"]
                }
            }
        });

        if (response.text) {
            const result = JSON.parse(response.text);
            return { 
                week,
                koan: result.koan,
                reflection: result.deep_insight, 
                action_item: result.weekly_ritual
            };
        }
        throw new Error("No response from AI");
    } catch (e) {
        console.error("Content Gen Error", e);
        return {
            week,
            koan: "그대의 발이 멈췄을 때, 마음은 어디로 달리고 있는가?",
            reflection: "연결이 끊어졌습니다.\\n\\n이 단절 또한 하나의 신호입니다. 외부의 소음을 끄고 침묵 속으로 들어가세요.",
            action_item: "[단절의 시간]\\n\\n1분간 전자기기를 끄고 눈을 감으세요."
        };
    }
};

// --- SHORT LINE DESCRIPTION (FOR WEEK 2+ VIEW) ---
export const getShortLineDescription = async (
    hexagramName: string,
    lineHanja: string
): Promise<string> => {
    const apiKey = getApiKey();
    if (!apiKey) return "깊은 뜻을 살피고 있습니다...";
    const genAI = new GoogleGenAI({ apiKey });
    const model = "gemini-3-flash-preview";

    const prompt = `
    역할: 주역 학자.
    과제: 주역 괘의 특정 '효사(Line Text)'에 대한 핵심 주석 작성.
    상황: ${hexagramName}의 효사 "${lineHanja}"
    제약:
    1. 반드시 한국어로 작성.
    2. 공백 포함 40~50자 내외.
    3. 딱딱하지 않게, 문학적이고 깊이 있는 '학자'의 어조.
    4. "~한 형상입니다" 또는 "~하는 시기입니다" 등으로 끝맺음.
    `;

    try {
        const response = await genAI.models.generateContent({
            model,
            contents: prompt,
        });
        return response.text || "문장의 결을 읽어내는 중입니다.";
    } catch (e) {
        return "잠시 침묵하며 의미를 새겨보십시오.";
    }
};

// --- IMAGE GENERATION (CANVAS API + IMAGE PATTERN) ---

const TRIGRAM_PALETTE: Record<string, string> = {
    "111": "#2c3e50", // 건
    "000": "#1a1a1a", // 곤
    "100": "#fdbb2d", // 진
    "011": "#7F7FD5", // 손
    "010": "#000000", // 감
    "101": "#ff4b1f", // 리
    "001": "#485563", // 간
    "110": "#24c6dc", // 태
};

// Helper: Rounded Rectangle
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

// Helper: Wrap Text
function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) {
    const chars = text.split('');
    let line = '';
    let startY = y;

    // 만약 텍스트가 너무 길면 시작 위치를 위로 조금 올립니다.
    if (text.length > 20) startY = startY - (lineHeight * 1.5);

    for (let n = 0; n < chars.length; n++) {
        const testLine = line + chars[n];
        const metrics = ctx.measureText(testLine);
        const testWidth = metrics.width;
        if (testWidth > maxWidth && n > 0) {
            ctx.fillText(line, x, startY);
            line = chars[n];
            startY += lineHeight;
        } else {
            line = testLine;
        }
    }
    ctx.fillText(line, x, startY);
}

// Helper: Load Image Async
const loadImage = (src: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "Anonymous"; // Required for Canvas toBlob export
        img.src = src;
        img.onload = () => resolve(img);
        img.onerror = (e) => reject(e);
    });
};

export const generateKoanCardImage = async (
    week: number,
    koan: string,
    userName: string,
    hexagramCode: string,
    hexagramName: string
): Promise<Blob | null> => {
    try {
        // 1. Setup Canvas (3x Resolution for High DPI)
        const canvas = document.createElement('canvas');
        const width = 320;
        const height = 568;
        const scale = 3; 
        canvas.width = width * scale;
        canvas.height = height * scale;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;

        // Scale all drawing operations
        ctx.scale(scale, scale);

        // 2. Determine Gradient Colors
        const getDynamicColors = (code: string) => {
             if (!code || code.length !== 6) return ['#1e3c72', '#2a5298']; 
            const lowerCode = code.substring(0, 3);
            const upperCode = code.substring(3, 6);
            return [TRIGRAM_PALETTE[upperCode] || '#2c3e50', TRIGRAM_PALETTE[lowerCode] || '#4ca1af'];
        };
        const [colorStart, colorEnd] = getDynamicColors(hexagramCode);
        
        // 3. Draw Background Gradient
        const gradient = ctx.createLinearGradient(0, 0, 0, height);
        gradient.addColorStop(0, colorStart);
        gradient.addColorStop(1, colorEnd);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);

        // 4. Draw Pattern Image (Seigaiha)
        try {
            // Using the specific Seigaiha (Wave) pattern URL provided/implied
            const patternUrl = "https://www.transparenttextures.com/patterns/seigaiha.png";
            const patternImg = await loadImage(patternUrl);
            const pattern = ctx.createPattern(patternImg, 'repeat');
            
            if (pattern) {
                ctx.fillStyle = pattern;
                ctx.globalAlpha = 0.15; // 은은하게 깔리도록 투명도 조절
                ctx.fillRect(0, 0, width, height);
                ctx.globalAlpha = 1.0; // Reset alpha
            }
        } catch (e) {
            console.warn("Pattern image load failed, using plain gradient", e);
        }

        // 5. Draw Light/Shadow Overlays (Vignette)
        // Light Overlay (Top-Left)
        const lightGrad = ctx.createRadialGradient(0, 0, 10, 100, 100, 300);
        lightGrad.addColorStop(0, "rgba(255,255,255,0.1)");
        lightGrad.addColorStop(1, "transparent");
        ctx.fillStyle = lightGrad;
        ctx.fillRect(0, 0, width, height);
        
        // Dark Overlay (Bottom-Right)
        const darkGrad = ctx.createRadialGradient(width, height, 10, width-100, height-100, 300);
        darkGrad.addColorStop(0, "rgba(0,0,0,0.3)");
        darkGrad.addColorStop(1, "transparent");
        ctx.fillStyle = darkGrad;
        ctx.fillRect(0, 0, width, height);

        // 6. Draw Gold Borders
        // Outer Border
        ctx.strokeStyle = "rgba(238, 189, 43, 0.4)"; // #eebd2b
        ctx.lineWidth = 1.5;
        roundRect(ctx, 12, 12, width - 24, height - 24, 20);
        ctx.stroke();

        // Inner Border
        ctx.strokeStyle = "rgba(238, 189, 43, 0.2)";
        ctx.lineWidth = 1;
        roundRect(ctx, 16, 16, width - 32, height - 32, 16);
        ctx.stroke();

        // 7. Text - Common Config
        const serifFont = "'Noto Serif KR', serif";
        const sansFont = "'Pretendard', sans-serif";
        const goldColor = "#eebd2b";
        const whiteColor = "#ffffff";

        // 8. Text - Week Header
        ctx.fillStyle = goldColor;
        ctx.font = `bold 12px ${sansFont}`;
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        const weekText = `WEEK 0${week}`;
        ctx.fillText(weekText, 32, 34);
        
        // Underline for Week
        ctx.strokeStyle = "rgba(238, 189, 43, 0.3)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(32, 50);
        ctx.lineTo(82, 50);
        ctx.stroke();

        // 9. Text - "話頭" (Vertical)
        ctx.fillStyle = goldColor;
        ctx.font = `bold 15px ${serifFont}`;
        ctx.textAlign = "center";
        ctx.fillText("話", width - 40, 34);
        ctx.fillText("頭", width - 40, 54);

        // 10. Decorative Lines (Vertical)
        // Top Center Line
        const gradTop = ctx.createLinearGradient(width/2, 80, width/2, 130);
        gradTop.addColorStop(0, "transparent");
        gradTop.addColorStop(0.5, goldColor);
        gradTop.addColorStop(1, "transparent");
        ctx.strokeStyle = gradTop;
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.moveTo(width/2, 80);
        ctx.lineTo(width/2, 130);
        ctx.stroke();

        // 11. Text - Main Koan
        ctx.globalAlpha = 1.0;
        ctx.fillStyle = whiteColor;
        ctx.font = `bold 26px ${serifFont}`; // Font size
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        // Shadow for readability
        ctx.shadowColor = "rgba(0,0,0,0.5)";
        ctx.shadowBlur = 4;
        ctx.shadowOffsetY = 2;

        const centerX = width / 2;
        const centerY = height / 2;
        const maxTextWidth = width - 80;
        const lineHeight = 40;

        wrapText(ctx, koan, centerX, centerY, maxTextWidth, lineHeight);

        // Reset Shadow
        ctx.shadowColor = "transparent";
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;

        // Bottom Center Line
        const gradBot = ctx.createLinearGradient(width/2, height - 130, width/2, height - 80);
        gradBot.addColorStop(0, "transparent");
        gradBot.addColorStop(0.5, goldColor);
        gradBot.addColorStop(1, "transparent");
        ctx.strokeStyle = gradBot;
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.moveTo(width/2, height - 130);
        ctx.lineTo(width/2, height - 80);
        ctx.stroke();
        ctx.globalAlpha = 1.0;

        // 12. Text - Footer (Hexagram Name)
        const footerY = height - 40;
        
        // Decorators around name
        ctx.fillStyle = "rgba(255,255,255,0.4)";
        ctx.fillRect(centerX - 60, footerY - 5, 32, 1);
        ctx.fillRect(centerX + 28, footerY - 5, 32, 1);

        ctx.fillStyle = goldColor;
        ctx.font = `bold 20px ${serifFont}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(hexagramName, centerX, footerY - 5);

        // Domain Name
        ctx.fillStyle = "rgba(255,255,255,0.6)";
        ctx.font = `10px ${sansFont}`;
        ctx.fillText("OPPAJEOM.COM", centerX, footerY + 15);

        // 13. Convert to Blob
        return new Promise<Blob | null>((resolve) => {
            canvas.toBlob((blob) => resolve(blob), 'image/png', 1.0);
        });

    } catch (e) {
        console.error("Native Canvas Drawing Failed:", e);
        return null;
    }
};

// --- DB OPERATIONS ---

export const createSubscription = async (
    user: UserContext,
    lines: LineValue[],
    phone: string
): Promise<Subscription | null> => {
    const hexagramCode = lines.map(l => (l % 2 !== 0 ? '1' : '0')).join('');
    const movingLines = lines
        .map((l, i) => (l === 6 || l === 9 ? i : -1))
        .filter(i => i !== -1);

    const { data, error } = await supabase
        .from('subscriptions')
        .insert({
            user_name: user.name,
            phone: phone,
            hexagram_code: hexagramCode,
            moving_lines: movingLines, // Stored as JSON array
            question: user.question,
            situation: user.situation,
            current_week: 1,
            status: 'active'
        })
        .select()
        .single();

    if (error) {
        console.error("Subscription Error:", error);
        return null;
    }
    return data;
};

export const getSubscriptionByPhone = async (phone: string): Promise<Subscription | null> => {
    const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('phone', phone)
        .order('started_at', { ascending: false })
        .limit(1)
        .single();
    
    if (error) return null;
    return data;
};

export const saveWeeklyLog = async (
    subscriptionId: string,
    week: number,
    emotion: string,
    content: WeeklyContent
): Promise<void> => {
    await supabase.from('weekly_logs').insert({
        subscription_id: subscriptionId,
        week_number: week,
        user_emotion: emotion,
        ai_content: content
    });
};

export const getPreviousLog = async (subscriptionId: string, week: number): Promise<WeeklyLog | null> => {
    // 현재 주차보다 1주 전의 로그를 가져옵니다.
    if (week <= 1) return null;
    
    const { data, error } = await supabase
        .from('weekly_logs')
        .select('*')
        .eq('subscription_id', subscriptionId)
        .eq('week_number', week - 1)
        .single();
        
    if (error) return null;
    return data as WeeklyLog;
};

export const getLogByWeek = async (subscriptionId: string, week: number): Promise<WeeklyLog | null> => {
    // 특정 주차의 로그를 정확히 가져옵니다.
    const { data, error } = await supabase
        .from('weekly_logs')
        .select('*')
        .eq('subscription_id', subscriptionId)
        .eq('week_number', week)
        .single();

    if (error) return null;
    return data as WeeklyLog;
};

// --- NOTIFICATION TRIGGER (CLIENT SIDE) ---
// 실제로는 Edge Function을 호출합니다.
export const triggerAlimTalk = async (phone: string, name: string, week: number) => {
    try {
        await supabase.functions.invoke('send-alimtalk', {
            body: { phone, name, week }
        });
    } catch (e) {
        console.error("AlimTalk Trigger Failed:", e);
    }
};