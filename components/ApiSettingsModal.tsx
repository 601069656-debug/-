import React, { useState, useEffect } from 'react';
import { Button } from './Button';
import { auth } from '../firebase';

interface ApiSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (model: string) => void;
}

export const ApiSettingsModal: React.FC<ApiSettingsModalProps> = ({ isOpen, onClose, onSave }) => {
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [modelName, setModelName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setApiKey(localStorage.getItem('thirdPartyApiKey') || '');
      setBaseUrl(localStorage.getItem('thirdPartyBaseUrl') || '');
      setModelName(localStorage.getItem('thirdPartyModelName') || '');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      localStorage.setItem('thirdPartyApiKey', apiKey);
      localStorage.setItem('thirdPartyBaseUrl', baseUrl);
      localStorage.setItem('thirdPartyModelName', modelName);
      onSave('openai-custom'); // Pass the custom model identifier
      onClose();
    } catch (error) {
      console.error("Error in handleSave:", error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-700 p-6 rounded-lg w-full max-w-md">
        <h2 className="text-xl font-bold text-slate-200 mb-4">第三方 API 设置</h2>
        
        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1">API Key</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-slate-200"
              placeholder="sk-..."
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Base URL</label>
            <input
              type="text"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-slate-200"
              placeholder="https://api.example.com"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">模型名称 (Model Name)</label>
            <input
              type="text"
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
              className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-slate-200"
              placeholder="gpt-4o"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <Button variant="ghost" onClick={onClose} disabled={isSaving}>取消</Button>
          <Button variant="primary" onClick={handleSave} disabled={isSaving}>
            {isSaving ? '保存中...' : '保存'}
          </Button>
        </div>
      </div>
    </div>
  );
};
