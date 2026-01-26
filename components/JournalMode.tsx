import React, { useState, useEffect, useRef } from 'react';
import { UserContext, AnalysisResult, JournalFeedback } from '../types';
import { analyzeJournalEntry } from '../services/geminiReflectService';

interface JournalModeProps {
  userContext: UserContext;
  analysis: AnalysisResult;
  onClose: () => void;
}

export const JournalMode: React.FC<JournalModeProps> = ({ userContext, analysis, onClose }) => {
  const [step, setStep] = useState<'INTRO' | 'WRITE' | 'ANALYZING' | 'FEEDBACK'>('INTRO');
  const [journalText, setJournalText] = useState('');
  const [feedback, setFeedback] = useState<JournalFeedback | null>(null);
  
  // Typewriter effect state
  const [displayedReflection, setDisplayedReflection] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const reflectionRef = useRef<HTMLParagraphElement>(null);

  // Scroll Lock Logic
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
        document.body.style.overflow = 'unset';
    };
  }, []);

  // Intro Transition
  useEffect(() => {
    const timer = setTimeout(() => {
      setStep('WRITE');
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  const handleSubmit = async () => {
    if (!journalText.trim()) return;
    
    setStep('ANALYZING');
    try {
      const result = await analyzeJournalEntry(userContext, analysis, journalText);
      setFeedback(result);
      // Wait a bit for the breathing animation to finish a cycle
      setTimeout(() => {
          setStep('FEEDBACK');
      }, 3000);
    } catch (e) {
      console.error(e);
      alert("연결이 지연되고 있습니다. 잠시 후 다시 시도해주세요.");
      setStep('WRITE');
    }
  };

  // Typewriter Effect Logic
  useEffect(() => {
    if (step === 'FEEDBACK' && feedback) {
      setIsTyping(true);
      setDisplayedReflection('');
      let i = 0;
      const text = feedback.reflection;
      const speed = 50; // ms per char

      const typing = setInterval(() => {
        setDisplayedReflection(text.substring(0, i + 1));
        i++;
        if (i === text.length) {
          clearInterval(typing);
          setIsTyping(false);
        }
        // Auto scroll
        if (reflectionRef.current) {
            reflectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }
      }, speed);

      return () => clearInterval(typing);
    }
  }, [step, feedback]);

  // --- RENDERERS ---

  if (step === 'INTRO') {
    return (
      <div className="fixed inset-0 z-[100] h-[100dvh] w-screen bg-sanctuary-paper flex flex-col items-center justify-center animate-fade-in-slow">
        <div className="text-center space-y-6">
          <span className="material-symbols-outlined text-4xl text-sanctuary-blue opacity-50">spa</span>
          <h2 className="text-2xl font-serif text-sanctuary-blue font-bold tracking-widest">Digital Sanctuary</h2>
          <p className="text-sm font-sans text-gray-500 tracking-wide">잠시 멈추고, 마음을 기록합니다.</p>
        </div>
      </div>
    );
  }

  if (step === 'WRITE') {
    return (
      <div className="fixed inset-0 z-[100] h-[100dvh] w-screen bg-sanctuary-paper flex flex-col overflow-hidden animate-fade-in-slow">
        {/* Header */}
        <header className="px-6 py-6 flex justify-between items-center bg-transparent z-10">
           <button onClick={onClose} className="text-gray-400 hover:text-sanctuary-blue transition-colors">
              <span className="material-symbols-outlined">close</span>
           </button>
           <span className="text-xs font-serif text-sanctuary-gold tracking-widest uppercase">Journaling</span>
           <div className="w-6"></div>
        </header>

        <main className="flex-1 px-6 pb-24 overflow-y-auto">
            <div className="max-w-lg mx-auto space-y-8 pt-4">
                <div className="space-y-2 text-center">
                    <h3 className="text-xl font-serif text-sanctuary-blue leading-relaxed">
                        {userContext.name}님, <br/>지금 마음이 어떠신가요?
                    </h3>
                    <p className="text-sm text-gray-500 font-light">
                        점괘를 보고 든 생각, 혹은 막막한 심정을<br/>있는 그대로 적어주세요.
                    </p>
                </div>

                <div className="relative">
                    <textarea 
                        value={journalText}
                        onChange={(e) => setJournalText(e.target.value)}
                        className="w-full h-64 bg-transparent border-none resize-none text-sanctuary-text text-lg leading-10 font-serif focus:ring-0 placeholder-gray-300 lined-paper p-0"
                        placeholder="여기에 마음을 내려놓으세요..."
                    ></textarea>
                </div>
            </div>
        </main>

        <div className="fixed bottom-0 left-0 w-full p-6 bg-gradient-to-t from-sanctuary-paper via-sanctuary-paper to-transparent z-20 flex justify-center">
            <button 
                onClick={handleSubmit}
                disabled={!journalText.trim()}
                className="w-full max-w-lg bg-sanctuary-blue text-white font-serif py-4 rounded-xl shadow-lg hover:bg-[#2c3e50] transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
                <span className="material-symbols-outlined text-sm">send</span>
                현자에게 보내기
            </button>
        </div>
      </div>
    );
  }

  if (step === 'ANALYZING') {
      return (
        <div className="fixed inset-0 z-[100] h-[100dvh] w-screen bg-sanctuary-blue flex flex-col items-center justify-center animate-fade-in-slow text-white">
            <div className="relative w-24 h-24 mb-8">
                <div className="absolute inset-0 bg-white/10 rounded-full animate-ping"></div>
                <div className="absolute inset-4 bg-white/20 rounded-full animate-pulse"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                    <span className="material-symbols-outlined text-4xl text-sanctuary-gold">psychology</span>
                </div>
            </div>
            <p className="text-sanctuary-gold font-serif text-lg tracking-widest animate-pulse">
                마음을 읽고 있습니다...
            </p>
        </div>
      );
  }

  if (step === 'FEEDBACK' && feedback) {
      return (
        <div className="fixed inset-0 z-[100] h-[100dvh] w-screen bg-sanctuary-paper flex flex-col overflow-hidden animate-fade-in-slow">
            <header className="px-6 py-6 flex justify-end items-center bg-transparent z-10 sticky top-0 bg-sanctuary-paper/90 backdrop-blur-sm">
                <button onClick={onClose} className="text-sanctuary-blue font-bold text-sm hover:opacity-70 transition-opacity">
                    닫기
                </button>
            </header>

            <main className="flex-1 px-6 pb-24 overflow-y-auto">
                <div className="max-w-lg mx-auto space-y-10 pt-4 pb-10">
                    {/* Title & Quote */}
                    <div className="text-center space-y-6">
                        <span className="material-symbols-outlined text-3xl text-sanctuary-gold">auto_awesome</span>
                        <h2 className="text-2xl font-serif text-sanctuary-blue font-bold leading-tight">
                            {feedback.title}
                        </h2>
                        <div className="relative py-4">
                            <span className="absolute top-0 left-0 text-4xl text-sanctuary-gold/20 font-serif">“</span>
                            <p className="text-lg text-gray-600 font-serif italic px-6 relative z-10">
                                {feedback.quote}
                            </p>
                            <span className="absolute bottom-0 right-0 text-4xl text-sanctuary-gold/20 font-serif">”</span>
                        </div>
                    </div>

                    {/* Reflection (Typewriter) */}
                    <div className="prose prose-p:text-sanctuary-text prose-p:font-serif prose-p:leading-loose">
                        <p ref={reflectionRef} className="text-lg whitespace-pre-wrap">
                            {displayedReflection}
                            {isTyping && <span className="inline-block w-1.5 h-5 ml-1 bg-sanctuary-blue animate-pulse align-middle"></span>}
                        </p>
                    </div>

                    {/* Action Item */}
                    {!isTyping && (
                        <div className="bg-white border border-sanctuary-line rounded-xl p-6 shadow-sm animate-fade-in-slow mt-8">
                            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Today's Ritual</h4>
                            <div className="flex items-start gap-4">
                                <div className="w-10 h-10 rounded-full bg-sanctuary-blue/5 flex items-center justify-center shrink-0">
                                    <span className="material-symbols-outlined text-sanctuary-blue">check_circle</span>
                                </div>
                                <p className="text-sanctuary-blue font-serif text-lg leading-relaxed">
                                    {feedback.actionItem}
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
      );
  }

  return null;
};