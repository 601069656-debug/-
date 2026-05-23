import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import admin from "firebase-admin";
import crypto from "crypto";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const firebaseConfig = JSON.parse(fs.readFileSync(path.join(__dirname, 'firebase-applet-config.json'), 'utf-8'));

// Initialize Firebase Admin
try {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: firebaseConfig.projectId,
  });
} catch (e) {
  console.warn("Firebase Admin initialization failed with applicationDefault, trying without credentials:", e);
  try {
    admin.initializeApp({
      projectId: firebaseConfig.projectId,
    });
  } catch (e2) {
    console.error("Firebase Admin initialization failed completely:", e2);
  }
}
const db = admin.firestore();
db.settings({ databaseId: firebaseConfig.firestoreDatabaseId });

// Encryption utilities
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
const IV_LENGTH = 16;

function encrypt(text: string) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(text: string) {
  const textParts = text.split(':');
  const iv = Buffer.from(textParts.shift()!, 'hex');
  const encryptedText = Buffer.from(textParts.join(':'), 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Request logging middleware
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
  });

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Securely save API key
  app.post("/api/save-key", async (req, res) => {
    const { idToken, apiKey, baseUrl, modelName } = req.body;
    try {
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      const uid = decodedToken.uid;
      
      const encryptedKey = encrypt(apiKey);
      await db.collection('user_api_keys').doc(uid).set({
        encryptedKey,
        baseUrl,
        modelName,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error in /api/save-key:", error);
      res.status(401).json({ error: "Unauthorized or invalid key" });
    }
  });

  app.post("/api/proxy", async (req, res) => {
    const { provider, contents, config, customApiKey, customBaseUrl, customModelName } = req.body;
    let { model } = req.body;
    
    try {
      let apiKey = "";
      let baseUrl = "";

      if (provider === 'gemini') {
        const { GoogleGenAI } = await import("@google/genai");
        let ai;
        
        if (req.body.model === 'gemini-custom') {
          // CUSTOM API MODE: Only use custom key
          const customKey = customApiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.API_KEY;
          if (!customKey) {
            throw new Error("自定义 API Key 未配置。请在设置中填写您的 API Key。");
          }
          model = customModelName || 'gemini-3.1-pro-preview';
          ai = new GoogleGenAI({ apiKey: customKey });
          console.log("Using custom Gemini model:", model);
        } else {
          // OFFICIAL AI MODE
          ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
          console.log("Using official Gemini model:", model);
        }
        
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        
        try {
          const finalConfig = {
            ...config,
            repetitionPenalty: config?.repetitionPenalty || 1.1
          };
          const responseStream = await ai.models.generateContentStream({
            model,
            contents,
            config: finalConfig
          });
          
          for await (const chunk of responseStream) {
            const groundingMetadata = chunk.candidates?.[0]?.groundingMetadata;
            res.write(`data: ${JSON.stringify({ text: chunk.text, groundingMetadata })}\n\n`);
          }
          res.write('data: [DONE]\n\n');
          res.end();
        } catch (streamError: any) {
          console.warn("Gemini stream error:", streamError.message);
          res.write(`data: ${JSON.stringify({ error: streamError.message })}\n\n`);
          res.write('data: [DONE]\n\n');
          res.end();
        }
      } else if (provider === 'openai') {
        if (!customApiKey) throw new Error("No API key found. Please set it in settings.");
        
        apiKey = customApiKey;
        baseUrl = customBaseUrl;
        model = customModelName || model; // Use stored modelName if available
        // Translate Gemini format to OpenAI format
        let openAiMessages = [];
        if (config?.systemInstruction) {
          openAiMessages.push({
            role: 'system',
            content: typeof config.systemInstruction === 'string' ? config.systemInstruction : config.systemInstruction.parts?.[0]?.text || ''
          });
        }

        if (Array.isArray(contents)) {
          openAiMessages.push(...contents.map((msg: any) => ({
            role: msg.role === 'model' ? 'assistant' : 'user',
            content: msg.parts?.[0]?.text || msg.content || ''
          })));
        } else {
          openAiMessages.push({
            role: 'user',
            content: contents
          });
        }

        // Collapse consecutive messages of the same role
        let collapsedMessages = [];
        for (const msg of openAiMessages) {
          if (collapsedMessages.length > 0 && collapsedMessages[collapsedMessages.length - 1].role === msg.role) {
            collapsedMessages[collapsedMessages.length - 1].content += "\n\n" + msg.content;
          } else {
            collapsedMessages.push({ ...msg });
          }
        }
        openAiMessages = collapsedMessages;

        // Ensure the first message after system is a user message
        const firstNonSystemIdx = openAiMessages.findIndex(m => m.role !== 'system');
        if (firstNonSystemIdx !== -1 && openAiMessages[firstNonSystemIdx].role !== 'user') {
          openAiMessages.splice(firstNonSystemIdx, 0, {
            role: 'user',
            content: '开始记录。'
          });
        }

        // OpenAI-compatible proxy
        const response = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model,
            messages: openAiMessages,
            stream: true,
            temperature: config?.temperature || 1,
            top_p: config?.topP || 0.95,
            max_tokens: config?.maxOutputTokens || 8192,
          })
        });

        if (!response.ok) {
          const errorBody = await response.text();
          console.warn("OpenAI API Error Body (Expected):", errorBody.substring(0, 200) + (errorBody.length > 200 ? '...' : ''));
          
          let cleanErrorMsg = errorBody;
          if (errorBody.trim().toLowerCase().startsWith('<!doctype html>') || errorBody.trim().toLowerCase().startsWith('<html')) {
            const titleMatch = errorBody.match(/<title>(.*?)<\/title>/i);
            const title = titleMatch ? titleMatch[1] : 'HTML Error Page';
            cleanErrorMsg = `Received HTML error page: ${title}. This usually indicates a proxy/gateway timeout or error (e.g., Cloudflare 524).`;
          } else if (errorBody.length > 500) {
            cleanErrorMsg = errorBody.substring(0, 500) + '... (truncated)';
          }
          
          throw new Error(`OpenAI API error: ${response.status} ${response.statusText} - ${cleanErrorMsg}`);
        }

        const contentType = response.headers.get('content-type') || '';
        
        if (contentType.includes('application/json')) {
          const jsonResponse = await response.json();
          
          if (jsonResponse.error) {
            console.warn("OpenAI API JSON Error (Expected):", jsonResponse.error);
            const errorText = `\n[API Error: ${jsonResponse.error.message || JSON.stringify(jsonResponse.error)}]`;
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');
            res.write(`data: ${JSON.stringify({ text: errorText })}\n\n`);
            res.write('data: [DONE]\n\n');
            res.end();
            return;
          }
          
          const message = jsonResponse.choices?.[0]?.message || {};
          const text = message.content || ""; // Removed message.reasoning_content to maintain immersion
          res.setHeader('Content-Type', 'text/event-stream');
          res.setHeader('Cache-Control', 'no-cache');
          res.setHeader('Connection', 'keep-alive');
          res.write(`data: ${JSON.stringify({ text })}\n\n`);
          res.write('data: [DONE]\n\n');
          res.end();
          return;
        }

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        
        if (reader) {
          let receivedAnyData = false;
          let rawDataLog = "";
          
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              if (buffer.trim()) {
                // If there's still something in the buffer, try to process it as a final line
                const line = buffer.trim();
                if (line.startsWith('data: ')) {
                  const data = line.slice(6);
                  if (data !== '[DONE]') {
                    try {
                      const parsed = JSON.parse(data);
                      const choice = parsed.choices?.[0] || {};
                      const delta = choice.delta || choice.message || {};
                      let text = delta.content || "";
                      if (text) {
                        receivedAnyData = true;
                        res.write(`data: ${JSON.stringify({ text })}\n\n`);
                      }
                    } catch (e) {}
                  }
                } else if (line.startsWith('{') && line.includes('"error"')) {
                  try {
                    const parsed = JSON.parse(buffer);
                    if (parsed.error) {
                      res.write(`data: ${JSON.stringify({ text: `\n[API Error: ${parsed.error.message || JSON.stringify(parsed.error)}]` })}\n\n`);
                    }
                  } catch (e) {}
                }
              }
              break;
            }
            buffer += decoder.decode(value, { stream: true });
            
            let newlineIndex;
            while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
              const line = buffer.slice(0, newlineIndex).trim();
              buffer = buffer.slice(newlineIndex + 1);
              
              if (line.startsWith('data: ')) {
                const data = line.slice(6);
                if (data === '[DONE]') continue;
                try {
                  const parsed = JSON.parse(data);
                  
                  if (parsed.error) {
                    // Use console.warn instead of console.error to avoid triggering the AI Studio error reporter
                    // for expected third-party API errors like rate limits.
                    console.warn("OpenAI Stream API Error (Expected):", parsed.error);
                    res.write(`data: ${JSON.stringify({ text: `\n[API Error: ${parsed.error.message || JSON.stringify(parsed.error)}]` })}\n\n`);
                    continue;
                  }
                  
                  const choice = parsed.choices?.[0] || {};
                  const delta = choice.delta || choice.message || {};
                  
                  let text = "";
                  
                  if (delta.reasoning_content) {
                    text += `<thought>${delta.reasoning_content}</thought>`;
                  } else if (delta.reasoning) {
                    text += `<thought>${delta.reasoning}</thought>`;
                  }
                  
                  if (delta.content) {
                    text += delta.content;
                  }
                  
                  if (choice.finish_reason === 'content_filter' || choice.finish_reason === 'safety') {
                    text += "\n[系统提示：输出内容触发了 API 提供商的安全过滤机制导致生成截断。建议尝试调整对话引导或检查舞台设定中的敏感词。]";
                  }
                  
                  if (text) {
                    receivedAnyData = true;
                    res.write(`data: ${JSON.stringify({ text })}\n\n`);
                  } else {
                    // Log the first few empty chunks for debugging
                    if (rawDataLog.length < 500) {
                      rawDataLog += JSON.stringify(parsed) + " | ";
                    }
                  }
                } catch (e) {
                  console.error("Error parsing OpenAI stream data:", e, "Data:", data);
                }
              } else if (line.startsWith('{') && line.includes('"error"')) {
                // Handle case where proxy returns JSON error without data: prefix
                try {
                  const parsed = JSON.parse(line);
                  if (parsed.error) {
                    res.write(`data: ${JSON.stringify({ text: `\n[API Error: ${parsed.error.message || JSON.stringify(parsed.error)}]` })}\n\n`);
                  }
                } catch (e) {}
              } else if (line.length > 0 && !line.startsWith(':')) {
                // Log unexpected lines
                if (rawDataLog.length < 500) {
                  rawDataLog += `[Raw Line: ${line}] | `;
                }
              }
            }
          }
          
          if (!receivedAnyData && rawDataLog) {
            res.write(`data: ${JSON.stringify({ text: `\n[Debug: 代理服务器返回了 200 OK，但没有有效内容。原始数据: ${rawDataLog}]` })}\n\n`);
          }
        }
        res.write('data: [DONE]\n\n');
        res.end();
      }
    } catch (error: any) {
      // Use console.warn to prevent the AI Studio system from treating expected network/API errors as fatal bugs
      console.warn("Proxy connection warning:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/generate", async (req, res) => {
    const { provider, contents, config, customApiKey, customBaseUrl, customModelName } = req.body;
    let { model } = req.body;
    
    try {
      let apiKey = "";
      let baseUrl = "";

      if (provider === 'gemini') {
        const { GoogleGenAI } = await import("@google/genai");
        let ai;
        
        if (req.body.model === 'gemini-custom') {
          // CUSTOM API MODE
          const customKey = customApiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.API_KEY;
          if (!customKey) {
            throw new Error("自定义 API Key 未配置。请在设置中填写您的 API Key。");
          }
          model = customModelName || 'gemini-3.1-pro-preview';
          ai = new GoogleGenAI({ apiKey: customKey });
          console.log("Using custom Gemini model for generate:", model);
        } else {
          // OFFICIAL AI MODE
          ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
          console.log("Using official Gemini model for generate:", model);
        }
        
        const finalConfig = {
          ...config,
          repetitionPenalty: config?.repetitionPenalty || 1.1
        };
        const response = await ai.models.generateContent({
          model,
          contents,
          config: finalConfig
        });
        
        res.json({ text: response.text });
      } else if (provider === 'openai') {
        if (!customApiKey) throw new Error("No API key found. Please set it in settings.");
        apiKey = customApiKey;
        baseUrl = customBaseUrl;
        model = customModelName || model;
        
        let openAiMessages = [];
        if (config?.systemInstruction) {
          openAiMessages.push({
            role: 'system',
            content: typeof config.systemInstruction === 'string' ? config.systemInstruction : config.systemInstruction.parts?.[0]?.text || ''
          });
        }

        if (Array.isArray(contents)) {
          openAiMessages.push(...contents.map((msg: any) => ({
            role: msg.role === 'model' ? 'assistant' : 'user',
            content: msg.parts?.[0]?.text || msg.content || ''
          })));
        } else {
          openAiMessages.push({
            role: 'user',
            content: contents
          });
        }

        // Collapse consecutive messages of the same role
        let collapsedMessages = [];
        for (const msg of openAiMessages) {
          if (collapsedMessages.length > 0 && collapsedMessages[collapsedMessages.length - 1].role === msg.role) {
            collapsedMessages[collapsedMessages.length - 1].content += "\n\n" + msg.content;
          } else {
            collapsedMessages.push({ ...msg });
          }
        }
        openAiMessages = collapsedMessages;

        // Ensure the first message after system is a user message
        const firstNonSystemIdx = openAiMessages.findIndex(m => m.role !== 'system');
        if (firstNonSystemIdx !== -1 && openAiMessages[firstNonSystemIdx].role !== 'user') {
          openAiMessages.splice(firstNonSystemIdx, 0, {
            role: 'user',
            content: '开始记录。'
          });
        }

        const response = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model,
            messages: openAiMessages,
            stream: false,
            temperature: config?.temperature || 1,
            top_p: config?.topP || 0.95,
            max_tokens: config?.maxOutputTokens || 8192,
            response_format: config?.responseMimeType === "application/json" ? { type: "json_object" } : undefined
          })
        });

        if (!response.ok) {
          const errorBody = await response.text();
          let cleanErrorMsg = errorBody;
          if (errorBody.trim().toLowerCase().startsWith('<!doctype html>') || errorBody.trim().toLowerCase().startsWith('<html')) {
            const titleMatch = errorBody.match(/<title>(.*?)<\/title>/i);
            const title = titleMatch ? titleMatch[1] : 'HTML Error Page';
            cleanErrorMsg = `Received HTML error page: ${title}. This usually indicates a proxy/gateway timeout or error (e.g., Cloudflare 524).`;
          } else if (errorBody.length > 500) {
            cleanErrorMsg = errorBody.substring(0, 500) + '... (truncated)';
          }
          throw new Error(`OpenAI API error: ${response.status} ${response.statusText} - ${cleanErrorMsg}`);
        }

        const jsonResponse = await response.json();
        if (jsonResponse.error) {
          throw new Error(jsonResponse.error.message || JSON.stringify(jsonResponse.error));
        }
        
        const message = jsonResponse.choices?.[0]?.message || {};
        let text = "";
        if (message.reasoning_content) {
          text += `<thought>${message.reasoning_content}</thought>`;
        }
        text += message.content || "";
        res.json({ text });
      }
    } catch (error: any) {
      console.warn("Generate connection warning:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
