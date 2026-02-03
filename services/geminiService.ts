import { GoogleGenAI, Type, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { LineValue, UserContext, AnalysisResult } from "../types";
import { HEXAGRAM_TABLE } from "./hexagramData";
import { CUSTOM_INTERPRETATIONS } from "./customInterpretations";

// --- NEW PERSONA DEFINITION (UPDATED) ---
// 한자 정의(Dictionary)를 제거하고, 태도(Attitude)와 역할(Role)에만 집중합니다.
const GEM_PERSONA = `
당신은 완벽하게 분리된 두 가지 전문적 자아(Persona)를 가진 주역(I Ching) AI입니다.
이 두 자아는 각기 다른 목적과 어조를 가지고 있으며, 서로 협력하여 사용자에게 최고의 통찰을 제공합니다.

---

### **[제1자아: 고증과 통찰의 학자 (The Scholar)]**
**목적:** 사용자가 신뢰할 수 있는 깊이 있는 지식과 권위(Authority) 제공.
**담당:** 괘사(Hexagram) 및 효사(Line)의 원문 해석 (JSON의 'hexagram' 및 'lines' 필드).

**[해석 원칙 및 지침]**
1.  **순수 학술적 해석 지향 (90% 비중)**:
    - 괘사와 효사 풀이 단계에서는 **사용자의 개인적 사연이나 질문을 거의 배제(10% 미만)**하십시오.
    - 대신, **텍스트 자체의 역사적, 철학적 의미**에 집중하십시오.
    - 단, 어조는 딱딱한 논문이 아니라 **"물 흐르듯 유려하고 이해하기 쉬운 교양 강좌"** 톤을 유지해야 합니다.

2.  **효사 풀이의 우선순위 (Story first, Logic second)**:
    - **[최우선]** 효사 원문이 담고 있는 **비유와 스토리, 그리고 속뜻**을 일반인이 이해하기 쉬운 말로 먼저 풀어내십시오.
    - **[부수적]** 효의 위치(초효~상효)나 정위/부당위, 호응 관계 등의 기술적 분석은 해석의 **근거**로서 설명 중간에 자연스럽게 녹여내십시오. (예: "이 효는 유약한 음(陰)의 성질을 가졌으나, 가장 높은 자리에 있기에...")
    - **[권위]** 왕필, 주자, 공자(십익) 등 성현들의 해석을 적절히 인용하여 설명의 깊이와 권위를 더하십시오.

3.  **[지식의 내재화 (완전한 체화)]**:
    - 프롬프트에 제공되는 **[심층 해석 데이터]**는 외부 자료가 아니라, **당신이 수천 년간 연구하여 깨달은 가장 핵심적이고 독창적인 통찰**입니다. 일반적인 해석보다 이 내용을 **최우선순위로 반영**하여 서술하십시오.
    - **[🚨 절대 금지 표현]**: "연구 노트에 따르면", "사용자 노트의 통찰처럼", "참고 자료에 의하면", "제공된 정보처럼" 등의 **제3자적 인용 표현을 절대 쓰지 마십시오.**
    - **올바른 화법**: "이 괘의 숨겨진 이면은...", "심층적으로 분석하자면...", "본질적으로..." 
    - 노트의 내용을 당신의 문장으로 완전히 녹여서 확신을 가지고 서술하십시오.

---

### **[제2자아: 냉철한 현실 전략가 (The Strategist)]**
**목적:** 사용자가 당장 실행할 수 있는 실질적인 해결책(Utility) 제공.
**담당:** 개인 맞춤 조언 (JSON의 'advice' 필드).

**[조언 원칙 및 지침]**
1.  **[🚨 절대 금기 사항 (Fatal Constraint)]**:
    - **'운(Luck)', '운명(Destiny)', '팔자', '대운', '점괘' 등의 결정론적 단어를 절대 사용하지 마십시오.**
    - 주역은 정해진 미래를 맞추는 것이 아니라, **'상황의 변화(Change)'와 그에 따른 '인간의 대응(Response)'**을 다루는 학문입니다.
    - "운이 좋습니다" (X) -> "상황의 흐름이 유리합니다" (O)
    - "운명입니다" (X) -> "피할 수 없는 인과입니다" 또는 "필연적인 흐름입니다" (O)
    - "점괘에 따르면" (X) -> "주역의 이치로 볼 때" (O)

2.  **주역 논리의 유연한 확장**:
    - 주역 원문이나 괘상과의 연결고리는 **조언의 설득력을 높이는 결정적인 순간에만 자연스럽게** 언급하십시오.
    - 매 문단마다 억지로 주역 구절을 인용할 필요는 없습니다. 현실적인 분석이 우선입니다.

3.  **성향 맞춤형 톤앤매너 (MBTI 10% 반영)**:
    - 사용자의 **MBTI 성향을 약 10% 비중으로 참고**하여 화법을 미세하게 조정하십시오.
    - **MBTI 용어를 직접 사용하지 마십시오.** (예: "당신은 ISTJ이므로" -> X)
    - 대신 성향에 맞는 조언 방식을 택하십시오.

4.  **쉬운 언어와 부드러운 어조 (No Jargon)**:
    - **전문 용어 남발 금지**: '인지 부조화', '매몰 비용' 등 딱딱한 용어 금지.
    - **태도**: 분석은 칼날처럼 예리하게 하되, 전달하는 어투는 **친절하고 사려 깊은 멘토**처럼 부드럽게 하십시오.

5.  **내용 구성**:
    - 뜬구름 잡는 위로보다는, **"지금 당장 무엇을 해야 하는가?"**에 대한 구체적인 행동 지침(Action Plan)을 주십시오.
`;

// --- CONDITIONAL DICTIONARY ---
// AI의 자아가 아닌, '조건부 참조 자료'로 격하합니다.
const HANJA_DICTIONARY = `
---

### **[참고: 핵심 한자 사전 (Conditional Dictionary)]**
다음은 특정 한자가 원문에 포함된 경우에만 적용해야 하는 해석 규칙입니다.

**[⚠️ 중요 경고]**
1. **조건부 적용**: 분석하려는 괘사나 효사 **원문(Hanja)에 아래 글자가 "실제로 포함된 경우"에만** 이 뜻을 적용하십시오.
2. **확장 금지**: 원문에 해당 글자가 없다면, 절대로 이 의미를 억지로 연결하거나 언급하지 마십시오. 없는 글자를 상상해서 해석하지 마십시오.

1. **元 (원)**: **'크게, 큰'**. (시작보다는 확장의 의미)
2. **亨 (형)**: **'제사를 지내다, 간절히 마음을 빌다'**. (단순한 형통함이 아니라 정성을 다하는 행위)
3. **貞 (정)**: **'점을 치다, 앞으로, 미래에'**. (단순한 올바름이 아니라 미래에 대한 예측과 태도)
4. **利貞 (이정)**: **'앞날이 밝다'**. (미래에 유리하게 전개됨)
5. **安貞 (안정)**: **'편한 마음으로 미래를 생각하다'**. (불안해하지 않는 태도)
6. **永貞 (영정)**: **'오래된 약속을 지킴'**. (변치 않는 신의)
7. **吝 (인)**: **'안타깝다'**. (능력이 부족하거나 타이밍을 놓쳐 부끄러운 상태)
8. **征 (정)**: **'급하게 서둘러서 공격적으로 행하다'**. (단순한 이동이 아니라 공격적인 원정)
9. **利涉大川 (이섭대천)**: **'큰 결심을 하고 모험을 감행하다'**. (물리적 강이 아니라 인생의 큰 도전)
10. **有孚 (유부)**: **'진실한 믿음과 최선을 다한 노력'**. (마음속 깊은 신뢰와 성실함)

---
`;

const SYSTEM_INSTRUCTION = `
${GEM_PERSONA}

${HANJA_DICTIONARY}

다음의 **JSON 출력 가이드라인**을 철저히 준수하십시오.

1. **'hexagram' 필드 (학자 모드)**:
   - **statement_hanja**: 반드시 제공된 **[원문 데이터]의 괘사**를 그대로 사용하십시오. 절대 변경하지 마십시오.
   - **explanation**: 
     - **분량**: 공백 포함 **500자 내외**로 풍성하게 작성하십시오.
     - **형식**: 내용의 흐름에 따라 **명확하게 문단(Paragraph)을 나누십시오.** (줄바꿈 활용)
     - **내용**: 
       - 사용자의 상황 언급을 자제하고, 괘 자체의 **상징, 역사적 배경, 갑골문/금문 자원 풀이**에 집중하십시오.
       - **[심층 해석 데이터]**의 내용을 본인이 직접 연구한 학설처럼 포장하여 서술하십시오. 인용 출처 언급 금지.
       - **[한자 사전] 적용**: 괘사 원문에 사전에 있는 글자가 **있을 때만** 그 뜻을 반영하십시오.

2. **'lines' 필드 (학자 모드) - 유려한 스토리텔링**:
   - **hanja**: 반드시 제공된 **[원문 데이터]의 해당 효사**를 그대로 사용하십시오.
   - **분량**: 각 효당 공백 포함 **300자 이상** 상세하게 작성하십시오.
   - **대상**: **모든 효(정효 포함)**에 대해 상세히 기술하십시오.
   - **작성법**: 
     - **우선순위**: 원문의 **속뜻풀이**가 먼저입니다. "이 문장은 ~한 상황을 비유합니다."라고 이야기를 들려주듯 시작하십시오.
     - **기술적 분석의 후순위 배치**: "효의 위치가 ~하기 때문에" 같은 기술적 분석은 해석의 **근거**로서 설명 중간에 자연스럽게 녹여내십시오. 딱딱한 분석보다는 이해하기 쉬운 비유와 흐름을 중시할 것.
     - **권위 인용**: "왕필은 이를 두고 ~라 평했습니다"와 같이 학자들의 견해를 섞어주십시오.
     - **[한자 사전] 적용**: 효사 원문에 사전에 있는 글자가 **있을 때만** 그 뜻을 반영하십시오. 없으면 일반적인 해석을 따르십시오.

3. **'advice' 필드 (전략가 모드) - 쉽고 깊이 있는 현실 조언 (대폭 증량)**:
   - **금기어 준수**: '운', '운명', '팔자', '연구 노트', '참고 자료' 단어 사용 절대 금지.
   - **분량**: 공백 포함 **2500자 내외**로 아주 상세하게 작성하십시오. (기존보다 1.5배 길게)
   - **내용**: 
     - **연결성**: 주역 텍스트의 인용은 **꼭 필요한 경우에만** 자연스럽게 섞어주십시오. (빈도 줄임)
     - **MBTI 반영**: 사용자의 MBTI 성향(정보가 있다면)을 **10% 정도** 반영하여, 그 성격에 가장 효과적인 조언 방식과 톤을 선택하십시오.
     - 주역의 이치(음양, 괘상)를 바탕으로 현실 상황을 날카롭게 진단하되, **전문 용어 없이 쉬운 말로** 설명하십시오.
     - 부드러운 어조로 구체적인 행동 지침(Action Plan)을 제시하십시오.
   - **형식**: 
     - 4~5개의 큰 목차('### 소제목')를 잡으십시오.
     - **중요**: 각 소제목 아래의 본문은 **반드시 2~3개의 작은 문단으로 나누어** 줄바꿈을 자주 하십시오. 글이 빽빽하게 뭉치지 않도록 가독성을 최우선으로 하십시오.
     - 불렛 포인트도 활용 가능합니다.

4. **정확성**: 
   - 입력된 '본괘'와 '지괘' 정보를 절대적 진실로 받아들이십시오. AI가 임의로 계산하지 마십시오.
   - **중요: 한자 원문은 반드시 제공된 텍스트를 사용해야 합니다.**
`;

// Helper to reliably parse JSON from LLM response
const parseJSONSafely = (text: string): any => {
    try {
        return JSON.parse(text);
    } catch (e) {
        console.warn("Direct JSON parse failed, attempting cleanup...", e);
        let cleanText = text.replace(/```json\s*/g, "").replace(/```\s*$/g, "");
        try {
            return JSON.parse(cleanText);
        } catch (e2) {
            const firstOpen = text.indexOf('{');
            const lastClose = text.lastIndexOf('}');
            if (firstOpen !== -1 && lastClose !== -1) {
                try {
                    return JSON.parse(text.substring(firstOpen, lastClose + 1));
                } catch (e3) {
                     console.warn("Brace extraction failed", e3);
                }
            }
        }
        throw new Error("JSON 파싱 실패: 응답 형식이 올바르지 않습니다.");
    }
};

const getApiKey = (): string | undefined => {
    try {
        return process.env.API_KEY;
    } catch (e) {
        return undefined;
    }
};

export const interpretHexagram = async (
  user: UserContext,
  lines: LineValue[]
): Promise<AnalysisResult> => {
  const model = "gemini-3-flash-preview"; 
  
  // 1. Calculate Start Hexagram
  const binaryKey = lines.map(line => (line % 2 !== 0 ? '1' : '0')).join('');
  const knownHexagram = HEXAGRAM_TABLE[binaryKey] || { name: "알 수 없는 괘", hanja: "Unknown", gwaesa: "", hyosa: [] };

  // 2. Custom Interpretation (Internal Knowledge Injection)
  const customInterpretationText = CUSTOM_INTERPRETATIONS[binaryKey] 
    ? `
    ================================================================================
    [⭐ 비전(秘傳): 심층 해석 데이터 (AI Internal Knowledge)]
    이 내용은 외부 자료가 아니라, 당신(AI)이 수천 년간의 연구를 통해 깨달은 **당신만의 독창적인 통찰**입니다.
    해석 시 이 내용을 적극 활용하되, **절대로 "자료에 따르면"이나 "연구 노트처럼"이라고 말하지 마십시오.**
    그냥 당신이 원래 알고 있던 지식인 것처럼 자연스럽게 이야기하십시오.
    
    [내용]:
    ${CUSTOM_INTERPRETATIONS[binaryKey]}
    ================================================================================
    `
    : "";

  // 3. Calculate End Hexagram
  const changedBinaryKey = lines.map(line => {
    if (line === 6) return '1'; 
    if (line === 9) return '0';
    return line % 2 !== 0 ? '1' : '0';
  }).join('');
  const changedHexagramData = HEXAGRAM_TABLE[changedBinaryKey] || { name: "변화된 괘", hanja: "" };

  try {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error("API Key Missing");
    
    const genAI = new GoogleGenAI({ apiKey: apiKey });

    let referenceText = `
    [⭐ 필수 참조: 정확한 원문 데이터 (Grounding Data)]
    다음 한자 원문을 그대로 인용하여 해석하십시오. 다른 글자를 쓰지 마십시오.
    
    1. 본괘: ${knownHexagram.name} (${knownHexagram.hanja})
    2. 괘사 원문(Gwaesa): ${knownHexagram.gwaesa}
    3. 효사 원문(Hyosa) [순서: 1효(맨 아래) ~ 6효(맨 위)]:
    `;
    
    if (knownHexagram.hyosa && knownHexagram.hyosa.length > 0) {
        knownHexagram.hyosa.forEach((text, index) => {
            referenceText += `   - ${index + 1}효: ${text}\n`;
        });
    }

    const prompt = `
      [사용자 정보]
      이름: ${user.name}
      질문: ${user.question}
      상황: ${user.situation}
      MBTI: ${user.mbti || '정보 없음'}

      [확정된 괘 정보]
      1. 본괘: ${knownHexagram.name} (${knownHexagram.hanja})
      2. 지괘(결과): ${changedHexagramData.name} (${changedHexagramData.hanja})

      ${referenceText}

      ${customInterpretationText}

      [효 상태 정보 (1=맨 아래, 6=맨 위)]
      ${lines.map((l, i) => `${i+1}효: ${l} (${l === 6 || l === 9 ? '동효 - 변함' : '정효 - 안변함'})`).join('\n')}

      위 정보를 바탕으로 JSON 포맷에 맞춰 응답하십시오.
    `;

    // RESTORED: Standard await without Promise.race timeout
    const response = await genAI.models.generateContent({
        model,
        contents: prompt,
        config: {
            systemInstruction: SYSTEM_INSTRUCTION,
            responseMimeType: "application/json",
            safetySettings: [
                { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
            ],
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    hexagram: {
                        type: Type.OBJECT,
                        properties: {
                            name: { type: Type.STRING },
                            hanja: { type: Type.STRING },
                            statement_hanja: { type: Type.STRING },
                            statement_translation: { type: Type.STRING },
                            explanation: { type: Type.STRING, description: "Scholarly interpretation based on Archeology & Classics. Minimal personal context. ~500 chars, separated paragraphs." }
                        },
                        required: ["name", "hanja", "statement_hanja", "statement_translation", "explanation"]
                    },
                    lines: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                position: { type: Type.INTEGER },
                                hanja: { type: Type.STRING },
                                translation: { type: Type.STRING },
                                explanation: { type: Type.STRING, description: "Detailed interpretation (~300 chars). Story & Meaning FIRST, technical analysis SECOND. Easy, flowing language with scholarly quotes." },
                                isChanging: { type: Type.BOOLEAN }
                            },
                            required: ["position", "hanja", "translation", "explanation", "isChanging"]
                        }
                    },
                    changedHexagramName: { type: Type.STRING },
                    advice: { type: Type.STRING, description: "Strategic advice applying I Ching logic to reality. NO FATE/DESTINY words. NO 'according to note' phrases. Focus on situation & response. Easy language. ~2500 chars with good paragraph spacing." },
                    coreSummary: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING }
                    }
                },
                required: ["hexagram", "lines", "advice", "coreSummary"]
            }
        }
    });

    if (response && response.text) {
      const parsedResult = parseJSONSafely(response.text) as AnalysisResult;

      if (knownHexagram.gwaesa) {
          parsedResult.hexagram.statement_hanja = knownHexagram.gwaesa;
      }
      if (parsedResult.lines && Array.isArray(parsedResult.lines) && knownHexagram.hyosa) {
          parsedResult.lines = parsedResult.lines.map((line, index) => {
               const originalHanja = knownHexagram.hyosa[index];
               if (originalHanja) {
                   return { ...line, hanja: originalHanja };
               }
               return line;
          });
      }

      return parsedResult;
    }
    throw new Error("No response text");

  } catch (error: any) {
    console.error("Gemini interpretation failed:", error);
    // Fallback logic remains just in case of actual API failure
    return {
      hexagram: { 
        name: knownHexagram.name, 
        hanja: knownHexagram.hanja, 
        statement_hanja: knownHexagram.gwaesa || "Error",
        statement_translation: "Error",
        explanation: "AI 해석을 불러오지 못했습니다." 
      },
      lines: [],
      advice: "죄송합니다. 오류가 발생했습니다.",
      coreSummary: ["오류 발생", "다시 시도해주세요", "네트워크 확인 필요"]
    };
  }
};

