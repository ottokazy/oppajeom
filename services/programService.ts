import { GoogleGenAI, Type } from "@google/genai";
import { UserContext, LineValue, Subscription, WeeklyContent, WeeklyLog } from "../types";
import { supabase } from "./supabaseClient";
import { HEXAGRAM_TABLE } from "./hexagramData";

// Constants for LocalStorage Keys
const LOCAL_SUBS_KEY = 'oppajeom_local_subscriptions';
const LOCAL_LOGS_KEY = 'oppajeom_local_logs';

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
*주역 8괘(Trigrams)의 속성을 고려하여, 종교적 색채가 없는 보편적인 실천법을 제시하십시오. 다음 라이브러리를 적극 참고하십시오.*

1. 건(乾, 하늘) - [강건함/주도성]
하늘이 쉬지 않고 움직이듯, 그대 삶의 핸들을 단단히 잡는 시간입니다.
- [주인] 오늘 하루 가장 회피하고 싶었던 일 하나를 정해 가장 먼저 마주하기.
- [고립] 한 시간 동안 기계의 소음을 끄고, 오로지 자신의 숨소리와 대화하기.
- [지평] 탁 트인 곳에서 지평선 끝에 시선을 두고, 내 마음의 크기를 하늘만큼 넓혀보기.
- [울림] 나를 깨우는 문장 하나를 골라, 빈방에 내 목소리가 가득 차도록 낭독하기.
- [수직] 오르막길을 오르며 대지의 저항을 이겨내는 내 다리의 강건함을 확인하기.
- [통로] 현관의 신발을 정돈하며, 내 삶에 들어올 새로운 기운의 길을 닦아주기.
- [기둥] 오늘 내가 꼭 지켜낼 마음의 중심을 한 줄의 글자로 적어 책상에 두기.
- [맑음] 정신이 흐려질 때 차가운 물 한 잔을 마시며 내 안의 생명력을 일깨우기.

2. 진(震, 우레) - [시동/역동]
땅을 뚫고 솟는 새싹처럼, 정체된 기운을 깨뜨리고 나아가는 힘입니다.
- [새벽] 평소보다 조금 일찍 일어나, 어둠이 빛으로 바뀌는 찰나를 목격하기.
- [고동] 빠른 박자의 음악에 몸을 맡기고, 심장 박동이 빨라지는 것을 온몸으로 느끼기.
- [미지] 단 한 번도 가보지 않은 길을 택해 산책하며, 낯선 풍경이 주는 설렘 마주하기.
- [분출] 아무도 없는 공간에서 짧고 강한 소리를 내어, 가슴속 응어리를 밖으로 던지기.
- [질주] 10분간 숨이 턱 끝까지 차오르도록 달려, 살아있음을 온몸의 감각으로 확인하기.
- [환기] 책상 위 물건들의 위치를 바꾸어, 익숙한 공간에 새로운 바람을 불어넣기.
- [접촉] 두 손바닥을 강하게 마주 쳐서, 손끝에서 번지는 열기와 진동에 집중하기.
- [즉시] '나중에'라고 미뤄둔 사소한 일 하나를 지금 이 순간 바로 매듭짓기.

3. 곤(坤, 땅) - [포용/유순]
모든 것을 받아들여 기르는 대지처럼, 비움으로써 채워지는 이치를 배웁니다.
- [접지] 맨발로 흙이나 바닥을 밟으며, 지구의 거대한 무게감이 나를 받쳐줌을 느끼기.
- [품음] 오늘 만나는 사람의 말을 가로막지 않고, 끝까지 넉넉하게 담아주기.
- [배양] 화분의 흙을 만지거나 식물의 잎을 닦으며, 생명을 돌보는 기쁨에 젖어보기.
- [보시] 대가를 바라지 않고 누군가를 위해 문을 잡아주거나 따뜻한 눈길 보내기.
- [음미] 밥 한 술을 입에 넣고, 그것이 내 몸이 되기까지의 자연의 여정을 천천히 씹기.
- [여백] 서랍 속의 낡은 물건 하나를 비워내며, 내 마음의 빈터도 함께 넓히기.
- [긍정] 불편한 상황이 오면 "그럴 수도 있지"라고 말하며, 흐르는 강물처럼 수용하기.
- [위로] 자기 전 내 발을 손으로 어루만지며, 오늘 하루를 견딘 육체에 감사를 전하기.

