# 🚀 部署指南 - Cloudflare Workers API 代理

本指南將幫助您部署 SEO LazyPack 的後端 API 代理到 Cloudflare Workers，徹底解決 API Key 暴露問題。

## 📋 目錄

1. [前置準備](#前置準備)
2. [本地開發](#本地開發)
3. [部署到 Cloudflare](#部署到-cloudflare)
4. [前端配置](#前端配置)
5. [故障排除](#故障排除)

---

## 前置準備

### 1. 註冊 Cloudflare 帳號

前往 [Cloudflare 註冊頁面](https://dash.cloudflare.com/sign-up) 創建免費帳號。

### 2. 取得 Gemini API Key

前往 [Google AI Studio](https://aistudio.google.com/app/apikey) 取得您的 API Key。

### 3. 安裝 Wrangler CLI

Wrangler 是 Cloudflare Workers 的命令行工具。

```bash
# 全局安裝 Wrangler
npm install -g wrangler

# 或者在 worker 目錄中本地安裝
cd worker
npm install
```

### 4. 登入 Cloudflare

```bash
wrangler login
```

這會開啟瀏覽器讓您授權 Wrangler 訪問您的 Cloudflare 帳號。

---

## 本地開發

### 1. 設定本地環境變數

在 `worker/` 目錄下創建 `.dev.vars` 檔案：

```bash
cd worker
echo "GEMINI_API_KEY=你的_API_KEY" > .dev.vars
```

**⚠️ 重要**：`.dev.vars` 已經加入 `.gitignore`，不會被提交到 Git。

### 2. 啟動本地開發伺服器

```bash
cd worker
npm run dev
```

這會在 `http://localhost:8787` 啟動本地 Worker。

### 3. 測試 API 端點

開啟新的終端視窗，測試 Worker 是否正常運作：

```bash
# 健康檢查
curl http://localhost:8787/health

# 應該返回類似以下內容：
# {
#   "status": "ok",
#   "service": "SEO LazyPack API Proxy",
#   "version": "1.0.0",
#   "timestamp": "2025-12-23T..."
# }
```

### 4. 啟動前端應用程式

開啟另一個終端視窗，在專案根目錄啟動前端：

```bash
# 在專案根目錄
npm run dev
```

前端會自動連接到 `http://localhost:8787` 的 Worker API。

---

## 部署到 Cloudflare

### 1. 更新 Worker 配置

編輯 `worker/wrangler.toml`，將 `ALLOWED_ORIGINS` 更新為您的實際網域：

```toml
# worker/wrangler.toml
name = "seo-lazypack-api"
```

同時更新 `worker/src/index.js` 中的 `ALLOWED_ORIGINS`：

```javascript
const ALLOWED_ORIGINS = [
  'https://yourdomain.com',       // ⚠️ 改成您的網域
  'https://www.yourdomain.com',   // ⚠️ 改成您的網域
  'http://localhost:3000'          // 保留用於本地開發
];
```

### 2. 設定 API Key Secret

**關鍵步驟**：將 Gemini API Key 設定為 Cloudflare Workers 的 Secret（加密環境變數）。

```bash
cd worker
wrangler secret put GEMINI_API_KEY
```

系統會提示您輸入 API Key：

```
Enter a secret value: ******************
✨ Success! Uploaded secret GEMINI_API_KEY
```

**為什麼使用 Secret？**
- Secret 會被加密儲存
- 不會出現在代碼或日誌中
- 只能在 Worker 運行時訪問

### 3. 部署 Worker

```bash
cd worker
npm run deploy

# 或者部署到生產環境
npm run deploy:prod
```

部署成功後，您會看到類似以下的輸出：

```
✨ Successfully published your script to
 https://seo-lazypack-api.your-subdomain.workers.dev
```

**記下這個 URL**，您稍後會需要它。

### 4. 測試已部署的 Worker

```bash
# 替換為您的 Worker URL
curl https://seo-lazypack-api.your-subdomain.workers.dev/health
```

應該返回健康檢查的 JSON 回應。

---

## 前端配置

### 1. 更新前端環境變數

在專案根目錄創建 `.env` 檔案（如果還沒有的話）：

```bash
# 在專案根目錄
cp .env.example .env
```

編輯 `.env`：

```env
# 本地開發
API_ENDPOINT=http://localhost:8787

# 生產環境（部署前端時使用）
# API_ENDPOINT=https://seo-lazypack-api.your-subdomain.workers.dev
```

### 2. 部署前端

根據您的前端託管平台，設定環境變數：

#### Vercel 部署

```bash
# 設定環境變數
vercel env add API_ENDPOINT

# 輸入您的 Worker URL
https://seo-lazypack-api.your-subdomain.workers.dev

# 部署
vercel --prod
```

#### Netlify 部署

在 Netlify 控制台：
1. 進入 **Site settings** > **Build & deploy** > **Environment**
2. 添加環境變數：
   - Key: `API_ENDPOINT`
   - Value: `https://seo-lazypack-api.your-subdomain.workers.dev`

#### Cloudflare Pages 部署

```bash
# 或者一併部署到 Cloudflare Pages
npm run build

# 在 Pages 設定中添加環境變數 API_ENDPOINT
```

---

## 驗證部署

### 1. 檢查 CORS 設定

確保您的 Worker 允許前端網域的請求：

```bash
curl -X OPTIONS \
  -H "Origin: https://yourdomain.com" \
  -H "Access-Control-Request-Method: POST" \
  https://seo-lazypack-api.your-subdomain.workers.dev/api/analyze
```

應該返回包含 CORS header 的回應。

### 2. 測試完整流程

1. 訪問您部署的前端網站
2. 輸入 Sitemap URL 和文章內容
3. 點擊「生成內鏈建議」
4. 檢查瀏覽器開發者工具的 Network 標籤
5. 確認請求發送到 Worker URL 而非 Google API

### 3. 監控 Worker

使用 Wrangler 查看即時日誌：

```bash
cd worker
npm run tail

# 或者
wrangler tail
```

---

## 故障排除

### ❌ Worker 返回 500 錯誤

**原因**：API Key Secret 未設定或設定錯誤。

**解決方案**：
```bash
cd worker
wrangler secret put GEMINI_API_KEY
```

重新輸入正確的 API Key。

---

### ❌ CORS 錯誤

**錯誤訊息**：
```
Access to fetch at '...' from origin '...' has been blocked by CORS policy
```

**解決方案**：

1. 檢查 `worker/src/index.js` 中的 `ALLOWED_ORIGINS` 是否包含您的網域
2. 確保網域格式正確（包含 `https://`，不包含結尾的 `/`）
3. 重新部署 Worker

---

### ❌ 前端無法連接到 Worker

**錯誤訊息**：
```
Failed to fetch
```

**解決方案**：

1. 檢查 `.env` 中的 `API_ENDPOINT` 是否正確
2. 確認 Worker 已成功部署
3. 測試 Worker 健康檢查端點：
   ```bash
   curl https://your-worker-url/health
   ```

---

### ❌ Gemini API 返回錯誤

**錯誤訊息**：
```
Gemini API error: 401 - Invalid API key
```

**解決方案**：

1. 確認您的 Gemini API Key 有效
2. 檢查 API Key 是否有足夠的配額
3. 前往 [Google AI Studio](https://aistudio.google.com/app/apikey) 確認 API Key 狀態
4. 重新設定 Secret：
   ```bash
   wrangler secret delete GEMINI_API_KEY
   wrangler secret put GEMINI_API_KEY
   ```

---

### ❌ Worker 達到配額限制

**Cloudflare Workers 免費方案限制**：
- 每日 100,000 次請求
- 單次請求執行時間 10ms CPU 時間

**解決方案**：

1. 監控使用量：前往 Cloudflare Dashboard > Workers & Pages > 您的 Worker
2. 如果超過免費配額，考慮升級到 Workers Paid 計劃（$5/月）

---

## 🔒 安全最佳實踐

### 1. 定期輪換 API Key

建議每 3-6 個月更換一次 Gemini API Key：

```bash
# 1. 在 Google AI Studio 生成新的 API Key
# 2. 更新 Worker Secret
wrangler secret put GEMINI_API_KEY

# 3. 撤銷舊的 API Key
```

### 2. 設定速率限制

為了防止濫用，可以在 Worker 中添加速率限制：

```javascript
// worker/src/index.js
// 添加簡單的 IP-based 速率限制

const rateLimiter = new Map();

function checkRateLimit(ip) {
  const now = Date.now();
  const record = rateLimiter.get(ip) || { count: 0, resetTime: now + 60000 };

  if (now > record.resetTime) {
    record.count = 0;
    record.resetTime = now + 60000;
  }

  record.count++;
  rateLimiter.set(ip, record);

  return record.count <= 10; // 每分鐘最多 10 次請求
}
```

### 3. 監控異常流量

使用 Cloudflare Analytics 監控：
1. 請求數量趨勢
2. 錯誤率
3. 回應時間

---

## 📚 其他資源

- [Cloudflare Workers 官方文件](https://developers.cloudflare.com/workers/)
- [Wrangler CLI 文件](https://developers.cloudflare.com/workers/wrangler/)
- [Google Gemini API 文件](https://ai.google.dev/docs)
- [專案 SECURITY.md](./SECURITY.md) - 安全性指南

---

## ✅ 部署檢查清單

完成部署前，確認以下事項：

- [ ] Wrangler CLI 已安裝並登入
- [ ] Gemini API Key 已設定為 Cloudflare Secret
- [ ] Worker 中的 `ALLOWED_ORIGINS` 已更新為實際網域
- [ ] Worker 已成功部署並通過健康檢查
- [ ] 前端 `.env` 中的 `API_ENDPOINT` 已設定
- [ ] 前端已成功連接到 Worker API
- [ ] CORS 設定正確，無跨域錯誤
- [ ] 已測試完整的文章分析流程
- [ ] 已設定日誌監控（optional）
- [ ] 已設定計費警報（optional）

---

**祝部署順利！** 🎉

如果遇到任何問題，請參考 [故障排除](#故障排除) 章節或查閱 [Cloudflare Workers 官方文件](https://developers.cloudflare.com/workers/)。
