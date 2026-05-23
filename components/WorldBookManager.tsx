import React from 'react';
import { Button } from './Button';
import { X, BookOpen } from 'lucide-react';
import * as stages from '../stages';

interface WorldBookManagerProps {
  isOpen: boolean;
  onClose: () => void;
  selectedStages: string[];
  onToggleStage: (stageId: string) => void;
}

export const WorldBookManager: React.FC<WorldBookManagerProps> = ({ 
  isOpen, 
  onClose, 
  selectedStages, 
  onToggleStage 
}) => {
  if (!isOpen) return null;

  // Safety check: ensure stageList is defined
  const stageList = [
    { id: 'YELLOW_TURBAN', name: '黄巾起义 (184 AD)' },
    { id: 'ANTI_DONG_ZHUO', name: '讨伐董卓 (190 AD)' },
    { id: 'WARLORDS_CHAOS', name: '群雄逐鹿 (194 AD)' },
    { id: 'GUANDU', name: '官渡之战 (200 AD)' },
    { id: 'CHIBI', name: '赤壁之战 (208 AD)' },
    { id: 'THREE_KINGDOMS', name: '三国鼎立 (220 AD)' },
    { id: 'NORTHERN_EXPEDITION', name: '诸葛北伐 (227 AD)' },
    { id: 'FALL_OF_THREE', name: '晋灭三国 (263 AD)' },
  ];

  if (!stageList || stageList.length === 0) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4 backdrop-blur-sm">
      <div className="bg-stone-950 border-2 border-double border-amber-900/60 p-6 rounded-none shadow-[inset_0_0_40px_rgba(139,92,26,0.15),0_0_50px_rgba(0,0,0,0.95)] max-w-lg w-full max-h-[90vh] flex flex-col space-y-6 font-serif">
        <div className="flex justify-between items-center shrink-0">
          <h2 className="text-lg md:text-xl font-calligraphy text-amber-500 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-amber-600" />
            山河纪略 · 九州大势
          </h2>
          <button onClick={onClose} className="text-stone-400 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <p className="text-xs text-stone-400 shrink-0">
          选择激活并推演之剧本与地方大势割据。
        </p>

        <div className="grid grid-cols-1 gap-2 overflow-y-auto custom-scrollbar pr-2">
          {stageList.map(stage => (
            <button
              key={stage.id}
              onClick={(e) => {
                e.stopPropagation();
                onToggleStage(stage.id);
              }}
              className={`p-3 rounded-none text-left text-xs transition-all border ${
                selectedStages.includes(stage.id)
                  ? 'bg-amber-950/30 border-amber-600 text-amber-200 shadow-[inset_0_0_10px_rgba(240,150,50,0.15)]'
                  : 'bg-stone-900/50 border-amber-900/20 text-stone-400 hover:bg-stone-900 hover:border-amber-900/40 hover:text-stone-300'
              }`}
            >
              {stage.name}
            </button>
          ))}
        </div>

        <Button onClick={onClose} className="w-full shrink-0 bg-amber-900 border border-amber-800 hover:bg-amber-800 text-amber-100 rounded-none py-2.5 text-xs">
          归天听命 / 返回
        </Button>
      </div>
    </div>
  );
};
