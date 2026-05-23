
import React, { useState, useEffect } from 'react';
import { Character, Role, TroopType, NPCProfile } from '../types';
import { THEME_COLORS } from '../constants';
import { Button } from './Button';
import { motion, AnimatePresence } from 'framer-motion';

interface CharacterSheetProps {
  character: Character;
  npcProfiles: NPCProfile[];
  onClose: () => void;
  onUpdate?: (updatedCharacter: Character) => void;
}

type Tab = 'status' | 'abilities' | 'background' | 'inventory' | 'npcs';

export const CharacterSheet: React.FC<CharacterSheetProps> = ({ character, npcProfiles, onClose, onUpdate }) => {
  const [activeTab, setActiveTab] = useState<Tab>('status');
  const [isEditing, setIsEditing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncText, setSyncText] = useState('');
  const [editedCharacter, setEditedCharacter] = useState<Character>(character);

  useEffect(() => {
    if (!isEditing && !isSyncing) {
      setEditedCharacter(character);
    }
  }, [character, isEditing, isSyncing]);

  const handleSave = () => {
    if (onUpdate) {
      onUpdate(editedCharacter);
    }
    setIsEditing(false);
    setIsSyncing(false);
  };

  const handleChange = (field: keyof Character, value: any) => {
    setEditedCharacter(prev => ({ ...prev, [field]: value }));
  };

  const parseStatusText = (text: string) => {
    const newChar = { ...editedCharacter } as any;
    
    // Helper to extract value after colon
    const extract = (key: string) => {
      const keyPattern = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(?:\\/\\/\\s*)?【${keyPattern}】[：:]?\\s*(.*?)(?=\\n|$)`, 'g');
      const match = regex.exec(text);
      return match ? match[1].trim() : null;
    };

    const hpProv = extract('体力') || extract('状态') || extract('HP/粮草');
    if (hpProv) {
      const parts = hpProv.split(/[/,，（(]/).map(s => s.replace(/[)）]/g, '').trim());
      if (parts[0]) {
          const hpMatch = parts[0].match(/(\d+)/);
          if (hpMatch) newChar.hp = hpMatch[1];
          else newChar.hp = parts[0];
      }
      if (parts[1]) newChar.provisions = parts[1];
    }

    const nativePlace = extract('籍贯') || extract('背景');
    if (nativePlace) newChar.nativePlace = nativePlace.split('/')[1]?.trim() || nativePlace;

    const birthDate = extract('出生生辰') || extract('出生时间') || extract('生辰');
    if (birthDate) newChar.birthDate = birthDate;

    const ageVal = extract('年龄') || extract('寿数');
    if (ageVal) newChar.age = ageVal;

    const styleName = extract('字') || extract('角色');
    if (styleName) {
        const styleMatch = styleName.match(/\(字: (.*?)\)/);
        if (styleMatch) newChar.styleName = styleMatch[1];
    }

    const personality = extract('性格');
    if (personality) newChar.personality = personality;

    const socialIdentity = extract('出身背景') || extract('出身门第');
    if (socialIdentity) newChar.socialIdentity = socialIdentity.split('/')[0]?.trim() || socialIdentity;

    const lineage = extract('家族世系') || extract('宗脉');
    if (lineage) newChar.lineage = lineage;

    const tactics = extract('擅长兵法') || extract('特技');
    if (tactics) newChar.tactics = tactics;

    const specialty = extract('名将特技') || extract('成名特技');
    if (specialty) newChar.specialty = specialty;

    const prestige = extract('声望');
    if (prestige) {
      const num = parseInt(prestige);
      if (!isNaN(num)) newChar.prestige = num;
    }

    const params = extract('核心属性') || extract('六维属性') || extract('六维参数') || extract('六维');
    if (params) {
      const attrs = { ...newChar.attributes };
      const commandMatch = params.match(/统(?:率)?:?\s*(\d+)/);
      const martialMatch = params.match(/武(?:力)?:?\s*(\d+)/);
      const vitalityMatch = params.match(/体(?:力)?:?\s*(\d+)/);
      const intellectMatch = params.match(/智(?:谋)?:?\s*(\d+)/);
      const politicsMatch = params.match(/政(?:治)?:?\s*(\d+)/);
      const charismaMatch = params.match(/魅(?:力)?:?\s*(\d+)/);

      if (commandMatch) attrs.command = parseInt(commandMatch[1]);
      if (martialMatch) attrs.martial = parseInt(martialMatch[1]);
      if (vitalityMatch) attrs.vitality = parseInt(vitalityMatch[1]);
      if (intellectMatch) attrs.intelligence = parseInt(intellectMatch[1]);
      if (politicsMatch) attrs.politics = parseInt(politicsMatch[1]);
      if (charismaMatch) attrs.charisma = parseInt(charismaMatch[1]);

      newChar.attributes = attrs;
    }
    
    const items = extract('物品');
    if (items) {
      newChar.items = items.split(/[,，]/).map((s: string) => s.trim()).filter(Boolean);
    }
    
    // Check if name/role needs to be parsed (from 姓名/官职)
    const nameRole = extract('姓名\\/官职') || extract('姓名/官职');
    if (nameRole) {
      const parts = nameRole.split('/').map(s => s.trim());
      if (parts[0]) newChar.name = parts[0];
      if (parts[1]) newChar.allegiance = parts[1]; // mapping role to allegiance or similar 
    }
    
    // Extract Resources (金钱, 粮食, 兵力, 民心)
    const resources = extract('势力资源\\/状态') || extract('势力资源/状态');
    if (resources) {
        const parts = resources.split(/[,，/\|]/).map((s: string) => s.trim()).filter(Boolean);
        parts.forEach(part => {
          const matchFunds = part.match(/金钱[:：]?\s*(.+)/);
          const matchProv = part.match(/粮(?:草|食)[:：]?\s*(.+)/);
          const matchForces = part.match(/兵力[:：]?\s*(.+)/);
          const matchPop = part.match(/民心[:：]?\s*(.+)/);
          
          if (matchFunds) newChar.funds = matchFunds[1];
          else if (matchProv) newChar.provisions = matchProv[1];
          else if (matchForces) newChar.forces = matchForces[1];
          else if (matchPop) newChar.popularity = matchPop[1];
          else if (part && !part.match(/(金钱|粮食|粮草|兵力|民心)/)) {
             if (!newChar.territory || !newChar.territory.includes(part)) {
                 newChar.territory = newChar.territory ? `${newChar.territory} / ${part}` : part;
             }
          }
        });
    }
    
    const currentStatus = extract('当前状态');
    if (currentStatus) newChar.currentStatus = currentStatus;
    
    const coreIntent = extract('核心意图\\/政务') || extract('核心意图/政务');
    if (coreIntent) newChar.coreIntent = coreIntent;
    
    const bond = extract('羁绊等级');
    if (bond) newChar.bond = bond;

    setEditedCharacter(newChar);
    setIsSyncing(false);
    setIsEditing(true); 
  };

  const getTheme = () => {
    // Default theme logic
    if (character.prestige && character.prestige > 50) return THEME_COLORS[Role.WARLORD];
    return THEME_COLORS[character.troopType] || THEME_COLORS[TroopType.UNKNOWN];
  };

  const colors = getTheme();

  const getPercentage = (val?: string) => {
    if (!val) return 100;
    const parts = val.split('/');
    if (parts.length === 2) {
      const current = parseInt(parts[0]);
      const max = parseInt(parts[1]);
      if (!isNaN(current) && !isNaN(max) && max > 0) {
        return Math.min(100, Math.max(0, (current / max) * 100));
      }
    }
    return 100;
  };

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

  const renderAttribute = (label: string, value: number, color: string, field: keyof Character['attributes']) => (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between items-end">
        <span className="text-[10px] text-zinc-500 uppercase">{label}</span>
        <span className={`text-[11px] font-mono ${value > 100 ? 'text-amber-400' : 'text-zinc-200'}`}>{value}</span>
      </div>
      {isEditing ? (
        <input
          type="number"
          className="w-full bg-zinc-900 border border-zinc-800 text-[10px] text-zinc-200 p-1 focus:border-zinc-500 focus:outline-none"
          value={editedCharacter.attributes[field]}
          onChange={(e) => {
            const val = parseInt(e.target.value) || 0;
            setEditedCharacter(prev => ({
              ...prev,
              attributes: { ...prev.attributes, [field]: val }
            }));
          }}
        />
      ) : (
        <div className="h-1 bg-zinc-900 rounded-full overflow-hidden">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(100, value)}%` }}
            className={`h-full ${color}`}
          />
        </div>
      )}
    </div>
  );

  const renderField = (label: string, field: keyof Character, placeholder?: string, isTextArea = false) => (
    <div className="mb-4">
      <label className={`block text-xs uppercase tracking-wider mb-1 ${colors.text} opacity-70`}>{label}</label>
      {isEditing ? (
        isTextArea ? (
          <textarea
            className="w-full bg-zinc-950/50 border border-zinc-700/50 text-zinc-200 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none min-h-[100px]"
            value={(editedCharacter as any)[field] || ''}
            onChange={(e) => handleChange(field, e.target.value)}
            placeholder={placeholder}
          />
        ) : (
          <input
            className="w-full bg-zinc-950/50 border border-zinc-700/50 text-zinc-200 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
            value={(editedCharacter as any)[field] || ''}
            onChange={(e) => handleChange(field, e.target.value)}
            placeholder={placeholder}
          />
        )
      ) : (
        <div className="text-zinc-300 text-sm border-b border-zinc-800/50 pb-1 whitespace-pre-wrap">
          {renderSafeString((character as any)[field]) || <span className="text-zinc-600 italic">未记录</span>}
        </div>
      )}
    </div>
  );

  const renderArrayField = (label: string, field: string, placeholder?: string) => (
    <div className="mb-4">
      <label className={`block text-xs uppercase tracking-wider mb-1 ${colors.text} opacity-70`}>{label}</label>
      {isEditing ? (
        <textarea
          className="w-full bg-zinc-950/50 border border-zinc-700/50 text-zinc-200 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
          value={Array.isArray((editedCharacter as any)[field]) ? ((editedCharacter as any)[field] || []).join(', ') : (editedCharacter as any)[field] || ''}
          onChange={(e) => handleChange(field as any, e.target.value.split(/[,，]/).map((s: string) => s.trim()))}
          placeholder={placeholder}
        />
      ) : (
        <div className="flex flex-wrap gap-2">
          {(Array.isArray((character as any)[field]) ? (character as any)[field] : ((character as any)[field] ? [(character as any)[field]] : [])).length > 0 ? (
            (Array.isArray((character as any)[field]) ? (character as any)[field] : [(character as any)[field]]).map((item: any, i: number) => (
              <span key={i} className="px-2 py-1 bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 rounded-sm">
                {renderSafeString(item)}
              </span>
            ))
          ) : (
            <span className="text-zinc-600 italic text-sm">无</span>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 bg-black/80 backdrop-blur-md">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className={`
          w-full h-full md:w-[800px] md:h-[600px] flex flex-col
          bg-slate-950 md:rounded-lg md:border md:border-slate-800 shadow-2xl overflow-hidden relative
        `}
      >
        <div className={`absolute top-0 left-0 w-full h-1 ${colors.bg}`} />
        
        <div className="flex flex-col md:flex-row items-center justify-between p-1 md:p-6 border-b border-slate-800 bg-slate-900/50 gap-1">
          <div className="flex items-center gap-1 md:gap-4 w-full md:w-auto">
             <div className={`w-8 h-8 md:w-16 md:h-16 flex-shrink-0 flex items-center justify-center border-2 ${colors.border} rounded-full bg-slate-950`}>
                <span className={`text-xs md:text-2xl font-display ${colors.text}`}>
                  {character.name[0]}
                </span>
             </div>
             <div className="flex-1 min-w-0">
               {isEditing ? (
                 <input 
                   className="text-xs md:text-3xl font-display bg-transparent border-b border-slate-700 text-white focus:outline-none w-full"
                   value={editedCharacter.name}
                   onChange={(e) => handleChange('name', e.target.value)}
                 />
               ) : (
                 <h2 className="text-xs md:text-3xl font-display text-white tracking-wide truncate">{character.name}</h2>
               )}
               <p className={`text-[8px] md:text-sm uppercase tracking-[0.1em] md:tracking-[0.2em] ${colors.text} opacity-80 truncate`}>
                 {character.socialIdentity} • {character.nativePlace}
               </p>
             </div>
             <Button onClick={onClose} variant="ghost" className="md:hidden text-slate-400 hover:text-white p-0">
               关闭
             </Button>
          </div>

          <div className="flex gap-4 items-center w-full md:w-auto justify-between md:justify-end">
             <div className="flex flex-col gap-1.5 w-full md:w-48">
                <div className="flex justify-between text-[9px] md:text-[10px] text-slate-400 uppercase">
                  <span>体力</span>
                  <span>{(editedCharacter as any).hp || '100/100'}</span>
                </div>
                <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-green-500 transition-all duration-500" style={{ width: `${getPercentage((editedCharacter as any).hp)}%` }} />
                </div>
             </div>
             
             {character.prestige !== undefined && (
               <div className="flex flex-col gap-1 flex-shrink-0 min-w-[60px]">
                 <span className="text-[8px] text-amber-500 font-bold uppercase">声望 (Prestige)</span>
                 <div className="text-lg font-display text-amber-400">
                   {editedCharacter.prestige || 0}
                 </div>
               </div>
             )}
          </div>
        </div>

        <div className="flex border-b border-slate-800 bg-slate-900/30 overflow-x-auto no-scrollbar">
          {(['status', 'abilities', 'background', 'inventory', 'npcs'] as Tab[]).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`
                flex-1 min-w-[70px] py-2 text-[9px] md:text-sm uppercase tracking-wider transition-colors whitespace-nowrap
                ${activeTab === tab ? `text-white bg-slate-800/50 border-b-2 ${colors.border}` : 'text-slate-500 hover:text-slate-300'}
              `}
            >
              {tab === 'status' && '档案'}
              {tab === 'abilities' && '武艺'}
              {tab === 'background' && '个人志'}
              {tab === 'inventory' && '随身器物'}
              {tab === 'npcs' && '见闻'}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-2 md:p-6 bg-slate-950 relative">
          {isSyncing ? (
             <div className="max-w-2xl mx-auto space-y-2 animate-in fade-in slide-in-from-bottom-4">
                <h3 className="text-sm text-white font-display text-center">同步信息</h3>
                <textarea 
                  className="w-full h-40 bg-slate-900 border border-slate-700 text-slate-200 p-2 font-mono text-[10px] focus:border-white focus:outline-none"
                  placeholder="复制【Status】文本至此..."
                  value={syncText}
                  onChange={(e) => setSyncText(e.target.value)}
                />
                <div className="flex gap-2 justify-center">
                   <Button onClick={() => parseStatusText(syncText)} className="bg-white text-black hover:bg-slate-200 text-[10px] flex-1">
                     应用
                   </Button>
                   <Button onClick={() => setIsSyncing(false)} variant="ghost" className="text-[10px] flex-1">
                     取消
                   </Button>
                </div>
             </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.1 }}
                className="max-w-4xl mx-auto"
              >
                {activeTab === 'status' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                       <h3 className={`text-xs font-display ${colors.text} border-b border-zinc-800 pb-1`}>基础概况</h3>
                       <div className="grid grid-cols-2 gap-4">
                         {renderField('字', 'styleName')}
                         {renderField('性别', 'gender')}
                         {renderField('出生生辰', 'birthDate', '光和四年仲秋八月')}
                         {renderField('年龄', 'age', '弱冠之年')}
                       </div>
                       {renderField('籍贯', 'nativePlace')}
                       {renderField('出身背景', 'socialIdentity')}
                       {renderField('家族世系', 'lineage', '无')}
                       {renderField('当前归属', 'allegiance')}
                       {renderField('志向/立场', 'alignment')}
                       <div className="pt-2">
                          <h3 className={`text-xs font-display ${colors.text} border-b border-zinc-800 pb-1`}>近期状态</h3>
                          {renderField('羁绊等级', 'bond', '无')}
                          {renderField('当前状态', 'currentStatus', '例如: 健康/负伤')}
                          {renderField('核心意图', 'coreIntent', '推行的策略或动作', true)}
                       </div>
                    </div>
                    <div className="space-y-4">
                       <h3 className={`text-xs font-display ${colors.text} border-b border-zinc-800 pb-1`}>能力评价 (基础上限 100)</h3>
                       <div className="grid grid-cols-2 gap-x-4 gap-y-3 bg-zinc-900/30 p-3 border border-zinc-800/50 rounded-sm">
                          {renderAttribute('统帅', editedCharacter.attributes.command, 'bg-blue-500', 'command')}
                          {renderAttribute('武力', editedCharacter.attributes.martial, 'bg-red-500', 'martial')}
                          {renderAttribute('体力', editedCharacter.attributes.vitality, 'bg-green-500', 'vitality')}
                          {renderAttribute('智谋', editedCharacter.attributes.intelligence, 'bg-purple-500', 'intelligence')}
                          {renderAttribute('政治', editedCharacter.attributes.politics, 'bg-emerald-500', 'politics')}
                          {renderAttribute('魅力', editedCharacter.attributes.charisma, 'bg-amber-500', 'charisma')}
                       </div>
                       <div className="p-2 border-l-2 border-amber-900/50 bg-amber-950/10 rounded-r-sm">
                          <p className="text-[9px] text-amber-600/80 leading-relaxed italic">
                            提示: 当数值低于 80 时，可通过日常历练获得成长。携带名品可助公超越凡人极限。
                          </p>
                       </div>
                    </div>
                  </div>
                )}

                {activeTab === 'abilities' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       <div className="space-y-2">
                          <h3 className={`text-xs font-display ${colors.text} border-b border-slate-800 pb-1`}>特技与战法</h3>
                          {renderField('成名特技', 'specialty')}
                          {renderField('擅长兵种', 'troopType')}
                          {renderField('兵法计论', 'tactics')}
                       </div>
                       <div className="space-y-2">
                          <h3 className={`text-xs font-display ${colors.text} border-b border-slate-800 pb-1`}>声望表现</h3>
                          {renderField('声望值', 'prestige' as any)}
                          {renderField('影响力', 'prestige' as any)}
                       </div>
                    </div>
                  </div>
                )}

                {activeTab === 'inventory' && (
                  <div className="space-y-4">
                    <h3 className={`text-xs font-display ${colors.text} border-b border-slate-800 pb-1`}>势力资源</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {renderField('金钱', 'funds', '0')}
                      {renderField('粮食', 'provisions', '0')}
                      {renderField('兵马规模', 'forces', '无')}
                      {renderField('民心', 'popularity', '无')}
                    </div>
                    <h3 className={`text-xs font-display ${colors.text} border-b border-slate-800 pb-1 pt-2`}>私藏与据点</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {renderArrayField('随身器物', 'items')}
                      {renderField('领地/据点', 'territory', '据点名称...', true)}
                    </div>
                  </div>
                )}

                {activeTab === 'background' && (
                  <div className="space-y-2">
                    <h3 className={`text-xs font-display ${colors.text} border-b border-slate-800 pb-1`}>个人生平</h3>
                    {renderField('性格', 'personality')}
                    {renderField('外貌描述', 'appearance', '人物仪表描述...', true)}
                    {renderField('史笔评价', 'biography', '人物详细背景...', true)}
                  </div>
                )}

                {activeTab === 'npcs' && (
                  <div className="space-y-4">
                    <h3 className={`text-xs font-display ${colors.text} border-b border-zinc-800 pb-1`}>天下英杰见闻</h3>
                    {npcProfiles.length === 0 ? (
                      <div className="text-zinc-600 italic text-sm">尚未结识当世英杰。</div>
                    ) : (
                      npcProfiles.map((npc, npcIdx) => (
                        <div key={`npc-${npcIdx}`} className="bg-zinc-900/30 p-3 border border-zinc-800 rounded-sm">
                          <div className="flex justify-between items-start mb-2">
                             <h4 className="text-sm font-bold text-zinc-200">{npc.name}</h4>
                             <span className="text-[10px] text-zinc-500">{npc.status}</span>
                          </div>
                          
                          {npc.attributes && (
                            <div className="mb-3 grid grid-cols-6 gap-1">
                              {[
                                { l: '统', v: npc.attributes.command, c: 'text-blue-400' },
                                { l: '武', v: npc.attributes.martial, c: 'text-red-400' },
                                { l: '体', v: npc.attributes.vitality, c: 'text-green-400' },
                                { l: '智', v: npc.attributes.intelligence, c: 'text-purple-400' },
                                { l: '政', v: npc.attributes.politics, c: 'text-emerald-400' },
                                { l: '魅', v: npc.attributes.charisma, c: 'text-amber-400' },
                              ].map(a => (
                                <div key={a.l} className="flex flex-col items-center bg-black/20 rounded py-1">
                                  <span className="text-[8px] text-zinc-500 uppercase">{a.l}</span>
                                  <span className={`text-[10px] font-mono ${a.c}`}>{a.v}</span>
                                </div>
                              ))}
                            </div>
                          )}

                          <div className="space-y-2">
                            {(npc.records || []).map((record, recordIdx) => (
                              <div key={`record-${recordIdx}`} className="text-[10px] text-zinc-300 border-l-2 border-zinc-700 pl-2">
                                <span className="font-mono text-zinc-500">{record.timestamp}</span>: {record.content}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          )}
        </div>

        <div className="p-2 border-t border-slate-800 bg-slate-900 flex justify-center items-center gap-2">
           <div className="flex gap-2 w-full">
              {isEditing ? (
                <Button onClick={handleSave} className="bg-white text-black hover:bg-slate-200 text-[10px] w-full">
                  保存
                </Button>
              ) : (
                <>
                  {!isSyncing && (
                    <>
                      <Button onClick={() => setIsSyncing(true)} variant="ghost" className="text-cyan-400 border-cyan-900/30 hover:bg-cyan-900/20 text-[10px] flex-1">
                        同步
                      </Button>
                      <Button onClick={() => setIsEditing(true)} variant="ghost" className="text-white border-slate-700 hover:bg-slate-800 text-[10px] flex-1">
                        编辑
                      </Button>
                      <Button onClick={onClose} variant="secondary" className="text-[10px] flex-1">
                        关闭
                      </Button>
                    </>
                  )}
                </>
              )}
           </div>
        </div>
      </motion.div>
    </div>
  );
};
