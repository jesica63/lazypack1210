# 🔒 安全性指南與 API Key 保護

## ⚠️ 重要安全警告

### 當前架構的安全風險

本專案目前將 **Gemini API Key 直接嵌入前端代碼**，這是一個**嚴重的安全風險**：

```typescript
// ❌ 不安全：API Key 暴露在前端
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
```

**風險說明**：
- ✋ 任何使用者都可以通過瀏覽器開發者工具查看你的 API Key
- 💸 攻擊者可以竊取並濫用你的 API Key，導致高額費用
- 🚫 違反 Google API 服務條款
- 📊 無法追蹤或限制 API 使用量

---

## 🛡️ 推薦解決方案：後端 API 代理架構

### 方案 1: 使用 Cloudflare Workers（推薦，免費）

#### 優點：
- ✅ 完全免費（每日 100,000 次請求）
- ✅ 全球 CDN，低延遲
- ✅ 簡單部署，無需維護伺服器
- ✅ 自動 HTTPS

#### 實作步驟：

1️⃣ **建立 Cloudflare Worker**

```javascript
// worker.js
export default {
  async fetch(request, env) {
    // CORS 設定
    const corsHeaders = {
      'Access-Control-Allow-Origin': 'https://yourdomain.com', // ⚠️ 改成你的網域
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // 處理預檢請求
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // 只允許 POST 請求
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    try {
      const body = await request.json();

      // 驗證請求來源（可選，但推薦）
      const origin = request.headers.get('Origin');
      if (origin !== 'https://yourdomain.com') {
        return new Response('Forbidden', { status: 403 });
      }

      // 呼叫 Gemini API
      const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${env.GEMINI_API_KEY}` // ✅ API Key 儲存在環境變數
        },
        body: JSON.stringify(body)
      });

      const data = await response.json();

      return new Response(JSON.stringify(data), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        }
      });

    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }
};
```

2️⃣ **修改前端代碼**

```typescript
// services/geminiService.ts
export const analyzeArticleWithGemini = async (
  articleContent: string,
  urlList: string[]
): Promise<AnalysisResult> => {
  // ✅ 呼叫你的 Cloudflare Worker，而非直接呼叫 Gemini API
  const response = await fetch('https://your-worker.your-subdomain.workers.dev/api/analyze', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      userPrompt: `文章內容: ${articleContent}\n可用 URL: ${urlList.join('\n')}`,
      systemInstruction: SYSTEM_INSTRUCTION
    })
  });

  const result = await response.json();
  return result;
};
```

3️⃣ **部署到 Cloudflare**

```bash
# 安裝 Wrangler CLI
npm install -g wrangler

# 登入 Cloudflare
wrangler login

# 建立新的 Worker 專案
wrangler init seo-lazypack-api

# 設定環境變數（API Key）
wrangler secret put GEMINI_API_KEY

# 部署
wrangler publish
```

---

### 方案 2: 使用 Vercel Edge Functions

適合已經在使用 Vercel 部署的專案。

```typescript
// api/gemini.ts
import { NextRequest, NextResponse } from 'next/server';

export const config = {
  runtime: 'edge',
};

export default async function handler(req: NextRequest) {
  // 驗證來源
  const origin = req.headers.get('origin');
  if (!origin || !origin.includes('yourdomain.com')) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  const { userPrompt, systemInstruction } = await req.json();

  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/...', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.GEMINI_API_KEY}`
    },
    body: JSON.stringify({ userPrompt, systemInstruction })
  });

  const data = await response.json();
  return NextResponse.json(data);
}
```

---

### 方案 3: 傳統 Node.js 後端（Express）

適合需要更複雜邏輯或已有後端的專案。

```javascript
// server.js
const express = require('express');
const cors = require('cors');
const { GoogleGenAI } = require('@google/genai');

const app = express();

app.use(cors({
  origin: 'https://yourdomain.com' // ⚠️ 改成你的網域
}));
app.use(express.json());

app.post('/api/analyze', async (req, res) => {
  try {
    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY // ✅ 從環境變數讀取
    });

    const { userPrompt, systemInstruction } = req.body;

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash-exp",
      contents: [{ parts: [{ text: userPrompt }] }],
      config: {
        systemInstruction: { parts: [{ text: systemInstruction }] },
      }
    });

    res.json({ result: response.text });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`API server running on port ${PORT}`);
});
```

---

## 🔧 短期緩解措施（如果暫時無法實作後端）

如果你需要繼續使用前端直接呼叫 API，請**務必**採取以下措施：

### 1. 在 Google Cloud Console 設定 API Key 限制

登入 [Google Cloud Console](https://console.cloud.google.com/apis/credentials)

#### ✅ 設定 HTTP Referrer 限制
```
允許的 Referrer:
https://yourdomain.com/*
https://www.yourdomain.com/*
```

#### ✅ 設定 API 限制
- 只允許呼叫 "Generative Language API"
- 禁止其他所有 API

#### ✅ 設定配額限制
```
每日請求上限: 1000 次
每分鐘請求上限: 10 次
```

### 2. 監控 API 使用量

定期檢查 [Google Cloud Console 的配額頁面](https://console.cloud.google.com/apis/api/generativelanguage.googleapis.com/quotas)：

- 📊 設定超額警報（例如：使用量超過 80% 時發送通知）
- 🔍 檢查異常流量模式
- 💰 監控計費狀況

### 3. 實作前端速率限制

```typescript
// 簡單的前端速率限制
const rateLimiter = {
  requests: [] as number[],
  maxRequests: 5,
  timeWindow: 60000, // 1 分鐘

  canMakeRequest(): boolean {
    const now = Date.now();
    this.requests = this.requests.filter(time => now - time < this.timeWindow);

    if (this.requests.length >= this.maxRequests) {
      return false;
    }

    this.requests.push(now);
    return true;
  }
};

// 在呼叫 API 前檢查
if (!rateLimiter.canMakeRequest()) {
  throw new Error('請求過於頻繁，請稍後再試');
}
```

---

## 📋 安全檢查清單

在部署到生產環境前，請確認：

- [ ] API Key 不存在於前端代碼或 Git 歷史記錄中
- [ ] 已實作後端 API 代理，或設定了嚴格的 API Key 限制
- [ ] 已在 Google Cloud Console 設定 HTTP Referrer 限制
- [ ] 已設定 API 配額與計費警報
- [ ] 已檢查 `.env` 檔案是否已加入 `.gitignore`
- [ ] 已實作前端速率限制
- [ ] 已定期審查 API 使用日誌

---

## 🆘 如果 API Key 已經洩漏

如果你懷疑 API Key 已經洩漏：

1. ⚡ **立即撤銷舊的 API Key**
   - 前往 [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
   - 刪除洩漏的 API Key
   - 創建新的 API Key 並設定限制

2. 🔍 **檢查使用記錄**
   - 查看是否有異常的 API 呼叫
   - 檢查計費記錄

3. 🛡️ **實作防護措施**
   - 立即採用後端代理架構
   - 設定嚴格的限制與監控

---

## 📚 延伸閱讀

- [Google API Key 最佳實踐](https://cloud.google.com/docs/authentication/api-keys)
- [OWASP API 安全指南](https://owasp.org/www-project-api-security/)
- [Cloudflare Workers 文件](https://developers.cloudflare.com/workers/)

---

**最後提醒**：API Key 就像你的密碼，絕對不應該出現在前端代碼中。請盡快實作後端代理架構。
