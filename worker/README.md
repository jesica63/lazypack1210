# SEO LazyPack API Proxy - Cloudflare Worker

這個 Cloudflare Worker 作為 SEO LazyPack 前端應用程式和 Google Gemini API 之間的安全代理層，保護 API Key 不被暴露在客戶端。

## 🏗️ 架構

```
Frontend (Browser)
    ↓
    ↓ HTTP Request
    ↓
Cloudflare Worker (This)
    ↓ API Key stored in Secret
    ↓
Google Gemini API
```

## 📂 目錄結構

```
worker/
├── src/
│   └── index.js          # Worker 主要代碼
├── package.json          # 依賴配置
├── wrangler.toml         # Cloudflare Workers 配置
├── .gitignore           # Git 忽略文件
└── README.md            # 本文件
```

## 🔌 API 端點

### `GET /health`

健康檢查端點。

**回應**：
```json
{
  "status": "ok",
  "service": "SEO LazyPack API Proxy",
  "version": "1.0.0",
  "timestamp": "2025-12-23T12:00:00.000Z"
}
```

### `POST /api/analyze`

分析文章並生成內部連結建議。

**請求體**：
```json
{
  "articleContent": "文章內容...",
  "urlList": ["https://...", "https://..."],
  "systemInstruction": "系統指令...",
  "responseSchema": { ... }
}
```

**回應**：
```json
{
  "revisedArticle": "修訂後的文章...",
  "suggestions": [
    {
      "anchorText": "錨點文字",
      "targetUrl": "https://...",
      "reason": "原因說明",
      "revisedSegment": "修訂的段落"
    }
  ]
}
```

### `POST /api/curate`

生成懶人包文章。

**請求體**：
```json
{
  "prompt": "提示詞...",
  "systemInstruction": "系統指令...",
  "responseSchema": { ... } // optional
}
```

**回應**：
```json
{
  "text": "生成的 HTML 內容..."
}
```
或（如果有 responseSchema）：
```json
[
  {
    "sectionTitle": "段落標題",
    "contentDraft": "內容草稿",
    "sourceIds": [1, 2]
  }
]
```

## 🔧 本地開發

### 1. 安裝依賴

```bash
npm install
```

### 2. 設定環境變數

創建 `.dev.vars` 檔案：

```bash
echo "GEMINI_API_KEY=你的_API_KEY" > .dev.vars
```

### 3. 啟動開發伺服器

```bash
npm run dev
```

Worker 會在 `http://localhost:8787` 運行。

### 4. 測試

```bash
# 健康檢查
curl http://localhost:8787/health

# 測試分析端點（需要準備 JSON 請求體）
curl -X POST http://localhost:8787/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"articleContent":"...","urlList":[],"systemInstruction":"..."}'
```

## 🚀 部署

### 1. 登入 Cloudflare

```bash
wrangler login
```

### 2. 設定 API Key Secret

```bash
wrangler secret put GEMINI_API_KEY
```

### 3. 部署

```bash
npm run deploy
```

部署到生產環境：

```bash
npm run deploy:prod
```

## 🔒 安全特性

1. **API Key 保護**：API Key 儲存在 Cloudflare Secret 中，永不暴露給客戶端
2. **CORS 保護**：只允許指定網域的請求
3. **請求驗證**：驗證請求方法和必要參數
4. **錯誤處理**：統一的錯誤回應格式

## 📊 監控

查看即時日誌：

```bash
npm run tail
```

或前往 Cloudflare Dashboard：
- Workers & Pages > 您的 Worker > Logs

## 🛠️ 配置

編輯 `wrangler.toml` 來修改 Worker 配置：

```toml
name = "seo-lazypack-api"  # Worker 名稱
compatibility_date = "2024-01-01"
```

編輯 `src/index.js` 來修改允許的來源：

```javascript
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'https://yourdomain.com'
];
```

## 📝 常見問題

### Worker 返回 401 錯誤

檢查 API Key Secret 是否正確設定：

```bash
wrangler secret list
```

應該會看到 `GEMINI_API_KEY` 在列表中。

### CORS 錯誤

確保前端的網域已添加到 `ALLOWED_ORIGINS`。

### 達到配額限制

Cloudflare Workers 免費方案每日 100,000 次請求。查看使用量：

Cloudflare Dashboard > Workers & Pages > 您的 Worker > Analytics

## 📚 相關文件

- [DEPLOYMENT.md](../DEPLOYMENT.md) - 完整部署指南
- [SECURITY.md](../SECURITY.md) - 安全性說明
- [Cloudflare Workers 文件](https://developers.cloudflare.com/workers/)
