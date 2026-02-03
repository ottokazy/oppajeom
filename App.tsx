import React, { useState, useEffect, useRef } from 'react';
import { UserContext, LineValue, AnalysisResult } from './types';
import { interpretHexagram, interpretPremiumQuestions } from './services/geminiService';
import { createSubscription, triggerAlimTalk, getSubscriptionByPhone } from './services/programService';
import { CoinAnimation } from './components/CoinAnimation';
import { HexagramDisplay } from './components/HexagramDisplay';
import { ProgramMode } from './components/ProgramMode';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

// [이미지 설정 가이드]
// 1. 깃허브에 올린 이미지 파일을 클릭하세요.
// 2. 우측 상단의 'Raw' 버튼을 우클릭하거나 클릭하여 '이미지 주소 복사'를 하세요.
//    (주소가 https://raw.githubusercontent.com/... 으로 시작해야 외부에서 보입니다.)
// 3. 아래 따옴표("") 안에 복사한 주소를 붙여넣으세요.
const GITHUB_IMG_URL = "https://raw.githubusercontent.com/ottokazy/oppajeom/main/yin_yang_cat.png"; 

// 기본 태극 문양 (이미지가 없을 경우 사용됨)
const DEFAULT_SVG_URL = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Cdefs%3E%3ClinearGradient id='grad' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' style='stop-color:%23eebd2b;stop-opacity:1' /%3E%3Cstop offset='100%25' style='stop-color:%23b58900;stop-opacity:1' /%3E%3C/linearGradient%3E%3C/defs%3E%3Ccircle cx='50' cy='50' r='48' fill='%231a1a1a' stroke='%23eebd2b' stroke-width='1.5'/%3E%3Cpath d='M50,2 A48,48 0 0,1 50,98 A24,24 0 0,1 50,50 A24,24 0 0,0 50,2' fill='url(%23grad)'/%3E%3Ccircle cx='50' cy='26' r='5' fill='%231a1a1a'/%3E%3Ccircle cx='50' cy='74' r='5' fill='%23eebd2b'/%3E%3C/svg%3E";

