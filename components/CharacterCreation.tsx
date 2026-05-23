
import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Character, TroopType, HistoricalPeriod } from '../types';
import { Button } from './Button';
import { TROOP_TYPES, HISTORICAL_PERIODS, SOCIAL_IDENTITIES, LINEAGES } from '../constants';

const ERA_YEARS: Record<string, number> = {
  '黄巾起义 (184 AD)': 184,
  '讨伐董卓 (190 AD)': 190,
  '群雄逐鹿 (194 AD)': 194,
  '官渡之战 (200 AD)': 200,
  '赤壁之战 (208 AD)': 208,
  '三国鼎立 (220 AD)': 220,
  '诸葛北伐 (227 AD)': 227,
  '晋灭三国 (263-280 AD)': 263,
  '自定义剧本 (Custom)': 190
};

const BIRTH_MONTHS = [
  '正月 (孟春)', '二月 (仲春)', '三月 (季春)',
  '四月 (孟夏)', '五月 (仲夏)', '六月 (季夏)',
  '七月 (孟秋)', '八月 (仲秋)', '九月 (季秋)',
  '十月 (孟冬)', '十一月 (仲冬)', '十二月 (季冬)'
];

const BIRTH_DAYS = [
  '初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
  '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
  '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十'
];

const BIRTH_HOURS = [
  '子时 (夜半)', '丑时 (鸡鸣)', '寅时 (平旦)', '卯时 (日出)',
  '辰时 (食时)', '巳时 (隅中)', '午时 (日中)', '未时 (日昳)',
  '申时 (晡时)', '酉时 (日入)', '戌时 (黄昏)', '亥时 (人定)'
];

const getClassicalAgeName = (ageNum: number) => {
  if (ageNum < 15) return '髫年/稚子';
  if (ageNum >= 15 && ageNum < 20) return '束发之年';
  if (ageNum >= 20 && ageNum < 30) return '弱冠之年';
  if (ageNum >= 30 && ageNum < 40) return '而立之年';
  if (ageNum >= 40 && ageNum < 50) return '不惑之年';
  return '知命之人';
};

interface CharacterCreationProps {
  onComplete: (character: Character, stageSettings?: string) => void;
}

