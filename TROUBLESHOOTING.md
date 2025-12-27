# 🔧 故障排除指南

## ❌ 錯誤：「生成失敗: 文章架構生成失敗: Failed to fetch」

### 問題原因

這個錯誤表示**前端無法連接到後端 API**，通常有以下原因：

1. ❌ Cloudflare Worker 後端沒有啟動
2. ❌ API Key 沒有設定
3. ❌ 環境變數設定錯誤
4. ❌ 依賴套件沒有安裝

---

## ✅ 完整解決方案

### 步驟 1：設定 Gemini API Key

編輯 `worker/.dev.vars` 檔案，將你的 API Key 填入：

```bash
# worker/.dev.vars
GEMINI_API_KEY=AIzaSyDxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**如何取得 API Key？**
1. 前往：https://aistudio.google.com/apikey
2. 登入你的 Google 帳號
3. 點擊「Create API Key」
4. 複製 API Key 並貼到上方檔案

---

### 步驟 2：確認環境變數

檢查 `.env.local` 檔案（已自動創建）：

```bash
# .env.local
API_ENDPOINT=http://localhost:8787
```

---

### 步驟 3：啟動後端 Worker

**開啟第一個終端視窗**，執行：

```bash
cd worker
npm run dev
```

你應該會看到類似這樣的訊息：
```
⛅️ wrangler 3.x.x
-------------------
⎔ Starting local server...
[wrangler:inf] Ready on http://localhost:8787
```

**⚠️ 保持這個終端視窗開啟！不要關閉！**

---

### 步驟 4：啟動前端應用程式

**開啟第二個終端視窗**，執行：

```bash
npm run dev
```

你應該會看到：
```
VITE v6.x.x  ready in xxx ms

➜  Local:   http://localhost:3000/
➜  Network: http://0.0.0.0:3000/
```

---

### 步驟 5：測試功能

1. 開啟瀏覽器訪問 `http://localhost:3000`
2. 點擊「魔法棒」按鈕（懶人包生成）
3. 填寫表單：
   - **主題**：例如「2024 年最佳筆電推薦」
   - **引言**：例如「本文將介紹...」
   - **文章大綱**（每行一個標題）：
     ```
     背景介紹
     產品特色
     優缺點分析
     購買建議
     ```
   - **參考連結**：貼上 2-3 個相關網址
4. 點擊「開始生成」

---

## 🔍 進階除錯

### 檢查 Worker 是否正在運行

```bash
# 檢查 8787 端口是否被佔用
lsof -ti:8787

# 或者直接訪問健康檢查端點
curl http://localhost:8787/health
```

應該回傳：
```json
{
  "status": "ok",
  "service": "SEO LazyPack API Proxy",
  "version": "1.0.0",
  "timestamp": "2025-12-27T..."
}
```

---

### 檢查瀏覽器 Console

按 `F12` 打開開發者工具，查看 Console 分頁：

**正常情況**：
```
POST http://localhost:8787/api/curate 200 OK
```

**錯誤情況**：
```
POST http://localhost:8787/api/curate net::ERR_CONNECTION_REFUSED
```
→ 表示 Worker 沒有啟動，請回到步驟 3

---

### 檢查 Network 請求

在開發者工具的 **Network** 分頁：

1. 勾選「Preserve log」
2. 執行「懶人包生成」
3. 找到 `/api/curate` 請求
4. 點擊查看：
   - **Status Code**: 應該是 200
   - **Response**: 應該有 JSON 資料
   - 如果是 500 錯誤，查看 Response 中的 `error` 訊息

---

## 🚀 快速啟動腳本（進階）

### macOS / Linux

創建 `start-dev.sh`：

```bash
#!/bin/bash

echo "🚀 啟動 SEO LazyPack 開發環境..."

# 檢查 .dev.vars 是否存在
if [ ! -f "worker/.dev.vars" ]; then
  echo "❌ 錯誤：worker/.dev.vars 不存在"
  echo "請先設定你的 GEMINI_API_KEY"
  exit 1
fi

# 啟動 Worker（背景執行）
echo "📡 啟動 Worker..."
cd worker
npm run dev &
WORKER_PID=$!
cd ..

# 等待 Worker 啟動
sleep 3

# 啟動前端
echo "🎨 啟動前端..."
npm run dev

# 清理
kill $WORKER_PID
```

使用方式：
```bash
chmod +x start-dev.sh
./start-dev.sh
```

---

## ❓ 常見問題

### Q1: 顯示「Port 8787 already in use」

**A**: 端口被佔用，殺掉舊的 Worker 進程：

```bash
# 找到佔用的進程
lsof -ti:8787

# 殺掉進程（將 PID 替換為上方的數字）
kill -9 <PID>

# 重新啟動 Worker
cd worker && npm run dev
```

---

### Q2: API Key 設定後仍然失敗

**A**: 檢查以下項目：

1. **API Key 格式**：應該以 `AIzaSy` 開頭
2. **API Key 權限**：確認已啟用 Gemini API
3. **重新啟動**：修改 `.dev.vars` 後，必須重新啟動 Worker

```bash
# 在 Worker 終端按 Ctrl+C 停止
# 重新執行
npm run dev
```

---

### Q3: 前端顯示的端口不是 3000

**A**: 正常現象。如果 3000 被佔用，Vite 會自動使用下一個可用端口（3001, 3002...）

只要能正常開啟頁面即可。

---

### Q4: Worker 啟動時顯示錯誤

**A**: 常見錯誤與解決：

**錯誤**: `Error: Missing API key`
```bash
# 確認 worker/.dev.vars 檔案存在且包含：
GEMINI_API_KEY=你的實際API_Key
```

**錯誤**: `wrangler: command not found`
```bash
# 重新安裝依賴
cd worker
npm install
```

---

## 📊 系統需求

### 軟體版本

- **Node.js**: v18.0.0 或更新版本 ✅ (當前：v22.21.1)
- **npm**: v9.0.0 或更新版本 ✅ (當前：10.9.4)
- **作業系統**: macOS, Linux, Windows

### 網路需求

- 穩定的網路連線（用於呼叫 Gemini API）
- 能夠訪問以下網域：
  - `generativelanguage.googleapis.com`（Gemini API）
  - `corsproxy.io`、`allorigins.win`（CORS 代理）

---

## 🆘 仍然無法解決？

1. **查看完整錯誤訊息**：
   - Worker 終端的錯誤訊息
   - 瀏覽器 Console 的錯誤訊息
   - Network 分頁的請求詳情

2. **重新安裝依賴**：
   ```bash
   # 主專案
   rm -rf node_modules package-lock.json
   npm install

   # Worker
   cd worker
   rm -rf node_modules package-lock.json
   npm install
   cd ..
   ```

3. **檢查防火牆設定**：
   - 確認本地防火牆沒有阻擋 8787 端口
   - 確認公司網路沒有阻擋 Google API

---

**文件版本**: v1.0
**最後更新**: 2025-12-27
**相關文件**: DEVELOPER_GUIDE.md, DEPLOYMENT.md, SECURITY.md