const MAIN_IMG_URL = GITHUB_IMG_URL || DEFAULT_SVG_URL;

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
  const [showInfoModal, setShowInfoModal] = useState(false); // [New] Business Info Modal
  const [isRestoring, setIsRestoring] = useState(false); // [UX] Restore Loading State
  const [isRestoreFailed, setIsRestoreFailed] = useState(false); // [UX] Restore Failed State (Manual Retry)
  
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
  const analysisStartedRef = useRef(false); // Prevent double analysis

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

  // [Restore Logic] Restore state from sessionStorage after payment redirect
  useEffect(() => {
    // 1. Initial SDK Setup
    if (window.Kakao && !window.Kakao.isInitialized()) {
        try { window.Kakao.init(KAKAO_JS_KEY); } catch (e) {}
    }
    if (window.IMP) {
        window.IMP.init("imp16601765"); 
    }
    
    // Check URL Params
    const params = new URLSearchParams(window.location.search);
    const impSuccess = params.get('imp_success');
    const errorMsg = params.get('error_msg');
    const mode = params.get('mode');
    
    // [CRITICAL FIX] 2. Payment Return Handler FIRST
    const isPaymentReturn = sessionStorage.getItem('oppajeom_payment_pending');

    const restoreState = async () => {
        if (isPaymentReturn) {
            setIsRestoring(true); // Show loading overlay

            try {
                // Restore Context
                const savedContext = JSON.parse(sessionStorage.getItem('oppajeom_context') || '{}');
                const savedLines = JSON.parse(sessionStorage.getItem('oppajeom_lines') || '[]');
                const savedAnalysis = JSON.parse(sessionStorage.getItem('oppajeom_analysis') || 'null');
                const savedPremiumQ = JSON.parse(sessionStorage.getItem('oppajeom_premium_q') || '{}');
                const savedIsProgramMode = sessionStorage.getItem('oppajeom_is_program_mode') === 'true';

                // Apply Restore
                if (savedContext.name) setUserContext(savedContext);
                if (savedLines.length) setLines(savedLines);
                if (savedAnalysis) setAnalysis(savedAnalysis);
                if (savedPremiumQ.q1) setPremiumQuestions(savedPremiumQ);

                // Clear Flag
                sessionStorage.removeItem('oppajeom_payment_pending');

                if (impSuccess === 'true') {
                    // Success Logic
                    if (savedIsProgramMode) {
                        // [CRITICAL FIX] Mobile subscription flow restoration
                        const savedPhone = sessionStorage.getItem('oppajeom_phone');
                        if (savedPhone) {
                            // 1. Check if sub already exists (Idempotency)
                            const existingSub = await getSubscriptionByPhone(savedPhone);
                            if (existingSub) {
                                // Already created? just go.
                                console.log("Subscription already exists.");
                            } else {
                                // 2. Create new
                                const newSub = await createSubscription(savedContext, savedLines, savedPhone);
                                if (!newSub) throw new Error("Subscription creation returned null");
                                await triggerAlimTalk(savedPhone, savedContext.name, 1);
                            }
                            
                            // [AUTO LOGIN FLAG]
                            sessionStorage.setItem('oppajeom_auto_login', 'true');
                        }
                        setIsProgramMode(true);
                        setProgramStartView('LOGIN'); 
                    } else {
                        // For Premium Q&A
                        setStep(Step.ADVICE); 
                        setPremiumStep(PremiumStep.ANALYZING);
                        
                        // Trigger Analysis
                        try {
                            const result = await interpretPremiumQuestions(savedContext, savedAnalysis, savedPremiumQ, savedLines);
                            setPremiumAdvice(result);
                            setPremiumStep(PremiumStep.RESULT);
                        } catch (e) {
                            alert("분석 중 오류가 발생했습니다.");
                            setPremiumStep(PremiumStep.INPUT);
                        }
                    }
                } else if (errorMsg) {
                    // Failure Logic
                    alert(`결제가 취소되었거나 실패했습니다.\n내용: ${errorMsg}`);
                    if (savedIsProgramMode) {
                        setIsProgramMode(true);
                    } else {
                        setStep(Step.ADVICE);
                        setPremiumStep(PremiumStep.INPUT);
                    }
                } else {
                    // Reload case
                     if (savedIsProgramMode) setIsProgramMode(true);
                     else if (savedAnalysis) setStep(Step.ADVICE);
                }
                
                setIsRestoring(false); 
                window.history.replaceState({}, document.title, window.location.pathname);

            } catch (err) {
                console.error("Critical Restore Error:", err);
                // [MANUAL RETRY] Show retry UI instead of crashing/redirecting
                setIsRestoring(false);
                setIsRestoreFailed(true);
            }
            return;
        }

        // 3. Direct Link Handler (Only if NOT payment return)
        if (mode === 'login') {
            setProgramStartView('LOGIN');
            setIsProgramMode(true);
            window.history.replaceState({}, document.title, window.location.pathname);
            return;
        }
    };

    restoreState();
  }, []);

  const handleManualRetry = async () => {
      setIsRestoreFailed(false);
      setIsRestoring(true);
      
      try {
          const savedContext = JSON.parse(sessionStorage.getItem('oppajeom_context') || '{}');
          const savedLines = JSON.parse(sessionStorage.getItem('oppajeom_lines') || '[]');
          const savedPhone = sessionStorage.getItem('oppajeom_phone');

          if (savedPhone) {
              const existingSub = await getSubscriptionByPhone(savedPhone);
              if (!existingSub) {
                  const newSub = await createSubscription(savedContext, savedLines, savedPhone);
                  if (!newSub) throw new Error("Retry failed");
                  await triggerAlimTalk(savedPhone, savedContext.name, 1);
              }
              sessionStorage.setItem('oppajeom_auto_login', 'true');
              setIsProgramMode(true);
              setProgramStartView('LOGIN');
          } else {
              alert("저장된 연락처 정보가 없습니다. 처음부터 다시 시도해주세요.");
              setStep(Step.LANDING);
          }
      } catch (e) {
          console.error(e);
          alert("설정 완료에 실패했습니다. 관리자에게 문의해주세요.");
          setIsRestoreFailed(true); // Show retry again
      } finally {
          setIsRestoring(false);
      }
  };

  useEffect(() => { window.scrollTo(0, 0); }, [step, premiumStep]);
  
  // [UX Enhancement] Scroll Lock
  useEffect(() => {
      if (premiumStep !== PremiumStep.IDLE || showInfoModal || isRestoring || isRestoreFailed) {
          document.body.style.overflow = 'hidden';
      } else {
          document.body.style.overflow = 'unset';
      }
      return () => { document.body.style.overflow = 'unset'; };
  }, [premiumStep, showInfoModal, isRestoring, isRestoreFailed]);

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
    // [FIX 1] Reset Analysis Flag on Start
    analysisStartedRef.current = false;
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

  // [FIX 1-1] Decouple State Change from Analysis Execution
  useEffect(() => {
    // Check if 6 lines are complete and not currently tossing
    if (lines.length === 6 && !isTossing && step === Step.DIVINATION) {
        // Wait briefly for the last coin animation to settle visually
        setTimeout(() => {
            setStep(Step.ANALYZING);
        }, 1500);
    }
  }, [lines, isTossing, step]);

  // [FIX 1-2] Trigger Analysis ONLY when step is ANALYZING
  useEffect(() => {
      if (step === Step.ANALYZING && !analysisStartedRef.current) {
          analysisStartedRef.current = true;
          // Use a small timeout to allow the browser to paint the loading screen first
          setTimeout(() => {
              performAnalysis();
          }, 100);
      }
  }, [step]);

  const performAnalysis = async () => {
    // [UX] Restore wait time to 8 seconds
    const minDelay = new Promise(resolve => setTimeout(resolve, 8000));
    
    // Call API without timeout protection (Restored behavior)
    const apiCall = interpretHexagram(userContext, lines);
    
    try {
        const [_, result] = await Promise.all([minDelay, apiCall]);
        
        setProgress(100); 
        setTimeout(() => {
            setAnalysis(result);
            setStep(Step.RESULT);
        }, 1000); // Standard transition delay
    } catch (e) {
        console.error("Critical Analysis Error", e);
        alert("분석 중 오류가 발생했습니다. 다시 시도해주세요.");
        setStep(Step.LANDING);
        analysisStartedRef.current = false;
        setLines([]);
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

  // [FIX 2] Helper to save state before redirect
  const saveStateForPayment = (isProgramMode: boolean) => {
      sessionStorage.setItem('oppajeom_payment_pending', 'true');
      sessionStorage.setItem('oppajeom_context', JSON.stringify(userContext));
      sessionStorage.setItem('oppajeom_lines', JSON.stringify(lines));
      if (analysis) sessionStorage.setItem('oppajeom_analysis', JSON.stringify(analysis));
      sessionStorage.setItem('oppajeom_premium_q', JSON.stringify(premiumQuestions));
      sessionStorage.setItem('oppajeom_is_program_mode', isProgramMode ? 'true' : 'false');
  };

  const handlePaymentAndAnalyze = async (pgProvider: string) => {
      if (!premiumQuestions.q1 || !premiumQuestions.q2 || !analysis) return;

      if (!window.IMP) {
          alert("결제 모듈이 로드되지 않았습니다. 새로고침 후 다시 시도해주세요.");
          return;
      }
      
      // Force Initialize V1 with user code right before payment
      window.IMP.init("imp16601765"); 
      
      // Save state before redirect
      saveStateForPayment(false);

      // Check Mobile for popup config
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

      // [CRITICAL FIX] m_redirect_url Construction
      // 1. 현재 주소 가져오기 (쿼리 스트링 제외)
      const currentUrl = window.location.href.split('?')[0];
      
      // [FIX 3] Mobile Optimized Payment (Redirect)
      // [SIMPLIFIED] Always use 'kakaopay' now
      window.IMP.request_pay({
          pg: pgProvider, // 'kakaopay' or 'tosspayments'
          pay_method: "card", // Default
          merchant_uid: `coffee_${new Date().getTime()}`,
          name: "현자에게 커피 한 잔 (심층 질문권)",
          amount: 4900, 
          buyer_email: "from.mr.ouyaa@gmail.com",
          buyer_name: userContext.name,
          buyer_tel: "01000000000",
          m_redirect_url: currentUrl, // Explicit URL
          app_scheme: 'oppajeompayment', // Required for App switching
          popup: !isMobile // PC: Popup (True), Mobile: Redirect (False)
      }, async (rsp: any) => {
          // This callback runs on PC (popup mode)
          if (rsp.success) {
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
              console.warn("Payment failed or cancelled:", rsp);
              if (rsp.error_msg && !rsp.error_msg.includes('취소')) {
                  alert(`결제 실패: ${rsp.error_msg}`);
              }
              setPremiumStep(PremiumStep.INPUT);
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
      className="min-h-screen text-gray-100 flex flex-col items-center font-sans relative"
      style={appBackgroundStyle}
      ref={topRef}
    >
      {/* RESTORE LOADING OVERLAY */}
      {isRestoring && (
          <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-black/90 backdrop-blur-md animate-fade-in-slow">
              <span className="material-symbols-outlined text-5xl text-[#eebd2b] animate-spin mb-6">sync</span>
              <p className="text-white text-lg font-bold mb-2">결제 정보를 확인하고 있습니다...</p>
              <p className="text-gray-400 text-sm">잠시만 기다려주세요.</p>
          </div>
      )}

      {/* RESTORE FAILED OVERLAY (Manual Retry) */}
      {isRestoreFailed && (
          <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-black/95 backdrop-blur-md animate-fade-in-slow px-6 text-center">
              <span className="material-symbols-outlined text-5xl text-red-500 mb-6">error</span>
              <h2 className="text-white text-xl font-bold mb-2">설정이 완전히 마무리되지 않았습니다.</h2>
              <p className="text-gray-400 text-sm mb-8 leading-relaxed">
                  결제는 정상적으로 완료되었으나,<br/>
                  네트워크 문제로 구독 설정이 저장되지 않았습니다.<br/>
                  아래 버튼을 눌러 설정을 완료해주세요.
              </p>
              <button 
                  onClick={handleManualRetry}
                  className="bg-[#eebd2b] text-black font-bold py-4 px-8 rounded-xl shadow-lg hover:bg-[#d4a825] transition-all flex items-center gap-2"
              >
                  <span className="material-symbols-outlined">refresh</span>
                  설정 완료하기 (재시도)
              </button>
          </div>
      )}

      {/* Monthly Care Modal */}
      {isProgramMode && (
        <ProgramMode 
            userContext={userContext} 
            lines={lines} 
            initialView={programStartView}
            onClose={handleCloseProgramMode} 
        />
      )}

      {/* Business Info Modal (PG Requirement) */}
      {showInfoModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center px-4 bg-black/80 backdrop-blur-sm animate-fade-in-slow" onClick={() => setShowInfoModal(false)}>
              <div className="bg-[#1f1b15] border border-[#eebd2b]/20 rounded-2xl p-6 w-full max-w-md max-h-[80vh] overflow-y-auto relative shadow-2xl" onClick={e => e.stopPropagation()}>
                  <button onClick={() => setShowInfoModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white">
                      <span className="material-symbols-outlined">close</span>
                  </button>
                  
                  <h3 className="text-lg font-serif font-bold text-[#eebd2b] mb-6 border-b border-white/10 pb-4">
                      서비스 정보 및 사업자 안내
                  </h3>

                  <div className="space-y-6 text-sm text-gray-300 font-light">
                      {/* 1. Products */}
                      <div>
                          <h4 className="font-bold text-white mb-2 text-xs uppercase tracking-wider text-[#eebd2b]/80">제공 서비스 및 가격</h4>
                          <ul className="space-y-2 text-xs">
                              <li className="flex justify-between">
                                  <span>기본 주역 점괘</span>
                                  <span className="text-white font-bold">무료</span>
                              </li>
                              <li className="flex justify-between">
                                  <span>심층 분석 (커피 후원)</span>
                                  <span className="text-white font-bold">4,900원</span>
                              </li>
                              <li className="flex justify-between">
                                  <span>월간 화두 구독 (4주)</span>
                                  <span className="text-white font-bold">9,900원</span>
                              </li>
                          </ul>
                          <p className="text-[10px] text-gray-500 mt-2">
                              * 본 서비스는 AI를 활용한 주역 분석 및 생성형 콘텐츠입니다.
                          </p>
                      </div>

                      {/* 2. Refund */}
                      <div>
                          <h4 className="font-bold text-white mb-2 text-xs uppercase tracking-wider text-[#eebd2b]/80">환불 및 취소 규정</h4>
                          <p className="text-xs leading-relaxed text-gray-400">
                              본 서비스는 <span className="text-red-400 font-bold">디지털 콘텐츠</span>로, 결제 후 콘텐츠(점괘 분석, 화두 카드 등)가 제공된 이후에는 환불이 불가능합니다.<br/>
                              단, 시스템 오류로 인해 콘텐츠가 정상적으로 제공되지 않은 경우 전액 환불 조치됩니다.
                          </p>
                      </div>

                      {/* 3. Business Info */}
                      <div>
                          <h4 className="font-bold text-white mb-2 text-xs uppercase tracking-wider text-[#eebd2b]/80">사업자 정보</h4>
                          <div className="grid grid-cols-[70px_1fr] gap-y-1 text-xs text-gray-400">
                              <span>상호명</span> <span>애월에서</span>
                              <span>대표자</span> <span>조희제</span>
                              <span>사업자번호</span> <span>341-23-01423</span>
                              <span>주소</span> <span>제주특별자치도 제주시 애월읍 광상로 305</span>
                              <span>전화번호</span> <span>010-4745-2249</span>
                              <span>이메일</span> <span>from.mr.ouyaa@gmail.com</span>
                              <span>통신판매업</span> <span>신고 준비 중</span>
                          </div>
                      </div>
                  </div>
                  
                  <div className="mt-8 pt-6 border-t border-white/10 text-center">
                       <p className="text-[10px] text-gray-600">© 2024 Oppajeom. All rights reserved.</p>
                  </div>
              </div>
          </div>
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

                      {/* Payment Buttons - SIMPLIFIED */}
                      <div className="space-y-3 mb-6">
                          {/* Kakao Pay (Primary) */}
                          <button 
                              onClick={() => handlePaymentAndAnalyze('kakaopay')}
                              disabled={!premiumQuestions.q1 || !premiumQuestions.q2}
                              className="w-full py-4 rounded-xl bg-[#FAE100] hover:bg-[#eac900] text-[#371D1E] flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                          >
                              <span className="font-bold">카카오페이 결제</span>
                          </button>

                          {/* Toss Pay (Secondary) */}
                          <button 
                              onClick={() => handlePaymentAndAnalyze('tosspayments')}
                              disabled={!premiumQuestions.q1 || !premiumQuestions.q2}
                              className="w-full py-4 rounded-xl bg-[#3282F6] hover:bg-[#2b72d7] text-white flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                          >
                              <span className="font-bold">토스페이/카드 결제</span>
                          </button>
                          
                          <p className="text-[10px] text-gray-500 text-center">
                              * 카카오페이에 등록된 <span className="text-gray-400 font-bold">신용/체크카드</span>도 사용 가능합니다.
                          </p>
                      </div>

                      <div className="mt-4 flex justify-center">
                          <button 
                              onClick={handleTestPremiumAnalyze}
                              className="text-xs text-gray-500 underline hover:text-[#eebd2b] transition-colors"
                          >
                              [테스트] 결제 없이 분석 결과 보기
                          </button>
                      </div>
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
                      
                      {/* Warning Message */}
                      <p className="text-center text-white text-xs font-bold mt-8 mb-2 animate-pulse leading-relaxed">
                          ⚠️ 이 페이지를 나가면 조언 내용이 사라집니다.<br/>PDF로 저장하세요.
                      </p>

                      {/* PDF Download Button */}
                      <button 
                          onClick={handleDownloadPremiumPDF}
                          disabled={isPdfGenerating}
                          className={`w-full mb-3 bg-[#eebd2b] text-black font-bold py-4 rounded-xl hover:bg-[#d4a825] transition-colors flex items-center justify-center gap-2 ${isPdfGenerating ? 'opacity-70 cursor-not-allowed' : ''}`}
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
                    {/* 👇 직접 링크 변환 적용 완료 */}
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

            {/* [New] Footer with Info Modal Trigger */}
            <div className="absolute bottom-6 w-full flex justify-center z-20">
                <button 
                    onClick={() => setShowInfoModal(true)}
                    className="text-[10px] text-gray-500 hover:text-[#eebd2b] border-b border-transparent hover:border-[#eebd2b] transition-all pb-0.5 opacity-60 hover:opacity-100 tracking-wide"
                >
                    사업자 정보 · 이용약관 · 상품안내
                </button>
            </div>
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

      {/* STEP 4: ANALYZING (RESTORED) */}
      {step === Step.ANALYZING && (
          <div className="flex flex-col items-center justify-center min-h-screen w-full px-6 text-center relative z-10 animate-fade-in-slow">
               <div className="w-full max-w-xs relative z-10">
                   <h2 className="text-[17px] font-serif font-medium text-white mb-10 leading-loose tracking-wide tracking-tighter drop-shadow-lg">
                     하늘의 뜻을<br/>읽어내고 있습니다...
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
                                    <p className="text-gray-300 text-[15px] leading-relaxed font-light">{item}</p>
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