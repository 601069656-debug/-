import React, { useState } from 'react';
import { Character } from '../types';
import { Button } from './Button';

interface StageSetupProps {
  character: Character;
  onComplete: (settings: string) => void;
}

export const StageSetup: React.FC<StageSetupProps> = ({ character, onComplete }) => {
  const [settings, setSettings] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onComplete(settings);
  };

  const getIdentityName = () => {
    return character.socialIdentity || "贤才";
  };
  const getName = () => character.name;

  return (
    <div className="w-full max-w-4xl mx-auto p-2 md:p-8 animate-fade-in text-slate-200">
      <div className="bg-slate-900/90 border border-slate-700 p-4 md:p-10 rounded-sm shadow-2xl relative overflow-hidden">
        {/* Background Decoration */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-900/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
        
        <h2 className="text-xl md:text-4xl font-display text-slate-100 mb-4 md:mb-6 border-b border-slate-700 pb-3 md:pb-4">
          天下大势设定
        </h2>

        <div className="mb-4 md:mb-6 text-slate-400 font-serif leading-relaxed text-xs md:text-base">
          <p className="mb-2 md:mb-4">
            志业已定。来自 <strong>{getIdentityName()}</strong> 的 <strong>{getName()}</strong> 即将投身于这三国乱世。
          </p>
          <p>
            在历史的长河滚滚向前之前，你可以设定本次推演的<strong className="text-slate-200">时间点</strong>、<strong className="text-slate-200">局势</strong>、<strong className="text-slate-200">初始身处之州郡</strong>等<strong className="text-slate-200">起始条件</strong>。
          </p>
          <p className="text-[10px] md:text-sm opacity-70 mt-2">
            * 这些设定将作为AI模拟的基础逻辑，请力求严谨。
          </p>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); handleSubmit(e); }} className="space-y-4 md:space-y-6">
          <div className="relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-amber-900/50 to-slate-800/50 rounded-sm opacity-50 group-hover:opacity-100 transition duration-500"></div>
            <textarea
              value={settings}
              onChange={(e) => setSettings(e.target.value)}
              placeholder="例如：
- 时间：初平元年，春，董卓迁都关中后。
- 地点：兖州，陈留郡。
- 局势：十八路讨董联军已现裂痕，众诸侯各怀鬼胎。"
              className="relative w-full h-64 md:h-96 bg-black text-slate-200 font-serif text-sm md:text-lg p-4 md:p-6 border border-slate-700 focus:border-amber-800 focus:outline-none rounded-sm resize-none shadow-inner leading-relaxed md:leading-loose"
            />
          </div>

          <div className="flex justify-end gap-4 pt-2 md:pt-4">
            <Button 
              type="submit" 
              variant="primary"
              className="px-6 md:px-8 py-2 md:py-3 text-sm md:text-lg bg-amber-900 hover:bg-amber-800 border-amber-700 text-white shadow-[0_0_20px_rgba(185,28,28,0.3)] w-full md:w-auto"
            >
              开启志业
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
