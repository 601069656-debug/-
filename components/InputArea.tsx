import React, { useRef, useEffect } from 'react';
import { Button } from './Button';

interface InputAreaProps {
  input: string;
  setInput: (value: string) => void;
  isLoading: boolean;
  currentModel: string;
  customModelName: string;
  onModelChange: (model: string) => void;
  onOpenApiSettings: () => void;
  onSendMessage: () => void;
  onRegenerate: () => void;
  onResetOpening: () => void;
  onDeduce: () => void;
  selectedMessageCount: number;
  showRegenerate: boolean;
  showResetOpening: boolean;
}

declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

export const InputArea: React.FC<InputAreaProps> = ({
  input,
  setInput,
  isLoading,
  currentModel,
  customModelName,
  onModelChange,
  onOpenApiSettings,
  onSendMessage,
  onRegenerate,
  onResetOpening,
  onDeduce,
  selectedMessageCount,
  showRegenerate,
  showResetOpening
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = '56px'; // Reset to min-height first
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${Math.max(56, scrollHeight)}px`;
    }
  }, [input]);

  return (
    <div className="p-3 md:p-8 bg-black/80 backdrop-blur-md border-t border-slate-800">
      <div className="max-w-4xl md:max-w-5xl mx-auto flex flex-col gap-2">
        
        {/* Tools Row: Regenerate & Model Selector */}
        <div className="flex justify-between items-end px-1 mb-2">
           {/* Regenerate / Reset Buttons */}
           <div className="flex gap-2">
             {showRegenerate && !isLoading && (
              <Button 
                type="button" 
                onClick={onRegenerate}
                variant="ghost"
                className="px-2 py-1 md:px-3 border border-red-900/30 text-red-400 hover:text-red-200 hover:bg-red-900/20 flex items-center gap-1 md:gap-2 text-xs md:text-sm"
                title="删除最后一条回复并重试"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                </svg>
                <span className="hidden md:inline">重新生成 (Regenerate)</span>
                <span className="md:hidden">重试</span>
              </Button>
             )}

             {/* Reset Opening Button - Only show if history is short (Opening only) */}
             {showResetOpening && !isLoading && (
               <Button 
                 type="button" 
                 onClick={onResetOpening}
                 variant="ghost"
                 className="px-2 py-1 md:px-3 border border-amber-900/30 text-amber-400 hover:text-amber-200 hover:bg-amber-900/20 flex items-center gap-1 md:gap-2 text-xs md:text-sm"
                 title="重置开场剧情"
               >
                 <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                   <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 0 0-3.7-3.7 48.678 48.678 0 0 0-7.324 0 4.006 4.006 0 0 0-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 0 0 3.7 3.7 48.656 48.656 0 0 0 7.324 0 4.006 4.006 0 0 0 3.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3-3 3" />
                 </svg>
                 <span className="hidden md:inline">重置开场 (Reset Intro)</span>
                 <span className="md:hidden">重置</span>
               </Button>
             )}
           </div>

           {/* Model Selector */}
           <div className="flex items-center gap-2">
              <label className="text-xs text-slate-500 uppercase tracking-wider font-display hidden md:block">
                Model: {currentModel === 'openai-custom' && customModelName ? customModelName : currentModel}
              </label>
              <select 
                value={currentModel} 
                onChange={(e) => {
                  if (e.target.value === 'gemini-custom') {
                    window.aistudio.openSelectKey();
                  } else if (e.target.value === 'openai-custom') {
                    onOpenApiSettings();
                  } else {
                    onModelChange(e.target.value);
                  }
                }}
                className="bg-slate-900 border border-slate-700 text-slate-300 text-xs py-1 px-2 rounded-sm focus:border-red-500 focus:outline-none cursor-pointer max-w-[100px] md:max-w-none"
                disabled={isLoading}
              >
                <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro</option>
                <option value="gemini-3-pro-preview">Gemini 3.0 Pro</option>
                <option value="gemini-3.1-flash-lite-preview">Gemini 3.1 Flash Lite</option>
                <option value="gemini-3-flash-preview">Gemini 3.0 Flash</option>
                <option value="gemini-custom">使用 GEMINI API Key</option>
                <option value="openai-custom">使用第三方 API Key</option>
              </select>
           </div>
        </div>

        {/* Input Row */}
        <div className="flex gap-2 md:gap-4 flex-col md:flex-row items-stretch">
          <div className="flex-1 flex gap-2 md:gap-4 w-full items-end">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (input.trim() && !isLoading) {
                    onSendMessage();
                  }
                }
              }}
              rows={1}
              placeholder="决定你的下一步行动... (Shift+Enter 换行)"
              disabled={isLoading}
              className={`flex-1 bg-slate-900/50 border text-base md:text-lg p-3 md:p-4 rounded-sm focus:outline-none transition-all placeholder-slate-600 font-serif resize-none min-h-[56px] max-h-[70vh] overflow-y-auto
                ${isLoading ? 'opacity-50 cursor-not-allowed border-transparent' : `border-slate-700 focus:border-red-900 text-slate-200 shadow-inner`}
              `}
            />
            
            {/* Deduce Button (Visible when messages selected) */}
            {selectedMessageCount > 0 && (
              <Button 
                type="button"
                onClick={onDeduce}
                disabled={isLoading}
                className="px-3 md:px-4 whitespace-nowrap bg-amber-900/80 border-amber-700 hover:bg-amber-800 text-amber-100 shadow-[0_0_15px_rgba(245,158,11,0.3)] text-sm md:text-base"
                variant="primary"
                title="基于选定回复进行剧情推演"
              >
                <span className="flex items-center gap-1 md:gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
                  </svg>
                  <span className="hidden md:inline">推演</span>
                  <span>({selectedMessageCount})</span>
                </span>
              </Button>
            )}

            <Button 
              type="button" 
              onClick={() => onSendMessage()}
              disabled={!input.trim() || isLoading}
              className="px-4 md:px-8 whitespace-nowrap bg-slate-800 border-slate-600 hover:bg-red-900 hover:border-red-700 text-slate-200 text-sm md:text-base"
              variant="primary"
            >
              执行
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