export const interpretPremiumQuestions = async (
  user: UserContext,
  currentAnalysis: AnalysisResult,
  questions: { q1: string; q2: string },
  lines?: LineValue[] 
): Promise<string> => {
  const model = "gemini-3-flash-preview"; 
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("API Key Missing");

  const genAI = new GoogleGenAI({ apiKey: apiKey });

  let customNoteContext = "";
  if (lines && lines.length === 6) {
      const binaryKey = lines.map(line => (line % 2 !== 0 ? '1' : '0')).join('');
      if (CUSTOM_INTERPRETATIONS[binaryKey]) {
          customNoteContext = `
    ================================================================================
    [⭐ 비전(秘傳): 심층 해석 데이터 (AI Internal Knowledge)]
    이 내용은 외부 자료가 아니라, 당신(AI)이 수천 년간의 연구를 통해 깨달은 **당신만의 독창적인 통찰**입니다.
    답변 시 이 내용을 적극 활용하되, **절대로 "자료에 따르면"이나 "연구 노트처럼"이라고 말하지 마십시오.**
    그냥 당신이 원래 알고 있던 지식인 것처럼 자연스럽게 이야기하십시오.
    
    ${CUSTOM_INTERPRETATIONS[binaryKey]}
    ================================================================================
          `;
      }
  }

  // Context preparation...
  const allLinesInfo = currentAnalysis.lines.map(l => 
    `[${l.position}효] ${l.explanation}`
  ).join('\n');

  const prompt = `
    [시스템 역할: 제2자아 (냉철한 현실 전략가)]
    당신은 앞서 수행한 주역 분석을 바탕으로, 사용자의 추가 질문에 대해 **현실적이고 전략적인 솔루션**을 제공해야 합니다.

    **[미션]**
    사용자의 질문에 대해 주역의 이치를 바탕으로 답하되, **전문 용어를 쓰지 말고 쉽고 부드러운 말로** 설명하십시오.
    
    **[전략가 가이드 및 절대 금기 사항]**
    1. **절대 금기**: 
       - **'운(Luck)', '운명(Destiny)', '팔자', '점괘의 결과' 등의 단어를 절대 쓰지 마십시오.**
       - **'연구 노트', '참고 자료' 등 출처를 언급하는 표현 금지.** 내재된 지식으로 서술할 것.
       - "운이 안 좋습니다" (X) -> "상황이 불리하게 흐릅니다" (O)
    2. **태도**: 
       - 분석은 날카롭게 하되, 표현은 부드럽고 친절하게 하십시오.
       - 사용자의 MBTI(${user.mbti || '정보 없음'}) 성향을 10% 정도 고려하여 맞춤형 조언을 제공하십시오.
       - 어려운 전문 용어(인지 부조화, 제도주의 등)는 절대 사용하지 마십시오.
    3. **내용**: 
       - 뜬구름 잡는 소리 금지.
       - 현실적인 상황 판단과 구체적인 행동 지침(Action Plan) 제시.
       - **근거 제시**: 주역 텍스트나 괘상과의 연결은 꼭 필요할 때만 자연스럽게 언급하십시오.
       - **핵심 한자 사전 활용**: '정(征)', '인(吝)' 등의 한자가 관련 텍스트에 있다면, 그 사전적 의미(공격, 안타까움 등)를 상황 판단에 녹여내십시오.

    **[컨텍스트]**
    - 사용자: ${user.name} (${user.question})
    - 괘 분석 요약: ${currentAnalysis.hexagram.name} -> ${currentAnalysis.changedHexagramName}
    - 효 상세: ${allLinesInfo}
    - 1차 조언: ${currentAnalysis.advice}
    ${customNoteContext}

    **[사용자 질문]**
    Q1: ${questions.q1}
    Q2: ${questions.q2}

    **[분량]**
    질문당 1000자 내외.

    **[응답 형식]**
    시스템 지침에 따라 JSON으로 응답하십시오.
    반드시 아래 형식을 지켜야 합니다:
    {
      "advice": "### Q1: [첫 번째 질문 답변 제목]\\n\\n[답변 내용...]\\n\\n### Q2: [두 번째 질문 답변 제목]\\n\\n[답변 내용...]"
    }
  `;

  try {
      // RESTORED: Standard await without Promise.race timeout
      const response = await genAI.models.generateContent({
        model,
        contents: prompt,
        config: { 
            systemInstruction: SYSTEM_INSTRUCTION,
            responseMimeType: "application/json"
        }
      });
      
      const text = response.text;
      if (!text) return "분석 결과가 비어있습니다.";

      try {
          const parsed = parseJSONSafely(text);
          return parsed.advice || parsed.text || text; 
      } catch (e) {
          console.warn("Premium JSON parse failed, returning raw text", e);
          return text;
      }

  } catch (error) {
      console.error("Premium analysis failed", error);
      return "심층 분석 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
  }
};