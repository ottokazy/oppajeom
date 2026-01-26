import { GoogleGenAI, Type } from "@google/genai";
import { UserContext, AnalysisResult, JournalFeedback } from "../types";

// [New Persona] The Stoic Sage (Global/Modern)
const SYSTEM_INSTRUCTION = `
You are 'The Sage', a wise mentor who fuses the ancient wisdom of the I Ching with the practical philosophy of Stoicism.
Your goal is to guide the user from emotional turmoil to a state of 'Ataraxia' (tranquility) and 'Action'.

**Context**: 
The user has just received an I Ching divination and has written a journal entry about their feelings.
You must analyze their journal in the context of their Hexagram.

**Persona Guidelines**:
1.  **Tone**: Calm, Meditative, Deep, yet Modern. Use a "Serif" voice (Authoritative yet Gentle).
2.  **Philosophy**:
    -   **I Ching**: View change as inevitable. "The only constant is change."
    -   **Stoicism**: Focus on what can be controlled. Distinguish between internal (mind) and external (events).
3.  **Language**: Write in **Korean** (unless the user writes in another language). Use refined, literary Korean (e.g., "그대는...", "~합니다").

**Output Format**:
Return a JSON object with:
-   title: A poetic title for your feedback.
-   quote: A short, resonant quote (can be from Marcus Aurelius, Seneca, or a rephrased I Ching line).
-   reflection: A deep, paragraph-based reflection on their journal. Connect their thoughts to the Hexagram.
-   actionItem: One single, simple, meditative action they can do right now (e.g., "Drink a glass of warm water," "Write down 3 fears").
`;

const getApiKey = (): string | undefined => {
    try {
        return process.env.API_KEY;
    } catch (e) {
        return undefined;
    }
};

export const analyzeJournalEntry = async (
    user: UserContext,
    analysis: AnalysisResult,
    journalText: string
): Promise<JournalFeedback> => {
    // Use the Pro model for deep reasoning (Complex Text Task)
    const model = "gemini-3-pro-preview"; 
    
    const apiKey = getApiKey();
    if (!apiKey) throw new Error("API Key Missing");

    const genAI = new GoogleGenAI({ apiKey: apiKey });

    const prompt = `
    [User Profile]
    Name: ${user.name}
    Question: ${user.question}
    Situation: ${user.situation}
    
    [Divination Context]
    Hexagram: ${analysis.hexagram.name} (${analysis.hexagram.hanja})
    Core Meaning: ${analysis.hexagram.explanation.substring(0, 200)}...
    
    [User's Journal Entry]
    "${journalText}"
    
    Based on the I Ching hexagram and the user's honest reflection, provide Stoic guidance.
    If the user seems anxious, ground them. If they are complacent, urge them to action.
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
                        title: { type: Type.STRING },
                        quote: { type: Type.STRING },
                        reflection: { type: Type.STRING },
                        actionItem: { type: Type.STRING }
                    },
                    required: ["title", "quote", "reflection", "actionItem"]
                }
            }
        });

        if (response.text) {
            return JSON.parse(response.text) as JournalFeedback;
        }
        throw new Error("No response");

    } catch (error) {
        console.error("Journal Analysis Failed:", error);
        return {
            title: "침묵의 지혜",
            quote: "물은 웅덩이를 채우지 않고는 나아가지 않는다.",
            reflection: "지금은 마음이 복잡하여 하늘의 소리가 닿지 않는 듯합니다. 잠시 눈을 감고 호흡을 가다듬으세요.",
            actionItem: "잠시 휴대폰을 끄고 1분간 눈을 감으세요."
        };
    }
};