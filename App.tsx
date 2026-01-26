import React, { useState, useEffect, useRef } from 'react';
import { UserContext, LineValue, AnalysisResult } from './types';
import { interpretHexagram, interpretPremiumQuestions } from './services/geminiService';
import { CoinAnimation } from './components/CoinAnimation';
import { HexagramDisplay } from './components/HexagramDisplay';
import { ProgramMode } from './components/ProgramMode';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

// [FIX] 로컬 파일(yin_yang_cat.png)이 현재 환경에 없어서 안 나오는 것입니다.
// 다시 외부 URL을 연결하여 화면이 정상적으로 나오게 수정합니다.
const MAIN_IMG_URL = "https://images.unsplash.com/photo-1518133524672-243e33dc72b3?q=80&w=1000&auto=format&fit=crop"; 

const KAKAO_JS_KEY = 'c089c8172def97eb00c07217cae174e6'; 
const OFFICIAL_DOMAIN = "https://www.oppajeom.com";

enum Step {
  LANDING, 
  INPUT,   
  DIVINATION,
  ANALYZING,
  RESULT, 
  ADVICE,  
  PREMIUM_RESULT 
}

// Premium Q&A Steps
enum PremiumStep {
    IDLE,
    INPUT,
    ANALYZING,
    RESULT
}

