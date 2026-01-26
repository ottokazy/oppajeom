import React from 'react';

interface KoanCardProps {
    week: number;
    koan: string;
    userName: string;
    hexagramCode: string; // "111111"
    hexagramName: string; // "重天乾" (Hanja)
    cardRef?: React.Ref<HTMLDivElement>; 
}

// 8괘(Trigram)별 테마 컬러 정의 (Darker, Muted for Midnight Theme)
const TRIGRAM_PALETTE: Record<string, string> = {
    "111": "#1a2634", // 건(하늘) - Very Deep Navy
    "000": "#0f0f0f", // 곤(땅) - Almost Black
    "100": "#8a6e16", // 진(우레) - Dark Antique Gold
    "011": "#4a4a8a", // 손(바람) - Muted Indigo
    "010": "#050505", // 감(물) - Abyss Black
    "101": "#8a2be2", // 리(불) - Deep Violet (Mystic Fire)
    "001": "#2c333a", // 간(산) - Charcoal
    "110": "#1f6b75", // 태(연못) - Dark Teal
};

export const KoanCard: React.FC<KoanCardProps> = ({ week, koan, userName, hexagramCode, hexagramName, cardRef }) => {
    
    // Generate Gradient based on Hexagram Structure
    const getDynamicGradient = (code: string) => {
        if (!code || code.length !== 6) return 'linear-gradient(180deg, #0f172a 0%, #1e293b 100%)'; 

        const lowerCode = code.substring(0, 3);
        const upperCode = code.substring(3, 6);

        const upperColor = TRIGRAM_PALETTE[upperCode] || '#1a2634';
        const lowerColor = TRIGRAM_PALETTE[lowerCode] || '#2c333a';

        // Vertical gradient for deep look
        return `linear-gradient(180deg, ${upperColor} 0%, ${lowerColor} 100%)`;
    };

    const bgGradient = getDynamicGradient(hexagramCode);

    return (
        <div 
            ref={cardRef}
            className="relative overflow-hidden flex flex-col"
            style={{ 
                width: '320px', 
                height: '568px', 
                borderRadius: '24px',
                fontFamily: "'Noto Serif KR', serif",
                background: bgGradient,
                boxShadow: 'none', 
            }}
        >
            {/* 1. Base Texture Layer (Washi Paper) - Keeps organic feel */}
            <div 
                className="absolute inset-0 z-0 pointer-events-none"
                style={{
                    backgroundImage: "url('https://www.transparenttextures.com/patterns/washi.png')",
                    opacity: 0.2, // Subtle texture
                    backgroundRepeat: 'repeat',
                }}
            ></div>

            {/* 2. Noise Texture Layer - Film Grain feel */}
            <div 
                className="absolute inset-0 z-0 pointer-events-none"
                style={{
                    backgroundImage: "url('https://www.transparenttextures.com/patterns/noise-lines.png')",
                    opacity: 0.08,
                    backgroundRepeat: 'repeat',
                }}
            ></div>

            {/* 3. Vignette Overlay (Darkening edges) */}
            <div 
                className="absolute inset-0 z-0 pointer-events-none"
                style={{
                    background: 'radial-gradient(circle at center, transparent 30%, rgba(0,0,0,0.6) 100%)',
                }}
            ></div>

            {/* 4. Gold Frame Borders - Metallic Gold #D4AF37 */}
            <div className="absolute inset-3 border border-[#D4AF37] rounded-[20px] z-10 pointer-events-none opacity-60"></div>
            <div className="absolute inset-5 border border-[#D4AF37] rounded-[16px] z-10 pointer-events-none opacity-20" style={{ borderStyle: 'dotted' }}></div>


            {/* 5. Content Layer */}
            <div className="relative z-20 h-full flex flex-col justify-between p-10 text-[#EAEAEA]">
                
                {/* Header */}
                <div className="flex justify-between items-start">
                    <span className="text-[10px] tracking-[0.3em] font-sans font-bold text-[#D4AF37] uppercase border-b border-[#D4AF37] pb-1" style={{ borderColor: 'rgba(212,175,55, 0.3)' }}>
                        Week 0{week}
                    </span>
                    <div className="flex flex-col items-center justify-center opacity-80 gap-1">
                        <span className="text-[12px] font-serif font-bold text-[#D4AF37] leading-none">話</span>
                        <span className="text-[12px] font-serif font-bold text-[#D4AF37] leading-none">頭</span>
                    </div>
                </div>

                {/* Main Koan */}
                <div className="flex-1 flex flex-col items-center justify-center relative my-4">
                    {/* Vertical Divider Top */}
                    <div className="w-[1px] h-16 bg-gradient-to-b from-transparent via-[#D4AF37] to-transparent opacity-40 mb-8"></div>
                    
                    <h1 
                        className="text-[28px] font-bold leading-[1.6] text-center break-keep text-[#EAEAEA] tracking-tight"
                        style={{ 
                            wordBreak: 'keep-all', 
                            textShadow: '0 4px 10px rgba(0,0,0,0.8)' 
                        }}
                    >
                        {koan}
                    </h1>

                    {/* Vertical Divider Bottom */}
                    <div className="w-[1px] h-16 bg-gradient-to-b from-transparent via-[#D4AF37] to-transparent opacity-40 mt-8"></div>
                </div>

                {/* Footer */}
                <div className="text-center pb-2">
                    <div className="flex items-center justify-center gap-4 mb-4 opacity-100">
                        <div className="w-6 h-[1px] bg-[#D4AF37] opacity-50"></div>
                        <span className="text-xl font-bold tracking-[0.3em] text-[#D4AF37] font-serif shadow-black drop-shadow-md">
                            {hexagramName}
                        </span>
                        <div className="w-6 h-[1px] bg-[#D4AF37] opacity-50"></div>
                    </div>
                    
                    <div className="flex flex-col items-center gap-1 opacity-50">
                         <span className="text-[8px] tracking-[0.3em] font-sans uppercase text-[#B0B0B0]">
                            Oppajeom.com
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};