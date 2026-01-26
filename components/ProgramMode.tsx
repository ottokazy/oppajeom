import React, { useState, useRef, useEffect, useMemo } from 'react';
import { UserContext, LineValue, Subscription, WeeklyContent } from '../types';
import { createSubscription, getSubscriptionByPhone, generateWeeklyContent, saveWeeklyLog, getPreviousLog, triggerAlimTalk, generateKoanCardImage, getLogByWeek, getShortLineDescription } from '../services/programService';
import { HEXAGRAM_TABLE } from '../services/hexagramData';
import { KoanCard } from './KoanCard';

interface ProgramModeProps {
    userContext: UserContext;
    lines: LineValue[];
    onClose: () => void;
    initialView?: 'ONBOARDING' | 'LOGIN'; // Add optional initial view prop
}

// 주역 학자 페르소나의 괘 핵심 요약 데이터 (64괘 전체 완비)
const SCHOLAR_COMMENTARY: Record<string, string> = {
    "111111": "하늘의 운행처럼 쉬지 않고 정진하는 시기입니다. 강력한 의지로 만물을 주도하면 크게 형통합니다.",
    "000000": "대지가 만물을 품듯 너른 마음으로 포용하십시오. 앞서지 않고 순리대로 따를 때 비로소 결실을 맺습니다.",
    "100010": "언 땅을 뚫고 싹이 돋는 시작의 진통입니다. 초기의 어려움 속에 숨겨진 무한한 잠재력을 믿으십시오.",
    "010001": "안개 낀 산처럼 앞이 흐립니다. 독단적으로 행동하지 말고, 스승을 찾아 바른 길을 묻는 것이 지혜입니다.",
    "111010": "때를 기다리는 것이 지혜입니다. 조급해하지 말고, 즐거운 마음으로 힘을 기르며 기다려야 이롭습니다.",
    "010111": "억지로 이기려 하면 흉합니다. 한발 물러서서 타협하고, 원만하게 중재를 구하는 것이 현명한 처세입니다.",
    "010000": "리더십과 규율이 필요한 시기입니다. 확고한 원칙으로 대중을 이끌어야 난관을 돌파할 수 있습니다.",
    "000010": "사람들과 친밀하게 화합하는 시기입니다. 늦기 전에 진심으로 다가가 협력 관계를 맺어야 길합니다.",
    "111011": "아직 힘이 부족하니 멈춰야 합니다. 검소하게 내실을 다지며 때가 무르익기를 기다리는 것이 좋습니다.",
    "110111": "호랑이 꼬리를 밟은 듯 위태롭습니다. 예의와 조심성으로 신중하게 대처하면 재앙을 피할 수 있습니다.",
    "111000": "하늘과 땅이 교감하니 만사가 형통합니다. 작은 노력으로 큰 결실을 얻는 태평성대의 시기입니다.",
    "000111": "소통이 막히고 꽉 막힌 시기입니다. 억지로 나아가지 말고, 내면의 덕을 지키며 은인자중하십시오.",
    "101111": "뜻이 맞는 사람들과 들판에서 만납니다. 사심을 버리고 공정하게 협력하면 큰일을 이룰 수 있습니다.",
    "111101": "해가 중천에 뜬 듯 풍요로운 시기입니다. 가진 것을 베풀고 겸손하면 하늘의 도움을 받아 길합니다.",
    "001000": "벼가 익을수록 고개를 숙이듯 겸손하십시오. 스스로 낮출수록 더 높이 존경받고 형통하게 됩니다.",
    "000100": "우레가 땅을 울리듯 기쁨이 넘칩니다. 미리 대비하고 준비하면 즐거움 속에 큰 성취를 이룹니다.",
    "100110": "대세를 따르는 것이 지혜입니다. 고집을 버리고 상황의 흐름과 타인의 의견에 순응하면 길합니다.",
    "011001": "썩은 것을 도려내는 개혁의 시기입니다. 과거의 잘못을 바로잡고 새롭게 시작하면 전화위복이 됩니다.",
    "110000": "군자가 백성을 대하듯 덕으로 임하십시오. 기운이 상승하는 시기이니 적극적으로 행동하고 베풀면 더 커집니다.",
    "000011": "바람이 땅을 스치듯 세상을 관찰하십시오. 행동하기 전에 상황을 냉철하게 통찰하는 것이 우선입니다.",
    "100101": "장애물을 씹어 부수듯 단호해야 합니다. 공정한 원칙으로 문제를 해결하면 막힘이 사라질 것입니다.",
    "101001": "본질을 아름답게 꾸미는 시기입니다. 겉모습뿐만 아니라 내면의 빛이 우러나오도록 정성을 다하십시오.",
    "000001": "기반이 깎여나가는 쇠퇴의 시기입니다. 무리하게 움직이지 말고, 남은 힘을 비축하며 견뎌야 합니다.",
    "100000": "긴 어둠 끝에 한 줄기 빛이 돌아옵니다. 서두르지 말고 회복의 기운을 천천히 북돋아야 합니다.",
    "100111": "작위적인 욕심을 버리고 순리대로 행하십시오. 진실한 마음으로 자연의 흐름을 따르면 길합니다.",
    "111001": "큰 덕과 실력을 쌓아두는 시기입니다. 밖으로 나가기보다 내면을 채우며 훗날의 큰일을 준비하십시오.",
    "100001": "말과 음식을 조심해야 합니다. 입으로 들어가는 것과 나가는 것을 신중히 하여 재앙을 막으십시오.",
    "011110": "기둥이 휘어질 만큼 짐이 무겁습니다. 비상한 각오와 용기로 위기를 돌파해야 할 비상시기입니다.",
    "010010": "험한 물살이 겹쳐 있습니다. 무리하게 빠져나오려 말고, 물 흐르듯 유연하게 믿음으로 버티십시오.",
    "101101": "불처럼 밝게 타오르는 시기입니다. 열정을 유지하되, 바른 대상에 의지해야 빛이 오래 지속됩니다.",
    "001110": "지극한 정성으로 마음이 통합니다. 사심 없이 비운 마음으로 상대를 받아들이면 감응할 것입니다.",
    "011100": "변함없이 꾸준한 것이 길합니다. 일시적인 기분보다 초심을 지키며 묵묵히 나아가는 것이 좋습니다.",
    "001111": "물러날 때를 아는 것이 지혜입니다. 소인배와 맞서지 말고, 거리를 두고 피하는 것이 상책입니다.",
    "111100": "기세가 하늘을 찌를 듯 강합니다. 힘만 믿고 날뛰지 말고, 예의와 법도를 지켜야 길함이 유지됩니다.",
    "000101": "해가 솟아오르듯 거침없이 나아갑니다. 밝은 덕으로 전진하면 윗사람의 인정을 받고 뜻을 이룹니다.",
    "101000": "밝은 빛이 땅속에 숨었습니다. 재능을 감추고 어리석은 척하며 때를 기다리는 것이 생존의 길입니다.",
    "101011": "집안을 다스리듯 내부 결속이 중요합니다. 각자 본분을 지키고 화목하면 밖의 일도 잘 풀립니다.",
    "110101": "서로 뜻이 맞지 않아 어긋납니다. 억지로 합치려 말고, 작은 일부터 차근차근 풀어가야 합니다.",
    "001010": "험한 산 앞에 물이 막혔습니다. 무리하게 나아가지 말고, 귀인의 도움을 구하며 반성해야 합니다.",
    "010100": "맺힌 것이 풀리고 해결되는 시기입니다. 머뭇거리지 말고 신속하게 행동하여 기회를 잡으십시오.",
    "110001": "덜어냄으로써 얻게 됩니다. 눈앞의 손해를 감수하고 정성을 다하면 나중에 큰 복으로 돌아옵니다.",
    "100011": "바람이 불어 불을 돕듯 이익이 넘칩니다. 기회가 왔을 때 적극적으로 행동하고 베풀면 더 커집니다.",
    "111110": "결단이 필요한 시기입니다. 맺고 끊음을 분명히 하고, 소인배를 단호하게 물리쳐야 합니다.",
    "011111": "우연한 만남을 조심하십시오. 유혹이나 강한 세력에 휩쓸리지 말고 중심을 잡아야 합니다.",
    "000110": "사람과 재물이 모여듭니다. 흩어지지 않도록 중심을 잡고, 제물을 바치듯 정성을 다해야 합니다.",
    "011000": "나무가 자라듯 순조롭게 상승합니다. 작은 노력이 쌓여 큰 성공이 되니 꾸준히 나아가십시오.",
    "010110": "물이 말라 곤란한 처지입니다. 말이 통하지 않으니 침묵하고, 군자의 도로써 묵묵히 견뎌야 합니다.",
    "011010": "마르지 않는 우물처럼 덕을 베푸십시오. 꾸준히 자신을 갈고닦으면 많은 이에게 혜택을 줍니다.",
    "101110": "낡은 가죽을 벗겨내는 혁명의 시기입니다. 때가 무르익었으니 과감하게 변화를 시도하면 길합니다.",
    "011101": "솥에 음식을 삶아내듯 새로운 것을 만듭니다. 낡은 것을 버리고 새롭게 혁신하면 성공합니다.",
    "100100": "우레가 치듯 놀랄 일이 생깁니다. 당황하지 말고 침착하게 자신을 돌아보면 오히려 복이 됩니다.",
    "001001": "산처럼 멈춰 서야 할 때입니다. 나아가려 하지 말고, 현재의 위치에서 분수를 지키며 안정을 찾으십시오.",
    "001011": "나무가 천천히 자라듯 순서가 중요합니다. 급하게 서두르지 말고, 결혼 절차를 밟듯 차근차근 나아가십시오.",
    "110100": "순서가 뒤바뀌고 흉한 조짐이 있습니다. 욕심을 버리고, 결과보다는 과정에 신중을 기해야 합니다.",
    "101100": "풍요로움이 극에 달했습니다. 해가 중천에 뜨면 지기 마련이니, 자만하지 말고 내실을 다져야 합니다.",
    "001101": "나그네처럼 떠도는 형상입니다. 한곳에 집착하지 말고, 유연하게 처신하며 안정을 구해야 합니다.",
    "011011": "바람처럼 부드럽게 스며드십시오. 자신을 낮추고 윗사람의 뜻을 따르면 목적을 이룰 수 있습니다.",
    "110110": "기쁨이 넘치고 소통이 원활합니다. 즐거운 마음으로 사람들을 대하면 어려운 일도 쉽게 풀립니다.",
    "010011": "바람이 물결을 흩어버리듯 장애가 사라집니다. 굳은 마음을 풀고 적극적으로 화합하면 길합니다.",
    "110010": "넘치지 않게 절제하는 것이 미덕입니다. 엄격한 규칙과 한계를 지키면 오히려 삶이 편안해집니다.",
    "110011": "어미 새가 알을 품듯 믿음이 가득합니다. 진실한 마음으로 대하면 돼지와 물고기까지 감동시킵니다.",
    "001100": "새가 낮게 날아야 안전합니다. 큰일보다는 작은 일에 충실하고, 겸손하게 몸을 낮춰야 허물이 없습니다.",
    "101010": "이미 강을 건너 일이 성사되었습니다. 초심을 잃지 말고 마무리를 잘해야 끝까지 길할 수 있습니다.",
    "010101": "아직 강을 건너지 못했습니다. 끝이 아니라 새로운 시작이니, 희망을 가지고 끈기 있게 도전하십시오."
};

