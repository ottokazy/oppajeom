import React from 'react';
import { LineValue } from '../types';

interface HexagramDisplayProps {
  lines: LineValue[];
  animateLast: boolean;
  simple?: boolean;
  compact?: boolean;
}

const Line: React.FC<{ value: LineValue; isNew: boolean; compact?: boolean }> = ({ value, isNew, compact }) => {
  const isYang = value === 7 || value === 9;
  const isChanging = value === 6 || value === 9;
  
  const colorClass = isChanging ? "bg-[#d1c7b7]" : "bg-[#eebd2b]";
  const widthClass = compact ? "w-12" : "w-full max-w-[16rem]";
  const heightClass = compact ? "h-1.5" : "h-3.5"; 

  return (
    <div className="w-full flex items-center justify-center relative">
      <div className={`relative ${widthClass} flex items-center justify-between`}>
        
        {/* Change Indicator Dot - Match with Image */}
        {isChanging && !compact && (
          <div className="absolute -left-8 top-1/2 -translate-y-1/2 flex items-center justify-center">
             <span className="text-xl text-[#eebd2b]">●</span>
          </div>
        )}

        {/* Left Part */}
        <div className={`${heightClass} ${colorClass} rounded-sm ${isYang ? 'w-full' : 'w-[45%]'} transition-colors duration-300`}></div>
        
        {/* Gap for Yin */}
        {!isYang && <div className="w-[10%]"></div>}
        
        {/* Right Part for Yin */}
        {!isYang && <div className={`${heightClass} ${colorClass} w-[45%] rounded-sm transition-colors duration-300`}></div>}
      </div>
    </div>
  );
};

export const HexagramDisplay: React.FC<HexagramDisplayProps> = ({ lines, animateLast, simple, compact }) => {
  const totalSlots = 6;
  const displayLines = [...lines]; 
  
  const slots = Array.from({ length: totalSlots }).map((_, index) => {
    const lineIndex = index;
    const value = displayLines[lineIndex];
    return { value, index: lineIndex };
  }).reverse();

  const slotHeightClass = compact ? "h-2.5" : "h-10";

  return (
    <div className={`w-full flex flex-col items-center justify-center ${simple ? '' : ''}`}>
      {slots.map((slot) => (
        <div key={slot.index} className={`w-full flex justify-center ${slotHeightClass}`}>
           {slot.value ? (
             <Line value={slot.value} isNew={animateLast && slot.index === lines.length - 1} compact={compact} />
           ) : (
             <div className={`${compact ? 'w-12 h-1.5 my-0.5' : 'w-full max-w-[16rem] h-3.5 my-3.2'} bg-white/5 rounded-sm`}></div>
           )}
        </div>
      ))}
    </div>
  );
};