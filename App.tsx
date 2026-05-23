
import React, { useState, useEffect, useRef, Component, ErrorInfo, ReactNode } from 'react';
import { Character, GameState, GameStatus, Message, Role, NPCProfile, NPCRecord, TroopType, HistoricalPeriod, LogSummary, GaiaState } from './types';
import { CharacterCreation } from './components/CharacterCreation';
import { StageSetup } from './components/StageSetup';
import { WorldBookManager } from './components/WorldBookManager';
import { StoryDisplay } from './components/StoryDisplay';
import { CharacterSheet } from './components/CharacterSheet';
import { GameMenu } from './components/GameMenu';
import { Header } from './components/Header';
import { StartScreen } from './components/StartScreen';
import { InputArea } from './components/InputArea';
import { ApiSettingsModal } from './components/ApiSettingsModal';
import { saveGame, loadGame, clearSave, exportSaveToFile, validateSaveData } from './services/storageService';
import { saveGameStateToCloud, loadGameStateFromCloud } from './services/cloudStorageService';
import { CharacterCompendium } from './components/CharacterCompendium';
import { LogModal } from './components/LogModal';
import { generateInitialPrompt, generateDeductionPrompt, generateForceDeducePrompt, generateStatusPrompt, generateNPCUpdatePrompt } from './services/promptService';
import { initializeGame, sendMessage, resetGame, switchSessionModel, analyzeNPCData, generateLogEntry, formatNPCRecords, getLogLocation } from './services/geminiService';
import { Button } from './components/Button';
import { THEME_COLORS } from './constants';
import { motion, AnimatePresence } from 'motion/react';
import { LogIn, LogOut, Globe, MessageSquare, History, Users, Plus, Trash2, Settings, Sparkles, ArrowDown, AlertCircle } from 'lucide-react';
import { auth, db, signInWithGoogle, handleFirestoreError, OperationType, FirestoreErrorInfo, isFirestoreQuotaBlocked } from './firebase';
import { onAuthStateChanged, User, signOut } from 'firebase/auth';
import { doc, collection, onSnapshot, setDoc, addDoc, query, orderBy, limit, serverTimestamp, deleteDoc, getDoc, updateDoc } from 'firebase/firestore';

const safeArray = (arr: any): any[] => Array.isArray(arr) ? arr : [];