const App: React.FC = () => {
  const [step, setStep] = useState<Step>(Step.LANDING);
  const [userContext, setUserContext] = useState<UserContext>({ name: '', question: '', situation: '', mbti: undefined });
  const [lines, setLines] = useState<LineValue[]>([]);
  const [isTossing, setIsTossing] = useState(false);
  const [currentTossResult, setCurrentTossResult] = useState<[number, number, number] | undefined>(undefined);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  
  // Modes
  const [isProgramMode, setIsProgramMode] = useState(false);
  // [UX Update] Allow starting ProgramMode in specific view (e.g. LOGIN)
  const [programStartView, setProgramStartView] = useState<'ONBOARDING' | 'LOGIN'>('ONBOARDING');

  const [isPdfGenerating, setIsPdfGenerating] = useState(false); // PDF Loading State
  
  // Premium Q&A State
  const [premiumStep, setPremiumStep] = useState<PremiumStep>(PremiumStep.IDLE);
  const [premiumQuestions, setPremiumQuestions] = useState({ q1: '', q2: '' });
  const [premiumAdvice, setPremiumAdvice] = useState<string>('');

  const [progress, setProgress] = useState(0);
  const [loadingMsgIndex, setLoadingMsgIndex] = useState(0);
  const loadingMessages = [
    { l1: "주역은 정해진 운명을 말하지 않습니다.", l2: "변화하는 상황에 대해 이야기합니다." },
    { l1: "하늘이 열렸다가(申) 닫히는(鬼) 그 찰라의 순간,", l2: "그 미세한 기미를 포착합니다." },
    { l1: "주역은 우리에게 화두를 던집니다.", l2: "그 화두를 나침반 삼아 삶을 여행하세요." }
  ];
  
  const topRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null); // For PDF Capture
  const premiumContentRef = useRef<HTMLDivElement>(null); // For Premium PDF Capture

  const mbtiTypes = [
    "ISTJ", "ISFJ", "INFJ", "INTJ",
    "ISTP", "ISFP", "INFP", "INTP",
    "ESTP", "ESFP", "ENFP", "ENTP",
    "ESTJ", "ESFJ", "ENFJ", "ENTJ"
  ];

  // Common Background Style
  const appBackgroundStyle = {
    backgroundColor: '#2a261f',
    backgroundImage: `radial-gradient(rgba(238, 189, 43, 0.05) 1px, transparent 1px), radial-gradient(rgba(238, 189, 43, 0.05) 1px, transparent 1px)`,
    backgroundSize: '24px 24px',
    backgroundPosition: '0 0, 12px 12px'
  };

  useEffect(() => {
    if (window.Kakao && !window.Kakao.isInitialized()) {
        try { window.Kakao.init(KAKAO_JS_KEY); } catch (e) {}
    }
    if (window.IMP) window.IMP.init("imp46424443"); 
    
    // [UX Update] Check for URL Query Params (Direct Login Link)
    const params = new URLSearchParams(window.location.search);
    const mode = params.get('mode');
    
    if (mode === 'login') {
        // Direct entry to Program Mode Login
        setProgramStartView('LOGIN');
        setIsProgramMode(true);
        
        // Clean up URL to avoid re-triggering on refresh (optional but good UX)
        window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  useEffect(() => { window.scrollTo(0, 0); }, [step, premiumStep]);
  
  // [UX Enhancement] Premium Q&A Scroll Lock
  useEffect(() => {
      if (premiumStep !== PremiumStep.IDLE) {
          document.body.style.overflow = 'hidden';
      } else {
          document.body.style.overflow = 'unset';
      }
      return () => { document.body.style.overflow = 'unset'; };
  }, [premiumStep]);

  useEffect(() => {
    // Trigger animation for both Main Analysis AND Premium Analysis
    if (step === Step.ANALYZING || premiumStep === PremiumStep.ANALYZING) {
      setProgress(0);
      const progressInterval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 98) return 98;
          return prev + (prev < 80 ? Math.random() * 1.0 + 0.5 : Math.random() * 0.1);
        });
      }, 100);
      const msgInterval = setInterval(() => {
        setLoadingMsgIndex((prev) => (prev + 1) % loadingMessages.length);
      }, 10000); 
      return () => { clearInterval(progressInterval); clearInterval(msgInterval); };
    }
  }, [step, premiumStep]); // Added premiumStep dependency

  const handleStart = () => {
    if (!userContext.name || !userContext.question) {
      alert("이름과 질문을 입력해주세요.");
      return;
    }
    setStep(Step.DIVINATION);
  };

  const tossCoins = () => {
    if (lines.length >= 6 || isTossing) return;
    setIsTossing(true);
    setCurrentTossResult(undefined);
  };

  const handleTossComplete = () => {
    const coin1 = Math.floor(Math.random() * 2) + 2;
    const coin2 = Math.floor(Math.random() * 2) + 2;
    const coin3 = Math.floor(Math.random() * 2) + 2;
    const sum = coin1 + coin2 + coin3;
    setCurrentTossResult([coin1, coin2, coin3]);
    setIsTossing(false);
    setLines(prev => [...prev, sum as LineValue]);
  };

  useEffect(() => {
    if (lines.length === 6 && !isTossing) {
        setTimeout(() => {
            setStep(Step.ANALYZING);
            performAnalysis();
        }, 1500);
    }
  }, [lines, isTossing]);

  const performAnalysis = async () => {
    const minDelay = new Promise(resolve => setTimeout(resolve, 8000));
    const apiCall = interpretHexagram(userContext, lines);
    try {
        const [_, result] = await Promise.all([minDelay, apiCall]);
        setProgress(100); 
        setTimeout(() => {
            setAnalysis(result);
            setStep(Step.RESULT);
        }, 1000); 
    } catch (e) {
        alert("분석 중 오류가 발생했습니다.");
        setStep(Step.LANDING);
    }
  };

  const handleDownloadPDF = async () => {
      if (!contentRef.current) {
          alert("저장할 내용을 찾을 수 없습니다.");
          return;
      }
      
      // UX: Show loading state
      setIsPdfGenerating(true);
      
      // Allow UI update
      await new Promise(resolve => setTimeout(resolve, 100));

      try {
          const element = contentRef.current;
          
          // html2canvas configuration for scrolling content
          const canvas = await html2canvas(element, { 
              scale: 2, // High resolution
              backgroundColor: '#2a261f', // Match background
              useCORS: true,
              logging: false,
              allowTaint: true,
              // Force full height capture regardless of scroll position
              height: element.scrollHeight,
              windowHeight: element.scrollHeight,
              y: 0,
              scrollY: 0,
              scrollX: 0
          });
          
          const imgData = canvas.toDataURL('image/jpeg', 0.8);
          
          // PDF 크기를 이미지 비율에 맞춰 설정 (긴 영수증 형태)
          const imgWidth = 210; // A4 width mm
          const pageHeight = (canvas.height * imgWidth) / canvas.width;
          
          const pdf = new jsPDF({
            orientation: 'p',
            unit: 'mm',
            format: [imgWidth, pageHeight] 
          });
          
          pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, pageHeight);
          pdf.save(`${userContext.name}_오빠가점바주까_조언.pdf`);
      } catch (e) {
          console.error(e);
          alert("PDF 저장 중 오류가 발생했습니다.");
      } finally {
          setIsPdfGenerating(false);
      }
  };

  const handleDownloadPremiumPDF = async () => {
      if (!premiumContentRef.current) {
          alert("저장할 내용을 찾을 수 없습니다.");
          return;
      }
      
      setIsPdfGenerating(true);
      await new Promise(resolve => setTimeout(resolve, 100));

      try {
          const element = premiumContentRef.current;
          
          const canvas = await html2canvas(element, { 
              scale: 2,
              backgroundColor: '#1f1b15', 
              useCORS: true,
              logging: false,
              allowTaint: true,
              height: element.scrollHeight,
              windowHeight: element.scrollHeight
          });
          
          const imgData = canvas.toDataURL('image/jpeg', 0.8);
          const imgWidth = 210; 
          const pageHeight = (canvas.height * imgWidth) / canvas.width;
          
          const pdf = new jsPDF({
            orientation: 'p',
            unit: 'mm',
            format: [imgWidth, pageHeight] 
          });
          
          pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, pageHeight);
          pdf.save(`${userContext.name}_심층조언.pdf`);
      } catch (e) {
          console.error(e);
          alert("PDF 저장 중 오류가 발생했습니다.");
      } finally {
          setIsPdfGenerating(false);
      }
  };

  // --- PREMIUM Q&A LOGIC ---
  const handleOpenPremiumInput = () => {
      setPremiumStep(PremiumStep.INPUT);
  };

  const handlePaymentAndAnalyze = async () => {
      if (!premiumQuestions.q1 || !premiumQuestions.q2 || !analysis) return;

      if (!window.IMP) {
          alert("결제 모듈 로딩 실패");
          return;
      }
      
      // Portone Payment Logic
      window.IMP.request_pay({
          pg: "kakaopay.TC0ONETIME", // Test PG
          pay_method: "card",
          merchant_uid: `coffee_${new Date().getTime()}`,
          name: "현자에게 커피 한 잔 (심층 질문권)",
          amount: 4900, 
          buyer_email: "",
          buyer_name: userContext.name,
          buyer_tel: "01000000000",
      }, async (rsp: any) => {
          if (rsp.success) {
              // Payment Success -> Trigger AI Analysis
              setPremiumStep(PremiumStep.ANALYZING);
              try {
                  const result = await interpretPremiumQuestions(userContext, analysis, premiumQuestions, lines);
                  setPremiumAdvice(result);
                  setPremiumStep(PremiumStep.RESULT);
              } catch (e) {
                  console.error(e);
                  alert("분석 중 오류가 발생했습니다.");
                  setPremiumStep(PremiumStep.INPUT);
              }
          } else {
              alert(`결제 실패: ${rsp.error_msg}`);
          }
      });
  };

  // [TEST ONLY] Bypass Payment
  const handleTestPremiumAnalyze = async () => {
      if (!premiumQuestions.q1 || !premiumQuestions.q2 || !analysis) {
          alert("질문을 입력해주세요.");
          return;
      }
      setPremiumStep(PremiumStep.ANALYZING);
      try {
          const result = await interpretPremiumQuestions(userContext, analysis, premiumQuestions, lines);
          setPremiumAdvice(result);
          setPremiumStep(PremiumStep.RESULT);
      } catch (e) {
          console.error(e);
          alert("분석 중 오류가 발생했습니다.");
          setPremiumStep(PremiumStep.INPUT);
      }
  };

  const getStepButtonLabel = () => {
      if (lines.length >= 6) return "점괘 해석하기";
      if (isTossing) return "천·지·인 감응...";
      const ordinals = ["첫 번째", "두 번째", "세 번째", "네 번째", "다섯 번째", "여섯 번째"];
      return `${ordinals[lines.length]} 동전 던지기`;
  };

  // Helper to calculate transformed lines for the "End" hexagram display
  const getTransformedLines = (originalLines: LineValue[]): LineValue[] => {
    return originalLines.map(line => {
        // 6 (Old Yin) -> 7 (Young Yang)
        // 9 (Old Yang) -> 8 (Young Yin)
        // 7 (Young Yang) -> 7
        // 8 (Young Yin) -> 8
        if (line === 6) return 7;
        if (line === 9) return 8;
        return line;
    });
  };

  // Helper to render advice with simple markdown-like headers
  const renderFormattedAdvice = (text: string) => {
    return text.split('\n').map((line, index) => {
        if (line.trim().startsWith('###')) {
            return (
                <h4 key={index} className="text-lg font-serif font-bold text-[#eebd2b] mt-8 mb-3 flex items-center gap-2">
                    <span className="w-8 h-[1px] bg-[#eebd2b]/50"></span>
                    {line.replace(/^###\s*/, '')}
                </h4>
            );
        }
        if (line.trim() === '') {
            return <div key={index} className="h-2"></div>;
        }
        return <p key={index} className="mb-2 text-gray-300 font-light leading-relaxed">{line}</p>;
    });
  };

  const handleCloseProgramMode = () => {
      setIsProgramMode(false);
      setProgramStartView('ONBOARDING'); // Reset to default
  };

  return (
    <div 
      className="min-h-screen text-gray-100 flex flex-col items-center font-sans relative overflow-x-hidden"
      style={appBackgroundStyle}
      ref={topRef}
    >
      {/* Monthly Care Modal */}
      {isProgramMode && (
        <ProgramMode 
            userContext={userContext} 
            lines={lines} 
            initialView={programStartView}
            onClose={handleCloseProgramMode} 
        />
      )}

      {/* Premium Q&A Modal Layer */}
      {premiumStep !== PremiumStep.IDLE && (
          <div className="fixed inset-0 z-[100] h-[100dvh] w-screen bg-[#2a261f] flex flex-col items-center overflow-y-auto animate-fade-in-slow">
              {/* Header - Consistent with ProgramMode */}
              <div className="w-full max-w-lg px-6 py-6 flex justify-end items-center sticky top-0 bg-[#2a261f]/95 backdrop-blur-md z-20 border-b border-white/5">
                  <button onClick={() => setPremiumStep(PremiumStep.IDLE)} className="text-[#eebd2b]/80 hover:text-[#eebd2b] font-bold text-xs tracking-widest uppercase transition-colors">
                      CLOSE
                  </button>
              </div>

              {/* INPUT STEP */}
              {premiumStep === PremiumStep.INPUT && (
                  <div className="w-full max-w-lg px-6 py-10 flex flex-col">
                      <div className="text-center mb-10">
                          <span className="material-symbols-outlined text-4xl text-[#eebd2b] mb-4 opacity-80">local_cafe</span>
                          <h2 className="text-2xl font-serif text-white font-bold mb-3">커피 한 잔, 감사히 받겠습니다.</h2>
                          <p className="text-gray-400 text-sm font-light leading-relaxed">
                              더 깊은 조언을 위해 질문을 구체적으로 적어주세요.
                          </p>
                      </div>

                      <div className="space-y-6 mb-10">
                          <div>
                              <label className="block text-xs font-bold text-[#eebd2b] mb-2">첫 번째 추가 질문</label>
                              <textarea 
                                  className="w-full h-24 bg-[#1f1b15] border border-white/10 rounded-xl p-4 text-white focus:border-[#eebd2b] focus:ring-0 resize-none placeholder-gray-600"
                                  placeholder="예: 구체적으로 언제쯤 행동하는 게 좋을까요?"
                                  value={premiumQuestions.q1}
                                  onChange={(e) => setPremiumQuestions({...premiumQuestions, q1: e.target.value})}
                              ></textarea>
                          </div>
                          <div>
                              <label className="block text-xs font-bold text-[#eebd2b] mb-2">두 번째 추가 질문</label>
                              <textarea 
                                  className="w-full h-24 bg-[#1f1b15] border border-white/10 rounded-xl p-4 text-white focus:border-[#eebd2b] focus:ring-0 resize-none placeholder-gray-600"
                                  placeholder="예: 만약 제가 반대로 행동한다면 어떤 결과가 있을까요?"
                                  value={premiumQuestions.q2}
                                  onChange={(e) => setPremiumQuestions({...premiumQuestions, q2: e.target.value})}
                              ></textarea>
                          </div>
                      </div>

                      <button 
                          onClick={handlePaymentAndAnalyze}
                          disabled={!premiumQuestions.q1 || !premiumQuestions.q2}
                          className="w-full bg-[#eebd2b] text-black font-bold py-4 rounded-xl shadow-lg hover:bg-[#d4a825] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                          <span className="material-symbols-outlined text-lg">payments</span>
                          <span>결제하기</span>
                      </button>
                  </div>
              )}

              {/* ANALYZING STEP (Updated to match main analyzing style) */}
              {premiumStep === PremiumStep.ANALYZING && (
                  <div className="flex-1 flex flex-col items-center justify-center w-full px-6 text-center relative z-10 animate-fade-in-slow">
                       <div className="w-full max-w-xs relative z-10">
                           <h2 className="text-[17px] font-serif font-medium text-white mb-10 leading-loose tracking-wide tracking-tighter drop-shadow-lg">
                             질문의 깊이를 더해<br/>하늘의 뜻을 다시 묻습니다...
                           </h2>
                           <div className="mb-12">
                               <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden mb-3">
                                   <div className="h-full bg-[#eebd2b] transition-all duration-300 ease-out shadow-[0_0_15px_#eebd2b]" style={{width: `${progress}%`}}></div>
                               </div>
                               <div className="flex justify-between text-[10px] font-bold tracking-widest text-[#eebd2b] font-sans drop-shadow-md">
                                 <span>DEEP ANALYZING...</span>
                                 <span>{Math.round(progress)}%</span>
                               </div>
                           </div>
                           <div className="h-24 relative flex items-center justify-center">
                               {loadingMessages.map((msg, idx) => (
                                   <div key={idx} className={`absolute top-0 left-0 w-full transition-all duration-1000 flex flex-col items-center justify-center gap-1.5 ${idx === loadingMsgIndex ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
                                      <p className="text-[#eebd2b] text-[15px] font-bold leading-relaxed break-keep drop-shadow-md">{msg.l1}</p>
                                      <p className="text-[#eebd2b] text-[15px] font-bold leading-relaxed break-keep drop-shadow-md">{msg.l2}</p>
                                   </div>
                               ))}
                           </div>
                       </div>
                  </div>
              )}

              {/* RESULT STEP */}
              {premiumStep === PremiumStep.RESULT && (
                  <div className="w-full max-w-lg px-6 py-10 pb-24">
                      {/* Wrapped in Ref for PDF */}
                      <div ref={premiumContentRef} className="bg-[#1f1b15] border border-[#eebd2b]/20 rounded-2xl p-8 shadow-2xl">
                          <h3 className="text-xl font-serif font-bold text-white mb-6 flex items-center gap-2">
                              <span className="material-symbols-outlined text-[#eebd2b]">local_cafe</span>
                              심층 조언
                          </h3>
                          {renderFormattedAdvice(premiumAdvice)}
                      </div>
                      
                      {/* PDF Download Button */}
                      <button 
                          onClick={handleDownloadPremiumPDF}
                          disabled={isPdfGenerating}
                          className={`w-full mt-8 mb-3 bg-[#eebd2b] text-black font-bold py-4 rounded-xl hover:bg-[#d4a825] transition-colors flex items-center justify-center gap-2 ${isPdfGenerating ? 'opacity-70 cursor-not-allowed' : ''}`}
                      >
                          {isPdfGenerating ? (
                              <>
                                <span className="material-symbols-outlined animate-spin">progress_activity</span>
                                <span>생성 중...</span>
                              </>
                          ) : (
                              <>
                                <span className="material-symbols-outlined">download</span>
                                <span>PDF로 결과 저장하기</span>
                              </>
                          )}
                      </button>

                      <button 
                          onClick={() => setPremiumStep(PremiumStep.IDLE)}
                          className="w-full bg-white/10 text-white font-bold py-4 rounded-xl hover:bg-white/20 transition-colors"
                      >
                          닫기
                      </button>
                  </div>
              )}
          </div>
      )}

      {/* STEP 1: LANDING */}
      {step === Step.LANDING && (
        <div className="flex flex-col items-center justify-center min-h-screen w-full px-6 text-center relative z-10 animate-fade-in-slow">
            
            {/* Yin-Yang Cat Image Section (Replaced with Remote URL) */}
            <div className="relative w-56 h-56 mb-12 flex items-center justify-center">
                {/* Outer Glow Halo */}
                <div className="absolute inset-0 rounded-full shadow-[0_0_80px_rgba(238,189,43,0.2)] pointer-events-none"></div>
                
                {/* Image Container with Slow Spin */}
                <div className="relative w-full h-full rounded-full overflow-hidden shadow-2xl border border-white/10 animate-[spin_60s_linear_infinite]">
                    {/* 👇 다시 인터넷 주소로 교체 */}
                    <img 
                        src={MAIN_IMG_URL} 
                        alt="오빠가 점바주까 메인" 
                        className="w-full h-full object-cover"
                        crossOrigin="anonymous" 
                    />
                    {/* Inner Shadow for Depth */}
                    <div className="absolute inset-0 rounded-full shadow-[inset_0_0_20px_rgba(0,0,0,0.5)] pointer-events-none"></div>
                </div>
            </div>
            
            {/* UPDATED TEXT SECTION */}
            <div className="space-y-6 mb-16">
                <h1 className="text-4xl font-serif font-bold text-white tracking-wide drop-shadow-lg leading-tight">
                    오빠가 점바주까
                </h1>
                
                <div className="flex items-center justify-center gap-3">
                    {/* Decorative Line Left */}
                    <div className="w-10 h-[1px] bg-gradient-to-r from-transparent to-[#eebd2b]"></div>
                    
                    <p className="text-[#eebd2b] text-sm font-serif tracking-[0.15em] font-light">
                        주역 - 5000년의 지혜
                    </p>
                    
                    {/* Decorative Line Right */}
                    <div className="w-10 h-[1px] bg-gradient-to-l from-transparent to-[#eebd2b]"></div>
                </div>
            </div>

            <button onClick={() => setStep(Step.INPUT)} className="w-full max-w-[260px] bg-[#eebd2b] hover:bg-[#d4a825] text-[#1a1917] font-bold py-4 rounded-xl transition-all duration-300 shadow-xl text-lg">질문 시작하기</button>
        </div>
      )}

      {/* STEP 2: INPUT */}
      {step === Step.INPUT && (
        <div className="w-full max-w-md px-6 pt-10 pb-10 min-h-screen flex flex-col animate-fade-in-slow">
            <h2 className="text-2xl font-sans font-bold text-white mb-8 leading-tight">무엇이 궁금하신가요?</h2>
            <div className="space-y-6">
                <div>
                    <label className="block text-xs font-bold text-gray-400 mb-2">이름</label>
                    <input type="text" value={userContext.name} onChange={e => setUserContext({...userContext, name: e.target.value})} className="w-full bg-[#27272a] border border-white/5 rounded-lg px-4 py-4 text-white placeholder-gray-500 focus:border-[#eebd2b] focus:ring-1 focus:ring-[#eebd2b] outline-none transition-all" placeholder="홍길동" />
                </div>
                <div>
                    <label className="block text-xs font-bold text-gray-400 mb-2">묻고자 하는 질문</label>
                    <textarea value={userContext.question} onChange={e => setUserContext({...userContext, question: e.target.value})} className="w-full h-24 bg-[#27272a] border border-white/5 rounded-lg px-4 py-4 text-white placeholder-gray-500 focus:border-[#eebd2b] focus:ring-1 focus:ring-[#eebd2b] outline-none resize-none transition-all" placeholder="예: 이직을 해야 할까요?" />
                </div>
                <button onClick={handleStart} className="w-full bg-[#eebd2b] hover:bg-[#d4a825] text-[#1a1917] font-bold py-4 rounded-xl shadow-lg flex items-center justify-center gap-2 text-lg">
                    <span className="material-symbols-outlined text-xl">auto_awesome</span>
                    하늘과 감응하기
                </button>
            </div>

            <div className="relative my-8">
                <div className="absolute inset-0 flex items-center" aria-hidden="true"><div className="w-full border-t border-white/10"></div></div>
                <div className="relative flex justify-center text-[10px] uppercase tracking-widest"><span className="bg-[#18181b] px-3 text-gray-500">선택 입력 사항 (더 정확한 풀이)</span></div>
            </div>

            <div className="space-y-6 pb-12">
                <div>
                    <label className="block text-xs font-bold text-gray-400 mb-2">현재 상황</label>
                    <textarea value={userContext.situation} onChange={e => setUserContext({...userContext, situation: e.target.value})} className="w-full h-24 bg-[#27272a] border border-white/5 rounded-lg px-4 py-4 text-white placeholder-gray-500 focus:border-[#eebd2b] focus:ring-1 focus:ring-[#eebd2b] outline-none resize-none transition-all" placeholder="현재 상황이나 배경을 상세히 입력해주세요" />
                </div>
                <div>
                    <label className="block text-xs font-bold text-gray-400 mb-3">MBTI <span className="font-normal text-gray-600 ml-1">(성향 맞춤 조언)</span></label>
                    <div className="grid grid-cols-4 gap-2">
                        {mbtiTypes.map(t => (
                            <button key={t} onClick={() => setUserContext({...userContext, mbti: userContext.mbti === t ? undefined : t})} className={`text-[10px] py-2.5 rounded-lg border transition-all duration-200 font-bold ${userContext.mbti === t ? 'bg-[#27272a] text-[#eebd2b] border-[#eebd2b]' : 'bg-[#27272a] text-gray-500 border-white/5'}`}>{t}</button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* STEP 3: DIVINATION */}
      {step === Step.DIVINATION && (
        <div className="flex flex-col items-center h-screen w-full px-6 pt-6 pb-24 relative">
             <div className="text-center mb-6">
                 <h2 className="text-2xl font-sans font-bold text-[#eebd2b] mb-1 leading-tight"><span className="text-white">{userContext.name}</span>님의 점괘를 짓습니다.</h2>
                 <p className="text-sm text-gray-500">고민을 떠올리며 동전을 던져주세요.</p>
             </div>

             <div className="w-full max-w-[280px] bg-[#24211a] rounded-2xl p-4 border border-white/5 shadow-2xl mb-6">
                 <div className="flex flex-col gap-3">
                     {[5, 4, 3, 2, 1, 0].map((index) => {
                         const isActive = lines.length === index;
                         const hasValue = index < lines.length;
                         const val = lines[index]; 
                         const isMoving = hasValue && (val === 6 || val === 9);

                         return (
                             <div key={index} className="flex items-center justify-between gap-3 h-7">
                                 {/* 좌측 레이블 영역 */}
                                 <div className="w-16 flex items-center justify-end gap-1.5">
                                     <span className={`text-sm font-bold transition-colors ${isActive ? 'text-white' : hasValue ? 'text-gray-300' : 'text-gray-600'}`}>
                                         {index + 1}효
                                     </span>
                                     <div className="flex justify-center w-2.5">
                                         {isMoving && <span className="text-[#eebd2b] text-[10px]">●</span>}
                                     </div>
                                 </div>
                                 <div className="flex-1 h-full flex items-center">
                                     {hasValue ? (
                                         <div className="w-full h-3 flex items-center justify-center animate-fade-in-slow">
                                             {(val === 7 || val === 9) ? (
                                                 <div className={`w-full h-full rounded-sm shadow-inner ${isMoving ? 'bg-[#d1c7b7]' : 'bg-[#eebd2b]'}`}></div>
                                             ) : (
                                                 <div className="w-full h-full flex justify-between gap-2">
                                                     <div className={`w-[45%] h-full rounded-sm shadow-inner ${isMoving ? 'bg-[#d1c7b7]' : 'bg-[#eebd2b]'}`}></div>
                                                     <div className={`w-[45%] h-full rounded-sm shadow-inner ${isMoving ? 'bg-[#d1c7b7]' : 'bg-[#eebd2b]'}`}></div>
                                                 </div>
                                             )}
                                         </div>
                                     ) : isActive ? (
                                        <div className="w-full h-3 bg-white/20 rounded-sm shadow-[0_0_10px_rgba(255,255,255,0.05)] border border-white/10"></div>
                                     ) : (
                                        <div className="w-full h-3 bg-white/5 rounded-sm"></div>
                                     )}
                                 </div>
                             </div>
                         );
                     })}
                 </div>
             </div>

             <div className="relative mb-6 transform scale-90">
                 <CoinAnimation isTossing={isTossing} onTossComplete={handleTossComplete} result={currentTossResult} />
             </div>

             <div className="mb-6 px-5 py-1.5 bg-white/5 border border-white/10 rounded-full flex items-center gap-2">
                 <div className="w-1 h-1 rounded-full bg-[#eebd2b]"></div>
                 <span className="text-[11px] font-bold text-gray-300">현재 {lines.length} / 6 효 확정</span>
             </div>

             <div className="fixed bottom-0 left-0 w-full p-6 bg-gradient-to-t from-[#2a261f] via-[#2a261f] to-transparent">
                <button 
                  onClick={tossCoins} 
                  disabled={isTossing || lines.length >= 6} 
                  className={`w-full max-w-lg mx-auto py-5 rounded-2xl font-bold text-lg transition-all flex items-center justify-center gap-2 
                    ${lines.length >= 6 ? 'bg-[#eebd2b] text-black' : 
                      isTossing ? 'bg-[#1e293b] text-[#eebd2b]/80 border border-[#eebd2b]/20' : 
                      'bg-[#eebd2b] text-[#1a1917] shadow-xl active:scale-95'}`}
                >
                    {getStepButtonLabel()}
                    {!isTossing && lines.length < 6 && <span className="material-symbols-outlined text-xl">casino</span>}
                </button>
             </div>
        </div>
      )}

      {/* STEP 4: ANALYZING */}
      {step === Step.ANALYZING && (
        <div className="flex flex-col items-center justify-center min-h-screen w-full px-6 text-center relative z-10 animate-fade-in-slow">
             <div className="w-full max-w-xs relative z-10">
                 <h2 className="text-[17px] font-serif font-medium text-white mb-10 leading-loose tracking-wide tracking-tighter drop-shadow-lg">
                   괘상을 읽고<br/>하늘의 뜻을 해석 중입니다...
                 </h2>
                 <div className="mb-12">
                     <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden mb-3">
                         <div className="h-full bg-[#eebd2b] transition-all duration-300 ease-out shadow-[0_0_15px_#eebd2b]" style={{width: `${progress}%`}}></div>
                     </div>
                     <div className="flex justify-between text-[10px] font-bold tracking-widest text-[#eebd2b] font-sans drop-shadow-md">
                       <span>ANALYZING...</span>
                       <span>{Math.round(progress)}%</span>
                     </div>
                 </div>
                 <div className="h-24 relative flex items-center justify-center">
                     {loadingMessages.map((msg, idx) => (
                         <div key={idx} className={`absolute top-0 left-0 w-full transition-all duration-1000 flex flex-col items-center justify-center gap-1.5 ${idx === loadingMsgIndex ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
                            <p className="text-[#eebd2b] text-[15px] font-bold leading-relaxed break-keep drop-shadow-md">{msg.l1}</p>
                            <p className="text-[#eebd2b] text-[15px] font-bold leading-relaxed break-keep drop-shadow-md">{msg.l2}</p>
                         </div>
                     ))}
                 </div>
             </div>
        </div>
      )}

      {/* STEP 5: RESULT */}
      {step === Step.RESULT && analysis && (
        <div className="min-h-screen w-full flex flex-col items-center pb-32 animate-fade-in-slow">
            <div className="w-full max-w-lg px-6 pt-16 flex flex-col">
                <h1 className="text-3xl font-serif text-[#eebd2b] text-center mb-6 tracking-widest font-medium drop-shadow-md">{analysis.hexagram.name}</h1>
                
                <div className="transform scale-90 mb-6 flex justify-center w-full">
                    {/* Fixed Width Container for HexagramDisplay to prevent collapse */}
                    <div className="w-96 bg-[#1f1b15]/60 rounded-2xl p-6 border border-[#eebd2b]/10 shadow-2xl backdrop-blur-sm">
                        <HexagramDisplay lines={lines} animateLast={false} />
                    </div>
                </div>

                <div className="flex items-center gap-3 mb-6 mt-4">
                    <div className="h-[1px] w-8 bg-[#eebd2b]/30"></div>
                    <h2 className="text-lg font-serif text-[#d1c7b7]">괘사 (卦辭)</h2>
                    <div className="h-[1px] flex-1 bg-[#eebd2b]/10"></div>
                </div>

                <div className="bg-[#1f1b15]/60 rounded-2xl p-8 border border-[#eebd2b]/10 shadow-lg mb-10 backdrop-blur-sm">
                    <h3 className="text-3xl font-serif text-white text-center mb-6 font-normal tracking-wide">{analysis.hexagram.hanja || analysis.hexagram.name}</h3>
                    <div className="text-center mb-8">
                        <p className="text-[#eebd2b] text-xl font-serif mb-3 font-normal tracking-wide">{analysis.hexagram.statement_hanja}</p>
                        <p className="text-[#d1c7b7] text-sm leading-relaxed px-4 font-normal">{analysis.hexagram.statement_translation}</p>
                    </div>
                    <p className="text-[#a8a29e] leading-loose text-justify text-[15px] whitespace-pre-wrap font-light">
                        {analysis.hexagram.explanation}
                    </p>
                </div>

                <div className="flex items-center gap-3 mb-6">
                    <div className="h-[1px] w-8 bg-[#eebd2b]/30"></div>
                    <h2 className="text-lg font-serif text-[#d1c7b7]">효사 (爻辭) 상세 풀이</h2>
                    <div className="h-[1px] flex-1 bg-[#eebd2b]/10"></div>
                </div>

                <div className="space-y-6 pb-12">
                    {analysis.lines.map((line, idx) => (
                        <div key={idx} className={`bg-[#1f1b15]/60 rounded-2xl p-6 border backdrop-blur-sm ${line.isChanging ? 'border-[#eebd2b]/30 bg-[#2a2318]/80' : 'border-[#eebd2b]/5'}`}>
                            <div className="mb-3">
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium tracking-wide ${line.isChanging ? 'bg-[#eebd2b] text-[#1a1814]' : 'bg-[#363026] text-[#9ca3af]'}`}>
                                    제{line.position}효 {line.isChanging && '● 동효'}
                                </span>
                            </div>
                            <h4 className="text-xl font-serif text-white mb-2 font-normal tracking-wide">{line.hanja}</h4>
                            <p className="text-[#eebd2b] text-sm mb-4 font-normal">{line.translation}</p>
                            <p className="text-[#a8a29e] text-sm leading-relaxed text-justify font-light">{line.explanation}</p>
                        </div>
                    ))}
                </div>
            </div>
            
            <div className="fixed bottom-0 left-0 w-full p-6 bg-gradient-to-t from-[#1e1b15] via-[#1e1b15] to-transparent z-40 flex justify-center">
                <button onClick={() => setStep(Step.ADVICE)} className="w-full max-w-lg bg-[#eebd2b] hover:bg-[#d4a825] text-black font-bold py-5 rounded-2xl shadow-2xl flex items-center justify-center gap-2 text-lg transition-transform active:scale-95">
                    <span className="material-symbols-outlined">auto_awesome</span>
                    {userContext.name}님에 대한 현실적 조언 보기
                </button>
            </div>
        </div>
      )}

      {/* STEP 6: ADVICE */}
      {(step === Step.ADVICE || step === Step.PREMIUM_RESULT) && analysis && (
        <div className="min-h-screen w-full flex flex-col items-center pb-24 animate-fade-in-slow">
             
             {/* Printable Area Wrapper */}
             <div ref={contentRef} className="w-full flex flex-col items-center bg-[#2a261f]">
                 {/* Title Section */}
                 <div className="w-full max-w-lg px-6 pt-12 pb-6">
                    <h1 className="text-3xl font-serif font-bold text-[#eebd2b] leading-relaxed">
                       {userContext.name}님을 위한<br/>현실적 조언
                    </h1>
                 </div>

                 <div className="w-full max-w-lg px-6 flex flex-col gap-10 pb-10">

                    {/* 1. QUESTION & HEXAGRAM CARD */}
                    <div className="bg-[#1f1b15]/80 border border-[#eebd2b]/20 rounded-2xl p-6 shadow-xl backdrop-blur-sm">
                        <div className="mb-6">
                            <p className="text-[10px] text-[#eebd2b] font-bold tracking-widest uppercase mb-1">QUESTION</p>
                            <p className="text-gray-200 font-serif text-lg leading-relaxed">{userContext.question}</p>
                        </div>
                        <div className="h-px w-full bg-[#eebd2b]/10 mb-6"></div>
                        <div className="flex justify-between items-center relative">
                            {/* Start Hexagram */}
                            <div className="flex flex-col items-center gap-3 w-1/2">
                                <span className="text-xs text-[#eebd2b] font-bold opacity-80">본괘 (Start)</span>
                                <div className="w-16 h-20"> {/* Mini Display */}
                                     <HexagramDisplay lines={lines} animateLast={false} simple compact />
                                </div>
                                <span className="text-white font-serif">{analysis.hexagram.name}</span>
                            </div>

                            {/* Divider */}
                            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-[#eebd2b]/10 -translate-x-1/2"></div>

                            {/* End Hexagram */}
                            <div className="flex flex-col items-center gap-3 w-1/2">
                                <span className="text-xs text-[#eebd2b] font-bold opacity-80">지괘 (End)</span>
                                <div className="w-16 h-20">
                                     {/* Calculate target lines for display */}
                                     <HexagramDisplay lines={getTransformedLines(lines)} animateLast={false} simple compact />
                                </div>
                                <span className="text-white font-serif">{analysis.changedHexagramName || "변화 없음"}</span>
                            </div>
                        </div>
                    </div>

                    {/* 2. CORE SUMMARY */}
                    <div>
                        <h3 className="flex items-center gap-2 text-[#eebd2b] font-serif font-bold mb-4">
                            <span className="text-xs">✦</span> 핵심 요약
                        </h3>
                        <div className="space-y-3">
                            {analysis.coreSummary.map((item, idx) => (
                                <div key={idx} className="bg-[#2a261f] border border-[#eebd2b]/10 rounded-xl p-5 flex gap-4 items-start shadow-md">
                                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#eebd2b]/10 flex items-center justify-center text-[#eebd2b] font-bold text-xs mt-0.5">
                                        {idx + 1}
                                    </div>
                                    <p className="text-gray-300 text-sm leading-relaxed font-light">{item}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* 3. DETAILED ADVICE */}
                    <div>
                        <h3 className="flex items-center gap-2 text-[#eebd2b] font-serif font-bold mb-4">
                            <span className="text-xs">✦</span> 상세 풀이
                        </h3>
                         <div className="bg-[#24211a] border border-[#eebd2b]/10 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
                            {/* Render with Markdown-like Header Detection */}
                            {renderFormattedAdvice(analysis.advice)}
                        </div>
                    </div>
                </div>
            </div>
            {/* End of Printable Area */}

            <div className="w-full max-w-lg px-6 flex flex-col gap-10 pb-10">
                {/* 4. PREMIUM ACTIONS (New Flow) */}
                <div className="space-y-4 pt-6 border-t border-white/5">
                    <p className="text-center text-gray-400 text-sm mb-4">더 깊은 통찰이 필요하신가요?</p>
                    
                    {/* Option A: Coffee & Ask More (One-time) - UPDATED */}
                    <button 
                        onClick={handleOpenPremiumInput}
                        className="w-full bg-[#3e3429] border border-[#eebd2b]/30 py-6 rounded-2xl flex items-center justify-between px-6 group hover:bg-[#4a3f33] transition-all shadow-lg"
                    >
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-[#eebd2b]/10 flex items-center justify-center">
                                <span className="material-symbols-outlined text-[#eebd2b]">local_cafe</span>
                            </div>
                            <div className="text-left">
                                <div className="font-bold text-[#eebd2b] text-lg">커피 한 잔 후원하고 더 물어보기</div>
                                <div className="text-xs text-gray-400 font-light mt-1">추가 심층 질문 2가지 + 현자의 상세 답변</div>
                            </div>
                        </div>
                        <span className="material-symbols-outlined text-gray-500 group-hover:text-[#eebd2b]">arrow_forward_ios</span>
                    </button>

                    {/* Option B: Monthly Care (Subscription) - UPDATED TEXT */}
                    <button 
                        onClick={() => setIsProgramMode(true)}
                        className="w-full relative bg-gradient-to-r from-[#2c1a16] to-[#4a2c26] border border-[#ff8f70]/30 py-6 rounded-2xl flex items-center justify-between px-6 group overflow-hidden shadow-lg hover:shadow-2xl hover:scale-[1.01] transition-all"
                    >
                        <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        <div className="flex items-center gap-4 relative z-10">
                            <div className="w-12 h-12 rounded-full bg-[#ff8f70]/20 flex items-center justify-center">
                                <span className="material-symbols-outlined text-[#ffcdb2]">spa</span>
                            </div>
                            <div className="text-left">
                                <div className="font-bold text-[#ffcdb2] text-lg">월간 화두</div>
                                <div className="text-sm text-[#ffcdb2] font-medium mt-0.5">삶을 변화시키는 4주의 여정</div>
                                <div className="text-xs text-[#ffb5a0]/80 font-light mt-1">매주 도착하는 화두카드와 마음기록</div>
                            </div>
                        </div>
                        <span className="material-symbols-outlined text-[#ff8f70]/50 group-hover:text-[#ffcdb2] relative z-10">arrow_forward_ios</span>
                    </button>
                </div>

                {/* PDF Download Button (Bottom) */}
                <button 
                    onClick={handleDownloadPDF}
                    disabled={isPdfGenerating}
                    className={`w-full bg-white/5 border border-white/10 text-gray-400 font-bold py-4 rounded-xl hover:bg-white/10 transition-colors flex items-center justify-center gap-2 mt-4 ${isPdfGenerating ? 'cursor-not-allowed opacity-70' : ''}`}
                >
                    {isPdfGenerating ? (
                        <>
                            <span className="material-symbols-outlined animate-spin">progress_activity</span>
                            <span>PDF 생성 중...</span>
                        </>
                    ) : (
                        <>
                            <span className="material-symbols-outlined">download</span>
                            <span>PDF로 결과 저장하기</span>
                        </>
                    )}
                </button>
             </div>
        </div>
      )}

    </div>
  );
};

export default App;