4. 간(艮, 산) - [머무름/절제]
앞길이 막혔을 때 억지로 나아가지 않고, 산처럼 묵직하게 자리를 지키는 지혜입니다.
- [부동] 자리에 앉아 5분간 미동도 없이, 오직 들숨과 날숨의 드나듦만 지켜보기.
- [경계] 일과가 끝난 후 세상의 모든 연결을 끊고, 나만의 성채 안으로 들어가기.
- [멈춤] 습관적으로 찾던 간식이나 음료를 하루만 참아보며, 내 욕망의 얼굴 직시하기.
- [지탱] 벽에 등을 기대고 서서, 내 척추가 산의 줄기처럼 곧게 뻗어 있음을 감각하기.
- [관조] 창밖의 풍경을 움직이지 않는 산의 시선으로, 아무 판단 없이 10분간 바라보기.
- [정지] 걷다가 문득 멈춰 서서, 지금 이 순간 내 주변에서 들리는 세 가지 소리 찾기.
- [침묵] 누군가를 기다릴 때 스마트폰을 꺼내지 않고, 기다림 자체를 향유하기.
- [매듭] 어질러진 주변을 제자리에 되돌리며, 흩어진 마음의 조각들을 하나로 모으기.

5. 감(坎, 물) - [흐름/정화]
구덩이에 빠져도 멈추지 않는 물처럼, 유연함으로 삶의 험난함을 건너갑니다.
- [씻김] 따뜻한 물에 몸을 맡기고, 오늘 하루의 고단함이 물살을 따라 씻겨 내려감을 상상하기.
- [낙하] 유리컵에 물을 따를 때 생기는 기포와 소리를 지켜보며 내 마음의 찌꺼기 가라앉히기.
- [고백] 마음속의 응어리를 일기장에 가감 없이 쏟아내어, 글자로 흐르게 하기.
- [순응] 계획이 틀어졌을 때 저항하지 말고, 바뀐 길 위에서 새로운 풍경을 즐기기.
- [윤슬] 물 한 모금을 입안에 머금고, 내 몸속 모든 세포에 생명수가 스며듦을 느끼기.
- [유연] 물속에서 움직이듯 팔다리를 부드럽게 뻗으며, 경직된 근육에 흐름을 주기.
- [깊이] 거울 속 내 눈동자의 깊은 곳을 가만히 응시하며, 내면의 참모습과 마주하기.
- [하심] 물이 낮은 곳으로 흐르듯, 오늘 만나는 모든 인연에게 먼저 고개 숙여 인사하기.

6. 리(離, 불) - [밝음/통찰]
어둠을 밝히는 등불처럼, 복잡한 생각의 타래를 끊고 본질을 꿰뚫어 봅니다.
- [응시] 촛불이나 작은 조명 하나에 시선을 모으고, 그 빛이 내 이마를 비춘다고 생각하기.
- [광합성] 등 뒤로 쏟아지는 햇볕을 온전히 받으며, 내 안의 그늘진 생각들을 태워버리기.
- [분별] 오늘 해야 할 일들을 흰 종이에 적고, 가장 중요한 세 가지에만 빨간 동그라미 치기.
- [발견] 길가에 핀 꽃이나 사물의 색깔 속에서, 평소 보지 못했던 찬란한 빛깔 하나 찾아내기.
- [직시] 오랫동안 회피했던 문제를 똑바로 쳐다보고, 그것이 사실은 한 줌 그림자임을 깨닫기.
- [몰입] 내가 사랑하는 일에 30분간 온 마음을 다해, 시간의 흐름조차 잊어버리기.
- [품격] 단정한 옷차림으로 나를 정돈하여, 내 삶을 대하는 나의 정성스러운 태도 보이기.
- [소각] 나를 괴롭히는 단어 하나를 적어 잘게 찢은 뒤, 바람에 날려 보내듯 버리기.

7. 손(巽, 바람) - [스며듦/유연]
틈새를 파고드는 바람처럼, 부드러운 태도로 닫힌 마음의 문을 엽니다.
- [통풍] 모든 창문을 열어 묵은 공기를 내보내고, 계절의 냄새가 실린 새 공기를 들여놓기.
- [향기] 숲의 향이나 꽃의 향기를 깊게 들이마시며, 향기가 내 몸의 결을 따라 퍼지게 하기.
- [스침] 바람이 부는 곳에 서서, 바람이 내 머리카락과 살결을 스치는 자유로운 감각 느끼기.
- [전파] 가까운 이에게 아무런 용건 없이, 그저 "생각나서 연락했다"는 따뜻한 안부 전하기.
- [순환] 가슴 깊은 곳까지 숨을 채웠다가, 내 안의 모든 긴장을 실어 길게 내뱉기.
- [스며듦] 낯선 사람에게 부드러운 미소와 함께 가벼운 목례를 건네며 세상과 연결되기.
- [부드러움] 바람에 흔들리는 나뭇가지처럼, 목과 어깨를 천천히 돌리며 긴장의 매듭 풀기.
- [용서] 타인의 작은 실수를 바람이 불어 가듯 너그럽게 웃으며 넘겨주기.

