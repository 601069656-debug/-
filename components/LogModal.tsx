import React, { useState, useRef, useEffect } from 'react';
import { LogSummary, NPCProfile } from '../types';
import { X, Plus, Trash2 } from 'lucide-react';
import { Button } from './Button';

interface LogModalProps {
  logs: LogSummary[];
  npcProfiles: NPCProfile[];
  onClose: () => void;
  onSyncLog: () => void;
  onSyncNPC: (npcId: string) => void;
  onDeleteLog: (logId: string) => void;
  onUpdateLog: (updatedLog: LogSummary) => void;
}

export const LogModal: React.FC<LogModalProps> = ({ logs, npcProfiles, onClose, onSyncLog, onSyncNPC, onDeleteLog, onUpdateLog }) => {
  const [selectedLogId, setSelectedLogId] = useState<string | null>(logs.length > 0 ? logs[0].id : null);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [editingEvent, setEditingEvent] = useState<{ dayIndex: number, eventIndex: number } | null>(null);
  const [editingLog, setEditingLog] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const [editedDescription, setEditedDescription] = useState('');
  const [editedLogTitle, setEditedLogTitle] = useState('');
  const [editedLogDate, setEditedLogDate] = useState('');

  const logContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logs.length > 0 && !selectedLogId && !selectedProfileId && window.innerWidth >= 640) {
      setSelectedLogId(logs[0].id);
    }
  }, [logs, selectedLogId, selectedProfileId]);

  const selectedLog = logs.find(l => l.id === selectedLogId);
  const selectedProfile = npcProfiles.find(p => p.id === selectedProfileId);
  
  const mandateOfHeaven = npcProfiles.find(p => p.id === 'historical-system');

  const handleEdit = (dayIndex: number, eventIndex: number) => {
    if (!selectedLog) return;
    setEditingEvent({ dayIndex, eventIndex });
    setEditedTitle(selectedLog.days[dayIndex].events[eventIndex].title);
    setEditedDescription(selectedLog.days[dayIndex].events[eventIndex].description);
  };

  const handsetSelectedLog = (id: string | null) => {
    setSelectedLogId(id);
    setSelectedProfileId(null);
  };

  const handsetSelectedProfile = (id: string | null) => {
    setSelectedProfileId(id);
    setSelectedLogId(null);
  };

  const handleSave = () => {
    if (!selectedLog || !editingEvent) return;
    
    const updatedLog = {
      ...selectedLog,
      days: selectedLog.days.map((day, dIdx) => {
        if (dIdx !== editingEvent.dayIndex) return day;
        return {
          ...day,
          events: day.events.map((event, eIdx) => {
            if (eIdx !== editingEvent.eventIndex) return event;
            return {
              ...event,
              title: editedTitle,
              description: editedDescription
            };
          })
        };
      })
    };
    
    onUpdateLog(updatedLog);
    setEditingEvent(null);
  };

  const handleEditLog = () => {
    if (!selectedLog) return;
    setEditingLog(true);
    setEditedLogTitle(selectedLog.title);
    setEditedLogDate(selectedLog.date);
  };

  const handleSaveLog = () => {
    if (!selectedLog) return;
    const updatedLog = { ...selectedLog, title: editedLogTitle, date: editedLogDate };
    onUpdateLog(updatedLog);
    setEditingLog(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-6 backdrop-blur-sm">
      <div className="absolute inset-0 bg-black/80" onClick={onClose} />
      
      <div className="relative w-full max-w-5xl h-[90vh] bg-stone-950 border-2 border-double border-amber-900/60 shadow-[inset_0_0_40px_rgba(139,92,26,0.15),0_0_50px_rgba(0,0,0,0.95)] rounded-none flex overflow-hidden animate-in zoom-in-95 duration-200 font-serif">
        
        {/* Sidebar Navigation */}
        <div className={`
          ${selectedLog || selectedProfile ? 'hidden sm:flex' : 'flex'} 
          w-full sm:w-1/4 border-b sm:border-b-0 sm:border-r border-amber-905/30 bg-stone-900/20 flex-col
        `}>
          <div className="p-4 border-b border-amber-900/15 font-calligraphy text-amber-500 text-[15px] select-none">起居卷宗</div>
          <div className="flex-1 overflow-y-auto">
            {logs.map(log => (
              <div 
                key={log.id}
                onClick={() => handsetSelectedLog(log.id)}
                className={`p-3 cursor-pointer border-b border-amber-900/10 text-xs transition-colors ${selectedLogId === log.id ? 'bg-amber-950/30 text-amber-300 font-semibold' : 'text-stone-400 hover:bg-stone-900/45 hover:text-stone-200'}`}
              >
                {log.title} ({log.date})
              </div>
            ))}
            {mandateOfHeaven && (
              <div
                onClick={() => handsetSelectedProfile(mandateOfHeaven.id)}
                className={`p-3 cursor-pointer border-b border-amber-900/10 text-xs transition-colors ${selectedProfileId === mandateOfHeaven.id ? 'bg-amber-950/30 text-amber-300 font-semibold' : 'text-stone-400 hover:bg-stone-900/45 hover:text-stone-200'}`}
              >
                天命运数
              </div>
            )}
          </div>
          <div className="p-4 border-t border-amber-900/15">
            <Button onClick={onSyncLog} className="w-full bg-amber-900 hover:bg-amber-800 border border-amber-800 text-amber-100 rounded-none text-xs py-2.5">
              <Plus size={14} className="mr-1 inline" /> 辑史
            </Button>
          </div>
        </div>

        {/* Main Content Area */}
        <div className={`
          ${selectedLog || selectedProfile ? 'flex' : 'hidden sm:flex'} 
          flex-1 flex-col overflow-hidden
        `}>
          <div className="flex items-center justify-between p-4 border-b border-amber-900/15 bg-stone-900/40">
            <div className="flex items-center gap-2">
              <button 
                onClick={() => { setSelectedLogId(null); setSelectedProfileId(null); }}
                className="sm:hidden p-1 text-stone-400 hover:text-white"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
                </svg>
              </button>
              <h2 className="text-base md:text-lg font-calligraphy text-amber-500">浮生录</h2>
            </div>
            <button onClick={onClose} className="p-2 text-stone-400 hover:text-white rounded-full"><X size={20} /></button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 sm:p-6" ref={logContainerRef}>
            {selectedLog ? (
              <div className="bg-stone-900/20 border border-amber-900/10 rounded-none p-4 sm:p-6 relative group">
                <div className="absolute top-4 right-4 flex gap-2">
                  <button onClick={() => onDeleteLog(selectedLog.id)} className="p-1.5 text-stone-500 hover:text-red-400"><Trash2 size={16} /></button>
                </div>
                
                {editingLog ? (
                  <div className="space-y-2 mb-6">
                    <input value={editedLogTitle} onChange={e => setEditedLogTitle(e.target.value)} className="w-full bg-stone-900 border border-amber-900/45 rounded-none p-2 text-white font-bold text-lg focus:outline-none focus:border-amber-600" />
                    <input value={editedLogDate} onChange={e => setEditedLogDate(e.target.value)} className="w-full bg-stone-900 border border-amber-900/45 rounded-none p-2 text-white text-xs focus:outline-none focus:border-amber-600" />
                    <div className="flex gap-2">
                      <Button onClick={handleSaveLog} className="bg-amber-900 hover:bg-amber-800 border-amber-800 text-amber-100 rounded-none text-xs px-3 py-1.5">保存</Button>
                      <Button onClick={() => setEditingLog(false)} className="bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-none text-xs px-3 py-1.5">取消</Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-between items-start mb-6">
                    <div className="text-amber-300 font-bold text-lg font-serif">{selectedLog.title} - {selectedLog.date}</div>
                    <button onClick={handleEditLog} className="text-[11px] text-stone-500 hover:text-amber-400">编辑标题/日期</button>
                  </div>
                )}

                <div className="space-y-8 text-stone-300">
                  {selectedLog.days.map((day, dayIndex) => (
                    <div key={dayIndex} className="mb-6">
                      <div className="text-amber-500 font-bold mb-3 border-b border-amber-900/10 pb-1 text-xs">【{day.date}】</div>
                      <div className="space-y-4">
                        {day.events.map((event, eventIndex) => (
                          <div key={eventIndex} className="pl-4 border-l-2 border-amber-900/15">
                            {editingEvent?.dayIndex === dayIndex && editingEvent?.eventIndex === eventIndex ? (
                              <div className="space-y-2">
                                <input value={editedTitle} onChange={e => setEditedTitle(e.target.value)} className="w-full bg-stone-900 border border-amber-900/45 rounded-none p-2 text-white text-xs focus:outline-none focus:border-amber-600" />
                                <textarea value={editedDescription} onChange={e => setEditedDescription(e.target.value)} className="w-full bg-stone-900 border border-amber-900/45 rounded-none p-2 text-white text-xs h-24 focus:outline-none focus:border-amber-600" />
                                <div className="flex gap-2">
                                  <Button onClick={handleSave} className="bg-amber-900 hover:bg-amber-800 border-amber-800 text-amber-100 rounded-none text-xs px-3 py-1.5">保存</Button>
                                  <Button onClick={() => setEditingEvent(null)} className="bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-none text-xs px-3 py-1.5">取消</Button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="flex justify-between items-start">
                                  <div className="font-bold text-base text-amber-300 mb-1">{eventIndex + 1}. {event.title}</div>
                                  <button onClick={() => handleEdit(dayIndex, eventIndex)} className="text-[11px] text-stone-500 hover:text-amber-400">编辑</button>
                                </div>
                                <div className="text-xs mb-2 whitespace-pre-wrap leading-relaxed">{event.description}</div>
                                <div className="mb-2">
                                  <div className="text-stone-500 text-[10px]">重要对白：</div>
                                  {event.dialogues?.map((d, i) => <div key={i} className="italic pl-4 text-xs whitespace-pre-wrap text-stone-400 leading-normal">「 {d} 」</div>)}
                                </div>
                                {event.notes && <div className="text-stone-500 text-[10px] whitespace-pre-wrap">备注：{event.notes}</div>}
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : selectedProfile ? (
              <div className="bg-stone-900/20 border border-amber-900/10 rounded-none p-4 sm:p-6">
                <div className="flex justify-between items-center mb-4">
                  <div className="text-amber-300 font-bold text-base">{selectedProfile.name}</div>
                  {selectedProfile.id === 'historical-system' && (
                    <Button onClick={() => onSyncNPC(selectedProfile.id)} className="bg-amber-900/10 border border-amber-800 hover:bg-amber-900/30 text-amber-300 text-[10px] py-1 px-3.5 rounded-none font-medium">
                      同步信息
                    </Button>
                  )}
                </div>
                <div className="text-stone-350 text-xs whitespace-pre-wrap leading-relaxed">{selectedProfile.userNotes || '暂无详细描述'}</div>
              </div>
            ) : (
              <div className="text-center text-stone-500 py-20 text-xs">暂无内容</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