export const CharacterCreation: React.FC<CharacterCreationProps> = ({ onComplete }) => {
  const [page, setPage] = useState(1);

  // Common State
  const [name, setName] = useState('');
  const [styleName, setStyleName] = useState(''); // 字
  const [nativePlace, setNativePlace] = useState(''); // 籍贯
  const [gender, setGender] = useState('男');
  const [appearance, setAppearance] = useState('');
  const [biography, setBiography] = useState('');
  
  // Background & Logic
  const [socialIdentity, setSocialIdentity] = useState(SOCIAL_IDENTITIES[0]);
  const [lineage, setLineage] = useState(LINEAGES[0]);
  const [alignment, setAlignment] = useState('兴复汉室'); // 志向
  const [personality, setPersonality] = useState('刚毅果敢');
  const [selectedSetting, setSelectedSetting] = useState<HistoricalPeriod>(HistoricalPeriod.ANTI_DONG_ZHUO);
  
  // Birth Date States
  const [birthYearOption, setBirthYearOption] = useState<number>(170);
  const [birthMonth, setBirthMonth] = useState('正月 (孟春)');
  const [birthDay, setBirthDay] = useState('十五');
  const [birthHour, setBirthHour] = useState('卯时 (日出)');
  const [customBirth, setCustomBirth] = useState('');
  const [useCustomBirth, setUseCustomBirth] = useState(false);

  // Compile birth year options based on selected scenario
  const birthYearOptions = useMemo(() => {
    const currentYear = ERA_YEARS[selectedSetting] || 190;
    const getEraName = (year: number) => {
      if (year >= 240 && year <= 248) return `正始${year - 240 + 1}年 (${year}年)`;
      if (year >= 233 && year <= 239) return `青龙${year - 233 + 1}年 (${year}年)`;
      if (year >= 227 && year <= 232) return `太和${year - 227 + 1}年 (${year}年)`;
      if (year >= 220 && year <= 226) return `黄初${year - 220 + 1}年 (${year}年)`;
      if (year >= 196 && year <= 219) return `建安${year - 196 + 1}年 (${year}年)`;
      if (year >= 194 && year <= 195) return `兴平${year - 194 + 1}年 (${year}年)`;
      if (year >= 190 && year <= 193) return `初平${year - 190 + 1}年 (${year}年)`;
      if (year >= 184 && year <= 189) return `中平${year - 184 + 1}年 (${year}年)`;
      if (year >= 178 && year <= 183) return `光和${year - 178 + 1}年 (${year}年)`;
      if (year >= 172 && year <= 177) return `熹平${year - 172 + 1}年 (${year}年)`;
      if (year >= 168 && year <= 171) return `建宁${year - 168 + 1}年 (${year}年)`;
      if (year >= 158 && year <= 167) return `延熹${year - 158 + 1}年 (${year}年)`;
      if (year >= 147 && year <= 157) return `永兴/建和 (${year}年)`;
      return `汉廷纪年 (${year}年)`;
    };

    const ages = [18, 20, 24, 28, 32, 36, 42, 50];
    return ages.map(age => {
      const bYear = currentYear - age;
      return {
        year: bYear,
        label: `${getEraName(bYear)} (届时${age}岁)`
      };
    });
  }, [selectedSetting]);

  useEffect(() => {
    if (birthYearOptions.length > 2) {
      setBirthYearOption(birthYearOptions[2].year); // default to ~24 years old at scenario start
    }
  }, [birthYearOptions]);
  
  // Capabilities
  const [troopType, setTroopType] = useState<TroopType>(TroopType.INFANTRY);
  const [specialty, setSpecialty] = useState('');
  const [attrs, setAttrs] = useState({
    command: 75,
    martial: 75,
    vitality: 100,
    intelligence: 75,
    politics: 75,
    charisma: 75
  });

  const updateAttr = (key: keyof typeof attrs, val: string) => {
    const num = parseInt(val) || 0;
    setAttrs(prev => ({ ...prev, [key]: Math.min(100, num) }));
  };

  // Resource/State
  const [territory, setTerritory] = useState('');
  const [allegiance, setAllegiance] = useState('在野');
  const [stageSettings, setStageSettings] = useState('');

  const isCustomStage = selectedSetting === HistoricalPeriod.CUSTOM;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const currentYear = ERA_YEARS[selectedSetting] || 190;
    const computedAgeNum = currentYear - birthYearOption;
    const finalAge = getClassicalAgeName(computedAgeNum);

    const getBirthOptionLabel = (year: number) => {
      if (year >= 240 && year <= 248) return `正始${year - 240 + 1}年`;
      if (year >= 233 && year <= 239) return `青龙${year - 233 + 1}年`;
      if (year >= 227 && year <= 232) return `太和${year - 227 + 1}年`;
      if (year >= 220 && year <= 226) return `黄初${year - 220 + 1}年`;
      if (year >= 196 && year <= 219) return `建安${year - 196 + 1}年`;
      if (year >= 194 && year <= 195) return `兴平${year - 194 + 1}年`;
      if (year >= 190 && year <= 193) return `初平${year - 190 + 1}年`;
      if (year >= 184 && year <= 189) return `中平${year - 184 + 1}年`;
      if (year >= 178 && year <= 183) return `光和${year - 178 + 1}年`;
      if (year >= 172 && year <= 177) return `熹平${year - 172 + 1}年`;
      if (year >= 168 && year <= 171) return `建宁${year - 168 + 1}年`;
      if (year >= 158 && year <= 167) return `延熹${year - 158 + 1}年`;
      return `汉廷纪年${year}年`;
    };

    const finalBirthTime = useCustomBirth 
      ? customBirth 
      : `${getBirthOptionLabel(birthYearOption)}${birthMonth.split(' ')[0]}${birthDay}日 ${birthHour.split(' ')[0]}`;

    const unifiedCharacter: Character = {
      name,
      styleName,
      nativePlace,
      gender,
      age: finalAge,
      birthDate: finalBirthTime,
      appearance: appearance || '英挺',
      biography: biography || '乱世中的一员',
      socialIdentity,
      lineage,
      alignment,
      personality,
      attributes: attrs,
      specialty: specialty || '善战',
      troopType,
      prestige: (
        socialIdentity === '顶级名门 (袁氏级别)' || 
        lineage.includes('刘氏') || 
        lineage.includes('汉室') || 
        lineage.includes('宗室') || 
        lineage.includes('皇亲') || 
        lineage.includes('四世三公') || 
        lineage.includes('四世太尉')
      ) ? 50 : 10,
      allegiance,
      territory: territory || '无',
      hp: '100/100',
      setting: selectedSetting
    };
    
    onComplete(unifiedCharacter, stageSettings);
  };

  const inputClass = "w-full bg-stone-900/90 border border-amber-900/40 text-stone-200 p-3 rounded-none focus:border-amber-600 focus:outline-none focus:ring-1 focus:ring-amber-600 transition-colors placeholder-stone-600 font-serif text-sm shadow-[inset_0_1px_3px_rgba(0,0,0,0.6)]";
  const labelClass = "block text-amber-100/70 mb-1.5 font-serif text-xs md:text-sm uppercase tracking-wider font-semibold";

  const renderPage1 = () => (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      <div className="border border-red-900/30 bg-red-950/20 p-4 rounded-sm">
        <label className={`${labelClass} text-red-400`}>时代剧本</label>
        <select 
          value={selectedSetting} 
          onChange={(e) => setSelectedSetting(e.target.value as HistoricalPeriod)} 
          className={inputClass}
        >
          {HISTORICAL_PERIODS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label className={labelClass}>姓名</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
            placeholder="例如：曹操"
            required
          />
        </div>
        <div>
          <label className={labelClass}>字</label>
          <input
            type="text"
            value={styleName}
            onChange={(e) => setStyleName(e.target.value)}
            className={inputClass}
            placeholder="例如：孟德"
          />
        </div>
        <div>
          <label className={labelClass}>籍贯</label>
          <input
            type="text"
            value={nativePlace}
            onChange={(e) => setNativePlace(e.target.value)}
            className={inputClass}
            placeholder="例如：沛国谯县"
          />
        </div>
        <div>
          <label className={labelClass}>出身门第</label>
          <select value={socialIdentity} onChange={(e) => setSocialIdentity(e.target.value)} className={inputClass}>
            {SOCIAL_IDENTITIES.map(si => <option key={si} value={si}>{si}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>家族世系</label>
          <select value={lineage} onChange={(e) => setLineage(e.target.value)} className={inputClass}>
            {LINEAGES.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>擅长兵种</label>
          <select value={troopType} onChange={(e) => setTroopType(e.target.value as TroopType)} className={inputClass}>
            {TROOP_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <div className="md:col-span-2 border border-amber-900/40 bg-amber-950/20 p-4 rounded-sm mt-2 shadow-[inset_0_0_10px_rgba(180,83,9,0.1)]">
          <span className="text-xs font-display text-amber-500 block mb-3 border-b border-amber-900/20 pb-1">《出生生辰与其命星》 (Birth Time & Destiny Star)</span>
          <div className="flex items-center gap-4 mb-4">
            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
              <input
                type="radio"
                name="birthType"
                checked={!useCustomBirth}
                onChange={() => setUseCustomBirth(false)}
                className="rounded-full bg-slate-950 border-slate-700 text-amber-600 focus:ring-0 focus:ring-offset-0"
              />
              <span>自选传统纪年</span>
            </label>
            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
              <input
                type="radio"
                name="birthType"
                checked={useCustomBirth}
                onChange={() => setUseCustomBirth(true)}
                className="rounded-full bg-slate-950 border-slate-700 text-amber-600 focus:ring-0 focus:ring-offset-0"
              />
              <span>手书任意生辰</span>
            </label>
          </div>

          {!useCustomBirth ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-[10px] text-slate-500 mb-1">出生年号 (纪年)</label>
                <select
                  value={birthYearOption}
                  onChange={(e) => setBirthYearOption(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-700 text-slate-200 p-2 rounded text-xs focus:border-amber-600 focus:outline-none"
                >
                  {birthYearOptions.map(opt => (
                    <option key={opt.year} value={opt.year}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-slate-500 mb-1">生辰月令 (节气)</label>
                <select
                  value={birthMonth}
                  onChange={(e) => setBirthMonth(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 text-slate-200 p-2 rounded text-xs focus:border-amber-600 focus:outline-none"
                >
                  {BIRTH_MONTHS.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-slate-500 mb-1">诞生干支 (日期)</label>
                <select
                  value={birthDay}
                  onChange={(e) => setBirthDay(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 text-slate-200 p-2 rounded text-xs focus:border-amber-600 focus:outline-none"
                >
                  {BIRTH_DAYS.map(d => (
                    <option key={d} value={d}>{d}日</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-slate-500 mb-1">出生时辰 (命星)</label>
                <select
                  value={birthHour}
                  onChange={(e) => setBirthHour(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 text-slate-200 p-2 rounded text-xs focus:border-amber-600 focus:outline-none"
                >
                  {BIRTH_HOURS.map(h => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-[10px] text-slate-500 mb-1">手书传统生辰 (例如: 光和四年孟春正月十五日 卯时)</label>
              <input
                type="text"
                value={customBirth}
                onChange={(e) => setCustomBirth(e.target.value)}
                placeholder="例如：光和四年孟春正月十五日 卯时"
                className="w-full bg-slate-950 border border-slate-700 text-slate-200 p-2.5 rounded text-xs focus:border-amber-600 focus:outline-none"
              />
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );

  const renderPage2 = () => (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>志向/立场</label>
          <input
            type="text"
            value={alignment}
            onChange={(e) => setAlignment(e.target.value)}
            className={inputClass}
            placeholder="兴复汉室/称霸一方/辅佐明君"
          />
        </div>
        <div>
          <label className={labelClass}>归属/领地</label>
          <input
            type="text"
            value={allegiance}
            onChange={(e) => setAllegiance(e.target.value)}
            className={inputClass}
            placeholder="例如：在野/某势力太守/校尉"
          />
        </div>
      </div>

      <div>
        <label className={labelClass}>名将来历/生平摘要</label>
        <textarea
          value={biography}
          onChange={(e) => setBiography(e.target.value)}
          className={`${inputClass} h-24 resize-none`}
          placeholder="简述您的出身或至今为止的事迹..."
        />
      </div>
      
      <div>
        <label className={labelClass}>特技与战法 (Specialty)</label>
        <input
          type="text"
          value={specialty}
          onChange={(e) => setSpecialty(e.target.value)}
          className={inputClass}
          placeholder="例如：单骑救主、连环、百步穿杨..."
        />
      </div>

      <div>
        <label className={labelClass}>仪表相貌</label>
        <textarea
          value={appearance}
          onChange={(e) => setAppearance(e.target.value)}
          className={`${inputClass} h-24 resize-none`}
          placeholder="例如：身长八尺，猿臂善射..."
        />
      </div>
    </motion.div>
  );

  const renderPage3 = () => (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      <div>
        <label className={labelClass}>初始能力数值 (基础上限 100)</label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[
            { label: '统帅', key: 'command' as const },
            { label: '武力', key: 'martial' as const },
            { label: '体力', key: 'vitality' as const },
            { label: '智谋', key: 'intelligence' as const },
            { label: '政治', key: 'politics' as const },
            { label: '魅力', key: 'charisma' as const },
          ].map(attr => (
            <div key={attr.key}>
              <label className="text-[10px] text-slate-500 uppercase mb-1 block">{attr.label}</label>
              <input
                type="number"
                value={attrs[attr.key]}
                onChange={(e) => updateAttr(attr.key, e.target.value)}
                className={`${inputClass} !p-2 text-center`}
                max={100}
                min={1}
              />
            </div>
          ))}
        </div>
        <p className="text-[10px] text-slate-600 mt-2 italic text-center">基础数值不可超过 100，可通过书籍/武具突破上限。</p>
      </div>

      <div>
        <label className={labelClass}>{isCustomStage ? "自定义推演背景设定" : "剧本初始处境设定"}</label>
        <textarea
          value={stageSettings}
          onChange={(e) => setStageSettings(e.target.value)}
          className={`${inputClass} h-48 resize-none`}
          placeholder={isCustomStage ? "在此详细勾勒您的自定义历史线..." : "设定您在剧本开场时的具体境遇，如：正率军援救某地，或正在某公门下任职。"}
        />
      </div>
    </motion.div>
  );

  return (
    <div className="max-w-2xl mx-auto w-full p-4 md:p-8 bg-stone-950/95 border-2 border-double border-amber-900/60 shadow-[inset_0_0_40px_rgba(139,92,26,0.15),0_0_50px_rgba(0,0,0,0.9)] rounded-none backdrop-blur-sm fade-in my-2 md:my-8 relative overflow-hidden">
      {/* Decorative Traditional Border Seal in corner */}
      <div className="absolute top-4 right-4 bg-red-800 text-white font-calligraphy text-[9px] md:text-xs py-1 px-1.5 border border-red-700 shadow shadow-red-900/50 opacity-80 rounded-xs select-none leading-3 max-w-[40px] text-center z-10">
        将才<br/>天成
      </div>

      <div className="text-center mb-5 md:mb-8 relative z-10">
        <h2 className="text-2xl md:text-4xl text-amber-500 mb-1 md:mb-2 font-calligraphy select-none leading-none">汉末列传 · 开启</h2>
        <div className="h-0.5 w-12 md:w-24 bg-red-800 mx-auto"></div>
        <p className="text-amber-900/50 mt-1 md:mt-2 font-serif tracking-[0.3em] md:tracking-[0.5em] uppercase text-[9px] md:text-xs">
          Chronicle Entry System
        </p>
      </div>

      <form onSubmit={handleSubmit} className="relative z-10">
        <div className="space-y-6">
          <div className="flex justify-center mb-6">
            {[1, 2, 3].map((p) => (
              <div key={p} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center border ${page === p ? 'bg-amber-900 border-amber-500 text-amber-100' : 'bg-slate-900 border-slate-700 text-slate-500'}`}>
                  {p}
                </div>
                {p < 3 && <div className={`w-8 h-px ${page > p ? 'bg-amber-500' : 'bg-slate-700'}`}></div>}
              </div>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {page === 1 && renderPage1()}
            {page === 2 && renderPage2()}
            {page === 3 && renderPage3()}
          </AnimatePresence>

          <div className="flex justify-between pt-6 border-t border-slate-800">
            {page > 1 ? (
              <Button type="button" onClick={() => setPage(page - 1)} variant="secondary">上一步</Button>
            ) : (
              <div />
            )}

            {page < 3 ? (
              <Button type="button" onClick={() => setPage(page + 1)} variant="primary">下一步</Button>
            ) : (
              <Button type="submit" variant="primary" className="bg-amber-900 border-amber-800 shadow-[0_0_20px_rgba(180,83,9,0.4)]">
                投身乱世 / 命定乾坤
              </Button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
};