8. 태(兌, 연못) - [기쁨/나눔]
맑은 연못가에서 나누는 대화처럼, 내 안의 즐거움을 밖으로 흘려보내 공명합니다.
- [미소] 거울 속의 나를 향해, 세상에서 가장 다정한 친구를 대하듯 환하게 웃어주기.
- [담소] 소중한 사람과 마주 앉아 차 한 잔을 나누며, 가벼운 농담으로 마음의 빗장 풀기.
- [탐닉] 아름다운 그림이나 사진을 감상하며, 시각적인 기쁨이 주는 충만함에 젖기.
- [감사] 오늘 나에게 찾아온 작은 행운 세 가지를 손가락으로 꼽으며 기록하기.
- [대접] 나를 위해 정성껏 차린 음식을 예쁜 그릇에 담아, 스스로를 귀하게 대접하기.
- [해학] 한바탕 크게 웃을 수 있는 일을 찾아, 내 몸속의 모든 세포가 함께 웃게 하기.
- [찬사] 오늘 하루를 잘 살아낸 나 자신에게, 작은 꽃 한 송이나 좋아하는 것을 선물하기.
- [화합] 서먹했던 관계 사이에 부드러운 말 한마디를 건네, 기쁨의 파동 만들기.

---

# 4. Output Structure (JSON)
반드시 다음 JSON 구조로 응답하십시오.

