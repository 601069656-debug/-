import React, { useRef, useState } from 'react';
import { Button } from './Button';
import { Cloud, CloudOff } from 'lucide-react';

interface StartScreenProps {
  saveExists: boolean;
  savedDifficulty?: 'normal' | 'grand';
  onContinue: () => void;
  onNewGame: (difficulty: 'normal' | 'grand') => void;
  onImport: (data: any) => void;
  onDeleteSave?: () => void;
  isCloudSyncEnabled?: boolean;
  onToggleCloudSync?: () => void;
  isAuthReady?: boolean;
}

export const StartScreen: React.FC<StartScreenProps> = ({ 
  saveExists, 
  savedDifficulty = 'normal', 
  onContinue, 
  onNewGame, 
  onImport, 
  onDeleteSave,
  isCloudSyncEnabled = false,
  onToggleCloudSync,
  isAuthReady = false
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedDifficulty, setSelectedDifficulty] = useState<'normal' | 'grand'>('normal');

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const json = e.target?.result as string;
        const data = JSON.parse(json);
        onImport(data);
      } catch (error) {
        console.error("Error parsing save file:", error);
        alert("无法读取存档文件。");
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-8 text-center fade-in relative overflow-hidden">
      {/* Background Fx */}
      <div className="absolute inset-0 pointer-events-none">
         <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] md:w-[500px] md:h-[500px] bg-amber-900/20 blur-[100px] rounded-full"></div>
      </div>

      <div className="mb-6 md:mb-10 relative">
         <div className="w-24 h-24 md:w-32 md:h-32 mx-auto border-4 border-amber-800 rotate-45 flex items-center justify-center shadow-[0_0_30px_rgba(180,83,9,0.5)] bg-black z-10 relative">
            <div className="w-16 h-16 md:w-24 md:h-24 border border-amber-600 flex items-center justify-center">
               <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-10 h-10 md:w-16 md:h-16 text-amber-500 -rotate-45">
                  <path d="M12.378 1.602a.75.75 0 0 0-.756 0L3 6.632l9 5.25 9-5.25-8.622-5.03ZM21.75 7.93l-9 5.25v9l8.628-5.032a.75.75 0 0 0 .372-.648V7.93ZM11.25 22.18v-9l-9-5.25v8.57a.75.75 0 0 0 .372.648l8.628 5.033Z" />
               </svg>
            </div>
         </div>
      </div>

      <div className="relative mb-6 md:mb-10 flex flex-col items-center select-none">
        {/* Calligraphy Title */}
        <h2 className="text-5xl md:text-8xl font-calligraphy text-amber-500 mb-2 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] tracking-widest leading-none">
          汉末群雄传
        </h2>
        {/* Subtle decorative seal */}
        <div className="absolute top-0 -right-12 md:-right-20 bg-red-800 text-white font-calligraphy text-[9px] md:text-xs py-1 px-1.5 border border-red-700 shadow-md flex items-center justify-center rounded-xs select-none rotate-6 leading-3 max-w-[40px] opacity-90">
          极密<br/>御览
        </div>
      </div>
      <p className="max-w-xl text-base md:text-xl text-amber-100/60 mb-8 md:mb-12 leading-relaxed font-serif italic border-y border-amber-900/30 py-4">
        "天下大势，合久必分，分久必合。<br/>
        当此乱世，尔等英雄名士，当效何人志业？"
      </p>
      
      <div className="flex flex-col gap-4 w-full max-w-xs relative z-10">
        {saveExists && (
          <div className="relative group">
            <Button onClick={onContinue} className="w-full text-lg py-3 md:py-4 border-amber-900 text-amber-100 hover:bg-amber-900/20" variant="secondary">
              再续霸业
            </Button>
          </div>
        )}
        
        <Button onClick={() => onNewGame('grand')} className="text-lg py-3 md:py-4 bg-amber-900 hover:bg-amber-800 border-amber-700 text-white shadow-[0_0_20px_rgba(180,83,9,0.4)]" variant="primary">
          {saveExists ? "另启乾坤" : "开启志业"}
        </Button>

        <div className="pt-4 border-t border-slate-800 mt-2">
           <input 
             type="file" 
             accept=".json" 
             ref={fileInputRef} 
             onChange={handleFileChange} 
             className="hidden" 
           />
           <Button onClick={handleImportClick} variant="ghost" className="text-sm w-full text-slate-500 hover:text-slate-300">
             导入史册 (存档)
           </Button>
           {saveExists && onDeleteSave && (
             <Button onClick={onDeleteSave} variant="ghost" className="text-sm w-full text-red-500 hover:text-red-400 mt-2 border border-red-900/30 hover:bg-red-900/20">
               抹除当前志业
             </Button>
           )}

           {onToggleCloudSync && isAuthReady && (
              <div className="mt-6 pt-4 border-t border-slate-800 flex flex-col items-center gap-2">
                <button 
                  onClick={onToggleCloudSync}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] uppercase tracking-[0.2em] font-bold transition-all border ${
                    isCloudSyncEnabled 
                      ? 'bg-sky-900/20 border-sky-500/50 text-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.2)]' 
                      : 'bg-slate-900/40 border-slate-700/50 text-slate-500 hover:border-slate-500 hover:text-slate-400'
                  }`}
                >
                  {isCloudSyncEnabled ? <Cloud size={12} /> : <CloudOff size={12} />}
                  {isCloudSyncEnabled ? "云端同步：开启" : "云端同步：禁用"}
                </button>
                <p className="text-[9px] text-slate-600 italic">
                  * 禁用后将仅使用本地浏览器缓存，防止多端冲突
                </p>
              </div>
            )}
        </div>
      </div>
    </div>
  );
};
