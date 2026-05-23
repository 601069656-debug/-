import React, { useState } from 'react';
import { Character } from '../types';
import { Button } from './Button';
import { User } from 'firebase/auth';
import { 
  Settings, 
  Users, 
  History, 
  BookOpen, 
  User as UserIcon, 
  Download, 
  Menu, 
  Globe,
  LogOut,
  Zap,
  ScrollText,
  Cloud,
  CloudOff
} from 'lucide-react';

interface HeaderProps {
  character: Character | null;
  user: User | null;
  difficulty?: 'normal' | 'grand';
  onOpenCharacterSheet: () => void;
  onOpenCompendium: () => void;
  onOpenLogModal: () => void;
  onOpenWorldBook: () => void;
  onExport: (purify?: boolean) => void;
  onOpenGameMenu?: () => void;
  onLogout?: () => void;
  isEditMode?: boolean;
  onToggleEditMode?: () => void;
  isSyncMode?: boolean;
  onToggleSyncMode?: () => void;
  isCloudSyncEnabled?: boolean;
  onToggleCloudSync?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ 
  character, 
  user,
  difficulty = 'normal',
  onOpenCharacterSheet, 
  onOpenCompendium,
  onOpenLogModal,
  onOpenWorldBook,
  onExport, 
  onOpenGameMenu,
  onLogout,
  isEditMode,
  onToggleEditMode,
  isSyncMode,
  onToggleSyncMode,
  isCloudSyncEnabled,
  onToggleCloudSync
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <header className="px-4 py-3 md:p-4 border-b border-white/5 flex justify-between items-center bg-black/80 backdrop-blur-xl sticky top-0 z-20 shadow-2xl">
      <div className="flex items-center gap-4 min-w-0">
         <div className="relative group cursor-pointer">
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-full border-2 border-amber-900 flex-shrink-0 flex items-center justify-center bg-black shadow-[0_0_15px_rgba(180,83,9,0.4)] group-hover:shadow-[0_0_20px_rgba(180,83,9,0.6)] transition-all">
               <span className="text-amber-600 font-bold text-xs md:text-sm">汉</span>
            </div>
         </div>
         
         <div className="flex flex-col">
            <h1 className="text-base md:text-2xl font-calligraphy text-amber-500 tracking-[0.1em] md:tracking-[0.15em] glow-sm truncate">汉末群雄传</h1>
         </div>
      </div>
      
      <div className="flex items-center gap-2 md:gap-6">
         {character && (
           <div className="hidden md:flex items-center gap-4 border-r border-white/10 pr-6">
              <div className="text-right">
                 <div className="font-bold text-slate-200 text-sm leading-none flex items-center justify-end gap-2">
                    {character.name}
                 </div>
                 <div className="text-[10px] text-red-500/80 uppercase tracking-widest font-display mt-1">
                   {character.socialIdentity || character.troopType}
                 </div>
              </div>
              
              <div className="flex flex-col gap-1">
                 <div className="flex gap-1">
                    {[1, 2, 3].map(i => (
                       <div key={i} className={`w-1.5 h-1.5 rounded-full ${i <= character.prestige / 33 ? 'bg-amber-500 shadow-[0_0_5px_rgba(245,158,11,0.5)]' : 'bg-neutral-800'}`} />
                    ))}
                 </div>
              </div>
           </div>
         )}

         {user && (
            <div className="flex items-center gap-3">
               <div className="hidden lg:flex flex-col items-end">
                  <span className="text-[10px] text-slate-200 font-bold leading-none">{user.displayName}</span>
                  <span className="text-[9px] text-slate-500 truncate max-w-[120px]">{user.email}</span>
               </div>
               {user.photoURL ? (
                  <img src={user.photoURL} alt="Avatar" className="w-8 h-8 rounded-full border border-white/10 shadow-lg" referrerPolicy="no-referrer" />
               ) : (
                  <div className="w-8 h-8 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center">
                     <UserIcon size={14} className="text-slate-400" />
                  </div>
               )}
            </div>
         )}
         
         <div className="relative">
            <Button 
              onClick={() => setIsMenuOpen(!isMenuOpen)} 
              variant="ghost" 
              className="p-2 text-slate-300 hover:text-white hover:bg-white/5 rounded-full transition-all"
              title="菜单"
            >
              <Menu size={20} />
            </Button>