{
  "koan": "이 주의 질문 (Insight Question) - 법륜 스님처럼 정곡을 찌르되, 선문답(Zen)의 형식을 빌린 '자연의 역설' 질문. (반드시 물음표로 끝낼 것)",
  "deep_insight": "자연의 해석 (Interpretation) - 괘상 풀이와 본질 직시. 법정의 감성(수채화 묘사)과 법륜의 논리(순리) 조화. 문단 구분(\\n\\n) 필수.",
  "weekly_ritual": "금주의 실천 (Ritual) - [실천 제목(동사형으로 끝맺음, 예: 관조하기)]\\n\\n구체적 가이드. **(중요: 본문은 쉼표(,)에서 절대 줄바꿈하지 말고, 문장이 마침표(.)로 끝날 때만 줄바꿈(\\n\\n) 하십시오. 시(Poem)처럼 끊어 쓰지 말고 문장 단위로 완성하십시오.)**"
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
  "weekly_ritual": "[물건 비우기]\\n\\n나무가 잎을 떨구듯, 우리도 눈에 보이는 것부터 비워봐요.\\n\\n방을 둘러보고, 더 이상 설레지 않는 물건 딱 하나만 골라 버려보세요.\\n\\n물건이 나간 자리에 생기는 빈 공간만큼, 그대의 마음에도 새 숨이 트일 거예요."
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

    // [RETRY LOGIC] Network glitch protection
    const MAX_RETRIES = 3;
    let attempt = 0;

    while (attempt < MAX_RETRIES) {
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
            throw new Error("No response text from AI");

        } catch (e) {
            console.warn(`Content Gen Attempt ${attempt + 1} Failed:`, e);
            attempt++;
            if (attempt >= MAX_RETRIES) {
                console.error("All retries failed. Returning fallback content.");
                return {
                    week,
                    koan: "그대의 발이 멈췄을 때, 마음은 어디로 달리고 있는가?",
                    // [FIX] Use actual newlines (\n) instead of escaped string literals (\\n) for raw text fallback
                    reflection: "연결이 끊어졌습니다.\n\n이 단절 또한 하나의 신호입니다. 외부의 소음을 끄고 침묵 속으로 들어가세요.",
                    action_item: "[단절하기]\n\n1분간 전자기기를 끄고 눈을 감으세요."
                };
            }
            // Simple backoff
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
    }
    
    // Should not reach here due to return in loop
    throw new Error("Unexpected end of generation");
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

// --- DB OPERATIONS (WITH LOCAL STORAGE FALLBACK) ---

// UUID 생성 헬퍼 (구형 브라우저 지원용)
function generateUUID() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

export const createSubscription = async (
    user: UserContext,
    lines: LineValue[],
    phone: string
): Promise<Subscription | null> => {
    const hexagramCode = lines.map(l => (l % 2 !== 0 ? '1' : '0')).join('');
    const movingLines = lines
        .map((l, i) => (l === 6 || l === 9 ? i : -1))
        .filter(i => i !== -1);

    const newSub: Subscription = {
        id: generateUUID(),
        user_name: user.name,
        phone: phone,
        hexagram_code: hexagramCode,
        moving_lines: movingLines,
        situation: user.situation,
        current_week: 1,
        started_at: new Date().toISOString(),
        status: 'active'
    };

    // 1. Try Supabase Insert
    try {
        const { data, error } = await supabase
            .from('subscriptions')
            .insert({
                ...newSub,
                moving_lines: movingLines // Pass array directly, supabase js handles jsonb
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    } catch (e) {
        console.warn("Supabase insert failed, falling back to LocalStorage:", e);
        
        // 2. Fallback to LocalStorage
        try {
            const localSubs = JSON.parse(localStorage.getItem(LOCAL_SUBS_KEY) || '[]');
            // 중복 방지 (같은 전화번호가 있으면 덮어쓰기 대신 추가 - 히스토리 관리)
            localSubs.push(newSub);
            localStorage.setItem(LOCAL_SUBS_KEY, JSON.stringify(localSubs));
            return newSub;
        } catch (localErr) {
            console.error("LocalStorage write failed:", localErr);
            return null;
        }
    }
};

export const getSubscriptionByPhone = async (phone: string): Promise<Subscription | null> => {
    // 1. Try Supabase Select
    try {
        const { data, error } = await supabase
            .from('subscriptions')
            .select('*')
            .eq('phone', phone)
            .order('started_at', { ascending: false })
            .limit(1)
            .single();
        
        if (data) return data;
        // PGRST116 is "The result contains 0 rows"
        if (error && error.code !== 'PGRST116') throw error; 
    } catch (e) {
        console.warn("Supabase select failed or empty, checking LocalStorage:", e);
    }

    // 2. Fallback to LocalStorage
    try {
        const localSubs = JSON.parse(localStorage.getItem(LOCAL_SUBS_KEY) || '[]');
        // Find most recent matching phone
        const found = localSubs
            .filter((sub: any) => sub.phone === phone)
            .sort((a: any, b: any) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())[0];
        
        return found || null;
    } catch (e) {
        return null;
    }
};

export const saveWeeklyLog = async (
    subscriptionId: string,
    week: number,
    emotion: string,
    content: WeeklyContent
): Promise<void> => {
    const logData = {
        subscription_id: subscriptionId,
        week_number: week,
        user_emotion: emotion,
        ai_content: content,
        created_at: new Date().toISOString()
    };

    // 1. Try Supabase Insert
    try {
        const { error } = await supabase.from('weekly_logs').insert(logData);
        if (error) throw error;
    } catch (e) {
        console.warn("Supabase log insert failed, falling back to LocalStorage");
        // 2. Fallback
        const localLogs = JSON.parse(localStorage.getItem(LOCAL_LOGS_KEY) || '[]');
        localLogs.push(logData);
        localStorage.setItem(LOCAL_LOGS_KEY, JSON.stringify(localLogs));
    }
};

export const getPreviousLog = async (subscriptionId: string, week: number): Promise<WeeklyLog | null> => {
    if (week <= 1) return null;
    const targetWeek = week - 1;

    // 1. Try Supabase
    try {
        const { data, error } = await supabase
            .from('weekly_logs')
            .select('*')
            .eq('subscription_id', subscriptionId)
            .eq('week_number', targetWeek)
            .single();
            
        if (data) return data as WeeklyLog;
        if (error && error.code !== 'PGRST116') throw error;
    } catch (e) {
        console.warn("Supabase log fetch failed, checking LocalStorage");
    }

    // 2. LocalStorage Fallback
    try {
        const localLogs = JSON.parse(localStorage.getItem(LOCAL_LOGS_KEY) || '[]');
        const found = localLogs.find((log: any) => 
            log.subscription_id === subscriptionId && log.week_number === targetWeek
        );
        return found || null;
    } catch (e) {
        return null;
    }
};

export const getLogByWeek = async (subscriptionId: string, week: number): Promise<WeeklyLog | null> => {
    // 1. Try Supabase
    try {
        const { data, error } = await supabase
            .from('weekly_logs')
            .select('*')
            .eq('subscription_id', subscriptionId)
            .eq('week_number', week)
            .single();

        if (data) return data as WeeklyLog;
        if (error && error.code !== 'PGRST116') throw error;
    } catch (e) {
        console.warn("Supabase log fetch failed, checking LocalStorage");
    }

    // 2. LocalStorage Fallback
    try {
        const localLogs = JSON.parse(localStorage.getItem(LOCAL_LOGS_KEY) || '[]');
        const found = localLogs.find((log: any) => 
            log.subscription_id === subscriptionId && log.week_number === week
        );
        return found || null;
    } catch (e) {
        return null;
    }
};

// --- NOTIFICATION TRIGGER (CLIENT SIDE) ---
// 실제로는 Edge Function을 호출합니다.
export const triggerAlimTalk = async (phone: string, name: string, week: number) => {
    try {
        await supabase.functions.invoke('send-alimtalk', {
            body: { phone, name, week }
        });
    } catch (e) {
        // 알림톡 발송 실패는 치명적이지 않으므로 로그만 남깁니다.
        console.error("AlimTalk Trigger Failed (Network/Supabase Error):", e);
    }
};