export const ProgramMode: React.FC<ProgramModeProps> = ({ userContext, lines, onClose, initialView = 'ONBOARDING' }) => {
    // Flow: ONBOARDING (Sales Page) -> LOGIN (Phone Input) -> PAYMENT (If new) -> WEEKLY_VIEW
    const [view, setView] = useState<'ONBOARDING' | 'LOGIN' | 'WEEKLY_VIEW'>(initialView);
    const [phone, setPhone] = useState('');
    const [subscription, setSubscription] = useState<Subscription | null>(null);
    const [weeklyContent, setWeeklyContent] = useState<WeeklyContent | null>(null);
    const [lineCommentary, setLineCommentary] = useState<string>("");
    
    // Inputs
    const [emotionInput, setEmotionInput] = useState('');
    const [reviewInput, setReviewInput] = useState(''); // Week 2+ Review Input
    const [prevActionItem, setPrevActionItem] = useState<string | null>(null); // To display previous week's task

    const [isGenerating, setIsGenerating] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false); 
    const [selectedPg, setSelectedPg] = useState<string>('kakaopay.TC0ONETIME'); 
    
    // [UX Enhancement] Scroll Lock Logic
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, []);

    // --- HANDLERS ---

    const handleLoginAndPay = async (targetPg: string) => {
        if (!phone || phone.length < 10) {
            alert("올바른 전화번호를 입력해주세요.");
            return;
        }
        
        setSelectedPg(targetPg); 
        setIsGenerating(true);
        
        const sub = await getSubscriptionByPhone(phone);
        
        if (sub) {
            // Existing User
            setSubscription(sub);
            
            try {
                // 1. Check if current week content already exists
                const existingLog = await getLogByWeek(sub.id, sub.current_week);
                if (existingLog && existingLog.content) {
                    setWeeklyContent(existingLog.content);
                    if (existingLog.user_emotion) {
                        setEmotionInput(existingLog.user_emotion);
                    }
                } else if (sub.current_week > 1) {
                    // 2. If no content for current week, but week > 1, fetch previous week's ritual for review
                    const prevLog = await getPreviousLog(sub.id, sub.current_week);
                    if (prevLog && prevLog.content) {
                        setPrevActionItem(prevLog.content.action_item);
                    }
                }
            } catch (e) {
                console.error("Failed to fetch log info", e);
            }

            setView('WEEKLY_VIEW');
            setIsGenerating(false);
        } else {
            // New User
            if (lines.length < 6) {
                alert("신규 구독을 위해서는 먼저 점괘(동전 던지기)가 필요합니다.\n메인 화면으로 이동합니다.");
                onClose();
                return;
            }
            requestPayment(targetPg);
        }
    };

    const requestPayment = (targetPg: string) => {
        if (!window.IMP) {
            alert("결제 모듈 로딩 실패");
            setIsGenerating(false);
            return;
        }

        window.IMP.request_pay({
            pg: targetPg,
            pay_method: "card",
            merchant_uid: `sub_${new Date().getTime()}`,
            name: "월간 화두: 4주 마음 챙김 구독",
            amount: 9900,
            buyer_email: "",
            buyer_name: userContext.name,
            buyer_tel: phone,
        }, async (rsp: any) => {
            if (rsp.success) {
                const newSub = await createSubscription(userContext, lines, phone);
                if (newSub) {
                    setSubscription(newSub);
                    await triggerAlimTalk(phone, userContext.name, 1);
                    setView('WEEKLY_VIEW');
                } else {
                    alert("구독 생성 실패. 관리자에게 문의하세요.");
                }
            } else {
                alert(`결제 실패: ${rsp.error_msg}`);
            }
            setIsGenerating(false);
        });
    };

    const handleTestSubscription = () => {
        if (lines.length < 6) {
            const mockHexagramCode = '111111'; 
            const mockMovingLines: number[] = [];
             
             const mockSub: Subscription = {
                id: 'test-uuid-manual',
                user_name: 'Test User',
                phone: '01000000000',
                hexagram_code: mockHexagramCode,
                moving_lines: mockMovingLines,
                situation: 'Test Situation',
                started_at: new Date().toISOString(),
                current_week: 1,
                status: 'active'
            };
            setSubscription(mockSub);
            setView('WEEKLY_VIEW');
            setIsGenerating(false);
            return;
        }

        const hexagramCode = lines.map(l => (l % 2 !== 0 ? '1' : '0')).join('');
        const movingLines = lines
            .map((l, i) => (l === 6 || l === 9 ? i : -1))
            .filter(i => i !== -1);

        const mockSub: Subscription = {
            id: 'test-uuid-manual',
            user_name: userContext.name || 'Test User',
            phone: '01000000000',
            hexagram_code: hexagramCode.length === 6 ? hexagramCode : '111111', 
            moving_lines: movingLines,
            situation: 'Test Situation',
            started_at: new Date().toISOString(),
            current_week: 1,
            status: 'active'
        };
        setSubscription(mockSub);
        setView('WEEKLY_VIEW');
        setIsGenerating(false);
    };

    const handleTestWeek2 = () => {
         let mockHexagramCode = '111111'; 
         let mockMovingLines = [0, 5];

         // If lines are available from props, use them
         if (lines.length === 6) {
             mockHexagramCode = lines.map(l => (l % 2 !== 0 ? '1' : '0')).join('');
             const detectedMovingLines = lines
                .map((l, i) => (l === 6 || l === 9 ? i : -1))
                .filter(i => i !== -1);
             if (detectedMovingLines.length > 0) {
                 mockMovingLines = detectedMovingLines;
             }
         }

         const mockSub: Subscription = {
            id: 'test-uuid-week2',
            user_name: 'Test User',
            phone: '01000000000',
            hexagram_code: mockHexagramCode,
            moving_lines: mockMovingLines,
            situation: 'Test Situation',
            started_at: new Date().toISOString(),
            current_week: 2, // Week 2
            status: 'active'
        };
        setSubscription(mockSub);
        setPrevActionItem("하루 한 번, 하늘을 5분간 멍하니 바라보세요."); // Mock Previous Ritual
        setView('WEEKLY_VIEW');
        setIsGenerating(false);
    };

    const generateContent = async () => {
        if (!subscription || !emotionInput.trim()) return;
        
        // If reviewing, ensure review input is present
        if (subscription.current_week > 1 && !reviewInput.trim()) {
            alert("지난주 실천에 대한 회고를 입력해주세요.");
            return;
        }

        setIsGenerating(true);
        try {
            const prevLog = await getPreviousLog(subscription.id, subscription.current_week);
            const prevFeedback = prevLog ? prevLog.user_emotion : undefined;

            // Combine Emotion and Review if applicable
            let combinedInput = emotionInput;
            if (subscription.current_week > 1) {
                combinedInput = `[지난주 실천 회고]: ${reviewInput}\n[현재 심경]: ${emotionInput}`;
            }

            const content = await generateWeeklyContent(
                subscription, 
                subscription.current_week, 
                combinedInput,
                prevFeedback
            );

            try {
                await saveWeeklyLog(subscription.id, subscription.current_week, combinedInput, content);
            } catch (err) {
                console.warn("DB Save skipped", err);
            }
            
            setWeeklyContent(content);
        } catch (e) {
            console.error(e);
            alert("콘텐츠 생성 중 오류가 발생했습니다.");
        } finally {
            setIsGenerating(false);
        }
    };

    const downloadCard = async () => {
        if (!weeklyContent || !subscription) return;
        const hexCode = subscription.hexagram_code || '111111';
        const hexInfo = HEXAGRAM_TABLE[hexCode] || { name: '중천건', hanja: '重天乾' };

        setIsDownloading(true);
        try {
            const blob = await generateKoanCardImage(
                weeklyContent.week,
                weeklyContent.koan,
                subscription.user_name,
                hexCode,
                hexInfo.hanja
            );

            if (blob) {
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `화두카드_Week${weeklyContent.week}.png`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                window.URL.revokeObjectURL(url);
            } else {
                throw new Error("Blob is null");
            }

        } catch (e) {
            console.error("Card Generation Failed:", e);
            alert("카드 저장 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
        } finally {
            setIsDownloading(false);
        }
    };

    // Helper to render GOLD hexagram for Midnight Theme with Glow
    const renderGoldHexagram = (code: string) => {
        const lines = code.split('').reverse();
        return (
            <div className="relative flex justify-center items-center">
                {/* Glow Effect (Very Subtle) */}
                <div className="absolute w-20 h-20 bg-gold/5 blur-[30px] rounded-full pointer-events-none"></div>
                
                {/* Hexagram Lines */}
                <div className="flex flex-col gap-2 w-20 mx-auto relative z-10 drop-shadow-[0_0_4px_rgba(212,175,55,0.3)]">
                    {lines.map((char, i) => (char === '1' ? (
                                <div key={i} className="w-full h-2.5 flex justify-between">
                                    <div className="w-full h-full bg-[#D4AF37] rounded-sm shadow-[0_0_2px_rgba(212,175,55,0.2)]"></div>
                                </div>
                            ) : (
                                <div key={i} className="w-full h-2.5 flex justify-between">
                                    <div className="w-[45%] h-full bg-[#D4AF37] rounded-sm shadow-[0_0_2px_rgba(212,175,55,0.2)]"></div>
                                    <div className="w-[45%] h-full bg-[#D4AF37] rounded-sm shadow-[0_0_2px_rgba(212,175,55,0.2)]"></div>
                                </div>
                            )
                    ))}
                </div>
            </div>
        );
    };

    const getHexagramCommentary = (code: string, name: string) => {
        if (SCHOLAR_COMMENTARY[code]) return SCHOLAR_COMMENTARY[code];
        const info = HEXAGRAM_TABLE[code];
        if (info && info.gwaesa) {
            return `${name} 괘의 핵심은 "${info.gwaesa}"입니다. 이 문장이 담고 있는 변화의 이치를 깊이 새겨보십시오.`;
        }
        return `${name}의 괘상을 얻으셨군요. 현재 당신의 상황에 이 괘가 가진 고유한 변화의 힘이 작용하고 있습니다.`;
    };

    const formatActionItem = (text: string) => {
        return text.replace(/([.?!])\s+/g, "$1\n\n");
    };

    // Week 2+ Line Logic
    const currentWeek = subscription?.current_week || 1;
    const isFirstWeek = currentWeek === 1;

    const targetLineText = useMemo(() => {
        if (isFirstWeek || !subscription) return null;
        const hexInfo = HEXAGRAM_TABLE[subscription.hexagram_code];
        if (!hexInfo || !hexInfo.hyosa) return "데이터 없음";

        // Strategy: Use moving lines if available for the specific week step
        // Week 2 -> index 0 of moving lines array
        // Week 3 -> index 1 of moving lines array...
        const moveIdx = currentWeek - 2; // Week 2 is first specialized week (index 0)
        let lineIndex = 0;

        if (subscription.moving_lines && subscription.moving_lines.length > moveIdx) {
             lineIndex = subscription.moving_lines[moveIdx];
        } else {
             // Fallback: Pick a line based on week to vary it if ran out of moving lines
             // e.g. Week 2 -> Line 2 (index 1), Week 3 -> Line 3 (index 2), Week 4 -> Line 4 (index 3)
             lineIndex = (currentWeek - 1) % 6;
        }

        return hexInfo.hyosa[lineIndex] || hexInfo.hyosa[0];
    }, [subscription, currentWeek, isFirstWeek]);

    // Effect to fetch line commentary for Week 2+
    useEffect(() => {
        if (!isFirstWeek && targetLineText && subscription && view === 'WEEKLY_VIEW' && !weeklyContent) {
            setLineCommentary(""); // Reset before fetch
            const hexInfo = HEXAGRAM_TABLE[subscription.hexagram_code];
            if (hexInfo) {
                getShortLineDescription(hexInfo.name, targetLineText).then(text => {
                    setLineCommentary(text);
                });
            }
        }
    }, [isFirstWeek, targetLineText, subscription, view, weeklyContent]);


    // --- RENDER ---

    if (view === 'ONBOARDING') {
        return (
            <div className="fixed inset-0 z-[100] h-[100dvh] w-full bg-midnight text-midnight-text flex flex-col animate-fade-in-slow overflow-hidden font-sans">
                {/* Background Atmosphere */}
                <div className="absolute top-[-20%] left-[-20%] w-[140%] h-[60%] bg-mystic-purple/20 blur-[120px] pointer-events-none rounded-full"></div>

                <div className="flex-1 w-full max-w-md mx-auto px-6 py-6 flex flex-col h-full relative z-10">
                    
                    {/* Main Content (Flexible Space) */}
                    <div className="flex-1 flex flex-col items-center justify-center w-full">
                        
                        {/* 1. Icon & Title */}
                        <div className="flex flex-col items-center mb-6">
                            <div className="w-12 h-12 bg-midnight-card rounded-full flex items-center justify-center border border-gold/20 shadow-[0_0_40px_rgba(36,0,70,0.6)] relative mb-4 animate-breathe">
                                <span className="material-symbols-outlined text-2xl text-gold">spa</span>
                            </div>
                            <h1 className="text-3xl font-serif font-bold text-gold mb-1 tracking-wide">월간 화두</h1>
                            <h2 className="text-[10px] text-white/50 font-sans tracking-[0.2em] uppercase">
                                이번 달, 당신이 붙잡을 질문들
                            </h2>
                        </div>

                        {/* 2. Slogan (Outside Box, Large) */}
                        <div className="text-center mb-8 w-full">
                             <p className="text-xl font-serif font-bold text-white leading-relaxed break-keep">
                                4주간의 깊은 성찰,<br/>
                                <span className="text-gold">변화의 여정</span>을 시작합니다.
                            </p>
                        </div>
                        
                        {/* 3. Description & Features (Combined Box) */}
                        <div className="w-full bg-white/5 rounded-2xl p-6 border border-white/5 backdrop-blur-sm shadow-lg">
                            <p className="text-midnight-sub text-xs leading-loose text-center mb-6 font-light break-keep opacity-90 border-b border-white/10 pb-6">
                                "주역의 통찰을 삶의 지혜로 바꾸세요.<br/>
                                당신의 고민을 매주 새로운 화두로 풀어냅니다."
                            </p>
                            
                            {/* Features List (Numbers Removed) */}
                            <div className="space-y-4">
                                <div className="flex items-start gap-4">
                                    <div className="w-8 h-8 rounded-full bg-gold/10 flex items-center justify-center shrink-0 border border-gold/10 mt-0.5">
                                        <span className="material-symbols-outlined text-gold text-sm">calendar_today</span>
                                    </div>
                                    <p className="text-sm text-midnight-text font-medium leading-relaxed break-keep pt-1 text-left">
                                        매주 월요일, 한 주를 붙잡을 질문 하나를 받습니다
                                    </p>
                                </div>
                                
                                <div className="flex items-start gap-4">
                                    <div className="w-8 h-8 rounded-full bg-gold/10 flex items-center justify-center shrink-0 border border-gold/10 mt-0.5">
                                        <span className="material-symbols-outlined text-gold text-sm">style</span>
                                    </div>
                                     <p className="text-sm text-midnight-text font-medium leading-relaxed break-keep pt-1 text-left">
                                        흔들릴 때 꺼내보는, 나만의 질문 카드
                                    </p>
                                </div>

                                <div className="flex items-start gap-4">
                                    <div className="w-8 h-8 rounded-full bg-gold/10 flex items-center justify-center shrink-0 border border-gold/10 mt-0.5">
                                        <span className="material-symbols-outlined text-gold text-sm">check_circle</span>
                                    </div>
                                     <p className="text-sm text-midnight-text font-medium leading-relaxed break-keep pt-1 text-left">
                                        생각으로 끝나지 않도록, 아주 작은 실천 하나
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Bottom Actions */}
                    <div className="pt-6 pb-2 space-y-3 w-full shrink-0">
                        <button 
                            onClick={() => setView('LOGIN')}
                            className="w-full bg-gold-gradient text-black font-bold py-4 rounded-xl shadow-[0_4px_20px_rgba(212,175,55,0.2)] flex items-center justify-center gap-2 transition-all hover:brightness-110 active:scale-[0.98] text-base"
                        >
                            <span>4주간의 여정 시작하기</span>
                            <span className="material-symbols-outlined text-lg">arrow_forward</span>
                        </button>

                        <button onClick={onClose} className="w-full text-midnight-sub/40 text-xs hover:text-midnight-sub transition-colors py-2">
                            닫기
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (view === 'LOGIN') {
        return (
            <div className="fixed inset-0 z-[100] h-[100dvh] w-full bg-midnight text-midnight-text flex flex-col items-center justify-center p-6 animate-fade-in-slow">
                 <div className="absolute top-[20%] right-[-20%] w-[100%] h-[50%] bg-mystic-purple/10 blur-[100px] pointer-events-none rounded-full"></div>

                <div className="max-w-sm w-full bg-midnight-card p-10 rounded-[32px] border border-white/5 shadow-2xl relative z-10">
                    <div className="text-center mb-10">
                        <span className="material-symbols-outlined text-4xl text-gold mb-6 opacity-80">phonelink_ring</span>
                        <h2 className="text-xl font-serif font-bold text-midnight-text mb-3">연락처 확인</h2>
                        <p className="text-midnight-sub text-sm font-light">매주 월요일 아침,<br/>당신의 전화번호로 지혜가 도착합니다.</p>
                    </div>
                    <div className="space-y-6">
                        <div className="relative">
                            <input 
                                type="tel" 
                                placeholder="01012345678" 
                                value={phone} 
                                onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ''))} 
                                className="w-full bg-midnight border border-white/10 rounded-xl p-4 text-lg text-midnight-text focus:border-gold focus:ring-1 focus:ring-gold placeholder-[#555] outline-none text-center tracking-widest transition-all" 
                            />
                        </div>
                        
                        <div className="space-y-3 pt-2">
                            <button 
                                onClick={() => handleLoginAndPay('kakaopay.TC0ONETIME')} 
                                disabled={isGenerating} 
                                className="w-full bg-gold-gradient text-black font-bold py-3.5 rounded-xl shadow-lg hover:brightness-110 transition-all flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isGenerating && selectedPg === 'kakaopay.TC0ONETIME' ? (
                                    <span className="material-symbols-outlined animate-spin">progress_activity</span>
                                ) : (
                                    <>
                                        <span className="material-symbols-outlined text-xl">chat_bubble</span>
                                        <span>카카오페이로 시작 (9,900원)</span>
                                    </>
                                )}
                            </button>

                            <button 
                                onClick={() => handleLoginAndPay('tosspay')} 
                                disabled={isGenerating} 
                                className="w-full bg-[#313b4d] text-white font-medium py-3.5 rounded-xl border border-white/5 flex items-center justify-center gap-2 transition-all hover:bg-[#3f4d63] shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isGenerating && selectedPg === 'tosspay' ? (
                                    <span className="material-symbols-outlined animate-spin">progress_activity</span>
                                ) : (
                                    <>
                                        <span className="material-symbols-outlined text-xl">account_balance_wallet</span>
                                        <span>토스페이로 시작 (9,900원)</span>
                                    </>
                                )}
                            </button>
                        </div>
                        
                        <p className="text-[10px] text-midnight-sub/40 text-center">
                            이미 구독 중이신 경우, 결제 없이 바로 입장합니다.
                        </p>

                        <button onClick={() => setView('ONBOARDING')} className="w-full text-midnight-sub text-sm py-2 hover:text-white transition-colors">
                            뒤로 가기
                        </button>
                        
                        <div className="pt-4 border-t border-white/5 flex flex-col gap-2 items-center">
                             <button onClick={handleTestSubscription} className="text-[10px] text-midnight-sub/30 hover:text-midnight-sub/60 underline tracking-wider">[TEST] 체험 계정으로 입장 (1주차)</button>
                             <button onClick={handleTestWeek2} className="text-[10px] text-midnight-sub/30 hover:text-midnight-sub/60 underline tracking-wider">[TEST] 2주차 입장 (실천 회고 테스트)</button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (view === 'WEEKLY_VIEW') {
        // State 1: Before Generation (Input Emotion)
        if (!weeklyContent) {
            const hexCode = subscription?.hexagram_code || '111111';
            const hexInfo = HEXAGRAM_TABLE[hexCode] || { name: '알 수 없음', hanja: '' };
            const scholarCommentary = getHexagramCommentary(hexCode, hexInfo.name);
            const isWeek2Plus = (subscription?.current_week || 1) > 1;

            return (
                <div className="fixed inset-0 z-[100] h-[100dvh] w-full bg-midnight text-midnight-text flex flex-col animate-fade-in-slow overflow-hidden">
                    {/* Global Background Ambience */}
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-mystic-purple/10 rounded-full blur-[120px] pointer-events-none"></div>
                    
                    <div className="flex-1 w-full max-w-md mx-auto px-6 py-6 flex flex-col h-full relative z-10">
                        
                        {/* 1. Header Section (Top) */}
                        <div className="flex-none flex flex-col items-center pt-10">
                            {/* Week Badge */}
                            <div className="mb-4">
                                <span className="text-[10px] text-midnight-sub/50 border border-white/10 rounded-full px-3 py-1 uppercase tracking-widest bg-midnight/30 backdrop-blur-md">
                                    Week 0{subscription?.current_week}
                                </span>
                            </div>

                            {/* Hexagram & Intro Text - Unified Layout for Week 1 & Week 2+ */}
                            <div className="flex flex-row items-center justify-center gap-6 w-full px-4">
                                {/* Left: Visual */}
                                <div className="shrink-0 scale-90">
                                    {renderGoldHexagram(hexCode)}
                                </div>

                                {/* Right: Text Intro */}
                                <div className="flex flex-col items-start text-left min-w-0">
                                    <h2 className="text-sm font-serif font-bold text-white/90 leading-tight mb-1.5 whitespace-nowrap">
                                        {isFirstWeek ? "이번주 마주하게 된 괘는" : "이번주 마주하게 된 문장은"}
                                    </h2>
                                    <div className="text-xl leading-tight font-serif break-keep">
                                        {isFirstWeek ? (
                                            <>
                                                <span className="text-gold tracking-wide font-bold">[{hexInfo.name}{hexInfo.hanja ? `(${hexInfo.hanja})` : ''}]</span>
                                                <span className="text-white/80 ml-1 text-base">입니다</span>
                                            </>
                                        ) : (
                                            <span className="text-gold tracking-wide font-bold text-lg leading-snug">
                                                "{targetLineText}"
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        {/* 2. Commentary / Explanation (Centered Middle) */}
                        <div className="flex-1 flex flex-col justify-center items-center px-2 py-4">
                            <p className="text-lg font-serif text-white/90 leading-relaxed text-center break-keep italic drop-shadow-md">
                                {isFirstWeek ? (
                                    `"${scholarCommentary}"`
                                ) : (
                                    lineCommentary ? (
                                        `"${lineCommentary}"`
                                    ) : (
                                        <span className="animate-pulse text-sm text-midnight-sub/70">문장의 결을 읽어내는 중...</span>
                                    )
                                )}
                            </p>
                        </div>
                        
                        {/* 3. Bottom Section (Input + Button) */}
                        <div className="flex-none flex flex-col w-full pb-4">
                            {isWeek2Plus && prevActionItem && (
                                <div className="mb-4">
                                    <label className="text-gold font-bold block mb-2 text-base font-sans tracking-wide opacity-90 text-center">
                                        지난주 돌아보기
                                    </label>
                                    <textarea 
                                        className="w-full h-24 bg-white/5 border border-white/10 rounded-xl p-3 text-white text-sm focus:border-gold focus:ring-1 focus:ring-gold resize-none placeholder-white/20 leading-relaxed font-sans transition-colors outline-none" 
                                        placeholder="어떤 변화가 있었나요?" 
                                        value={reviewInput} 
                                        onChange={(e) => setReviewInput(e.target.value)}
                                    ></textarea>
                                </div>
                            )}

                            {/* CURRENT EMOTION SECTION */}
                            <div className="mb-6">
                                <label className="text-gold font-bold block text-base font-sans tracking-wide opacity-90 mb-3 text-center">
                                    {isFirstWeek ? "이 괘를 받고 어떤 생각이 드시나요?" : "위의 문장을 읽고 어떤 생각이 드시나요?"}
                                </label>
                                {/* Fixed height to maintain balance */}
                                <textarea 
                                    className="w-full h-32 bg-white/5 border border-gold/30 rounded-xl p-4 text-white text-base focus:border-gold focus:ring-1 focus:ring-gold resize-none placeholder-white/20 placeholder:text-sm leading-relaxed font-sans transition-colors outline-none" 
                                    placeholder="문장이어도, 단어 하나여도 괜찮습니다. 불안, 기대, 혹은 막막함 등 떠오르는 감정과 생각을 적어보세요" 
                                    value={emotionInput} 
                                    onChange={(e) => setEmotionInput(e.target.value)}
                                ></textarea>
                            </div>
                            
                            {/* Action Button */}
                             <button 
                                onClick={generateContent} 
                                disabled={!emotionInput.trim() || (isWeek2Plus && !reviewInput.trim()) || isGenerating || (isWeek2Plus && !lineCommentary)} 
                                className="w-full bg-gold-gradient text-black font-bold font-sans py-4 rounded-xl shadow-[0_4px_20px_rgba(212,175,55,0.15)] flex items-center justify-center gap-2 transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                             >
                                {isGenerating ? (
                                    <><span className="material-symbols-outlined animate-spin">autorenew</span><span>지혜를 긷는 중...</span></>
                                ) : (
                                    <span>{currentWeek === 4 ? "새로운 변화 읽어보기" : "이번 주 화두 받기"}</span>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        // State 2: Content View
        const hexCode = subscription?.hexagram_code || '111111';
        const hexInfo = HEXAGRAM_TABLE[hexCode] || { name: '중천건', hanja: '重天乾' };
        const hexHanja = hexInfo.hanja; 

        return (
            <div className="fixed inset-0 z-[100] h-[100dvh] w-full bg-midnight text-midnight-text overflow-y-auto overflow-x-hidden animate-fade-in-very-slow">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-mystic-purple/10 rounded-full blur-[150px] pointer-events-none"></div>

                <header className="px-6 py-6 flex justify-end items-center sticky top-0 bg-midnight/90 backdrop-blur-md z-20 border-b border-white/5">
                     <button onClick={onClose} className="text-gold/80 hover:text-gold font-bold text-xs tracking-widest uppercase transition-colors">Close</button>
                </header>

                <main className="px-6 pb-24 max-w-md mx-auto pt-8 relative z-10">
                    <div className="flex justify-center mb-12 transform scale-100 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
                        <KoanCard 
                            week={weeklyContent.week} 
                            koan={weeklyContent.koan} 
                            userName={subscription?.user_name || 'User'} 
                            hexagramCode={hexCode}
                            hexagramName={hexHanja}
                            cardRef={null}
                        />
                    </div>

                    <div className="space-y-10">
                        <div className="bg-midnight-card p-8 rounded-[24px] border border-gold/10 shadow-2xl relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-6 opacity-5 transition-opacity group-hover:opacity-10">
                                <span className="material-symbols-outlined text-8xl text-gold">spa</span>
                            </div>
                            
                            <h3 className="text-[10px] font-bold text-gold uppercase tracking-[0.3em] mb-6 flex items-center gap-3">
                                <span className="w-8 h-[1px] bg-gold/50"></span>
                                Weekly Ritual
                            </h3>
                            
                            <p className="text-lg font-serif text-midnight-text leading-[2.2] relative z-10 whitespace-pre-wrap font-light">
                                {formatActionItem(weeklyContent.action_item)}
                            </p>
                        </div>

                        <div className="px-2">
                            <h3 className="flex items-center gap-3 text-gold/80 font-serif font-bold mb-6 text-xl">
                                <span className="material-symbols-outlined text-lg">auto_awesome</span>
                                현자의 성찰
                            </h3>
                            <div className="relative">
                                <div className="absolute left-0 top-2 bottom-2 w-[1px] bg-gradient-to-b from-transparent via-gold/30 to-transparent"></div>
                                <p className="text-midnight-sub leading-[2.0] text-justify font-serif text-[16px] font-light pl-6 whitespace-pre-wrap">
                                    {weeklyContent.reflection}
                                </p>
                            </div>
                        </div>
                        
                        <button 
                            onClick={downloadCard}
                            disabled={isDownloading}
                            className="w-full bg-midnight-card border border-gold/30 hover:bg-gold/10 text-gold font-bold py-5 rounded-xl shadow-lg transition-all flex items-center justify-center gap-3 mt-8 disabled:opacity-50 disabled:cursor-not-allowed group"
                        >
                            {isDownloading ? (
                                <>
                                    <span className="material-symbols-outlined animate-spin text-lg">downloading</span>
                                    <span className="text-sm font-sans tracking-widest">저장 중...</span>
                                </>
                            ) : (
                                <>
                                    <span className="material-symbols-outlined text-lg group-hover:scale-110 transition-transform">download</span>
                                    <span className="text-sm font-sans tracking-widest">화두카드 소장하기</span>
                                </>
                            )}
                        </button>
                    </div>
                </main>
            </div>
        );
    }

    return null;
};