# 本地開發指南

## 🎯 快速開始

由於 Claude Code 容器環境的網路限制，**您需要在本地 MacBook 終端機運行代理伺服器**。

### 步驟 1：確認環境設定

確認 `worker/.dev.vars` 檔案包含您的 Gemini API Key：

```bash
# worker/.dev.vars
GEMINI_API_KEY=您的真實APIKey
```

### 步驟 2：在 MacBook 終端機啟動代理伺服器

開啟**新的終端視窗**，執行：

```bash
cd /path/to/lazypack1210  # 切換到專案目錄
npm run server
```

您應該會看到：

```
========================================
🚀 SEO LazyPack API 代理伺服器已啟動
========================================
📡 監聽端口: 8787
🔑 API Key: 已配置 ✅
...
========================================
```

### 步驟 3：測試代理伺服器

在另一個終端視窗執行：

```bash
# 測試健康檢查
curl http://localhost:8787/health

# 測試文章分析功能
curl -X POST http://localhost:8787/api/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "articleContent": "這是一篇測試文章。人工智慧正在改變世界。",
    "urlList": ["https://example.com/ai"],
    "systemInstruction": "請分析文章並提供 SEO 優化建議"
  }'
```

如果成功，您會看到 Gemini 返回的 JSON 格式分析結果。

### 步驟 4：啟動前端開發伺服器

在**第三個終端視窗**執行：

```bash
npm run dev
```

### 步驟 5：在瀏覽器測試完整功能

1. 開啟瀏覽器訪問 `http://localhost:5173`（或終端顯示的端口）
2. 上傳文件或輸入文章內容
3. 測試 SEO 分析功能
4. 檢查瀏覽器開發者工具的 Network 面板，確認請求正確送到 `http://localhost:8787/api/analyze`

---

## 🔧 故障排除

### 問題 1：端口 8787 已被佔用

**錯誤訊息**：`Error: listen EADDRINUSE: address already in use :::8787`

**解決方法**：

```bash
# macOS/Linux
lsof -ti:8787 | xargs kill -9

# 或修改 server.js 中的端口號
```

### 問題 2：API Key 未配置

**錯誤訊息**：`API key not configured`

**解決方法**：

1. 確認 `worker/.dev.vars` 檔案存在
2. 確認內容格式正確：`GEMINI_API_KEY=AIzaSy...`
3. 重新啟動伺服器

### 問題 3：CORS 錯誤

**錯誤訊息**：瀏覽器控制台顯示 `Access-Control-Allow-Origin` 錯誤

**解決方法**：

確認前端運行的端口（如 `localhost:5173`）已在 `server.js` 的 `ALLOWED_ORIGINS` 中：

```javascript
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
];
```

---

## 📁 專案結構

```
lazypack1210/
├── server.js              # Express 代理伺服器（本地開發用）
├── worker/                # Cloudflare Worker（生產環境用）
│   ├── src/index.js
│   ├── .dev.vars         # ⚠️ API Key（不要提交到 Git）
│   └── wrangler.toml
├── services/
│   ├── geminiService.ts  # 前端 Gemini API 呼叫
│   └── curationService.ts
└── components/
    └── ResultView.tsx    # 結果顯示（含 XSS 防護）
```

---

## 🚀 生產環境部署

本地測試成功後，生產環境請使用 Cloudflare Worker：

```bash
cd worker
wrangler login
wrangler secret put GEMINI_API_KEY  # 輸入您的 API Key
wrangler deploy
```

部署成功後，修改前端 `.env` 檔案：

```env
API_ENDPOINT=https://your-worker.workers.dev
```

---

## ✅ 檢查清單

- [ ] `worker/.dev.vars` 已包含正確的 API Key
- [ ] 代理伺服器成功啟動（`npm run server`）
- [ ] 健康檢查端點返回 `{"status":"ok"}`
- [ ] 文章分析功能可正常呼叫 Gemini API
- [ ] 前端開發伺服器已啟動（`npm run dev`）
- [ ] 瀏覽器可正常使用完整功能
- [ ] Network 面板顯示請求發送到 `localhost:8787`

---

## 💡 提示

- 代理伺服器會顯示詳細的請求/回應日誌，方便除錯
- 支援熱重載：修改 `server.js` 後需手動重啟
- 生產環境自動切換到 Cloudflare Worker（無需修改前端代碼）
