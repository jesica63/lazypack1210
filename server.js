/**
 * SEO LazyPack - 本地開發用 API 代理伺服器 (Express 版本)
 * 功能與 Cloudflare Worker 完全相同，用於本地開發環境
 */

import express from 'express';
import cors from 'cors';
import axios from 'axios';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// ES Module 環境下獲取 __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 讀取 worker/.dev.vars 中的環境變數
const devVarsPath = join(__dirname, 'worker', '.dev.vars');
if (existsSync(devVarsPath)) {
  const devVarsContent = readFileSync(devVarsPath, 'utf8');
  const lines = devVarsContent.split('\n');
  lines.forEach(line => {
    const match = line.match(/^([^=]+)=(.+)$/);
    if (match) {
      process.env[match[1]] = match[2];
    }
  });
  console.log('✅ 已載入 worker/.dev.vars 環境變數');
}

const app = express();
const PORT = process.env.PORT || 8787;

// Gemini API 配置
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

// CORS 配置 - 與 Worker 相同
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5173',      // Vite 常用端口
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
  'https://yourdomain.com',
  'https://www.yourdomain.com'
];

// 中介軟體
app.use(express.json({ limit: '10mb' }));
app.use(cors({
  origin: (origin, callback) => {
    // 允許沒有 origin 的請求（如 Postman, curl）
    if (!origin) return callback(null, true);

    if (ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`❌ CORS 拒絕來源：${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// 請求日誌中介軟體
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`\n[${timestamp}] ${req.method} ${req.path}`);
  if (req.method === 'POST' && req.body) {
    console.log('📦 請求 Body:', JSON.stringify(req.body, null, 2));
  }
  next();
});

/**
 * 呼叫 Gemini API 的核心函數
 */
async function callGeminiAPI(endpoint, requestBody) {
  const url = `${GEMINI_API_BASE}/${endpoint}?key=${GEMINI_API_KEY}`;

  console.log(`🔄 正在呼叫 Gemini API: ${endpoint}`);
  console.log('📤 Gemini 請求內容:', JSON.stringify(requestBody, null, 2));

  try {
    const response = await axios.post(url, requestBody, {
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 60000, // 60 秒超時
      proxy: false // 禁用 proxy
    });

    console.log(`📡 Gemini API 回應狀態: ${response.status}`);
    console.log('✅ Gemini API 回應成功');
    return response.data;

  } catch (error) {
    if (error.response) {
      // 伺服器回應了錯誤狀態碼
      console.error('❌ Gemini API 錯誤:', error.response.status, error.response.data);
      throw new Error(`Gemini API error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
    } else if (error.request) {
      // 請求已發出但沒有收到回應
      console.error('❌ Gemini API 無回應:', error.message);
      throw new Error(`No response from Gemini API: ${error.message}`);
    } else {
      // 其他錯誤
      console.error('❌ Gemini API 呼叫失敗:', error.message);
      throw error;
    }
  }
}

/**
 * 健康檢查端點
 */
app.get('/health', (req, res) => {
  const health = {
    status: 'ok',
    service: 'SEO LazyPack API Proxy (Express)',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    apiKeyConfigured: !!GEMINI_API_KEY
  };
  console.log('✅ 健康檢查:', health);
  res.json(health);
});

/**
 * 文章分析端點
 */
app.post('/api/analyze', async (req, res) => {
  console.log('\n========== 文章分析請求 ==========');

  try {
    const { articleContent, urlList, systemInstruction } = req.body;

    // 驗證必要參數
    if (!articleContent) {
      console.error('❌ 缺少 articleContent');
      return res.status(400).json({ error: 'Missing articleContent' });
    }

    if (!GEMINI_API_KEY) {
      console.error('❌ 缺少 GEMINI_API_KEY');
      return res.status(500).json({ error: 'API key not configured' });
    }

    // 構建用戶提示
    const urlListText = (urlList && urlList.length > 0)
      ? `可用連結清單：\n${urlList.map((url, i) => `${i + 1}. ${url}`).join('\n')}`
      : '無可用連結';

    const userPrompt = `文章內容：\n${articleContent}\n\n${urlListText}`;

    // 增強 systemInstruction 確保返回 JSON 格式
    const enhancedSystemInstruction = `${systemInstruction}

請以 JSON 格式回應，包含以下欄位：
{
  "revisedArticle": "完整的修訂後文章內容（Markdown 格式）",
  "suggestions": [
    {
      "anchorText": "錨點文字",
      "targetUrl": "目標 URL",
      "reason": "選擇此連結的原因（繁體中文）",
      "revisedSegment": "包含新連結的優化段落"
    }
  ]
}`;

    // 構建 Gemini API 請求
    const geminiRequest = {
      contents: [
        {
          parts: [{ text: userPrompt }]
        }
      ],
      systemInstruction: {
        parts: [{ text: enhancedSystemInstruction }]
      },
      generationConfig: {
        responseMimeType: 'application/json'
      }
    };

    // 呼叫 Gemini API
    const response = await callGeminiAPI(
      'models/gemini-1.5-pro:generateContent',
      geminiRequest
    );

    // 解析回應
    if (response.candidates && response.candidates[0]) {
      const content = response.candidates[0].content;
      if (content && content.parts && content.parts[0]) {
        const resultText = content.parts[0].text;

        try {
          const parsedResult = JSON.parse(resultText);
          console.log('✅ 文章分析成功');
          return res.json(parsedResult);
        } catch (parseError) {
          console.error('❌ JSON 解析失敗:', parseError.message);
          console.log('原始回應:', resultText);
          return res.status(500).json({
            error: 'Failed to parse Gemini response',
            rawResponse: resultText
          });
        }
      }
    }

    console.error('❌ Gemini 回應格式異常');
    return res.status(500).json({ error: 'Invalid Gemini response format' });

  } catch (error) {
    console.error('❌ 文章分析錯誤:', error.message);
    res.status(500).json({
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * 文章生成端點
 */
app.post('/api/curate', async (req, res) => {
  console.log('\n========== 文章生成請求 ==========');

  try {
    const { topic, keywords, systemInstruction } = req.body;

    // 驗證必要參數
    if (!topic) {
      console.error('❌ 缺少 topic');
      return res.status(400).json({ error: 'Missing topic' });
    }

    if (!GEMINI_API_KEY) {
      console.error('❌ 缺少 GEMINI_API_KEY');
      return res.status(500).json({ error: 'API key not configured' });
    }

    // 構建用戶提示
    const keywordsText = (keywords && keywords.length > 0)
      ? `關鍵字：${keywords.join(', ')}`
      : '';

    const userPrompt = `主題：${topic}\n${keywordsText}`;

    // 增強 systemInstruction 確保返回 JSON 格式
    const enhancedSystemInstruction = `${systemInstruction}

請以 JSON 格式回應，包含以下欄位：
{
  "article": "生成的文章內容（Markdown 格式）",
  "metadata": {
    "title": "文章標題",
    "summary": "文章摘要",
    "keywords": ["關鍵字1", "關鍵字2"]
  }
}`;

    // 構建 Gemini API 請求
    const geminiRequest = {
      contents: [
        {
          parts: [{ text: userPrompt }]
        }
      ],
      systemInstruction: {
        parts: [{ text: enhancedSystemInstruction }]
      },
      generationConfig: {
        responseMimeType: 'application/json'
      }
    };

    // 呼叫 Gemini API
    const response = await callGeminiAPI(
      'models/gemini-1.5-pro:generateContent',
      geminiRequest
    );

    // 解析回應
    if (response.candidates && response.candidates[0]) {
      const content = response.candidates[0].content;
      if (content && content.parts && content.parts[0]) {
        const resultText = content.parts[0].text;

        try {
          const parsedResult = JSON.parse(resultText);
          console.log('✅ 文章生成成功');
          return res.json(parsedResult);
        } catch (parseError) {
          console.error('❌ JSON 解析失敗:', parseError.message);
          console.log('原始回應:', resultText);
          return res.status(500).json({
            error: 'Failed to parse Gemini response',
            rawResponse: resultText
          });
        }
      }
    }

    console.error('❌ Gemini 回應格式異常');
    return res.status(500).json({ error: 'Invalid Gemini response format' });

  } catch (error) {
    console.error('❌ 文章生成錯誤:', error.message);
    res.status(500).json({
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// 404 處理
app.use((req, res) => {
  console.warn(`⚠️ 404 Not Found: ${req.method} ${req.path}`);
  res.status(404).json({ error: 'Endpoint not found' });
});

// 全域錯誤處理
app.use((err, req, res, next) => {
  console.error('❌ 伺服器錯誤:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// 啟動伺服器
app.listen(PORT, () => {
  console.log('\n========================================');
  console.log('🚀 SEO LazyPack API 代理伺服器已啟動');
  console.log('========================================');
  console.log(`📡 監聽端口: ${PORT}`);
  console.log(`🔑 API Key: ${GEMINI_API_KEY ? '已配置 ✅' : '未配置 ❌'}`);
  console.log(`🌐 允許的來源: ${ALLOWED_ORIGINS.join(', ')}`);
  console.log('\n可用端點:');
  console.log(`  - GET  http://localhost:${PORT}/health`);
  console.log(`  - POST http://localhost:${PORT}/api/analyze`);
  console.log(`  - POST http://localhost:${PORT}/api/curate`);
  console.log('========================================\n');
});
