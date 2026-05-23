import { GoogleGenAI } from "@google/genai";

// 统一的 AI 服务接口
export const aiService = {
  async generateContent(provider: string, contents: any, config: any, customApiKey?: string, customBaseUrl?: string, customModelName?: string, model?: string) {
    if (provider === 'gemini') {
      // 官方模型：使用 ADC，不传入任何 Key
      if (model !== 'gemini-custom') {
        const ai = new GoogleGenAI({});
        return await ai.models.generateContent({
          model: model || 'gemini-3.1-flash-preview',
          contents,
          config
        });
      } 
      // 自定义模型：使用自定义 Key
      else {
        if (!customApiKey) throw new Error("自定义 API Key 未配置");
        const ai = new GoogleGenAI({ apiKey: customApiKey });
        return await ai.models.generateContent({
          model: customModelName || 'gemini-3.1-pro-preview',
          contents,
          config
        });
      }
    }
    // OpenAI 逻辑...
    throw new Error("Unsupported provider");
  }
};
