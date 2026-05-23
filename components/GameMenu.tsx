import React, { useState, useEffect } from 'react';
import { Button } from './Button';

interface GameMenuProps {
  isOpen: boolean;
  onClose: () => void;
  initialSettings: string;
  onSettingsChange: (newSettings: string) => void;
  onForceDeduce: (settings?: string) => void;
  onExit: () => void;
}

export const GameMenu: React.FC<GameMenuProps> = ({ isOpen, onClose, initialSettings, onSettingsChange, onForceDeduce, onExit }) => {
  const [settings, setSettings] = useState(initialSettings);
  const [activeTab, setActiveTab] = useState<'settings' | 'system'>('settings');

  const [showExitConfirm, setShowExitConfirm] = useState(false);

  // Sync internal state if prop changes
  useEffect(() => {
    setSettings(initialSettings);
  }, [initialSettings]);

  const handleSave = () => {
    onSettingsChange(settings);
    onClose();
  };

  const handleExitClick = () => {
    setShowExitConfirm(true);
  };

  const handleConfirmExit = () => {
    onExit();
    onClose();
    setShowExitConfirm(false);
  };

  const handleCancelExit = () => {
    setShowExitConfirm(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 md:p-4">
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full h-full md:h-auto md:w-[600px] bg-slate-900/95 backdrop-blur-xl border-l md:border border-slate-700 md:rounded-lg shadow-2xl animate-in slide-in-from-right-10 fade-in duration-200 p-6 md:p-10 flex flex-col gap-6 overflow-y-auto">
        
        {showExitConfirm ? (
          <div className="flex flex-col items-center justify-center py-12 text-center space-y-6 animate-in fade-in zoom-in duration-300">
            <div className="w-16 h-16 rounded-full bg-red-900/20 flex items-center justify-center border border-red-900/50">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-red-500">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
              </svg>
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-display text-slate-100">确认退出？</h3>
              <p className="text-sm text-slate-400 max-w-xs">确定要退出当前游戏并返回初始界面吗？<br/>未保存的进度可能会丢失。</p>
            </div>
            <div className="flex flex-col w-full gap-3 pt-4">
              <Button 
                onClick={handleConfirmExit}
                variant="primary"
                className="bg-red-900 hover:bg-red-800 border-red-700 text-white py-3"
              >
                确认退出
              </Button>
              <Button 
                onClick={handleCancelExit}
                variant="ghost"
                className="text-slate-400 hover:text-slate-200 py-3"
              >
                取消
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex justify-between items-center border-b border-slate-700 pb-2">
              <h3 className="text-slate-200 font-display text-lg">系统菜单</h3>
              <button onClick={onClose} className="text-slate-500 hover:text-slate-300">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-700">
              <button
                onClick={() => setActiveTab('settings')}
                className={`px-4 py-2 text-sm font-display transition-colors ${activeTab === 'settings' ? 'text-amber-500 border-b-2 border-amber-500' : 'text-slate-500 hover:text-slate-300'}`}
              >
                舞台设定
              </button>
              <button
                onClick={() => setActiveTab('system')}
                className={`px-4 py-2 text-sm font-display transition-colors ${activeTab === 'system' ? 'text-amber-500 border-b-2 border-amber-500' : 'text-slate-500 hover:text-slate-300'}`}
              >
                系统操作
              </button>
            </div>

            {activeTab === 'settings' && (
              <div className="flex flex-col gap-2 flex-1 md:flex-none">
                <textarea
                  value={settings}
                  onChange={(e) => setSettings(e.target.value)}
                  className="w-full h-96 md:h-80 bg-black/50 text-slate-300 text-xs p-3 border border-slate-700 focus:border-amber-600 focus:outline-none rounded-sm resize-none font-serif leading-relaxed"
                  placeholder="在此处记录或修改当前的游戏舞台设定..."
                />
                <div className="flex justify-end">
                   <Button 
                     onClick={handleSave}
                     variant="primary"
                     className="text-xs py-2 px-4 md:py-1 md:px-3 bg-amber-900/50 hover:bg-amber-800 border-amber-700 text-amber-100 w-full"
                     title="保存设定"
                   >
                     保存设定
                   </Button>
                </div>
              </div>
            )}

            {activeTab === 'system' && (
              <div className="pt-4 space-y-6">
                <Button 
                  onClick={handleExitClick}
                  variant="ghost"
                  className="w-full text-red-400 hover:text-red-200 hover:bg-red-900/20 border border-red-900/30 py-3 md:py-2"
                >
                  退出并返回初始界面
                </Button>
              </div>
            )}
          </>
        )}

      </div>
    </div>
  );
};