const isRetryableError = (error: any): boolean => {
  const msg = String(error?.message || error || "").toLowerCase();
  return msg.includes("429") || 
         msg.includes("500") || 
         msg.includes("502") || 
         msg.includes("503") || 
         msg.includes("504") || 
         msg.includes("too many requests") || 
         msg.includes("upstream_error") || 
         msg.includes("no capacity available") ||
         msg.includes("error code: 429") ||
         msg.includes("not enough quota") ||
         msg.includes("failed to fetch") ||
         msg.includes("fetch failed") ||
         msg.includes("空内容");
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const getInitialOfficerSlots = (character: Character, currentSlots?: any) => {
  let slots = [...safeArray(currentSlots)];
  if (character.troopType && character.troopType !== TroopType.UNKNOWN) {
    const typeMatch = character.troopType.match(/([a-zA-Z\s\u4e00-\u9fa5]+)/);
    if (typeMatch) {
      const typeName = typeMatch[1].trim();
      
      const newSlot = {
        typeName: typeName,
        npcId: 'Player',
        trueName: character.name,
        status: 'Active' as const
      };

      const existingIdx = slots.findIndex(slot => slot.typeName === typeName);
      if (existingIdx !== -1) {
        slots[existingIdx] = newSlot;
      } else {
        slots.push(newSlot);
      }
    }
  }
  return slots;
};

const compareDates = (dateA: string, dateB: string): number => {
  if (!dateA && !dateB) return 0;
  if (!dateA) return -1;
  if (!dateB) return 1;

  const hanToNum = (s: string) => {
    const map: Record<string, number> = {
      '正': 1, '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10,
      '十一': 11, '十二': 12, '元': 1
    };
    if (map[s]) return map[s];
    
    // Support parsed Chinese tens and twenties e.g. 十三，二十，二十五，三十
    let num = 0;
    let tempStr = s;
    if (tempStr.startsWith('十') && tempStr.length > 1) {
      tempStr = '一' + tempStr; // Handle 十五 as 一十五
    }
    
    const parts = tempStr.split('十');
    if (parts.length === 2) {
      const tens = parts[0] ? (map[parts[0]] || 0) : 0;
      const ones = parts[1] ? (map[parts[1]] || 0) : 0;
      return tens * 10 + ones;
    }

    const numMatch = s.match(/\d+/);
    return numMatch ? parseInt(numMatch[0]) : 0;
  };

  const parse = (d: string) => {
    // 匹配: [纪年] [年份]年 [月份]月 [日期]日
    // 例如: 中平元年 二月 十五日
    const dateMatch = d.match(/(?:([^\s\d]+))?(?:([^\s]+))?年\s*(?:([^\s]+))?月\s*(?:([^\s]+))?日/);
    if (!dateMatch) return 0;

    const eraName = dateMatch[1] || "";
    // 将纪年映射为权重 (简单的字母序或固定的硬编码，这里为简单起见抽取数字部分)
    let eraWeight = 0;
    if (eraName.includes('中平')) eraWeight = 1840000;
    else if (eraName.includes('兴平')) eraWeight = 1940000;
    else if (eraName.includes('初平')) eraWeight = 1900000;
    else if (eraName.includes('建安')) eraWeight = 1960000;

    const year = hanToNum(dateMatch[2] || "1");
    const month = hanToNum(dateMatch[3] || "1");
    const day = hanToNum(dateMatch[4] || "1");
    
    // 时辰提取: [时辰] 第[X]刻
    const timeMatch = d.match(/(夜半|鸡鸣|晨时|平旦|日出|早食|宴食|隅中|日中|日昳|晡时|日入|黄昏|人定|夜深|夜半)\s*(?:第\s*([^\s]+)\s*刻)?/);
    const periods = ['夜半', '鸡鸣', '晨时', '平旦', '日出', '早食', '宴食', '隅中', '日中', '日昳', '晡时', '日入', '黄昏', '人定', '夜深', '夜半'];
    const periodIdx = timeMatch ? periods.indexOf(timeMatch[1]) : 0;
    const ke = timeMatch && timeMatch[2] ? hanToNum(timeMatch[2]) : 0;

    // 数值化: eraWeight + year*10000 + month*100 + day + period*0.01
    return (eraWeight + year) * 1000000 + month * 10000 + day * 100 + periodIdx * 1 + ke * 0.01;
  };
  return parse(dateA) - parse(dateB);
};

const extractCharacterUpdate = (text: string, currentCharacter: Character | null): Character | null => {
  if (!text || !currentCharacter) return currentCharacter;
  
  const extract = (key: string) => {
    const keyPattern = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(?:\\/\\/\\s*)?【${keyPattern}】[：:]?\\s*(.*?)(?=\\n|$)`, 'g');
    const match = regex.exec(text);
    return match ? match[1].trim() : null;
  };

  const newChar = { ...currentCharacter };
  let hasChanges = false;
  
  // Extract Vitality / HP
  const hpProv = extract('体力') || extract('状态') || extract('HP/粮草');
  if (hpProv) {
      const parts = hpProv.split(/[/,，（(]/).map(s => s.replace(/[)）]/g, '').trim());
      if (parts[0]) {
          const hpMatch = parts[0].match(/(\d+)/);
          const hpVal = hpMatch ? hpMatch[1] : parts[0];
          if (hpVal !== newChar.hp) {
            newChar.hp = hpVal;
            hasChanges = true;
          }
      }
  }

  // Extract Attributes
  const params = extract('核心属性') || extract('六维属性') || extract('六维参数') || extract('六维');
  if (params) {
    const attrs = { ...newChar.attributes };
    const commandMatch = params.match(/统(?:率|帅)?:?\s*(\d+)/);
    const martialMatch = params.match(/武(?:力)?:?\s*(\d+)/);
    const vitalityMatch = params.match(/体(?:力)?:?\s*(\d+)/);
    const intellectMatch = params.match(/智(?:力|谋)?:?\s*(\d+)/);
    const politicsMatch = params.match(/政(?:治)?:?\s*(\d+)/);
    const charismaMatch = params.match(/魅(?:力)?:?\s*(\d+)/);

    if (commandMatch) attrs.command = parseInt(commandMatch[1]);
    if (martialMatch) attrs.martial = parseInt(martialMatch[1]);
    if (vitalityMatch) attrs.vitality = parseInt(vitalityMatch[1]);
    if (intellectMatch) attrs.intelligence = parseInt(intellectMatch[1]);
    if (politicsMatch) attrs.politics = parseInt(politicsMatch[1]);
    if (charismaMatch) attrs.charisma = parseInt(charismaMatch[1]);

    if (JSON.stringify(attrs) !== JSON.stringify(newChar.attributes)) {
      newChar.attributes = attrs;
      hasChanges = true;
    }
  }

  // Extract Specialty/TroopType
  const specialty = extract('特技') || extract('战法') || extract('名将特技') || extract('成名特技');
  if (specialty) {
      const parts = specialty.split(/[/,，]/);
      const specVal = parts[0].trim();
      if (specVal !== newChar.specialty) {
        newChar.specialty = specVal;
        hasChanges = true;
      }
  }

  // Extract Items
  const items = extract('物品');
  if (items) {
      const parsedItems = items.split(/[,，]/).map((s: string) => s.trim()).filter(Boolean);
      if (JSON.stringify(parsedItems) !== JSON.stringify(newChar.items)) {
         newChar.items = parsedItems;
         hasChanges = true;
      }
  }
  
  // Extract Name/Role
  const nameRole = extract('姓名\\/官职') || extract('姓名/官职');
  if (nameRole) {
      const parts = nameRole.split('/').map(s => s.trim());
      if (parts[1] && parts[1] !== newChar.allegiance) {
          // just an example of what might change. We won't update name dynamically to avoid breaking.
          // newChar.allegiance = parts[1];
      }
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
        
        if (matchFunds) { newChar.funds = matchFunds[1]; hasChanges = true; }
        else if (matchProv) { newChar.provisions = matchProv[1]; hasChanges = true; }
        else if (matchForces) { newChar.forces = matchForces[1]; hasChanges = true; }
        else if (matchPop) { newChar.popularity = matchPop[1]; hasChanges = true; }
        else if (part && !part.match(/(金钱|粮食|粮草|兵力|民心)/)) {
           // Maybe just store in territory or some general state
           if (!newChar.territory || !newChar.territory.includes(part)) {
               newChar.territory = newChar.territory ? `${newChar.territory} / ${part}` : part;
               hasChanges = true;
           }
        }
      });
  }
  
  const currentStatus = extract('当前状态');
  if (currentStatus && currentStatus !== newChar.currentStatus) {
      newChar.currentStatus = currentStatus;
      hasChanges = true;
  }
  
  const coreIntent = extract('核心意图\\/政务') || extract('核心意图/政务');
  if (coreIntent && coreIntent !== newChar.coreIntent) {
      newChar.coreIntent = coreIntent;
      hasChanges = true;
  }
  
  const bond = extract('羁绊等级');
  if (bond && bond !== newChar.bond) {
      newChar.bond = bond;
      hasChanges = true;
  }

  return hasChanges ? newChar : currentCharacter;
};

const extractGaiaState = (text: string, currentGaiaState?: GaiaState): GaiaState => {
  if (!text) return currentGaiaState || { provinces: {}, lastUpdated: Date.now() };

  const gaiaMatch = text.match(/<historical_state_monitor>([\s\S]*?)<\/historical_state_monitor>/i);
  if (gaiaMatch && gaiaMatch[1]) {
    try {
      const content = gaiaMatch[1].trim();
      const jsonObjects = findBalancedBraces(content);
      
      if (jsonObjects.length > 0) {
        const parsed = robustJSONParse(jsonObjects[0]);
        if (parsed.province_monitor) {
          return {
            provinces: {
              ...(currentGaiaState?.provinces || {}),
              ...parsed.province_monitor
            },
            lastUpdated: Date.now()
          };
        }
      }
    } catch (e) {
      console.error("Failed to parse historical_state_monitor JSON", e);
    }
  }
  return currentGaiaState || { provinces: {}, lastUpdated: Date.now() };
};

const findBalancedBraces = (text: string): string[] => {
  const results: string[] = [];
  let braceCount = 0;
  let startIndex = -1;
  let inString = false;
  let escape = false;
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    
    if (escape) {
      escape = false;
      continue;
    }
    
    if (char === '\\') {
      escape = true;
      continue;
    }
    
    if (char === '"') {
      inString = !inString;
      continue;
    }
    
    if (!inString) {
      if (char === '{') {
        if (braceCount === 0) startIndex = i;
        braceCount++;
      } else if (char === '}') {
        braceCount--;
        if (braceCount === 0 && startIndex !== -1) {
          results.push(text.substring(startIndex, i + 1));
          startIndex = -1;
        }
      }
    }
  }
  return results;
};

const robustJSONParse = (jsonStr: string): any => {
  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    // Try to fix common AI errors
    let fixed = jsonStr
      .replace(/,\s*([\]}])/g, '$1') // Remove trailing commas
      // Fix missing commas in arrays: ["a" "b"] -> ["a", "b"]
      .replace(/"\s*"/g, '", "')
      // Fix missing commas between objects in arrays: {"id":1} {"id":2} -> {"id":1}, {"id":2}
      .replace(/}\s*{/g, '}, {')
      // Fix common typo where 'o' is used instead of '0'
      .replace(/:\s*o([\s,}])/gi, ': 0$1')
      .replace(/:\s*O([\s,}])/g, ': 0$1')
      // Fix full-width colons and quotes
      .replace(/：/g, ':')
      .replace(/”/g, '"')
      .replace(/“/g, '"');
    
    try {
      return JSON.parse(fixed);
    } catch (e2) {
      // If still failing, try a more aggressive fix for missing commas in arrays of objects
      // This is common in the 'records' field
      fixed = fixed.replace(/}\s*"/g, '}, "').replace(/"\s*{/g, '", {');
      try {
        return JSON.parse(fixed);
      } catch (e3) {
        console.error("Failed to parse JSON string completely, throwing error:", e3, "Original string:", jsonStr);
        throw e; // Throw original error if fix fails
      }
    }
  }
};

const extractNPCUpdates = (text: string): any[] => {
  if (!text) return [];
  
  // Try to find the current location from the character's narrative [时间线：...] tags
  // Standard Format: [时间线：YYYY年MM月DD日-星期X-HH:MM-地点-天气]
  let narrativeLocation: string | null = null;
  const timeRegex = /\[时间线：\s*([^\]]*?)\s*\]/g;
  const timeMatches = Array.from(text.matchAll(timeRegex));
  
  if (timeMatches.length > 0) {
    // Usually the last one reflects the current scene
    const lastTimeMatch = timeMatches[timeMatches.length - 1][1];
    const parts = lastTimeMatch.split('-').map(p => p.trim());
    if (parts.length >= 4) {
      // Index 3 is usually Location in 5-part format: Date-Day-Time-Location-Weather
      // Or Index 3 is Location in 4-part format: Date-Time-Location-Weather
      narrativeLocation = parts[3];
    } else if (parts.length === 3) {
      // Maybe Date-Time-Location
      narrativeLocation = parts[2];
    }
  }

  // Robust NPC Sync extraction: Handle [NPC_SYNC_START] blocks OR pure JSON strings OR blocks in <details>
  const syncRegex = /\[NPC_SYNC_START\]([\s\S]*?)\[NPC_SYNC_END\]|<details\b[^>]*>([\s\S]*?id\s*[:：]\s*["']?[\s\S]*?name\s*[:：]\s*["']?[\s\S]*?)<\/details>/gi;
  const matches = Array.from(text.matchAll(syncRegex));
  console.log("NPC SYNC MATCHES:", matches.length);
  const updates: any[] = [];

  for (const match of matches) {
    try {
      const content = (match[1] || match[2] || "").trim();
      if (content) {
        // Use balanced brace parser to find all JSON objects within the block
        const jsonObjects = findBalancedBraces(content);
        
        if (jsonObjects.length > 0) {
          for (const jsonStr of jsonObjects) {
            try {
              const data = robustJSONParse(jsonStr);
              // Map 'description' to 'aiGeneratedRecord' if present
              if (data.description && !data.aiGeneratedRecord) {
                data.aiGeneratedRecord = data.description;
              }
              if (data.loyaltyLevel !== undefined && data.bondLevel === undefined) {
                data.bondLevel = data.loyaltyLevel;
              }
              
              // Apply location fallback to records if missing
              if (narrativeLocation && data.records && Array.isArray(data.records)) {
                data.records = data.records.map((r: any) => ({
                  ...r,
                  location: (r.location && r.location !== "地点" && r.location !== "未知地点") ? r.location : narrativeLocation
                }));
              }
              
              data.hasAppeared = true;
              if (narrativeLocation) {
                data.appearanceLocation = narrativeLocation;
              }
              
              updates.push(data);
            } catch (innerError) {
              console.error("Failed to parse individual NPC JSON object", innerError);
            }
          }
        } else {
          // Fallback to parsing the whole block if no braces found
          try {
            const data = robustJSONParse(content);
            if (data.description && !data.aiGeneratedRecord) {
              data.aiGeneratedRecord = data.description;
            }
            if (data.loyaltyLevel !== undefined && data.bondLevel === undefined) {
              data.bondLevel = data.loyaltyLevel;
            }
            // Apply location fallback
            if (narrativeLocation && data.records && Array.isArray(data.records)) {
              data.records = data.records.map((r: any) => ({
                ...r,
                location: (r.location && r.location !== "地点" && r.location !== "未知地点") ? r.location : narrativeLocation
              }));
            }
            data.hasAppeared = true;
            if (narrativeLocation) {
              data.appearanceLocation = narrativeLocation;
            }
            updates.push(data);
          } catch (e) {
            // If it's a markdown block, try to extract from it
            const mdMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
            if (mdMatch && mdMatch[1]) {
              const mdContent = mdMatch[1].trim();
              const mdJsonObjects = findBalancedBraces(mdContent);
              for (const jsonStr of mdJsonObjects) {
                try {
                  const data = robustJSONParse(jsonStr);
                  if (data.description && !data.aiGeneratedRecord) {
                    data.aiGeneratedRecord = data.description;
                  }
                  if (data.loyaltyLevel !== undefined && data.bondLevel === undefined) {
                    data.bondLevel = data.loyaltyLevel;
                  }
                  // Apply location fallback
                  if (narrativeLocation && data.records && Array.isArray(data.records)) {
                    data.records = data.records.map((r: any) => ({
                      ...r,
                      location: (r.location && r.location !== "地点" && r.location !== "未知地点") ? r.location : narrativeLocation
                    }));
                  }
                  data.hasAppeared = true;
                  if (narrativeLocation) {
                    data.appearanceLocation = narrativeLocation;
                  }
                  updates.push(data);
                } catch (innerError) {
                  console.error("Failed to parse individual NPC JSON object from Markdown", innerError);
                }
              }
            }
          }
        }
      }
    } catch (e) {
      console.error("Failed to parse NPC sync block", e);
    }
  }
  return updates;
};

const applyNPCUpdates = (existingProfiles: NPCProfile[], updates: any[], logs?: LogSummary[]): NPCProfile[] => {
  if (!updates || updates.length === 0) return existingProfiles;
  
  // Name normalization helper: "刘备 (字玄德)" -> "刘备"
  const normalizeName = (name: string): string => {
    if (!name) return '';
    return name.replace(/\s*\(.*?\)\s*/g, '').replace(/\s*（.*?）\s*/g, '').trim().toLowerCase();
  };

  // Create a map for faster lookup
  const profileMap = new Map<string, number>();
  if (Array.isArray(existingProfiles)) {
    existingProfiles.forEach((p, index) => {
      if (p && p.id) profileMap.set(p.id, index);
    });
  }

  const nameMap = new Map<string, number>();
  if (Array.isArray(existingProfiles)) {
    existingProfiles.forEach((p, index) => {
      if (p && p.name) {
        const normalized = normalizeName(p.name);
        const key = `${normalized}|${(p.nativePlace || '').toLowerCase()}`;
        if (!nameMap.has(key)) nameMap.set(key, index);
        
        // Also map just name if no conflict
        if (!nameMap.has(normalized)) nameMap.set(normalized, index);
      }
    });
  }

  let nextProfiles = [...existingProfiles];
  const now = Date.now();
  
  if (Array.isArray(updates)) {
    updates.forEach(update => {
      if (!update) return;
      const updateName = (update.name || '').trim();
      const normalizedUpdateName = normalizeName(updateName);
      const updatePlace = (update.nativePlace || update.placeId || '').trim();
      const updateId = update.id;
      
      if (!updateName && !updateId) return;

      let targetIndex = -1;
      // List of highly generic names that the AI often uses.
      const genericNames = [
        '未知的武将', '未知武将', '神秘人', '流民', '未知角色', '未知npc', '未知', '???',
        '乱军', '细作', '刺客', '山贼', '草寇', '影子', '军医', '书童', '侍者'
      ];
      const isGenericName = normalizedUpdateName ? genericNames.some(gn => normalizedUpdateName.includes(gn)) : false;

      // Only trust the ID if it's not the literal template string
      if (updateId && updateId !== 'unique_id_or_name' && profileMap.has(updateId)) {
        const potentialTarget = profileMap.get(updateId)!;
        const pName = nextProfiles[potentialTarget].name || '';
        const existingNormalized = normalizeName(pName);
        
        // If names differ significantly, we MUST prevent ID collision unless the existing one is highly generic.
        const isExistingNameGeneric = genericNames.some(gn => existingNormalized.includes(gn));
        
        if (existingNormalized !== normalizedUpdateName && !isExistingNameGeneric) {
            console.warn(`[NPC Sync] Prevented ID collision for ${updateId}: Existing name '${pName}', new name '${updateName}'`);
            update.id = `npc_${now}_${Math.random().toString(36).substring(2, 7)}`;
            
            const key = `${normalizedUpdateName}|${updatePlace.toLowerCase()}`;
            if (nameMap.has(key)) {
              targetIndex = nameMap.get(key)!;
            } else if (nameMap.has(normalizedUpdateName)) {
              targetIndex = nameMap.get(normalizedUpdateName)!;
            } else {
              targetIndex = nextProfiles.findIndex(p => p && normalizeName(p.name) === normalizedUpdateName);
            }
        } else {
           targetIndex = potentialTarget;
        }
      } else if (!isGenericName && normalizedUpdateName) {
        const key = `${normalizedUpdateName}|${updatePlace.toLowerCase()}`;
        if (nameMap.has(key)) {
          targetIndex = nameMap.get(key)!;
        } else if (nameMap.has(normalizedUpdateName)) {
          targetIndex = nameMap.get(normalizedUpdateName)!;
        } else {
          targetIndex = nextProfiles.findIndex(p => p && normalizeName(p.name) === normalizedUpdateName);
        }
      }

      if (targetIndex !== -1) {
        const p = nextProfiles[targetIndex];
        if (!p) return;

        let mergedRecords = [...safeArray(p.records)];
        
        if (update.records && Array.isArray(update.records)) {
          if (update._isFullUpdate) {
            // For manual updates, we replace the entire records list
            mergedRecords = update.records;
          } else {
            // For AI updates, we merge based on content uniqueness
            const existingContent = new Set(mergedRecords.map(r => r.content.trim()));
            if (Array.isArray(update.records)) {
              update.records.forEach((r: any) => {
                if (r.content && !existingContent.has(r.content.trim())) {
                  // AUTO-FIX LOCATION FROM LOGS
                  if (logs && r.timestamp) {
                    const logLoc = getLogLocation(r.timestamp, logs);
                    if (logLoc && logLoc !== "地点" && logLoc !== "未知地点") {
                      r.location = logLoc;
                    }
                  }

                  mergedRecords.push({ 
                    ...r, 
                    id: r.id || `rec_${now}_${Math.random().toString(36).substr(2, 9)}` 
                  });
                  existingContent.add(r.content.trim());
                }
              });
            }
          }
        }
        
        // Also fix appearanceLocation if applicable
        if (logs && update.appearanceTime && (!update.appearanceLocation || update.appearanceLocation === "地点")) {
          const appLoc = getLogLocation(update.appearanceTime, logs);
          if (appLoc) update.appearanceLocation = appLoc;
        }
        
        let mergedUserNotes = p.userNotes || '';
        if (update._isFullUpdate) {
          // For manual updates, respect the user's edited notes
          mergedUserNotes = update.userNotes !== undefined ? update.userNotes : mergedUserNotes;
        } else if (update.aiGeneratedRecord && update.aiGeneratedRecord !== p.aiGeneratedRecord) {
          // For AI updates, merge the new AI record into user notes
          if (!mergedUserNotes.includes(update.aiGeneratedRecord)) {
            mergedUserNotes = mergedUserNotes ? `${update.aiGeneratedRecord}\n\n${mergedUserNotes}` : update.aiGeneratedRecord;
          }
        }

        let nextHasAppeared = update.hasAppeared !== undefined ? update.hasAppeared : p.hasAppeared;
        
        let nextAppearanceTime = p.appearanceTime;
        let nextAppearanceLocation = p.appearanceLocation;
        
        if (update._isFullUpdate) {
            nextAppearanceTime = update.appearanceTime;
            nextAppearanceLocation = update.appearanceLocation;
        } else {
            nextAppearanceTime = p.appearanceTime || update.appearanceTime;
            nextAppearanceLocation = p.appearanceLocation || update.appearanceLocation;
        }

        // Auto-fill appearance time from latest record if they just appeared and time is empty
        if (nextHasAppeared && !nextAppearanceTime && mergedRecords.length > 0) {
           const sortedMerged = [...mergedRecords].sort((a,b) => compareDates(a.timestamp, b.timestamp));
           nextAppearanceTime = sortedMerged[0].timestamp;
           nextAppearanceLocation = sortedMerged[0].location || '未知地点';
        }

        nextProfiles[targetIndex] = {
          ...p,
          ...update,
          name: (update._isFullUpdate || !p.name.includes('(')) ? (update.name || p.name) : p.name,
          lastUpdated: now,
          // Handle structured attributes: AI can update them if provided
          attributes: update.attributes || p.attributes,
          // Prevent AI from overwriting these critical fields unless it's a manual update
          parameters: update._isFullUpdate ? update.parameters : p.parameters,
          specialties: update._isFullUpdate ? update.specialties : p.specialties,
          inventory: update._isFullUpdate ? update.inventory : p.inventory,
          bondLevel: update.bondLevel !== undefined ? update.bondLevel : p.bondLevel,
          // Handle appearance fields safely
          hasAppeared: nextHasAppeared,
          appearanceTime: nextAppearanceTime,
          appearanceLocation: nextAppearanceLocation,
          userNotes: mergedUserNotes,
          aiGeneratedRecord: '', // Clear it since it's merged into userNotes
          records: mergedRecords,
          tags: update._isFullUpdate ? (update.tags || []) : [...new Set([...safeArray(p.tags), ...safeArray(update.tags)])]
        };
      } else {
        // Create new NPC
        const newId = update.id || `npc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        let initialHasAppeared = update.hasAppeared !== undefined ? update.hasAppeared : false;
        const newRecords = update.records || [];

        let initialAppTime = update.appearanceTime || '';
        let initialAppLoc = update.appearanceLocation || '';
        if (initialHasAppeared && !initialAppTime && newRecords.length > 0) {
           const sortedNewRecords = [...newRecords].sort((a,b) => compareDates(a.timestamp, b.timestamp));
           initialAppTime = sortedNewRecords[0].timestamp;
           initialAppLoc = sortedNewRecords[0].location || '未知地点';
        }

        const newNpc = {
          bondLevel: 0,
          userNotes: '',
          aiGeneratedRecord: '',
          status: '健康',
          ...update,
          id: newId,
          parameters: update.parameters === 'UNCHANGED' ? '未知' : update.parameters,
          specialties: update.specialties === 'UNCHANGED' ? '' : update.specialties,
          inventory: update.inventory === 'UNCHANGED' ? '' : update.inventory,
          hasAppeared: initialHasAppeared,
          appearanceTime: initialAppTime,
          appearanceLocation: initialAppLoc,
          records: newRecords,
          tags: update.tags || [],
          lastUpdated: now
        };
        const newIndex = nextProfiles.length;
        nextProfiles.push(newNpc);
        
        // Update maps for subsequent updates in the same loop
        profileMap.set(newId, newIndex);
        const key = `${updateName.toLowerCase()}|${(update.nativePlace || '').toLowerCase()}`;
        if (!nameMap.has(key)) nameMap.set(key, newIndex);
      }
    });
  }
  
  return nextProfiles;
};

