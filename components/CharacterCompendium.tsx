import React, { useState, useEffect } from 'react';
import { NPCProfile, NPCRecord } from '../types';
import { Button } from './Button';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronUp, ChevronDown } from 'lucide-react';

interface CharacterCompendiumProps {
  profiles: NPCProfile[];
  onClose: () => void;
  onAddNPC: (name: string) => void;
  onUpdateNPC: (npc: NPCProfile) => void;
  onSyncNPC: (npcId: string) => void;
  onDeleteNPC: (npcId: string) => void;
  onMergeNPCs: (sourceIds: string[], targetId: string) => void;
  onMoveNPC: (id: string, direction: 'up' | 'down') => void;
  onBatchInferAppearances?: () => Promise<number>;
  onFormatRecords?: (npcId: string) => Promise<void>;
}

export const CharacterCompendium: React.FC<CharacterCompendiumProps> = ({ 
  profiles, 
  onClose, 
  onAddNPC, 
  onUpdateNPC,
  onSyncNPC,
  onDeleteNPC,
  onMergeNPCs,
  onMoveNPC,
  onBatchInferAppearances,
  onFormatRecords
}) => {
  console.log('CharacterCompendium received onDeleteNPC:', typeof onDeleteNPC);
  const [selectedNPCId, setSelectedNPCId] = useState<string | null>(null);
  const [newNPCName, setNewNPCName] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isMerging, setIsMerging] = useState(false);
  const [isBatchInferring, setIsBatchInferring] = useState(false);
  const [isFormatting, setIsFormatting] = useState(false);
  const [selectedMergeIds, setSelectedMergeIds] = useState<Set<string>>(new Set());
  const [showMergeConfirm, setShowMergeConfirm] = useState(false);
  const [primaryMergeId, setPrimaryMergeId] = useState<string | null>(null);
  const [editedStatus, setEditedStatus] = useState('');
  const [editedParameters, setEditedParameters] = useState('');
  const [editedSpecialties, setEditedSpecialties] = useState('');
  const [editedInventory, setEditedInventory] = useState('');
  const [editedUserNotes, setEditedUserNotes] = useState('');
  const [editedNativePlace, setEditedNativePlace] = useState('');
  const [editedTags, setEditedTags] = useState<string>('');
  const [editedName, setEditedName] = useState('');
  const [editedBondLevel, setEditedBondLevel] = useState<number>(0);
  const [editedRecords, setEditedRecords] = useState<string>('');
  const [editedHasAppeared, setEditedHasAppeared] = useState<boolean>(false);
  const [editedAppearanceTime, setEditedAppearanceTime] = useState('');
  const [editedAppearanceLocation, setEditedAppearanceLocation] = useState('');

  const selectedNPC = profiles.find(p => p.id === selectedNPCId) || null;

  const renderSafeString = (val: any): string => {
    if (typeof val === 'string') return val;
    if (Array.isArray(val)) return val.join(', ');
    if (typeof val === 'object' && val !== null) {
      try {
        return Object.entries(val).map(([k, v]) => `${k}: ${v}`).join(', ');
      } catch (e) {
        return JSON.stringify(val);
      }
    }
    return String(val || '');
  };

  // Sync editing states when selected NPC changes
  useEffect(() => {
    if (selectedNPC && !isEditing) {
      setEditedName(selectedNPC.name);
      setEditedStatus(selectedNPC.status || '');
      setEditedParameters(selectedNPC.parameters || '');
      setEditedSpecialties(selectedNPC.specialties || '');
      setEditedInventory(selectedNPC.inventory || '');
      setEditedNativePlace(selectedNPC.nativePlace || '');
      
      // Combine AI record and user notes for editing
      let combinedNotes = selectedNPC.userNotes || '';
      if (selectedNPC.aiGeneratedRecord && !combinedNotes.includes(selectedNPC.aiGeneratedRecord)) {
        combinedNotes = combinedNotes ? `${selectedNPC.aiGeneratedRecord}\n\n${combinedNotes}` : selectedNPC.aiGeneratedRecord;
      }
      setEditedUserNotes(combinedNotes);
      
      setEditedTags((selectedNPC.tags || []).join(', '));
      setEditedBondLevel(selectedNPC.bondLevel ?? 0);
      setEditedHasAppeared(selectedNPC.hasAppeared ?? false);
      setEditedAppearanceTime(selectedNPC.appearanceTime || '');
      setEditedAppearanceLocation(selectedNPC.appearanceLocation || '');
      setEditedRecords((selectedNPC.records || []).map(r => {
        let prefix = '';
        if (r.timestamp) prefix += `[${r.timestamp}]`;
        if (r.location) prefix += `[${r.location}]`;
        return prefix ? `${prefix} ${r.content}` : r.content;
      }).join('\n---\n'));
    }
  }, [selectedNPCId, profiles, isEditing]);

  const handleAdd = () => {
    if (newNPCName.trim()) {
      onAddNPC(newNPCName.trim());
      setNewNPCName('');
      setIsAdding(false);
    }
  };

  const handleEdit = (npc: NPCProfile) => {
    setIsEditing(true);
    // State is synced by useEffect, but we ensure it here for immediate feedback
    setEditedName(npc.name);
    setEditedStatus(npc.status || '');
    setEditedParameters(npc.parameters || '');
    setEditedSpecialties(npc.specialties || '');
    setEditedInventory(npc.inventory || '');
    setEditedNativePlace(npc.nativePlace || '');
    
    let combinedNotes = npc.userNotes || '';
    if (npc.aiGeneratedRecord && !combinedNotes.includes(npc.aiGeneratedRecord)) {
      combinedNotes = combinedNotes ? `${npc.aiGeneratedRecord}\n\n${combinedNotes}` : npc.aiGeneratedRecord;
    }
    setEditedUserNotes(combinedNotes);
    
    setEditedTags((npc.tags || []).join(', '));
    setEditedBondLevel(npc.bondLevel ?? 0);
    setEditedHasAppeared(npc.hasAppeared ?? false);
    setEditedAppearanceTime(npc.appearanceTime || '');
    setEditedAppearanceLocation(npc.appearanceLocation || '');
    setEditedRecords((npc.records || []).map(r => {
      let prefix = '';
      if (r.timestamp) prefix += `[${r.timestamp}]`;
      if (r.location) prefix += `[${r.location}]`;
      return prefix ? `${prefix} ${r.content}` : r.content;
    }).join('\n---\n'));
  };

  const handleSave = () => {
    if (selectedNPC) {
      const recordLines = editedRecords.split(/\s*---\s*/)
        .map(line => line.trim())
        .filter(line => line);
      
      const existingRecords = [...(selectedNPC.records || [])];
      const updatedRecords = recordLines.map((line, index) => {
        let timestamp = '';
        let location = '';
        let content = line;

        // Parse [timestamp][location] content
        const timeMatch = content.match(/^\[(.*?)\]/);
        if (timeMatch) {
          timestamp = timeMatch[1];
          content = content.substring(timeMatch[0].length).trim();
          
          const locMatch = content.match(/^\[(.*?)\]/);
          if (locMatch) {
            location = locMatch[1];
            content = content.substring(locMatch[0].length).trim();
          }
        }

        const matchIndex = existingRecords.findIndex(r => r.content.trim() === content);
        let existing = null;
        if (matchIndex !== -1) {
          existing = existingRecords[matchIndex];
          existingRecords.splice(matchIndex, 1); // Remove so it's not matched again
        }
        return {
          id: existing?.id || `rec_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 5)}`,
          content,
          timestamp: timestamp || existing?.timestamp || new Date().toLocaleString(),
          location: location || existing?.location
        };
      });

      const updatedNPC: NPCProfile = {
        ...selectedNPC,
        name: editedName,
        status: editedStatus,
        parameters: editedParameters,
        specialties: editedSpecialties,
        inventory: editedInventory,
        nativePlace: editedNativePlace,
        aiGeneratedRecord: '', // Clear since it's merged into userNotes
        userNotes: editedUserNotes,
        tags: editedTags.split(',').map(t => t.trim()).filter(t => t),
        bondLevel: editedBondLevel,
        hasAppeared: editedHasAppeared,
        appearanceTime: editedAppearanceTime,
        appearanceLocation: editedAppearanceLocation,
        records: updatedRecords,
        hiddenNotes: selectedNPC.hiddenNotes,
        lastUpdated: Date.now()
      };
      onUpdateNPC(updatedNPC);
    }
    setIsEditing(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-5xl h-[90vh] md:h-[85vh] flex bg-stone-950 border-2 border-double border-amber-900/60 shadow-[inset_0_0_40px_rgba(139,92,26,0.15),0_0_50px_rgba(0,0,0,0.95)] overflow-hidden relative rounded-none z-[1000] font-serif"
      >
        {/* Sidebar List */}
        <div className={`
          ${selectedNPC ? 'hidden md:flex' : 'flex'} 
          w-full md:w-1/3 border-r border-amber-900/15 flex-col bg-stone-900/15
        `}>
          <div className="p-4 border-b border-amber-900/15 flex justify-between items-center bg-stone-900/10">
            <h2 className="text-sm md:text-base font-calligraphy text-amber-500 select-none">英雄名录</h2>
            <div className="flex gap-2.5">
              {onBatchInferAppearances && (
                <Button 
                  onClick={async () => {
                    setIsBatchInferring(true);
                    try {
                      const count = await onBatchInferAppearances();
                      alert(`推断完成！共更新了 ${count} 个角色的登场状态。`);
                    } catch (e) {
                      alert(`推断失败: ${e instanceof Error ? e.message : String(e)}`);
                    } finally {
                      setIsBatchInferring(false);
                    }
                  }} 
                  disabled={isEditing || isAdding || isMerging || isBatchInferring}
                  variant="ghost" 
                  className={`text-[10px] p-0.5 h-auto text-amber-500 hover:text-amber-400 font-semibold ${(isEditing || isAdding || isMerging || isBatchInferring) ? 'opacity-30' : ''}`}
                  title="一键推断所有旧角色的登场状态"
                >
                  {isBatchInferring ? '推断中' : '全量推断'}
                </Button>
              )}
              <Button 
                onClick={() => {
                  setIsMerging(!isMerging);
                  setSelectedMergeIds(new Set());
                }} 
                disabled={isEditing || isAdding}
                variant="ghost" 
                className={`text-[10px] p-0.5 h-auto font-semibold ${isMerging ? 'text-amber-500' : 'text-stone-400 hover:text-stone-200'} ${(isEditing || isAdding) ? 'opacity-30' : ''}`}
              >
                {isMerging ? '取消' : '并宗'}
              </Button>
              <Button 
                onClick={() => setIsAdding(true)} 
                disabled={isEditing || isMerging}
                variant="ghost" 
                className={`text-[10px] p-0.5 h-auto text-amber-500 hover:text-amber-400 font-semibold ${(isEditing || isMerging) ? 'opacity-30' : ''}`}
              >
                +增修
              </Button>
              <Button onClick={onClose} variant="ghost" className="text-[10px] p-0.5 h-auto text-stone-400 hover:text-stone-100">
                收卷
              </Button>
            </div>
          </div>
          
          {isMerging && selectedMergeIds.size >= 2 && (
            <div className="p-3 border-b border-amber-900/30 bg-amber-950/20">
              <Button 
                onClick={() => {
                  setPrimaryMergeId(Array.from(selectedMergeIds)[0]);
                  setShowMergeConfirm(true);
                }} 
                className="w-full text-xs py-2 bg-amber-600 hover:bg-amber-500"
              >
                确认合并 ({selectedMergeIds.size} 个角色)
              </Button>
            </div>
          )}
          {isAdding && (
            <div className="p-3 border-b border-zinc-800 bg-zinc-900">
              <input 
                className="w-full bg-zinc-950 border border-zinc-700 text-zinc-200 px-3 py-2 text-sm mb-2 rounded-md"
                placeholder="输入NPC名称..."
                value={newNPCName}
                onChange={(e) => setNewNPCName(e.target.value)}
                autoFocus
              />
              <div className="flex gap-2">
                <Button onClick={handleAdd} className="flex-1 text-xs py-2">确认</Button>
                <Button onClick={() => setIsAdding(false)} variant="ghost" className="flex-1 text-xs py-2">取消</Button>
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto">
            {profiles.filter(npc => npc.id !== 'holy-grail-system' && npc.name !== '周聪' && npc.id !== 'historical-system').length === 0 ? (
              <div className="p-4 text-center text-stone-500 text-sm italic">
                暂无记录。可点击新增。
              </div>
            ) : (
              profiles.filter(npc => npc.id !== 'holy-grail-system' && npc.name !== '周聪' && npc.id !== 'historical-system').map((npc, idx) => {
                const displayName = npc.id === 'historical-system' ? '天下大势' : npc.name;
                return (
                <div 
                  key={`npc-${npc.id || ''}-${idx}`}
                  onClick={() => {
                    if (isEditing || isAdding) return;
                    if (isMerging) {
                      const next = new Set(selectedMergeIds);
                      if (next.has(npc.id)) next.delete(npc.id);
                      else next.add(npc.id);
                      setSelectedMergeIds(next);
                    } else {
                      setSelectedNPCId(npc.id);
                    }
                  }}
                  className={`
                    p-4 border-b border-amber-900/10 cursor-pointer transition-colors flex items-center gap-3
                    ${selectedNPCId === npc.id && !isMerging ? 'bg-amber-950/20 text-amber-200 border-l-2 border-l-amber-600 font-semibold shadow-[inset_0_0_10px_rgba(245,158,11,0.05)]' : 'text-stone-400 hover:bg-stone-900/40 hover:text-stone-200'}
                    ${isMerging && selectedMergeIds.has(npc.id) ? 'bg-amber-950/30 text-amber-200 border-l-2 border-l-amber-600' : ''}
                    ${(isEditing || isAdding) ? 'opacity-50 cursor-not-allowed' : ''}
                  `}
                >
                  {isMerging && (
                    <div className={`w-4 h-4 rounded-none border flex items-center justify-center ${selectedMergeIds.has(npc.id) ? 'bg-amber-700 border-amber-600' : 'border-stone-700'}`}>
                      {selectedMergeIds.has(npc.id) && <div className="w-2 h-2 bg-amber-50 rounded-xs animate-pulse" />}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-xs truncate text-amber-100">{displayName}</div>
                    <div className="text-[11px] opacity-60 truncate font-serif">{npc.aiGeneratedRecord || npc.userNotes || '暂无描述'}</div>
                  </div>
                  {!isMerging && !isAdding && !isEditing && (
                    <div className="flex flex-col gap-1 ml-2">
                      <button 
                        onClick={(e) => { e.stopPropagation(); onMoveNPC(npc.id, 'up'); }}
                        disabled={idx === 0}
                        className="p-1 text-stone-500 hover:text-amber-500 disabled:opacity-20"
                      >
                        <ChevronUp size={12} />
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); onMoveNPC(npc.id, 'down'); }}
                        disabled={idx === profiles.filter(n => n.id !== 'holy-grail-system' && n.name !== '周聪' && n.id !== 'historical-system').length - 1}
                        className="p-1 text-stone-500 hover:text-amber-500 disabled:opacity-20"
                      >
                        <ChevronDown size={12} />
                      </button>
                    </div>
                  )}
                </div>
                );
              })
            )}
          </div>
        </div>

        {/* Detail View */}
        <div className={`
          ${selectedNPCId ? 'flex' : 'hidden md:flex'} 
          flex-1 flex-col bg-stone-950 relative
        `}>
          {selectedNPC ? (
            <>
              <div className="p-4 md:p-6 border-b border-amber-900/15 flex flex-col md:flex-row justify-between items-start bg-stone-900/10 gap-4">
                <div className="flex items-center gap-3 w-full md:w-auto">
                  <button 
                    onClick={() => setSelectedNPCId(null)}
                    className="md:hidden p-1 text-stone-400 hover:text-white"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
                    </svg>
                  </button>
                  <div className="min-w-0">
                    <h2 className="text-base md:text-xl font-calligraphy text-amber-100 mb-1 truncate">{selectedNPC.name}</h2>
                    <div className="text-[10px] text-stone-500 font-serif">
                      天机更新于: {selectedNPC.lastUpdated ? new Date(selectedNPC.lastUpdated).toLocaleString() : '未载'}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                  <Button 
                    onClick={onClose}
                    variant="ghost"
                    className="md:hidden text-stone-400 hover:text-stone-100 text-[10px] py-1.5"
                  >
                    关闭
                  </Button>
                  <Button 
                    onClick={() => onSyncNPC(selectedNPC.id)}
                    className="flex-1 md:flex-none bg-amber-950/30 text-amber-300 border border-amber-900/40 hover:bg-amber-900/20 text-[10px] py-1.5 rounded-none"
                  >
                    同步天机
                  </Button>
                  <Button 
                    onClick={() => {
                      console.log('DEBUG: Delete button clicked for NPC:', selectedNPC.id);
                      console.log('DEBUG: Deletion proceeding without confirm');
                      onDeleteNPC(selectedNPC.id);
                      setSelectedNPCId(null);
                      console.log('DEBUG: Deletion action called and setSelectedNPCId(null) called');
                    }}
                    variant="ghost"
                    className="text-red-500/80 hover:text-red-400 hover:bg-stone-900 text-[10px] py-1.5"
                  >
                    绝交
                  </Button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
                {/* Status Section */}
                <section>
                  <div className="flex justify-between items-center mb-2 border-b border-amber-900/10 pb-1">
                    <h3 className="text-xs font-bold text-amber-500 tracking-wider">
                      生平与志趣
                    </h3>
                    {!isEditing ? (
                      <Button onClick={() => handleEdit(selectedNPC)} variant="ghost" className="text-[10px] py-0.5 h-auto text-amber-500 hover:text-amber-400 font-semibold">修改</Button>
                    ) : (
                      <div className="flex gap-2">
                        <Button 
                          onClick={() => {
                            setIsEditing(false);
                            // Re-sync from current NPC
                            if (selectedNPC) {
                              setEditedName(selectedNPC.name);
                              setEditedStatus(selectedNPC.status || '');
                              setEditedNativePlace(selectedNPC.nativePlace || '');
                              
                              let combinedNotes = selectedNPC.userNotes || '';
                              if (selectedNPC.aiGeneratedRecord && !combinedNotes.includes(selectedNPC.aiGeneratedRecord)) {
                                combinedNotes = combinedNotes ? `${selectedNPC.aiGeneratedRecord}\n\n${combinedNotes}` : selectedNPC.aiGeneratedRecord;
                              }
                              setEditedUserNotes(combinedNotes);
                              
                              setEditedTags((selectedNPC.tags || []).join(', '));
                              setEditedBondLevel(selectedNPC.bondLevel ?? 0);
                              setEditedRecords((selectedNPC.records || []).map(r => r.content).join('\n---\n'));
                            }
                          }} 
                          variant="ghost" 
                          className="text-[9px] py-0.5 h-auto text-zinc-500 hover:text-zinc-400"
                        >
                          取消
                        </Button>
                        <Button onClick={handleSave} variant="ghost" className="text-[9px] py-0.5 h-auto text-green-500 hover:text-green-400">保存</Button>
                      </div>
                    )}
                  </div>
                  {isEditing ? (
                    <div className="space-y-2">
                        <input className="w-full bg-zinc-900 border border-zinc-700 text-zinc-200 px-2 py-1 text-sm" value={editedName} onChange={(e) => setEditedName(e.target.value)} placeholder="名称..." />
                        <input className="w-full bg-zinc-900 border border-zinc-700 text-zinc-200 px-2 py-1 text-sm" value={editedNativePlace} onChange={(e) => setEditedNativePlace(e.target.value)} placeholder="籍贯 (如 常山, 沛国)..." />
                        <textarea className="w-full bg-zinc-900 border border-zinc-700 text-zinc-200 px-2 py-1 text-sm min-h-[100px]" value={editedUserNotes} onChange={(e) => setEditedUserNotes(e.target.value)} placeholder="综合记录 (角色描述/玩家备注)..." />
                        <textarea className="w-full bg-zinc-900 border border-zinc-700 text-zinc-200 px-2 py-1 text-sm min-h-[100px]" value={editedStatus} onChange={(e) => setEditedStatus(e.target.value)} placeholder="状态..." />
                        <textarea className="w-full bg-zinc-900 border border-zinc-700 text-zinc-200 px-2 py-1 text-sm min-h-[100px]" value={editedParameters} onChange={(e) => setEditedParameters(e.target.value)} placeholder="能力参数 (如 统帅 90, 武力 95)..." />
                        <textarea className="w-full bg-zinc-900 border border-zinc-700 text-zinc-200 px-2 py-1 text-sm min-h-[100px]" value={editedSpecialties} onChange={(e) => setEditedSpecialties(e.target.value)} placeholder="特性/战法..." />
                        <textarea className="w-full bg-zinc-900 border border-zinc-700 text-zinc-200 px-2 py-1 text-sm min-h-[100px]" value={editedInventory} onChange={(e) => setEditedInventory(e.target.value)} placeholder="物品/名马/宝物..." />
                        <div className="flex items-center gap-2">
                            <label className="text-xs text-zinc-400">羁绊等级 (0-5):</label>
                            <input type="number" min="0" max="5" className="w-16 bg-zinc-900 border border-zinc-700 text-zinc-200 px-2 py-1 text-sm" value={editedBondLevel} onChange={(e) => setEditedBondLevel(parseInt(e.target.value))} />
                        </div>
                        <div className="flex items-center gap-2">
                            <label className="text-xs text-zinc-400">是否登场:</label>
                            <input type="checkbox" className="bg-zinc-900 border border-zinc-700" checked={editedHasAppeared} onChange={(e) => setEditedHasAppeared(e.target.checked)} />
                        </div>
                        {editedHasAppeared && (
                          <>
                            <input className="w-full bg-zinc-900 border border-zinc-700 text-zinc-200 px-2 py-1 text-sm" value={editedAppearanceTime} onChange={(e) => setEditedAppearanceTime(e.target.value)} placeholder="登场时间..." />
                            <input className="w-full bg-zinc-900 border border-zinc-700 text-zinc-200 px-2 py-1 text-sm" value={editedAppearanceLocation} onChange={(e) => setEditedAppearanceLocation(e.target.value)} placeholder="登场地点..." />
                          </>
                        )}
                        <textarea className="w-full bg-zinc-900 border border-zinc-700 text-zinc-200 px-2 py-1 text-sm min-h-[100px]" value={editedRecords} onChange={(e) => setEditedRecords(e.target.value)} placeholder="重要记录 (格式: [时间][地点] 内容，用 --- 分隔)..." />
                    </div>
                  ) : (
                    <div className="bg-zinc-900/30 p-2 md:p-4 border border-zinc-800 rounded-sm text-[10px] md:text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed">
                      <div className="mb-2 font-bold flex flex-col">
                        <span className="text-green-500">综合记录:</span>
                        <span>
                          {selectedNPC.aiGeneratedRecord && !((selectedNPC.userNotes || '').includes(selectedNPC.aiGeneratedRecord)) 
                            ? `${selectedNPC.aiGeneratedRecord}\n\n${selectedNPC.userNotes || ''}`.trim() 
                            : (selectedNPC.userNotes || selectedNPC.aiGeneratedRecord || '暂无记录')}
                        </span>
                      </div>
                      <div className="mb-2 text-amber-500">羁绊等级: {selectedNPC.bondLevel ?? 1}</div>
                      <div className="mb-2 text-purple-400 font-mono text-xs">
                        登场状态: {selectedNPC.hasAppeared ? `已登场 (${selectedNPC.appearanceTime || '未知时间'} @ ${selectedNPC.appearanceLocation || '未知地点'})` : '未登场'}
                      </div>
                      {selectedNPC.nativePlace && (
                        <div className="mb-2 text-cyan-400 font-mono text-xs">
                          籍贯: {selectedNPC.nativePlace}
                        </div>
                      )}
                      <div className="mb-2">
                        <span className="text-blue-400 font-bold">状态: </span>
                        {renderSafeString(selectedNPC.status) || '暂无状态信息。'}
                      </div>
                      <div className="mb-2">
                        <span className="text-purple-400 font-bold">能力参数: </span>
                        {renderSafeString(selectedNPC.parameters) || '暂无能力参数。'}
                      </div>
                      <div className="mb-2">
                        <span className="text-pink-400 font-bold">特性/战法: </span>
                        {renderSafeString(selectedNPC.specialties) || '暂无信息。'}
                      </div>
                      <div className="mb-2">
                        <span className="text-yellow-400 font-bold">物品/宝物: </span>
                        {renderSafeString(selectedNPC.inventory) || '暂无持有物信息。'}
                      </div>
                    </div>
                  )}
                </section>

                {/* Tags Section */}
                <section>
                  <h3 className="text-[10px] md:text-sm font-bold text-zinc-400 uppercase tracking-wider mb-2 border-b border-zinc-800 pb-1">
                    标签
                  </h3>
                  {isEditing ? (
                    <input className="w-full bg-zinc-900 border border-zinc-700 text-zinc-200 px-2 py-1 text-sm" value={editedTags} onChange={(e) => setEditedTags(e.target.value)} placeholder="标签1, 标签2..." />
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {(selectedNPC.tags || []).length === 0 ? (
                        <div className="text-zinc-600 italic text-[10px] md:text-sm">暂无标签。</div>
                      ) : (
                        selectedNPC.tags.map((tag: any, idx: number) => (
                          <span key={`${renderSafeString(tag)}-${idx}`} className="px-2 py-1 bg-zinc-800 text-zinc-300 text-[10px] rounded-full">{renderSafeString(tag)}</span>
                        ))
                      )}
                    </div>
                  )}
                </section>

                {/* Records Section */}
                <section>
                  <div className="flex justify-between items-center mb-2 border-b border-zinc-800 pb-1">
                    <h3 className="text-[10px] md:text-sm font-bold text-zinc-400 uppercase tracking-wider">
                      重要记录
                    </h3>
                    {onFormatRecords && !isEditing && (selectedNPC.records || []).length > 0 && (
                      <Button
                        onClick={async () => {
                          setIsFormatting(true);
                          try {
                            await onFormatRecords(selectedNPC.id);
                            alert('格式校正完成！');
                          } catch(e) {
                            alert(`校正失败: ${e instanceof Error ? e.message : String(e)}`);
                          } finally {
                            setIsFormatting(false);
                          }
                        }}
                        variant="ghost"
                        className="text-[9px] py-0.5 h-auto text-cyan-500 hover:text-cyan-400"
                        disabled={isFormatting}
                      >
                        {isFormatting ? '校正中...' : '格式校正'}
                      </Button>
                    )}
                  </div>
                  <div className="bg-zinc-900/30 p-2 md:p-4 border border-zinc-800 rounded-sm text-[10px] md:text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed min-h-[200px]">
                    {(selectedNPC.records || []).length === 0 ? (
                      <div className="text-zinc-600 italic">暂无事件记录。</div>
                    ) : (
                      selectedNPC.records.map((record, idx) => (
                        <div key={`rec-${record.id || ''}-${idx}`} className="mb-3 border-b border-zinc-800/50 pb-2 last:border-0 last:mb-0 last:pb-0">
                          <div className="text-[8px] md:text-xs text-zinc-500 mb-1 font-mono">
                            {record.timestamp} {record.location && record.location !== "地点" && record.location !== "未知地点" && <span className="text-emerald-500/70 ml-1">@{record.location}</span>}
                          </div>
                          <div className="text-[10px] md:text-sm text-zinc-300 leading-relaxed">{record.content}</div>
                        </div>
                      ))
                    )}
                  </div>
                </section>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-600 italic p-4 text-center">
              请从左侧列表选择一个角色查看详情。
            </div>
          )}

          {/* Footer */}
          <div className="p-3 md:p-4 border-t border-slate-800 flex justify-end">
            <Button onClick={onClose} variant="secondary" className="text-xs">关闭</Button>
          </div>
        </div>

        {/* Merge Confirmation Modal */}
        <AnimatePresence>
          {showMergeConfirm && (
            <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl">
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="w-full max-w-lg bg-zinc-950 border border-amber-900/50 rounded-3xl p-8 shadow-2xl space-y-6"
              >
                <div className="text-center space-y-2">
                  <h3 className="text-2xl font-display text-amber-100 uppercase tracking-wider">合并角色资料</h3>
                  <p className="text-zinc-400 text-sm">请选择一个作为**主要资料**（保留其基本信息），其他角色的记录和备注将合并至其中。</p>
                </div>

                <div className="max-h-60 overflow-y-auto space-y-2 p-2 bg-zinc-900/50 rounded-xl border border-zinc-800">
                  {Array.from(selectedMergeIds).map((id, idx) => {
                    const npc = profiles.find(p => p.id === id);
                    if (!npc) return null;
                    return (
                      <div 
                        key={`merge-${id || ''}-${idx}`}
                        onClick={() => setPrimaryMergeId(id)}
                        className={`p-3 rounded-lg cursor-pointer border transition-all ${primaryMergeId === id ? 'bg-amber-500/20 border-amber-500 text-amber-100' : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'}`}
                      >
                        <div className="font-bold text-sm">{npc.name}</div>
                        <div className="text-[10px] opacity-60 truncate">{npc.aiGeneratedRecord || npc.userNotes || '暂无描述'}</div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex flex-col gap-3">
                  <Button 
                    onClick={() => {
                      if (primaryMergeId) {
                        onMergeNPCs(Array.from(selectedMergeIds), primaryMergeId);
                        setIsMerging(false);
                        setSelectedMergeIds(new Set());
                        setShowMergeConfirm(false);
                        setSelectedNPCId(null);
                      }
                    }}
                    className="w-full py-4 bg-amber-600 hover:bg-amber-500 text-white font-bold tracking-widest uppercase"
                  >
                    确认合并
                  </Button>
                  <Button 
                    onClick={() => setShowMergeConfirm(false)}
                    variant="ghost"
                    className="w-full py-2 text-zinc-500 hover:text-zinc-300"
                  >
                    取消
                  </Button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};