            {isMenuOpen && (
              <>
                <div className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm cursor-default" onClick={() => setIsMenuOpen(false)} />
                <div className="absolute right-0 top-full mt-2 w-64 bg-stone-950 border-2 border-double border-amber-900/60 shadow-[0_4px_30px_rgba(0,0,0,0.85)] rounded-none z-40 flex flex-col overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 font-serif">
                   {character && (
                      <div className="p-4 border-b border-amber-900/10 bg-stone-900/40">
                         <div className="font-bold text-amber-100 text-sm truncate">{character.name}</div>
                         <div className="text-[10px] text-amber-500 uppercase tracking-wider truncate font-display">
                           {character.socialIdentity || character.troopType}
                         </div>
                      </div>
                   )}
                   
                   <div className="p-2 space-y-1">
                      <button 
                        onClick={() => { onOpenCompendium(); setIsMenuOpen(false); }}
                        className="w-full flex items-center gap-3 px-3 py-2 text-xs text-stone-300 hover:bg-amber-950/20 hover:text-amber-400 Transition-all text-left"
                      >
                         <BookOpen size={14} className="text-amber-600" />
                         英雄名录
                      </button>

                      <button 
                        onClick={() => { onOpenLogModal(); setIsMenuOpen(false); }}
                        className="w-full flex items-center gap-3 px-3 py-2 text-xs text-stone-300 hover:bg-amber-950/20 hover:text-amber-400 transition-all text-left"
                      >
                         <ScrollText size={14} className="text-amber-600" />
                         浮生录
                      </button>

                      <button 
                        onClick={() => { onOpenWorldBook(); setIsMenuOpen(false); }}
                        className="w-full flex items-center gap-3 px-3 py-2 text-xs text-stone-300 hover:bg-amber-950/20 hover:text-amber-400 transition-all text-left"
                      >
                         <Globe size={14} className="text-amber-600" />
                         山河纪略
                      </button>

                      <button 
                        onClick={() => { onOpenCharacterSheet(); setIsMenuOpen(false); }}
                        className="w-full flex items-center gap-3 px-3 py-2 text-xs text-stone-300 hover:bg-amber-950/20 hover:text-amber-400 transition-all text-left"
                      >
                         <UserIcon size={14} className="text-amber-600" />
                         本命卷轴
                      </button>

                      <div className="h-px bg-amber-900/10 my-1" />

                      {onToggleEditMode && (
                        <button 
                          onClick={() => { onToggleEditMode(); setIsMenuOpen(false); }}
                          className={`w-full flex items-center gap-3 px-3 py-2 text-xs transition-all text-left ${isEditMode ? 'text-amber-400 bg-amber-950/30' : 'text-stone-300 hover:bg-amber-950/20 hover:text-amber-400'}`}
                        >
                           <Zap size={14} className="text-amber-600" />
                           {isEditMode ? "收束天机 (关闭编辑)" : "窥弄天机 (开启编辑)"}
                        </button>
                      )}

                       {onToggleSyncMode && (
                        <button 
                          onClick={() => { onToggleSyncMode(); setIsMenuOpen(false); }}
                          className={`w-full flex items-center gap-3 px-3 py-2 text-xs transition-all text-left ${isSyncMode ? 'text-amber-400 bg-amber-950/30' : 'text-stone-300 hover:bg-amber-950/20 hover:text-amber-400'}`}
                        >
                           <History size={14} className="text-amber-600" />
                           {isSyncMode ? "神魂守一 (关闭同步)" : "乾坤共鸣 (开启同步)"}
                        </button>
                      )}

                      {onToggleCloudSync && (
                        <button 
                          onClick={() => { onToggleCloudSync(); setIsMenuOpen(false); }}
                          className={`w-full flex items-center gap-3 px-3 py-2 text-xs transition-all text-left ${isCloudSyncEnabled ? 'text-amber-400 bg-amber-950/30' : 'text-stone-500 hover:bg-amber-950/20 hover:text-amber-400'}`}
                        >
                           {isCloudSyncEnabled ? <Cloud size={14} className="text-amber-600" /> : <CloudOff size={14} className="text-stone-600" />}
                           {isCloudSyncEnabled ? "斩断因果 (禁用同步)" : "寄托太虚 (云端同步)"}
                        </button>
                      )}
                      
                      <button 
                        onClick={() => { onExport(false); setIsMenuOpen(false); }}
                        className="w-full flex items-center gap-3 px-3 py-2 text-xs text-stone-300 hover:bg-amber-950/20 hover:text-amber-300 transition-all text-left"
                      >
                         <Download size={14} className="text-amber-600" />
                         抄录灵契 (完整存档)
                      </button>

                      <button 
                        onClick={() => { onExport(true); setIsMenuOpen(false); }}
                        className="w-full flex items-center gap-3 px-3 py-2 text-xs text-stone-300 hover:bg-amber-950/20 hover:text-amber-300 transition-all text-left"
                      >
                         <ScrollText size={14} className="text-amber-600" />
                         辑录青史 (纯净剧情)
                      </button>

                      {onOpenGameMenu && (
                        <button 
                          onClick={() => { onOpenGameMenu(); setIsMenuOpen(false); }}
                          className="w-full flex items-center gap-3 px-3 py-2 text-xs text-stone-300 hover:bg-amber-950/20 hover:text-amber-300 transition-all text-left"
                        >
                           <Settings size={14} className="text-amber-600" />
                           乾坤机杼 (系统菜单)
                        </button>
                      )}

                      {onLogout && (
                         <>
                            <div className="h-px bg-amber-900/10 my-1" />
                            <button 
                              onClick={() => { onLogout(); setIsMenuOpen(false); }}
                              className="w-full flex items-center gap-3 px-3 py-2 text-xs text-red-500/80 hover:bg-red-950/20 hover:text-red-400 transition-all text-left font-semibold"
                            >
                               <LogOut size={14} className="text-red-700" />
                               相忘江湖 (解除契约)
                            </button>
                         </>
                      )}
                   </div>
                </div>
              </>
            )}
         </div>
      </div>
    </header>
  );
};