const getDefaultWorldBooks = (setting: HistoricalPeriod): string[] => {
  switch (setting) {
    case HistoricalPeriod.YELLOW_TURBAN:
      return ['YELLOW_TURBAN'];
    case HistoricalPeriod.ANTI_DONG_ZHUO:
      return ['ANTI_DONG_ZHUO'];
    case HistoricalPeriod.WARLORDS_CHAOS:
      return ['WARLORDS_CHAOS'];
    case HistoricalPeriod.GUANDU:
      return ['GUANDU'];
    case HistoricalPeriod.CHIBI:
      return ['CHIBI'];
    case HistoricalPeriod.THREE_KINGDOMS:
      return ['THREE_KINGDOMS'];
    case HistoricalPeriod.NORTHERN_EXPEDITION:
      return ['NORTHERN_EXPEDITION'];
    case HistoricalPeriod.FALL_OF_THREE:
      return ['FALL_OF_THREE'];
    default:
      return [];
  }
};

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public props: ErrorBoundaryProps;
  public state: ErrorBoundaryState = {
    hasError: false,
    error: null
  };

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.props = props;
  }

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-center">
          <div className="max-w-md w-full bg-slate-900 border border-red-900/50 p-8 rounded-3xl shadow-2xl space-y-6">
            <div className="w-16 h-16 bg-red-900/20 rounded-full flex items-center justify-center mx-auto border border-red-900/50">
              <AlertCircle className="text-red-500 w-8 h-8" />
            </div>
            <h1 className="text-2xl font-display text-red-100 uppercase tracking-wider">系统崩溃 (System Crash)</h1>
            <p className="text-slate-400 text-sm leading-relaxed">
              检测到严重的推演回路故障。请尝试刷新页面以重新建立链接。
            </p>
            <div className="bg-black/40 p-4 rounded-xl text-left overflow-auto max-h-32">
              <code className="text-[10px] text-red-400/70 font-mono break-all">
                {this.state.error?.message || "Unknown error"}
              </code>
            </div>
            <button 
              onClick={() => window.location.reload()}
              className="w-full bg-red-900 hover:bg-red-800 text-white py-3 rounded-xl transition-all font-display tracking-widest uppercase border border-red-700"
            >
              重启系统 (Reboot)
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const SESSION_ID = Math.random().toString(36).substring(2, 15);

const getLatestDateFromHistory = (history: Message[]): string => {
  let latest = '';
  
  history.forEach(msg => {
    if (msg.content) {
      // 捕获可能包含星期的完整 TimeFormat 字符串
      const systemDateRegex = /(?:【当前日期：|\[时间线：)\s*([^\n】\]]+)/g;
      let match;
      while ((match = systemDateRegex.exec(msg.content)) !== null) {
        const foundDate = match[1].trim();
        if (compareDates(foundDate, latest) > 0) {
          latest = foundDate;
        }
      }
    }
  });
  return latest;
};

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  const executeAiCall = async (
    aiMsgId: string,
    callFn: () => Promise<{ text: string; groundingMetadata?: any }>,
    onRetryMsg: (count: number) => string
  ) => {
    let retryCount = 0;
    const maxRetries = 15;
    while (retryCount < maxRetries) {
      try {
        return await callFn();
      } catch (error: any) {
        if (isRetryableError(error) && retryCount < maxRetries - 1) {
          retryCount++;
          console.warn(`Retryable error (429) detected, retrying ${retryCount}/${maxRetries}...`);
          setGameState(prev => {
            const newHistory = [...prev.history];
            const lastMsg = newHistory.find(m => m.id === aiMsgId);
            if (lastMsg) {
              lastMsg.content = onRetryMsg(retryCount);
            }
            return { ...prev, history: newHistory };
          });
          await sleep(1000 * retryCount);
          continue;
        }
        throw error;
      }
    }
    throw new Error(`已尝试 ${maxRetries} 次自动重连，根源连接依然受阻，请检查网络或手动重新生成。`);
  };

  const [gameState, setGameState] = useState<GameState>({
    status: GameStatus.START_MENU,
    character: null,
    history: [],
    isLoading: false,
    isCharacterSheetOpen: false,
    isCompendiumOpen: false,
    isLogModalOpen: false,
    npcProfiles: [],
    logs: [],
    difficulty: 'normal',
    
  });
  const [activeTab, setActiveTab] = useState<'chat' | 'history'>('chat');
  const [input, setInput] = useState('');
  const [saveExists, setSaveExists] = useState(false);
  const [savedDifficulty, setSavedDifficulty] = useState<'normal' | 'grand'>('normal');
  const [currentModel, setCurrentModel] = useState('gemini-3-flash-preview');
  const [customModelName, setCustomModelName] = useState(localStorage.getItem('thirdPartyModelName') || '');
  const [selectedMessageIds, setSelectedMessageIds] = useState<Set<string>>(new Set());

  const scrollToBottom = () => {
    window.dispatchEvent(new CustomEvent('scroll-to-bottom'));
  };

  const [isGameMenuOpen, setIsGameMenuOpen] = useState(false);
  const [isCloudSyncEnabled, setIsCloudSyncEnabled] = useState(() => {
    return localStorage.getItem('isCloudSyncEnabled') === 'true';
  });
  const [isApiSettingsOpen, setIsApiSettingsOpen] = useState(false);
  const [isWorldBookOpen, setIsWorldBookOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSyncMode, setIsSyncMode] = useState(false);
  const [isCompendiumSyncMode, setIsCompendiumSyncMode] = useState(false);
  const [isLogSyncMode, setIsLogSyncMode] = useState(false);
  const [targetNPCId, setTargetNPCId] = useState<string | null>(null);

  const toggleStage = (stageId: string) => {
    setGameState(gs => {
      const currentStages = gs.selectedStages || [];
      const next = currentStages.includes(stageId) 
        ? currentStages.filter(id => id !== stageId)
        : [...currentStages, stageId];
      
      return { ...gs, selectedStages: next };
    });
  };

  const [restoredNotification, setRestoredNotification] = useState(false);
  const [pendingCloudSave, setPendingCloudSave] = useState<GameState | null>(null);
  const [apiKeyWarning, setApiKeyWarning] = useState(false);
  const [showNewGameConfirm, setShowNewGameConfirm] = useState(false);
  const [showDeleteSaveConfirm, setShowDeleteSaveConfirm] = useState(false);
  const [pendingDifficulty, setPendingDifficulty] = useState<'normal' | 'grand'>('normal');
  const hasAutoRestoredRef = useRef(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const localSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const gameStateRef = useRef<GameState>(gameState);
  const isSendingRef = useRef(false);

  // Keep gameStateRef in sync with gameState
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  // Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      console.log("Auth state changed:", u ? u.uid : "null");
      setUser(u);
      setIsAuthReady(true);
    });
    return () => unsub();
  }, []);

  // Sync Game State from Firestore
  useEffect(() => {
    if (!db || !user || !isCloudSyncEnabled) return;
    
    const gameDocRef = doc(db, 'games', user.uid);
    const unsub = onSnapshot(gameDocRef, (snapshot) => {
      // Ignore local updates to prevent self-conflict
      if (snapshot.metadata.hasPendingWrites) return;

      if (snapshot.exists()) {
        const data = snapshot.data() as GameState;
        
        setSaveExists(true);
        setSavedDifficulty(data.difficulty || 'normal');
        
        setGameState(prev => {
          const currentGameState = prev;

          // If we are in START_MENU, auto-restore is fine
          if (currentGameState.status === GameStatus.START_MENU && !hasAutoRestoredRef.current) {
            hasAutoRestoredRef.current = true;
            
            const localData = loadGame();
            const dataWithTimestamp = data as GameState & { lastUpdated?: any };
            const cloudTimestamp = dataWithTimestamp.lastUpdated?.toMillis ? dataWithTimestamp.lastUpdated.toMillis() : 0;
            const localTimestamp = localData?.timestamp || 0;
            
            // If local data is newer, prioritize it for fields that can be edited locally
            const useLocal = localTimestamp > cloudTimestamp;

            const persistentState: any = {
              status: useLocal && localData?.status ? localData.status : (data.status || prev.status),
              character: useLocal && localData?.character ? localData.character : (data.character || prev.character),
              npcProfiles: useLocal && localData?.npcProfiles ? localData.npcProfiles : (data.npcProfiles || prev.npcProfiles),
              stageSettings: useLocal && localData?.stageSettings ? localData.stageSettings : (data.stageSettings || localData?.stageSettings || prev.stageSettings),
              selectedStages: useLocal && localData?.selectedStages ? localData.selectedStages : (data.selectedStages || localData?.selectedStages || prev.selectedStages),
              difficulty: useLocal && localData?.difficulty ? localData.difficulty : (data.difficulty || prev.difficulty),
              
              gaiaState: useLocal && localData?.gaiaState ? localData.gaiaState : (data.gaiaState || prev.gaiaState),
              logs: useLocal && localData?.logs ? localData.logs : (data.logs || prev.logs || [])
            };

            if (useLocal && localData && localData.history && localData.history.length > 0) {
              persistentState.history = localData.history;
            } else if (data.history && data.history.length > 0) {
              persistentState.history = data.history;
            } else if (localData && localData.history && localData.history.length > 0) {
              persistentState.history = localData.history;
            }

            if (data.status === GameStatus.PLAYING || data.status === GameStatus.STAGE_SETUP || data.status === GameStatus.CREATION) {
              setRestoredNotification(true);
              setTimeout(() => setRestoredNotification(false), 5000);
              return {
                ...prev,
                ...persistentState,
              };
            }
            return prev;
          } 
          // If we are already playing, we don't overwrite "secretly"
          else if (currentGameState.status !== GameStatus.START_MENU) {
            // Ignore updates that were generated by this exact session
            const anyData = data as any;
            if (anyData.sessionId === SESSION_ID) {
              return prev;
            }

            // Check if cloud data is actually different from current state
            const isDifferent = 
              data.status !== currentGameState.status || 
              data.character?.name !== currentGameState.character?.name ||
              (data.gaiaState?.lastUpdated !== currentGameState.gaiaState?.lastUpdated);

            if (isDifferent) {
              setPendingCloudSave(data);
            }
            return prev;
          }
          return prev;
        });
      } else {
        setSaveExists(false);
      }
    }, (error) => handleFirestoreError(error, OperationType.GET, `games/${user.uid}`));
    
    return () => unsub();
  }, [user]);

  // Conflict Resolution UI is now inlined at the bottom of the component

  // Check for save file on mount and auto-restore if possible
  useEffect(() => {
    // Check for API Key
    const hasKey = !!(process.env.GEMINI_API_KEY || process.env.API_KEY);
    if (!hasKey) {
      setApiKeyWarning(true);
    }

    if (!user) {
      const savedData = loadGame();
      if (savedData) {
        setSaveExists(true);
        setSavedDifficulty(savedData.difficulty || 'normal');
        if (savedData.status === GameStatus.PLAYING || savedData.status === GameStatus.STAGE_SETUP || savedData.status === GameStatus.CREATION) {
          console.log("Auto-restoring session...");

          restoreGameSession(savedData.character, savedData.history, savedData.npcProfiles, savedData.stageSettings, savedData.status, savedData.difficulty, savedData.selectedStages, savedData.logs, savedData.gaiaState);
          setRestoredNotification(true);
          setTimeout(() => setRestoredNotification(false), 5000);
        }
      }
    }
  }, [user]);

  const handleToggleSyncMode = () => {
    setIsSyncMode(prev => {
      const newState = !prev;
      if (!newState) {
        setSelectedMessageIds(new Set()); // Clear selection when turning off
      }
      return newState;
    });
  };

  // Auto-save logic (Sync to Firestore if logged in, else LocalStorage)
  useEffect(() => {
    const shouldSave = (
      (gameState.status === GameStatus.PLAYING && gameState.character) ||
      (gameState.status === GameStatus.STAGE_SETUP && gameState.character) ||
      (gameState.status === GameStatus.CREATION && gameState.character)
    );

    if (shouldSave) {
      const lastMsg = gameState.history.length > 0 ? gameState.history[gameState.history.length - 1] : null;
      if ((!lastMsg || !lastMsg.isStreaming) && !gameState.isLoading) {
        
        // Debounce local save to prevent main thread blocking and mobile crashes
        if (localSaveTimeoutRef.current) clearTimeout(localSaveTimeoutRef.current);
        localSaveTimeoutRef.current = setTimeout(() => {
          // Always save locally to ensure local is primary
          saveGame(gameState.character!, gameState.history, gameState.npcProfiles || [], gameState.stageSettings, gameState.status, gameState.difficulty, gameState.selectedStages, gameState.logs, gameState.gaiaState);
          setSaveExists(true);
        }, 500); // 500ms debounce for local save

        // SAVE TO FIRESTORE
        if (user && db && !isFirestoreQuotaBlocked() && isCloudSyncEnabled) {
          // Debounce Firestore writes
          if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
          
          saveTimeoutRef.current = setTimeout(() => {
            saveGameStateToCloud(user.uid, gameState)
              .catch(err => {
                console.error("Cloud save failed:", err);
              });
          }, 3000); // 3s debounce for cloud save
        }
      }
    }

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      if (localSaveTimeoutRef.current) clearTimeout(localSaveTimeoutRef.current);
    };
  }, [gameState.status, gameState.character, gameState.history, gameState.isLoading, gameState.npcProfiles, gameState.stageSettings, gameState.difficulty, gameState.selectedStages, gameState.logs, gameState.gaiaState, user]);

  const handleReturnToStart = () => {
    console.log("Returning to start menu...");
    setIsGameMenuOpen(false);
    
    // Use a timeout to ensure the state update happens after the current render cycle
    // and isn't batched with other updates that might override it.
    setTimeout(() => {
      setGameState(prev => ({ 
        ...prev, 
        status: GameStatus.START_MENU, 
        character: null, 
        history: [],
        npcProfiles: [],
        logs: [],
        
        systemState: undefined,
        gaiaState: undefined,
        stageSettings: undefined,
        selectedStages: undefined,
        isCharacterSheetOpen: false,
        isCompendiumOpen: false,
        isLogModalOpen: false,
        isLoading: false,
        difficulty: 'normal'
      }));
      
      // Update saveExists state just in case (only for local saves)
      if (!user) {
        const savedData = loadGame();
        if (savedData) {
          setSaveExists(true);
          setSavedDifficulty(savedData.difficulty || 'normal');
        } else {
          setSaveExists(false);
        }
      }
    }, 0);
  };

  const handleStartNewGame = (difficulty: 'normal' | 'grand' = 'normal') => {
    setPendingDifficulty(difficulty);
    if (saveExists) {
      setShowNewGameConfirm(true);
    } else {
      confirmStartNewGame(difficulty);
    }
  };

  const confirmStartNewGame = (difficulty?: 'normal' | 'grand') => {
    console.log("Starting new game...");
    const diff = difficulty || pendingDifficulty;
    clearSave();
    resetGame();

    setGameState(prev => ({ 
      ...prev, 
      status: GameStatus.CREATION, 
      character: null, 
      history: [],
      logs: [],
      
      systemState: undefined,
      gaiaState: undefined,
      isCharacterSheetOpen: false,
      isCompendiumOpen: false,
      npcProfiles: [
        {
          id: 'historical-system',
          name: '天命系统 (Mandate of Heaven)',
          aiGeneratedRecord: '当前东汉末年大势的核心推演系统。负责朝廷威望、州郡局势与民心核算。',
          userNotes: '',
          status: '运作中',
          tags: ['系统', '大势'],
          hiddenNotes: '[Food Provisions: Initial] [Political Prestige: 10] [Unrest: 0]',
          records: [],
          lastUpdated: Date.now(),
          bondLevel: 0,
          resistance: 'High',
          nextMilestone: 'N/A'
        }
      ],
      stageSettings: undefined,
      selectedStages: undefined,
      difficulty: diff
    }));
    setSelectedMessageIds(new Set());
    setShowNewGameConfirm(false);
  };

  const cancelStartNewGame = () => {
    setShowNewGameConfirm(false);
  };

  const restoreGameSession = async (character: Character, history: Message[], npcProfiles: NPCProfile[] = [], stageSettings?: string, status: GameStatus = GameStatus.PLAYING, difficulty: 'normal' | 'grand' = 'normal', selectedStages?: string[], logs: LogSummary[] = [],  gaiaState?: GaiaState) => {
    const sanitizedHistory = history.map(msg => ({ ...msg, isStreaming: false }));

    let finalSelectedStages = selectedStages;
    if (!finalSelectedStages || finalSelectedStages.length === 0) {
      if (character && character.setting) {
        finalSelectedStages = getDefaultWorldBooks(character.setting);
      } else {
        finalSelectedStages = [];
      }
    }

    setGameState(prev => ({
      ...prev,
      character: character,
      history: sanitizedHistory,
      npcProfiles: npcProfiles,
      stageSettings: stageSettings,
      selectedStages: finalSelectedStages,
      status: status,
      difficulty: difficulty,
      
      gaiaState: gaiaState || prev.gaiaState,
      logs: logs,
      isLoading: true
    }));
    setSelectedMessageIds(new Set());

    try {
      if (status === GameStatus.PLAYING) {
        await initializeGame(sanitizedHistory, currentModel);
      }
      setGameState(prev => ({ ...prev, isLoading: false }));
      saveGame(character, sanitizedHistory, npcProfiles, stageSettings, status, difficulty, finalSelectedStages, logs, gaiaState);
      setSaveExists(true);
    } catch (e) {
      console.error("Failed to restore game session", e);
      setGameState(prev => ({ ...prev, isLoading: false }));
      console.warn("恢复会话失败");
    }
  };

  const handleContinueGame = async () => {
    if (user && db) {
      try {
        const cloudData = await loadGameStateFromCloud(user.uid);
        const localData = loadGame();
        
        let restored = false;
        
        if (cloudData && cloudData.character) {
          const cloudTimestamp = (cloudData as any).lastUpdated?.toMillis ? (cloudData as any).lastUpdated.toMillis() : (cloudData as any).timestamp || 0;
          const localTimestamp = localData?.timestamp || 0;
          const useLocal = localTimestamp > cloudTimestamp;

          const dataToRestore = useLocal && localData ? localData : (cloudData as any);
          
          await restoreGameSession(
            dataToRestore.character, 
            dataToRestore.history || [], 
            dataToRestore.npcProfiles || [], 
            dataToRestore.stageSettings, 
            dataToRestore.status || GameStatus.PLAYING, 
            dataToRestore.difficulty || 'normal', 
            dataToRestore.selectedStages || [], 
            dataToRestore.logs || [], 
            dataToRestore.gaiaState
          );
          restored = true;
        }
        
        if (!restored && localData && localData.character) {
          await restoreGameSession(localData.character, localData.history || [], localData.npcProfiles || [], localData.stageSettings, localData.status, localData.difficulty, localData.selectedStages, localData.logs, localData.gaiaState);
        }
      } catch (e) {
        console.error("Cloud restore failed, falling back to local storage:", e);
        const localData = loadGame();
        if (localData && localData.character) {
          await restoreGameSession(localData.character, localData.history || [], localData.npcProfiles || [], localData.stageSettings, localData.status, localData.difficulty, localData.selectedStages, localData.logs, localData.gaiaState);
        }
      }
    } else {
      const savedData = loadGame();
      if (!savedData) return;
      await restoreGameSession(savedData.character, savedData.history || [], savedData.npcProfiles || [], savedData.stageSettings, savedData.status, savedData.difficulty, savedData.selectedStages, savedData.logs, savedData.gaiaState);
    }
  };

  const handleImportGame = async (data: any) => {
    if (validateSaveData(data)) {
      await restoreGameSession(data.character, data.history, data.npcProfiles, (data as any).stageSettings, (data as any).status, (data as any).difficulty, (data as any).selectedStages, data.logs || [], data.gaiaState);
    } else {
      console.error("存档文件格式无效。");
    }
  };

  const handleExport = (purify?: boolean) => {
    if (gameState.character && gameState.history.length > 0) {
      exportSaveToFile(gameState.character, gameState.history, gameState.npcProfiles || [], gameState.stageSettings, gameState.status, gameState.difficulty, gameState.selectedStages, gameState.logs, gameState.gaiaState, { purify });
    }
  };

  const handleModelChange = async (newModel: string) => {
    setCurrentModel(newModel);
    
    // If playing, we need to switch the live session
    if (gameState.status === GameStatus.PLAYING) {
       try {
         await switchSessionModel(newModel, gameState.history, "");
       } catch(err) {
         console.error("Failed to switch model", err);
       }
    }
  };

  const handleOpenCompendium = () => {
    setGameState(prev => ({ ...prev, isCompendiumOpen: true }));
  };

  const handleOpenLogModal = () => {
    setGameState(prev => ({ ...prev, isLogModalOpen: true }));
  };

  const handleAddNPC = (name: string) => {
    const newNPC: NPCProfile = {
      id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
      name,
      aiGeneratedRecord: '',
      userNotes: '',
      status: '',
      parameters: '',
      specialties: '',
      inventory: '',
      tags: [],
      records: [],
      hiddenNotes: '',
      lastUpdated: Date.now(),
      bondLevel: 0,
      resistance: 'Low',
      nextMilestone: 'None'
    };
    setGameState(prev => ({
      ...prev,
      npcProfiles: [...safeArray(prev.npcProfiles), newNPC]
    }));
  };

  const handleUpdateNPC = (updatedNPC: Partial<NPCProfile> & { id?: string, name?: string }) => {
    if (!updatedNPC.id && !updatedNPC.name) return;
    
    setGameState(prev => {
      // Manual updates from the UI should be treated as full updates for the provided fields
      const nextProfiles = applyNPCUpdates(prev.npcProfiles || [], [{ ...updatedNPC, _isFullUpdate: true }], prev.logs);
      
      // Force immediate local save
      if (prev.character) {
        setTimeout(() => {
          saveGame(prev.character!, prev.history, nextProfiles, prev.stageSettings, prev.status, prev.difficulty,  prev.selectedStages, prev.logs, prev.gaiaState);
        }, 0);
      }

      return { ...prev, npcProfiles: nextProfiles };
    });
  };

  const handleDeleteNPC = (npcId: string) => {
    console.log('DEBUG: handleDeleteNPC called with ID:', npcId);
    setGameState(prev => {
      const nextProfiles = safeArray(prev.npcProfiles).filter(p => p.id !== npcId);
      console.log('DEBUG: Previous profiles length:', prev.npcProfiles?.length);
      console.log('DEBUG: Next profiles length:', nextProfiles.length);
      
      // Force immediate local save
      if (prev.character) {
        setTimeout(() => {
          saveGame(prev.character!, prev.history, nextProfiles, prev.stageSettings, prev.status, prev.difficulty,  prev.selectedStages, prev.logs, prev.gaiaState);
        }, 0);
      }

      return {
        ...prev,
        npcProfiles: nextProfiles
      };
    });
  };

  const handleMoveNPC = (id: string, direction: 'up' | 'down') => {
    setGameState(prev => {
      const profiles = [...(prev.npcProfiles || [])];
      const index = profiles.findIndex(p => p.id === id);
      if (index === -1) return prev;

      // Find the actual visible index (excluding historical-system)
      const visibleProfiles = profiles.filter(p => p.id !== 'historical-system');
      const visibleIndex = visibleProfiles.findIndex(p => p.id === id);
      
      if (direction === 'up' && visibleIndex > 0) {
        const targetId = visibleProfiles[visibleIndex - 1].id;
        const targetIndex = profiles.findIndex(p => p.id === targetId);
        // Swap
        const temp = profiles[index];
        profiles[index] = profiles[targetIndex];
        profiles[targetIndex] = temp;
      } else if (direction === 'down' && visibleIndex < visibleProfiles.length - 1) {
        const targetId = visibleProfiles[visibleIndex + 1].id;
        const targetIndex = profiles.findIndex(p => p.id === targetId);
        // Swap
        const temp = profiles[index];
        profiles[index] = profiles[targetIndex];
        profiles[targetIndex] = temp;
      } else {
        return prev;
      }

      // Force immediate local save
      if (prev.character) {
        setTimeout(() => {
          saveGame(prev.character!, prev.history, profiles, prev.stageSettings, prev.status, prev.difficulty,  prev.selectedStages, prev.logs, prev.gaiaState);
        }, 0);
      }

      return {
        ...prev,
        npcProfiles: profiles
      };
    });
  };

  const handleSyncNPC = (npcId: string) => {
    setTargetNPCId(npcId);
    setIsCompendiumSyncMode(true);
    setGameState(prev => ({ ...prev, isCompendiumOpen: false }));
    setSelectedMessageIds(new Set());
  };

  const handleMergeNPCs = (sourceIds: string[], targetId: string) => {
    console.log('DEBUG: handleMergeNPCs called. sourceIds:', sourceIds, 'targetId:', targetId);
    console.log('DEBUG: Available IDs:', gameState.npcProfiles?.map(p => p.id));
    setGameState(prev => {
      const profiles = prev.npcProfiles || [];
      const targetNPC = profiles.find(p => p.id === targetId);
      console.log('DEBUG: targetNPC found:', !!targetNPC);
      if (!targetNPC) return prev;

      const sourceNPCs = profiles.filter(p => sourceIds.includes(p.id) && p.id !== targetId);
      console.log('DEBUG: sourceNPCs found:', sourceNPCs.length);
      
      const mergedRecords = [...safeArray(targetNPC.records)];
      let mergedUserNotes = targetNPC.userNotes || '';
      let mergedAiGeneratedRecord = targetNPC.aiGeneratedRecord || '';
      let mergedHiddenNotes = targetNPC.hiddenNotes || '';
      const mergedTags = new Set(safeArray(targetNPC.tags));
      let maxBondLevel = targetNPC.bondLevel || 0;

      if (Array.isArray(sourceNPCs)) {
        sourceNPCs.forEach(s => {
          console.log('DEBUG: merging source NPC:', s.name, s.id);
          if (s.records) {
            mergedRecords.push(...s.records);
          }
          if (s.userNotes) {
            mergedUserNotes += `\n[Merged from ${s.name}]: ${s.userNotes}`;
          }
          if (s.aiGeneratedRecord) {
            mergedAiGeneratedRecord += `\n[Merged from ${s.name}]: ${s.aiGeneratedRecord}`;
          }
          if (s.hiddenNotes) {
            mergedHiddenNotes += `\n[Merged from ${s.name}]: ${s.hiddenNotes}`;
          }
          if (s.tags && Array.isArray(s.tags)) {
            s.tags.forEach(t => mergedTags.add(t));
          }
          if ((s.bondLevel || 0) > maxBondLevel) {
            maxBondLevel = s.bondLevel || 0;
          }
        });
      }

      // Sort merged records by timestamp using custom comparator
      mergedRecords.sort((a, b) => compareDates(a.timestamp, b.timestamp));

      // Deduplicate by content to prevent duplicate lore entries, fallback to ID or index
      const uniqueRecordsMap = new Map<string, NPCRecord>();
      mergedRecords.forEach((r, index) => {
        if (!r) return;
        const key = r.content ? r.content.trim() : (r.id || `temp_${index}`);
        if (!uniqueRecordsMap.has(key)) {
          // Ensure the record has an ID if it was missing
          if (!r.id) {
            r.id = `rec_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
          }
          uniqueRecordsMap.set(key, r);
        }
      });
      
      const sortedRecords = Array.from(uniqueRecordsMap.values()).sort((a, b) => {
        // 1. Try to sort by in-game Day if available
        const parseGameDay = (ts: string) => {
          if (!ts) return -1;
          const match = ts.match(/Day\s*(\d+)/i) || ts.match(/第\s*(\d+)\s*天/);
          if (match) {
            let day = parseInt(match[1], 10);
            let timeScore = 0;
            const lowerTs = ts.toLowerCase();
            if (lowerTs.includes('morning') || lowerTs.includes('早') || lowerTs.includes('上午')) timeScore = 1;
            else if (lowerTs.includes('noon') || lowerTs.includes('中')) timeScore = 2;
            else if (lowerTs.includes('afternoon') || lowerTs.includes('下午')) timeScore = 3;
            else if (lowerTs.includes('evening') || lowerTs.includes('傍晚') || lowerTs.includes('黄昏')) timeScore = 4;
            else if (lowerTs.includes('night') || lowerTs.includes('晚') || lowerTs.includes('夜')) timeScore = 5;
            return day * 10 + timeScore;
          }
          return -1;
        };

        const gameTimeA = parseGameDay(a.timestamp);
        const gameTimeB = parseGameDay(b.timestamp);

        if (gameTimeA !== -1 && gameTimeB !== -1 && gameTimeA !== gameTimeB) {
          return gameTimeA - gameTimeB;
        }

        // 2. Fallback to real-world creation time (from ID)
        const getTs = (id: string) => {
          if (!id) return 0;
          if (id.startsWith('rec_')) {
            const parts = id.split('_');
            if (parts.length > 1) return parseInt(parts[1], 10) || 0;
          }
          const match = id.match(/^(\d{12,14})/);
          if (match) return parseInt(match[1], 10) || 0;
          return 0;
        };
        
        const tsA = getTs(a.id);
        const tsB = getTs(b.id);
        
        if (tsA !== 0 && tsB !== 0) {
          return tsA - tsB;
        } else if (tsA !== 0) {
          return 1; // a has timestamp, b doesn't. b comes first (older)
        } else if (tsB !== 0) {
          return -1; // b has timestamp, a doesn't. a comes first (older)
        }
        
        return 0;
      });

      const updatedTargetNPC: NPCProfile = {
        ...targetNPC,
        records: sortedRecords,
        userNotes: mergedUserNotes.trim(),
        aiGeneratedRecord: mergedAiGeneratedRecord.trim(),
        hiddenNotes: mergedHiddenNotes.trim(),
        tags: Array.from(mergedTags),
        bondLevel: maxBondLevel,
        lastUpdated: Date.now()
      };

      const nextProfiles = profiles
        .filter(p => !sourceIds.includes(p.id) || p.id === targetId)
        .map(p => p.id === targetId ? updatedTargetNPC : p);

      // Force immediate local save
      if (prev.character) {
        setTimeout(() => {
          saveGame(prev.character!, prev.history, nextProfiles, prev.stageSettings, prev.status, prev.difficulty,  prev.selectedStages, prev.logs, prev.gaiaState);
        }, 0);
      }

      return {
        ...prev,
        npcProfiles: nextProfiles
      };
    });
  };

  const handleCancelCompendiumSync = () => {
    setIsCompendiumSyncMode(false);
    setTargetNPCId(null);
    setGameState(prev => ({ ...prev, isCompendiumOpen: true }));
    setSelectedMessageIds(new Set());
  };

  const handleSyncLog = () => {
    setIsLogSyncMode(true);
    setGameState(prev => ({ ...prev, isLogModalOpen: false }));
    setSelectedMessageIds(new Set());
  };

  const handleCancelLogSync = () => {
    setIsLogSyncMode(false);
    setGameState(prev => ({ ...prev, isLogModalOpen: true }));
    setSelectedMessageIds(new Set());
  };

  const handleConfirmLogSync = async () => {
    if (selectedMessageIds.size === 0 || gameState.isLoading) return;

    setGameState(prev => ({ ...prev, isLoading: true }));
    try {
      console.log(`Starting log generation for ${selectedMessageIds.size} messages...`);
      const selectedMessages = gameState.history.filter(m => selectedMessageIds.has(m.id));
      const logSummary = await generateLogEntry(selectedMessages, gameState.character, gameState.logs, gameState.stageSettings, gameState.npcProfiles);
      
      console.log("Log generated successfully, processing updates...");
      const hasEvents = logSummary.days && logSummary.days.some(day => day.events && day.events.length > 0);
      
      if (!hasEvents) {
        setGameState(prev => ({ ...prev, isLoading: false, isLogModalOpen: true }));
        setIsLogSyncMode(false);
        setSelectedMessageIds(new Set());
        alert("AI 未能从选中的内容中提取到新的有效事件，请尝试勾选更多或不同的对话。");
        return;
      }

      // Process and add log entry in one state update
      setGameState(prev => {
        return {
          ...prev,
          logs: [...safeArray(prev.logs), logSummary].sort((a, b) => b.timestamp - a.timestamp),
          isLoading: false,
          isLogModalOpen: true
        };
      });
      
      setIsLogSyncMode(false);
      setSelectedMessageIds(new Set());
    } catch (error: any) {
      console.error("Error generating log:", error);
      setGameState(prev => ({ ...prev, isLoading: false, isLogModalOpen: true }));
      setIsLogSyncMode(false);
      setSelectedMessageIds(new Set());
      alert(`日志生成失败: ${error.message || "未知错误"}`);
    }
  };

  const handleConfirmCompendiumSync = async () => {
    if (!targetNPCId || selectedMessageIds.size === 0) return;

    const targetNPC = gameState.npcProfiles?.find(p => p.id === targetNPCId);
    if (!targetNPC) return;

    // Get selected messages content
    const selectedContent = gameState.history
      .filter(msg => selectedMessageIds.has(msg.id))
      .map(msg => `[${msg.role === 'user' ? 'Player' : 'Game'}]: ${msg.content}`)
      .join('\n\n');

    setGameState(prev => ({ ...prev, isLoading: true }));

    const prompt = generateNPCUpdatePrompt(
      targetNPC.name, 
      targetNPC.status, 
      targetNPC.attributes,
      targetNPC.specialties || '',
      targetNPC.inventory || '',
      targetNPC.tags || [], 
      targetNPC.hiddenNotes || '',
      targetNPC.bondLevel || 0,
      targetNPC.resistance || 'Medium',
      targetNPC.nextMilestone || '',
      selectedContent,
      targetNPC.hasAppeared,
      targetNPC.appearanceTime,
      targetNPC.appearanceLocation
    );

    const result = await analyzeNPCData(prompt, gameState.character?.setting);

    setGameState(prev => {
      const updatedProfiles = safeArray(prev.npcProfiles).map(p => {
        if (p.id === targetNPCId) {
          // Merge new records: if content is same, update timestamp, otherwise add new
          const existingRecords = safeArray(p.records);
          const newRecords = safeArray(result.newRecords).map(r => ({
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            content: r.content,
            timestamp: r.timestamp || new Date().toLocaleString(),
            location: r.location
          }));

          // Simple merge: add new records, keep old ones
          const mergedRecords = [...existingRecords, ...newRecords];

          return {
            ...p,
            status: result.status || p.status,
            parameters: result.parameters || p.parameters,
            specialties: result.specialties || p.specialties,
            inventory: result.inventory || p.inventory,
            tags: result.tags || p.tags,
            hiddenNotes: result.hiddenNotes || p.hiddenNotes,
            bondLevel: result.bondLevel !== undefined ? result.bondLevel : p.bondLevel,
            resistance: result.resistance || p.resistance,
            nextMilestone: result.nextMilestone || p.nextMilestone,
            // Strictly handle the boolean `hasAppeared`
            hasAppeared: (result.hasAppeared === true || result.hasAppeared === false) ? result.hasAppeared : p.hasAppeared,
            appearanceTime: result.appearanceTime || p.appearanceTime,
            appearanceLocation: result.appearanceLocation || p.appearanceLocation,
            records: mergedRecords,
            lastUpdated: Date.now()
          };
        }
        return p;
      });

      return {
        ...prev,
        npcProfiles: updatedProfiles,
        isLoading: false,
        isCompendiumOpen: true // Re-open compendium
      };
    });

    setIsCompendiumSyncMode(false);
    setTargetNPCId(null);
    setSelectedMessageIds(new Set());
  };

  const handleBatchInferAppearances = async (): Promise<number> => {
    setGameState(prev => ({ ...prev, isLoading: true }));
    try {
      const { batchInferAppearances } = await import('./services/geminiService');
      const updates = await batchInferAppearances(gameState.npcProfiles, gameState.logs);
      
      if (updates && updates.length > 0) {
        setGameState(prev => {
          const updatedProfiles = prev.npcProfiles.map(p => {
            const update = updates.find(u => u.id === p.id);
            if (update) {
              return {
                ...p,
                hasAppeared: update.hasAppeared,
                appearanceTime: update.appearanceTime,
                appearanceLocation: update.appearanceLocation,
                lastUpdated: Date.now()
              };
            }
            return p;
          });
          return { ...prev, npcProfiles: updatedProfiles, isLoading: false };
        });
        return updates.length;
      } else {
        setGameState(prev => ({ ...prev, isLoading: false }));
        return 0;
      }
    } catch (error) {
      console.error("Batch infer failed:", error);
      setGameState(prev => ({ ...prev, isLoading: false }));
      throw error;
    }
  };

  const handleFormatNPCRecords = async (npcId: string): Promise<void> => {
    const npc = gameState.npcProfiles.find(p => p.id === npcId);
    if (!npc || !npc.records || npc.records.length === 0) return;

    setGameState(prev => ({ ...prev, isLoading: true }));
    try {
      const { formatNPCRecords } = await import('./services/geminiService');
      const updatedRecords = await formatNPCRecords(npc.records, gameState.logs);
      
      console.log("Formatted records:", updatedRecords);

      setGameState(prev => {
        const updatedProfiles = prev.npcProfiles.map(p => {
          if (p.id === npcId) {
            return { ...p, records: updatedRecords, lastUpdated: Date.now() };
          }
          return p;
        });
        return { ...prev, npcProfiles: updatedProfiles, isLoading: false };
      });
    } catch (error) {
      console.error("Format records failed:", error);
      setGameState(prev => ({ ...prev, isLoading: false }));
      throw error;
    }
  };

  const handleUpdateLog = (updatedLog: LogSummary) => {
    setGameState(prev => ({
      ...prev,
      logs: safeArray(prev.logs).map(log => log.id === updatedLog.id ? updatedLog : log)
    }));
  };

  const handleUpdateMessage = (id: string, newContent: string) => {
    setGameState(prev => ({
      ...prev,
      history: prev.history.map(msg => 
        msg.id === id ? { ...msg, content: newContent } : msg
      )
    }));
  };

  const handleDeleteMessage = (id: string) => {
    // Avoid window.confirm as it might be blocked in iframe
    setGameState(prev => {
      const newHistory = prev.history.filter(msg => msg.id !== id);
      
      // If we deleted the message, let's try to restore the game state from the new last message
      // Note: Only restore if there's a valid snapshot to prevent accidental wiping
      const lastMsgWithSnapshot = [...newHistory].reverse().find(m => m.snapshot);
      
            let nextGaiaState = prev.gaiaState;
            
      if (lastMsgWithSnapshot && lastMsgWithSnapshot.snapshot) {
                nextGaiaState = lastMsgWithSnapshot.snapshot.gaiaState || prev.gaiaState;
              }
      
      return {
        ...prev,
        history: newHistory,
        
        gaiaState: nextGaiaState
        // Note: deliberately not rolling back NPC profiles/logs here to avoid deleting player progress, 
        // focus only on system state and war duration to heal timeline.
      };
    });
    setSelectedMessageIds(prev => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });
  };

  const handleToggleMessageSelection = (id: string) => {
    setSelectedMessageIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        const limit = isCompendiumSyncMode ? 20 : (isLogSyncMode ? 30 : 10);
        if (newSet.size >= limit) {
          return prev;
        }
        newSet.add(id);
      }
      return newSet;
    });
  };

  const handleDeducePlot = async () => {
    if (selectedMessageIds.size === 0 || gameState.isLoading || isSendingRef.current) return;
    isSendingRef.current = true;

    const selectedMessageIdsSet = new Set(selectedMessageIds);
    // Add the last message if it's a model message
    const lastMsg = gameState.history.length > 0 ? gameState.history[gameState.history.length - 1] : null;
    if (lastMsg && lastMsg.role === 'model') {
      selectedMessageIdsSet.add(lastMsg.id);
    }
    
    const selectedContent = gameState.history
      .filter(m => selectedMessageIdsSet.has(m.id))
      .map(m => `[${m.role === 'user' ? '玩家' : 'AI'}]: ${m.content}`)
      .join('\n\n');

        const prompt = generateDeductionPrompt(selectedContent, input, gameState.npcProfiles, gameState.difficulty, gameState.stageSettings, gameState.selectedStages, gameState.logs, gameState.gaiaState);

    const userMsg: Message = {
      id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
      role: 'user',
      content: `【系统指令：基于选定事件进行剧情推演】${input ? `\n玩家行动描述：${input}` : ''}`
    };

    const currentHistory = [...gameState.history, userMsg];

    setGameState(prev => ({
      ...prev,
      history: currentHistory,
      isLoading: true
    }));
    setInput('');

    const aiMsgId = (Date.now() + 1).toString() + Math.random().toString(36).substring(2, 9);
    setGameState(prev => ({
      ...prev,
      history: [...currentHistory, { id: aiMsgId, role: 'model', content: '', isStreaming: true }]
    }));

    try {
      const response = await executeAiCall(aiMsgId, () => sendMessage(prompt, (text) => {
        setGameState(prev => {
          const newHistory = [...prev.history];
          const lastMsg = newHistory.find(m => m.id === aiMsgId);
          if (lastMsg) {
            lastMsg.content = text;
          }
          return { ...prev, history: newHistory };
        });
      }, gameState.character?.setting, getUnlockedTrueNames(), currentHistory, "", gameState.stageSettings), (count) => `[剧情推演受阻 (429)，正在尝试第 ${count} 次自动重连中...]`);

      const newCharacter = extractCharacterUpdate(response.text, gameState.character);
            const newGaiaState = extractGaiaState(response.text, gameState.gaiaState);
            const npcUpdates = extractNPCUpdates(response.text);

      setGameState(prev => {
        const nextProfiles = applyNPCUpdates(prev.npcProfiles || [], npcUpdates, prev.logs);
        const newHistory = [...prev.history];
        const lastMsg = newHistory.find(m => m.id === aiMsgId);
        if (lastMsg) {
          lastMsg.content = response.text;
          lastMsg.groundingMetadata = response.groundingMetadata;
          lastMsg.isStreaming = false;
          lastMsg.snapshot = {
            
            gaiaState: newGaiaState,
            
            npcProfiles: nextProfiles
          };
        }
        return { ...prev, history: newHistory, character: newCharacter, isLoading: false,  gaiaState: newGaiaState,  npcProfiles: nextProfiles };
      });
    } catch (error: any) {
      console.error("Failed to deduce plot", error);
      setGameState(prev => ({ ...prev, isLoading: false }));
    } finally {
      isSendingRef.current = false;
    }
  };

  const handleResetOpening = async () => {
    if (gameState.isLoading || !gameState.character || isSendingRef.current) return;
    isSendingRef.current = true;
    
    // Reset history
    setGameState(prev => ({
      ...prev,
      history: [],
      isLoading: true
    }));
    setSelectedMessageIds(new Set());

    try {
      await initializeGame([], currentModel);
      
      const initialPrompt = generateInitialPrompt(
        gameState.character, 
        gameState.stageSettings, 
        gameState.difficulty, 
        gameState.selectedStages 
      );

      const msgId = Date.now().toString() + Math.random().toString(36).substring(2, 9);
      
      setGameState(prev => ({
        ...prev,
        history: [{ id: msgId, role: 'model', content: '', isStreaming: true }]
      }));

      const response = await executeAiCall(msgId, () => sendMessage(initialPrompt, (text) => {
        setGameState(prev => {
          const newHistory = [...prev.history];
          const lastMsg = newHistory.find(m => m.id === msgId);
          if (lastMsg) {
            lastMsg.content = text;
          }
          return { ...prev, history: newHistory };
        });
      }, gameState.character?.setting, getUnlockedTrueNames(), [], "", gameState.stageSettings), (count) => `[重置开场受阻 (429)，正在尝试第 ${count} 次自动重连中...]`);

      const newCharacter = extractCharacterUpdate(response.text, gameState.character);
            const newGaiaState = extractGaiaState(response.text, gameState.gaiaState);
            const npcUpdates = extractNPCUpdates(response.text);

      setGameState(prev => {
         const newHistory = [...prev.history];
         const lastMsg = newHistory.find(m => m.id === msgId);
         if(lastMsg) {
             lastMsg.content = response.text;
             lastMsg.groundingMetadata = response.groundingMetadata;
             lastMsg.isStreaming = false;
             lastMsg.snapshot = {
                
                gaiaState: newGaiaState,
                
                npcProfiles: applyNPCUpdates(prev.npcProfiles || [], npcUpdates, prev.logs)
             };
         }
         
         const nextProfiles = applyNPCUpdates(prev.npcProfiles || [], npcUpdates, prev.logs);
         
         return { ...prev, history: newHistory, character: newCharacter, isLoading: false,  gaiaState: newGaiaState,  npcProfiles: nextProfiles };
      });

    } catch (error: any) {
      console.error("Failed to reset game opening", error);
      const errorMessage = error?.message || "Unknown error";
      setGameState(prev => ({ 
        ...prev, 
        history: [{ 
          id: Date.now().toString() + Math.random().toString(36).substring(2, 9), 
          role: 'model', 
          content: `[重置开场失败。错误信息: ${errorMessage}。]`, 
          isStreaming: false 
        }],
        isLoading: false 
      }));
    } finally {
      isSendingRef.current = false;
    }
  };

  const handleCharacterComplete = (character: Character, stageSettings?: string) => {
    const defaultStages = getDefaultWorldBooks(character.setting);
    
    if (stageSettings) {
      handleStageSetupComplete(stageSettings, character, defaultStages);
    } else {
      setGameState(prev => ({ 
        ...prev, 
        status: GameStatus.STAGE_SETUP, 
        character,
        selectedStages: defaultStages,
        isLoading: false 
      }));
    }
  };

  const handleStageSetupComplete = async (settings: string, characterOverride?: Character, stagesOverride?: string[]) => {
    const character = characterOverride ?? gameState.character;
    if (!character) return;

    const selectedStages = stagesOverride ?? gameState.selectedStages ?? getDefaultWorldBooks(character.setting);

    setGameState(prev => {
      const newState: GameState = { 
        ...prev, 
        status: GameStatus.PLAYING, 
        character: character,
        stageSettings: settings,
        selectedStages: selectedStages,
        isLoading: true 
      };
      saveGame(character, [], [], settings, GameStatus.PLAYING, prev.difficulty, selectedStages, []);
      setSaveExists(true);
      return newState;
    });

    try {
      await initializeGame([], currentModel);
      
      const initialPrompt = generateInitialPrompt(
        character, 
        settings, 
        gameState.difficulty, 
        selectedStages, 
        settings
      );

      const msgId = Date.now().toString() + Math.random().toString(36).substring(2, 9);
      
      // Add placeholder message for loading state
      setGameState(prev => ({
        ...prev,
        history: [...safeArray(prev.history), { id: msgId, role: 'model', content: '', isStreaming: true }]
      }));

      const response = await executeAiCall(msgId, () => sendMessage(initialPrompt, (text) => {
        setGameState(prev => {
          const newHistory = [...prev.history];
          const lastMsg = newHistory.find(m => m.id === msgId);
          if (lastMsg) {
            lastMsg.content = text;
          }
          return { ...prev, history: newHistory };
        });
      }, character.setting, getUnlockedTrueNames(), [], "", settings), (count) => `[开局同步受阻 (429)，正在尝试第 ${count} 次自动重连中...]`);

            const newGaiaState = extractGaiaState(response.text, gameState.gaiaState);
            const npcUpdates = extractNPCUpdates(response.text);

      setGameState(prev => {
         const nextProfiles = applyNPCUpdates(prev.npcProfiles || [], npcUpdates, prev.logs);
         const newHistory = [...prev.history];
         const lastMsg = newHistory.find(m => m.id === msgId);
         if(lastMsg) {
             lastMsg.content = response.text;
             lastMsg.groundingMetadata = response.groundingMetadata;
             lastMsg.isStreaming = false;
             lastMsg.snapshot = {
                
                gaiaState: newGaiaState,
                
                npcProfiles: nextProfiles
             };
         }
         
         return { ...prev, history: newHistory, isLoading: false,  gaiaState: newGaiaState,  npcProfiles: nextProfiles };
      });

    } catch (error: any) {
      console.error("Failed to start game", error);
      const errorMsg = error?.message || "未知错误";
      setGameState(prev => ({ 
        ...prev, 
        isLoading: false,
        history: [...prev.history, { 
          id: Date.now().toString() + Math.random().toString(36).substring(2, 9), 
          role: 'model', 
          content: `\n[游戏启动失败。错误信息: ${errorMsg}。请尝试点击“重置开场”或返回主菜单。]` 
        }]
      }));
    }
  };

  const handleForceDeduce = async (settingsOverride?: string) => {
    const currentSettings = settingsOverride ?? gameState.stageSettings;
    if (gameState.isLoading || !currentSettings) return;

        const prompt = generateForceDeducePrompt(currentSettings, input, gameState.npcProfiles, gameState.difficulty, gameState.selectedStages, gameState.logs, gameState.gaiaState);

    const userMsg: Message = {
      id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
      role: 'user',
      content: `【系统指令：基于更新后的舞台设定进行强制推演】${input ? `\n玩家额外行动：${input}` : ''}`
    };

    setGameState(prev => ({
      ...prev,
      history: [...prev.history, userMsg],
      isLoading: true
    }));
    setInput('');

    const aiMsgId = (Date.now() + 1).toString() + Math.random().toString(36).substring(2, 9);
    setGameState(prev => ({
      ...prev,
      history: [...prev.history, { id: aiMsgId, role: 'model', content: '', isStreaming: true }]
    }));

    try {
      const response = await executeAiCall(aiMsgId, () => sendMessage(prompt, (text) => {
        setGameState(prev => {
          const newHistory = [...prev.history];
          const lastMsg = newHistory.find(m => m.id === aiMsgId);
          if (lastMsg) {
            lastMsg.content = text;
          }
          return { ...prev, history: newHistory };
        });
      }, gameState.character?.setting, getUnlockedTrueNames(), gameState.history, "", currentSettings), (count) => `[强制演化受阻 (429)，正在尝试第 ${count} 次自动重连中...]`);

            const newGaiaState = extractGaiaState(response.text, gameState.gaiaState);
            const npcUpdates = extractNPCUpdates(response.text);

      setGameState(prev => {
         const nextProfiles = applyNPCUpdates(prev.npcProfiles || [], npcUpdates, prev.logs);
         const newHistory = [...prev.history];
         const lastMsg = newHistory.find(m => m.id === aiMsgId);
         if(lastMsg) {
             lastMsg.content = response.text;
             lastMsg.groundingMetadata = response.groundingMetadata;
             lastMsg.isStreaming = false;
             lastMsg.snapshot = {
               
               gaiaState: newGaiaState,
               
               npcProfiles: nextProfiles
             };
         }
         return { ...prev, history: newHistory, isLoading: false,  gaiaState: newGaiaState,  npcProfiles: nextProfiles };
      });
      
    } catch (error) {
      console.error("Force deduction failed", error);
      setGameState(prev => ({ ...prev, isLoading: false }));
    }
  };

  const handleUpdateCharacter = (updatedCharacter: Character) => {
    setGameState(prev => ({
      ...prev,
      character: updatedCharacter
    }));
  };

  const getUnlockedTrueNames = (): string[] => {
    const names: string[] = [];
    if (gameState.npcProfiles && Array.isArray(gameState.npcProfiles)) {
      gameState.npcProfiles.forEach(npc => {
        if (!npc.isTrueNameUnlocked) return;
        names.push(npc.name);
      });
    }
    return names;
  };

  const handleSendMessage = async () => {
    console.log("handleSendMessage triggered. Input:", input, "isLoading:", gameState.isLoading, "isSendingRef:", isSendingRef.current);
    
    if (!input.trim()) {
      console.log("handleSendMessage aborted: Input is empty.");
      return;
    }
    if (gameState.isLoading) {
      console.log("handleSendMessage aborted: Game is loading.");
      return;
    }
    if (isSendingRef.current) {
      console.log("handleSendMessage aborted: Already sending.");
      return;
    }

    isSendingRef.current = true;
    console.log("handleSendMessage proceeding. isSendingRef set to true.");
    let aiMsgId = "";
    try {
      let messageToSend = input;
      if (gameState.character) {
                  const statusPrompt = generateStatusPrompt(gameState.character, gameState.stageSettings, gameState.npcProfiles, gameState.difficulty, gameState.selectedStages, gameState.logs, gameState.gaiaState);
         messageToSend = `${statusPrompt}\n\n${input}`;
      }

      const userMsg: Message = {
        id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
        role: 'user',
        content: input
      };

      const currentHistory = [...gameState.history, userMsg];

      setGameState(prev => ({
        ...prev,
        history: currentHistory,
        isLoading: true
      }));
      setInput('');

      aiMsgId = (Date.now() + 1).toString() + Math.random().toString(36).substring(2, 9);
      setGameState(prev => ({
        ...prev,
        history: [...currentHistory, { id: aiMsgId, role: 'model', content: '', isStreaming: true }]
      }));

      const baselineDate = getLatestDateFromHistory([...gameState.history, userMsg]) || "";

      let lastUpdateTime = Date.now();
      const response = await executeAiCall(aiMsgId, () => sendMessage(messageToSend, (text) => {
        const now = Date.now();
        if (now - lastUpdateTime > 100) {
          setGameState(prev => {
            const newHistory = [...prev.history];
            const lastMsg = newHistory.find(m => m.id === aiMsgId);
            if (lastMsg) {
              lastMsg.content = text;
            }
            return { ...prev, history: newHistory };
          });
          lastUpdateTime = now;
        }
      }, gameState.character?.setting, getUnlockedTrueNames(), gameState.history, baselineDate, gameState.stageSettings, currentModel), (count) => `[与根源的连接拥堵 (429)，正在尝试第 ${count} 次自动重连中...]`);

      const newCharacter = extractCharacterUpdate(response.text, gameState.character);
            const newGaiaState = extractGaiaState(response.text, gameState.gaiaState);
            const npcUpdates = extractNPCUpdates(response.text);
      
      setGameState(prev => {
        const nextProfiles = applyNPCUpdates(prev.npcProfiles || [], npcUpdates, prev.logs);
        const newHistory = [...prev.history];
        const lastMsg = newHistory.find(m => m.id === aiMsgId);
        if(lastMsg) {
            lastMsg.content = response.text; // Retain raw text in history for AI context
            lastMsg.groundingMetadata = response.groundingMetadata;
            lastMsg.isStreaming = false;
            lastMsg.snapshot = {
                
                gaiaState: newGaiaState,
                
                npcProfiles: nextProfiles
            };
        }
        
        return { ...prev, history: newHistory, character: newCharacter, isLoading: false,  gaiaState: newGaiaState,  npcProfiles: nextProfiles };
      });
    } catch (error: any) {
      console.error("Failed to send message", error);
      const errorMessage = error?.message || "Unknown error";
      if (aiMsgId) {
        try {
          setGameState(prev => {
            const newHistory = [...prev.history];
            const lastMsg = newHistory.find(m => m.id === aiMsgId);
            if (lastMsg) {
              lastMsg.content = `[与根源的连接中断了。错误信息: ${errorMessage}。请尝试点击“重新生成”或检查网络连接。]`;
              lastMsg.isStreaming = false;
            }
            return { ...prev, history: newHistory, isLoading: false };
          });
        } catch (stateError) {
          console.error("Failed to update state after error", stateError);
        }
      }
    } finally {
      isSendingRef.current = false;
    }
  };

  const handleRegenerate = async () => {
    if (gameState.isLoading || gameState.history.length === 0 || isSendingRef.current) return;
    isSendingRef.current = true;

    const history = [...gameState.history];
    let lastUserIdx = -1;
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i].role === 'user') {
        lastUserIdx = i;
        break;
      }
    }

    if (lastUserIdx === -1) return; 

    const lastUserMsg = history[lastUserIdx];
    const contextHistory = history.slice(0, lastUserIdx);

    const restoredNpcProfiles = lastUserMsg.snapshot?.npcProfiles || gameState.npcProfiles;
        const restoredLogs = lastUserMsg.snapshot?.logs || gameState.logs;
    const restoredGaiaState = lastUserMsg.snapshot?.gaiaState || gameState.gaiaState;
    
    setGameState(prev => ({
      ...prev,
      
      npcProfiles: restoredNpcProfiles,
      logs: restoredLogs,
      gaiaState: restoredGaiaState,
      
      history: history.slice(0, lastUserIdx + 1),
      isLoading: true
    }));

    let aiMsgId = "";
    try {
      await initializeGame(contextHistory, currentModel, "");

      aiMsgId = Date.now().toString() + Math.random().toString(36).substring(2, 9);
      setGameState(prev => ({
        ...prev,
        history: [...prev.history, { id: aiMsgId, role: 'model', content: '', isStreaming: true }]
      }));

      let messageToSend = lastUserMsg.content;
      if (gameState.character) {
        const statusPrompt = generateStatusPrompt(gameState.character, gameState.stageSettings, restoredNpcProfiles, gameState.difficulty, gameState.selectedStages, restoredLogs, restoredGaiaState);
        messageToSend = `${statusPrompt}\n\n${lastUserMsg.content}`;
      }

      const baselineDate = getLatestDateFromHistory(history.slice(0, lastUserIdx + 1)) || "";

      let lastUpdateTime = Date.now();
      const response = await executeAiCall(aiMsgId, () => sendMessage(messageToSend, (text) => {
        const now = Date.now();
        if (now - lastUpdateTime > 100) {
          setGameState(prev => {
            const newHistory = [...prev.history];
            const lastMsg = newHistory.find(m => m.id === aiMsgId);
            if (lastMsg) {
              lastMsg.content = text;
            }
            return { ...prev, history: newHistory };
          });
          lastUpdateTime = now;
        }
      }, gameState.character?.setting, getUnlockedTrueNames(), contextHistory, baselineDate, gameState.stageSettings), (count) => `[重新生成受阻 (429)，正在尝试第 ${count} 次自动重拨...]`);

      const newCharacter = extractCharacterUpdate(response.text, gameState.character);
            const newGaiaState = extractGaiaState(response.text, gameState.gaiaState);
            const npcUpdates = extractNPCUpdates(response.text);
      
      setGameState(prev => {
          const nextProfiles = applyNPCUpdates(prev.npcProfiles || [], npcUpdates, prev.logs);
          const newHistory = [...prev.history];
          const lastMsg = newHistory.find(m => m.id === aiMsgId);
          if (lastMsg) {
             lastMsg.content = response.text; // Retain raw text in history for AI context
             lastMsg.groundingMetadata = response.groundingMetadata;
             lastMsg.isStreaming = false;
             lastMsg.snapshot = {
                
                gaiaState: newGaiaState,
                
                npcProfiles: nextProfiles
             };
          }
          
          return { ...prev, history: newHistory, character: newCharacter, isLoading: false,  gaiaState: newGaiaState,  npcProfiles: nextProfiles };
        });

    } catch (error: any) {
      console.error("Regeneration failed", error);
      const errorMessage = error?.message || "Unknown error";
      if (aiMsgId) {
        try {
          setGameState(prev => {
            const newHistory = [...prev.history];
            const lastMsg = newHistory.find(m => m.id === aiMsgId);
            if (lastMsg) {
              lastMsg.content = `[重新生成失败。错误信息: ${errorMessage}。]`;
              lastMsg.isStreaming = false;
            }
            return { ...prev, history: newHistory };
          });
        } catch (stateError) {
          console.error("Failed to update state after regeneration error", stateError);
        }
      }
    } finally {
      isSendingRef.current = false;
      setGameState(prev => ({ ...prev, isLoading: false }));
    }
  };

  const handleApplyCloudSave = () => {
    if (!pendingCloudSave) return;
    
    setGameState(prev => {
      const data = pendingCloudSave;
      const localData = loadGame();
      const persistentState: any = {
        status: data.status || prev.status,
        character: data.character || prev.character,
        npcProfiles: data.npcProfiles || prev.npcProfiles,
        stageSettings: data.stageSettings || localData?.stageSettings || prev.stageSettings,
        selectedStages: data.selectedStages || localData?.selectedStages || prev.selectedStages,
        difficulty: data.difficulty || prev.difficulty,
                gaiaState: data.gaiaState || prev.gaiaState,
        logs: data.logs || prev.logs || []
      };

      if (data.history && data.history.length > 0) {
        persistentState.history = data.history;
      } else if (localData && localData.history && localData.history.length > 0) {
        persistentState.history = localData.history;
      }

      return { ...prev, ...persistentState };
    });
    
    setPendingCloudSave(null);
    setRestoredNotification(true);
    setTimeout(() => setRestoredNotification(false), 3000);
  };

  const handleDeleteSaveClick = () => {
    setShowDeleteSaveConfirm(true);
  };

  const handleConfirmDeleteSave = async () => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    if (localSaveTimeoutRef.current) clearTimeout(localSaveTimeoutRef.current);

    if (!db || !user) return;
    if (isFirestoreQuotaBlocked()) {
      clearSave();
      setSaveExists(false);
      // ... continue with local cleanup
    } else {
      try {
        const gameDocRef = doc(db, 'games', user.uid);
        await deleteDoc(gameDocRef);
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `games/${user.uid}`);
      }
    }
    
    clearSave();
    setSaveExists(false);

      setGameState(prev => ({
        ...prev,
        history: [],
        npcProfiles: [],
        logs: [],
        
        systemState: undefined,
        gaiaState: undefined,
        stageSettings: undefined,
        status: GameStatus.START_MENU,
        character: null
      }));
      
      setShowDeleteSaveConfirm(false);
      console.log(`Deleted save for user: ${user.uid}`);
  };

  const cancelDeleteSave = () => {
    setShowDeleteSaveConfirm(false);
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setGameState(prev => ({
        ...prev,
        status: GameStatus.START_MENU,
        character: null,
        history: [],
        npcProfiles: [],
        logs: [],
        
        systemState: undefined,
        gaiaState: undefined,
        stageSettings: undefined
      }));
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const getTheme = () => {
    if (!gameState.character) return 'bg-black'; 
    
    const s = gameState.character;
    return THEME_COLORS[s.troopType]?.bg || 'bg-slate-900';
  };

  return (
    <div className={`min-h-screen flex flex-col transition-colors duration-1000 ${getTheme()} text-slate-200 font-serif`}>
      
      {!isAuthReady ? (
        <div className="min-h-screen bg-black flex items-center justify-center">
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="w-12 h-12 border-4 border-red-900/20 border-t-red-600 rounded-full shadow-[0_0_20px_rgba(220,38,38,0.3)]"
          />
        </div>
      ) : !user ? (
        <div className="min-h-screen bg-black flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-slate-900 border border-red-900/30 p-10 rounded-3xl max-w-md w-full text-center space-y-10 shadow-2xl relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-b from-red-600/5 to-transparent pointer-events-none" />
            <div className="w-24 h-24 bg-red-900/20 rounded-full flex items-center justify-center mx-auto border border-red-900/50 shadow-[0_0_40px_rgba(153,27,27,0.3)] relative">
              <Sparkles className="text-red-500 w-12 h-12" />
              <div className="absolute inset-0 rounded-full animate-pulse bg-red-500/10" />
            </div>
            <div className="space-y-3">
              <h1 className="text-4xl font-display text-red-100 tracking-wider uppercase italic glow-sm">汉末群雄传</h1>
              <p className="text-red-500/60 text-xs uppercase tracking-[0.3em] font-bold">史实 AI 推演系统</p>
            </div>
            <p className="text-slate-400 text-sm leading-relaxed italic">
              “夫英雄者，胸怀大志，腹有良谋，有包藏宇宙之机，吞吐天地之志者也。”
            </p>
            <button 
              onClick={signInWithGoogle}
              className="w-full bg-red-900 hover:bg-red-800 text-white py-4 rounded-xl flex items-center justify-center gap-3 transition-all font-display tracking-widest uppercase border border-red-700 shadow-lg active:scale-95 group"
            >
              <LogIn size={20} className="group-hover:translate-x-1 transition-transform" />
              建立灵魂链接 (Sign In)
            </button>
            <p className="text-[10px] text-slate-600 uppercase tracking-widest">
              Powered by Gemini 3.1 & Firebase
            </p>
          </motion.div>
        </div>
      ) : (
        <>
          <Header 
            character={gameState.character}
            user={user}
            difficulty={gameState.difficulty}
            onOpenCharacterSheet={() => setGameState(prev => ({ ...prev, isCharacterSheetOpen: true }))}
            onOpenCompendium={() => setGameState(prev => ({ ...prev, isCompendiumOpen: true }))}
            onOpenLogModal={handleOpenLogModal}
            onOpenWorldBook={() => setIsWorldBookOpen(true)}
            onExport={handleExport}
            onOpenGameMenu={gameState.status === GameStatus.PLAYING ? () => setIsGameMenuOpen(true) : undefined}
            onLogout={handleLogout}
            isEditMode={isEditMode}
            onToggleEditMode={() => setIsEditMode(!isEditMode)}
            isSyncMode={isSyncMode}
            onToggleSyncMode={handleToggleSyncMode}
            isCloudSyncEnabled={isCloudSyncEnabled}
            onToggleCloudSync={() => {
              const newValue = !isCloudSyncEnabled;
              setIsCloudSyncEnabled(newValue);
              localStorage.setItem('isCloudSyncEnabled', String(newValue));
            }}
          />

          {isFirestoreQuotaBlocked() && (
            <div className="bg-red-950/60 border-b border-red-500/30 p-2 flex items-center justify-center px-6 backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <AlertCircle size={16} className="text-red-500" />
                <span className="text-[10px] text-red-200 uppercase tracking-widest font-bold">
                  云端同步配额已耗尽 (Cloud Sync Quota Exceeded) - 24小时内将仅使用本地保存
                </span>
              </div>
            </div>
          )}

          {isCloudSyncEnabled && pendingCloudSave && (
            <div className="bg-amber-900/40 border-b border-amber-500/30 p-2 flex items-center justify-between px-6 backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <Sparkles size={16} className="text-amber-400 animate-pulse" />
                <span className="text-xs text-amber-200 uppercase tracking-widest font-bold">
                  检测到云端存档 (Cloud Save Found)
                </span>
              </div>
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => setPendingCloudSave(null)}
                  className="text-[10px] text-neutral-500 hover:text-neutral-300 uppercase tracking-widest transition-colors"
                >
                  忽略 (Ignore)
                </button>
                <button 
                  onClick={handleApplyCloudSave}
                  className="bg-amber-600 hover:bg-amber-500 text-white text-[10px] px-3 py-1 rounded-full uppercase tracking-widest font-bold transition-all active:scale-95"
                >
                  同步 (Sync)
                </button>
              </div>
            </div>
          )}

          {/* CONTENT AREA */}
          <main className="flex-1 flex flex-col relative max-w-7xl mx-auto w-full">
        
        {/* START SCREEN */}
        {gameState.status === GameStatus.START_MENU && (
          <StartScreen 
            saveExists={saveExists}
            savedDifficulty={savedDifficulty}
            onContinue={handleContinueGame}
            onNewGame={handleStartNewGame}
            onImport={handleImportGame}
            onDeleteSave={handleDeleteSaveClick}
            isCloudSyncEnabled={isCloudSyncEnabled}
            onToggleCloudSync={() => {
              const newValue = !isCloudSyncEnabled;
              setIsCloudSyncEnabled(newValue);
              localStorage.setItem('isCloudSyncEnabled', String(newValue));
            }}
            isAuthReady={isAuthReady}
          />
        )}

        {/* DELETE SAVE CONFIRMATION MODAL */}
        {showDeleteSaveConfirm && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/80 backdrop-blur-md" onClick={cancelDeleteSave} />
            <div className="relative w-full max-w-md bg-slate-900 border border-red-900/50 rounded-lg shadow-2xl p-8 flex flex-col items-center text-center space-y-6 animate-in fade-in zoom-in duration-300">
              <div className="w-20 h-20 rounded-full bg-red-900/20 flex items-center justify-center border border-red-900/50 shadow-[0_0_20px_rgba(153,27,27,0.3)]">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10 text-red-500">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                </svg>
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-display text-red-100 tracking-wider uppercase">删除存档？</h3>
                <p className="text-slate-400 leading-relaxed">确定要删除当前存档吗？<br/><span className="text-red-400/80">这将永久删除您的云端和本地存档，且无法恢复。</span></p>
              </div>
              <div className="flex flex-col w-full gap-3 pt-4">
                <Button 
                  onClick={() => handleConfirmDeleteSave()}
                  variant="primary"
                  className="bg-red-900 hover:bg-red-800 border-red-700 text-white py-4 text-lg"
                >
                  确认删除
                </Button>
                <Button 
                  onClick={cancelDeleteSave}
                  variant="ghost"
                  className="text-slate-400 hover:text-slate-200 py-3"
                >
                  取消
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* NEW GAME CONFIRMATION MODAL */}
        {showNewGameConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/80 backdrop-blur-md" onClick={cancelStartNewGame} />
            <div className="relative w-full max-w-md bg-slate-900 border border-red-900/50 rounded-lg shadow-2xl p-8 flex flex-col items-center text-center space-y-6 animate-in fade-in zoom-in duration-300">
              <div className="w-20 h-20 rounded-full bg-red-900/20 flex items-center justify-center border border-red-900/50 shadow-[0_0_20px_rgba(153,27,27,0.3)]">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10 text-red-500">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                </svg>
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-display text-red-100 tracking-wider uppercase">开始新的故事？</h3>
                <p className="text-slate-400 leading-relaxed">确定要开始新的故事吗？<br/><span className="text-red-400/80">当前的存档进度将会被永久覆盖。</span></p>
              </div>
              <div className="flex flex-col w-full gap-3 pt-4">
                <Button 
                  onClick={() => confirmStartNewGame()}
                  variant="primary"
                  className="bg-red-900 hover:bg-red-800 border-red-700 text-white py-4 text-lg"
                >
                  确认
                </Button>
                <Button 
                  onClick={cancelStartNewGame}
                  variant="ghost"
                  className="text-slate-400 hover:text-slate-200 py-3"
                >
                  取消
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* CREATION SCREEN */}
        {gameState.status === GameStatus.CREATION && (
          <div className="flex-1 flex items-center justify-center p-4 overflow-y-auto">
            <CharacterCreation onComplete={handleCharacterComplete} />
          </div>
        )}

        {/* STAGE SETUP SCREEN */}
        {gameState.status === GameStatus.STAGE_SETUP && gameState.character && (
          <div className="flex-1 flex items-center justify-center p-4 overflow-y-auto">
            <StageSetup 
              character={gameState.character} 
              onComplete={(settings) => handleStageSetupComplete(settings)} 
            />
          </div>
        )}

        {/* GAME PLAY SCREEN */}
        {gameState.status === GameStatus.PLAYING && gameState.character && (
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            
            <GameMenu 
              isOpen={isGameMenuOpen}
              onClose={() => setIsGameMenuOpen(false)}
              initialSettings={gameState.stageSettings || ''}
              onSettingsChange={(newSettings) => setGameState(prev => ({ ...prev, stageSettings: newSettings }))}
              onForceDeduce={handleForceDeduce}
              onExit={handleReturnToStart}
              
              onArchitectureChange={(arch) => setGameState(prev => ({ 
                ...prev, 
                 
              }))}
            />

            {/* Tabs */}
            <div className="flex gap-8 border-b border-white/10 px-8 pt-6 bg-black/40 backdrop-blur-md">
              <button 
                onClick={() => setActiveTab('chat')}
                className={`text-sm font-bold transition-all flex items-center gap-3 pb-4 relative group ${
                  activeTab === 'chat' ? 'text-amber-500' : 'text-neutral-500 hover:text-neutral-300'
                }`}
              >
                <div className={`p-1.5 rounded-lg transition-colors ${activeTab === 'chat' ? 'bg-amber-500/20' : 'bg-white/5 group-hover:bg-white/10'}`}>
                  <MessageSquare size={18} />
                </div>
                <span className="tracking-widest uppercase text-xs">局势对话 (Chat)</span>
                {activeTab === 'chat' && (
                  <motion.div 
                    layoutId="activeTab" 
                    className="absolute bottom-0 left-0 right-0 h-1 bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]" 
                  />
                )}
              </button>
              <button 
                onClick={() => setActiveTab('history')}
                className={`text-sm font-bold transition-all flex items-center gap-3 pb-4 relative group ${
                  activeTab === 'history' ? 'text-amber-500' : 'text-neutral-500 hover:text-neutral-300'
                }`}
              >
                <div className={`p-1.5 rounded-lg transition-colors ${activeTab === 'history' ? 'bg-amber-500/20' : 'bg-white/5 group-hover:bg-white/10'}`}>
                  <History size={18} />
                </div>
                <span className="tracking-widest uppercase text-xs">历程纪实 (War)</span>
                {activeTab === 'history' && (
                  <motion.div 
                    layoutId="activeTab" 
                    className="absolute bottom-0 left-0 right-0 h-1 bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]" 
                  />
                )}
              </button>
            </div>

            <div className="flex-1 flex flex-col overflow-hidden relative">
              {activeTab === 'chat' ? (
                <StoryDisplay 
                  messages={gameState.history} 
                  character={gameState.character} 
                  isTyping={gameState.isLoading}
                  onUpdateMessage={handleUpdateMessage}
                  onDeleteMessage={handleDeleteMessage}
                  selectedMessageIds={selectedMessageIds}
                  onToggleMessageSelection={handleToggleMessageSelection}
                  isEditMode={isEditMode}
                  isSyncMode={isSyncMode || isCompendiumSyncMode || isLogSyncMode}
                  
                />
              ) : (
                <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar bg-neutral-950/50">


                  <section className="space-y-4">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <Users className="text-amber-500" size={20} />
                      登场人物 (NPCs)
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {gameState.npcProfiles?.map(npc => (
                        <div key={npc.id} className="bg-neutral-900/50 border border-white/5 p-4 rounded-2xl space-y-2">
                          <div className="flex justify-between items-start">
                            <h4 className="font-bold text-amber-500">{npc.name}</h4>
                          </div>
                          <p className="text-sm text-neutral-300 leading-relaxed">{npc.userNotes || npc.aiGeneratedRecord}</p>
                          <div className="flex flex-wrap gap-2 pt-2">
                            {npc.tags?.map(tag => (
                              <span key={tag} className="text-[10px] bg-white/5 px-2 py-0.5 rounded text-neutral-400">#{tag}</span>
                            ))}
                          </div>
                        </div>
                      ))}
                      {gameState.npcProfiles.length === 0 && (
                        <p className="text-neutral-500 text-sm italic">暂无记录的人物...</p>
                      )}
                    </div>
                  </section>

                  <section className="space-y-4">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <History className="text-amber-500" size={20} />
                      历史事件 (Chronicle)
                    </h3>
                    <div className="space-y-4">
                      {gameState.history.filter(m => m.role === 'model').slice(-10).map((m, i) => (
                        <div key={i} className="relative pl-6 border-l border-white/10">
                          <div className="absolute left-[-5px] top-2 w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]" />
                          <p className="text-sm text-neutral-400 line-clamp-2 italic">"{m.content.substring(0, 150)}..."</p>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>
              )}
            </div>

            {/* Auto-restored notification */}
            {restoredNotification && (
              <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-amber-900/90 border border-amber-500/50 p-3 rounded-sm shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4 backdrop-blur-md">
                <div className="text-amber-200 font-display text-xs uppercase tracking-widest">
                  检测到未完成的志业，已自动恢复 (Session Restored)
                </div>
                <button onClick={() => setRestoredNotification(false)} className="text-amber-500 hover:text-white">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}

            {/* API Key Warning */}
            {apiKeyWarning && (
              <div className="fixed top-32 left-1/2 -translate-x-1/2 z-50 bg-red-900/90 border border-red-500/50 p-3 rounded-sm shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4 backdrop-blur-md">
                <div className="text-red-200 font-display text-xs uppercase tracking-widest">
                  警告：未检测到 API Key。请在设置中配置 GEMINI_API_KEY。
                </div>
                <button onClick={() => setApiKeyWarning(false)} className="text-red-500 hover:text-white">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}

            {/* Compendium Sync Confirmation Bar */}
            {isCompendiumSyncMode && (
              <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-slate-900/90 border border-cyan-500/50 p-4 rounded-lg shadow-2xl flex items-center gap-4 animate-in slide-in-from-bottom-4 backdrop-blur-md">
                <div className="text-cyan-400 font-display text-sm">
                  已选择 {selectedMessageIds.size} 条记录用于同步 NPC 信息
                </div>
                <Button onClick={handleConfirmCompendiumSync} className="bg-cyan-700 hover:bg-cyan-600 text-white text-xs">
                  确认同步 (Confirm)
                </Button>
                <Button onClick={handleCancelCompendiumSync} variant="ghost" className="text-slate-400 hover:text-white text-xs">
                  取消 (Cancel)
                </Button>
              </div>
            )}

            {/* Log Sync Confirmation Bar */}
            {isLogSyncMode && (
              <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-slate-900/90 border border-emerald-500/50 p-4 rounded-lg shadow-2xl flex items-center gap-4 animate-in slide-in-from-bottom-4 backdrop-blur-md">
                <div className="text-emerald-400 font-display text-sm">
                  已选择 {selectedMessageIds.size} 条记录用于生成日志
                </div>
                <Button 
                  onClick={handleConfirmLogSync} 
                  disabled={gameState.isLoading}
                  className="bg-emerald-700 hover:bg-emerald-600 text-white text-xs disabled:opacity-50"
                >
                  {gameState.isLoading ? '生成中...' : '生成日志 (Generate Log)'}
                </Button>
                <Button onClick={handleCancelLogSync} variant="ghost" className="text-slate-400 hover:text-white text-xs">
                  取消 (Cancel)
                </Button>
              </div>
            )}

            <InputArea 
              input={input}
              setInput={setInput}
              isLoading={gameState.isLoading}
              currentModel={currentModel}
              customModelName={customModelName}
              onModelChange={handleModelChange}
              onOpenApiSettings={() => setIsApiSettingsOpen(true)}
              onSendMessage={handleSendMessage}
              onRegenerate={handleRegenerate}
              onResetOpening={handleResetOpening}
              onDeduce={handleDeducePlot}
              selectedMessageCount={selectedMessageIds.size}
              showRegenerate={gameState.history.some(m => m.role === 'user')}
              showResetOpening={gameState.history.length <= 2}
            />
          </div>
        )}
      </main>

      <ApiSettingsModal 
        isOpen={isApiSettingsOpen} 
        onClose={() => setIsApiSettingsOpen(false)} 
        onSave={(model) => {
          setCustomModelName(localStorage.getItem('thirdPartyModelName') || '');
          handleModelChange(model);
        }} 
      />

      {/* Character Sheet Modal */}
      {gameState.isCharacterSheetOpen && gameState.character && (
        <CharacterSheet 
          character={gameState.character}
          npcProfiles={gameState.npcProfiles || []}
          onClose={() => setGameState(prev => ({ ...prev, isCharacterSheetOpen: false }))} 
          onUpdate={handleUpdateCharacter}
        />
      )}

      {/* Character Compendium Modal */}
      {gameState.isCompendiumOpen && (
        <CharacterCompendium
          profiles={gameState.npcProfiles || []}
          onClose={() => setGameState(prev => ({ ...prev, isCompendiumOpen: false }))}
          onAddNPC={handleAddNPC}
          onUpdateNPC={handleUpdateNPC}
          onSyncNPC={handleSyncNPC}
          onDeleteNPC={(id) => handleDeleteNPC(id)}
          onMergeNPCs={handleMergeNPCs}
          onMoveNPC={handleMoveNPC}
          onBatchInferAppearances={handleBatchInferAppearances}
          onFormatRecords={handleFormatNPCRecords}
        />
      )}

      {/* World Book Manager Modal */}
      {gameState.isLogModalOpen && (
        <LogModal
          logs={gameState.logs || []}
          npcProfiles={gameState.npcProfiles || []}
          onClose={() => setGameState(prev => ({ ...prev, isLogModalOpen: false }))}
          onSyncLog={handleSyncLog}
          onSyncNPC={handleSyncNPC}
          onUpdateLog={(updatedLog) => {
            setGameState(prev => ({
              ...prev,
              logs: safeArray(prev.logs).map(l => l.id === updatedLog.id ? updatedLog : l)
            }));
          }}
          onDeleteLog={(logId) => {
            setGameState(prev => ({
              ...prev,
              logs: safeArray(prev.logs).filter(l => l.id !== logId)
            }));
          }}
        />
      )}

      {isWorldBookOpen && (
        <WorldBookManager
          isOpen={isWorldBookOpen}
          onClose={() => setIsWorldBookOpen(false)}
          selectedStages={gameState.selectedStages || []}
          onToggleStage={toggleStage}
        />
      )}

      {/* Conflict Resolution UI - Removed from UI */}
      {false && pendingCloudSave && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] backdrop-blur-sm">
          <div className="bg-white p-8 rounded-2xl shadow-2xl max-w-md w-full mx-4 animate-in zoom-in-95 duration-200">
            <h2 className="text-2xl font-display text-slate-900 mb-2">检测到存档冲突</h2>
            <p className="text-slate-500 text-sm mb-8 leading-relaxed">
              发现云端存档与本地存档不一致。这通常是因为您在其他设备上进行了游戏。请选择保留哪一份：
            </p>
            <div className="grid grid-cols-2 gap-4">
              <Button 
                onClick={() => setPendingCloudSave(null)} 
                className="py-6 bg-orange-600 hover:bg-orange-500 text-white border-none shadow-lg shadow-orange-900/20"
              >
                保留本地存档
              </Button>
              <Button 
                onClick={() => {
                  if (pendingCloudSave) {
                    // Preserve local history if cloud save doesn't have it (due to 1MB limit mitigation)
                    const localData = loadGame();
                    const historyToRestore = (pendingCloudSave.history && pendingCloudSave.history.length > 0) 
                      ? pendingCloudSave.history 
                      : (localData?.history || gameState.history);
                      
                    restoreGameSession(pendingCloudSave.character!, historyToRestore, pendingCloudSave.npcProfiles || [], pendingCloudSave.stageSettings, pendingCloudSave.status, pendingCloudSave.difficulty, pendingCloudSave.selectedStages, pendingCloudSave.logs || [], pendingCloudSave. pendingCloudSave.gaiaState);
                    setPendingCloudSave(null);
                  }
                }} 
                className="py-6 bg-indigo-600 hover:bg-indigo-500 text-white border-none shadow-lg shadow-indigo-900/20"
              >
                使用云端存档
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )}
</div>
  );
};

export default () => (
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
