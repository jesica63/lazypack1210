#!/bin/bash

echo "🚀 SEO LazyPack 開發環境啟動器"
echo "================================"
echo ""

# 檢查是否在專案根目錄
if [ ! -f "package.json" ]; then
  echo "❌ 錯誤：請在專案根目錄執行此腳本"
  exit 1
fi

# 檢查 Node.js
if ! command -v node &> /dev/null; then
  echo "❌ 錯誤：未安裝 Node.js"
  echo "請前往 https://nodejs.org/ 下載安裝"
  exit 1
fi

echo "✅ Node.js: $(node --version)"
echo "✅ npm: $(npm --version)"
echo ""

# 檢查依賴是否安裝
if [ ! -d "node_modules" ]; then
  echo "📦 安裝主專案依賴..."
  npm install
  echo ""
fi

if [ ! -d "worker/node_modules" ]; then
  echo "📦 安裝 Worker 依賴..."
  cd worker
  npm install
  cd ..
  echo ""
fi

# 檢查 API Key 設定
if [ ! -f "worker/.dev.vars" ]; then
  echo "⚠️  警告：worker/.dev.vars 不存在"
  echo "正在創建範本檔案..."
  cat > worker/.dev.vars << EOF
# Cloudflare Worker 本地開發環境變數
# ⚠️ 請將下方的 API Key 替換成你的實際 Gemini API Key
# 取得 API Key: https://aistudio.google.com/apikey
GEMINI_API_KEY=YOUR_ACTUAL_GEMINI_API_KEY_HERE
EOF
  echo ""
  echo "❌ 請先編輯 worker/.dev.vars 設定你的 GEMINI_API_KEY"
  echo "   1. 前往：https://aistudio.google.com/apikey"
  echo "   2. 複製你的 API Key"
  echo "   3. 編輯 worker/.dev.vars 檔案，替換 YOUR_ACTUAL_GEMINI_API_KEY_HERE"
  echo ""
  exit 1
fi

# 檢查 API Key 是否已設定
if grep -q "YOUR_ACTUAL_GEMINI_API_KEY_HERE" worker/.dev.vars; then
  echo "❌ 錯誤：請先設定你的 GEMINI_API_KEY"
  echo "   編輯 worker/.dev.vars 檔案，替換為實際的 API Key"
  echo "   取得 API Key: https://aistudio.google.com/apikey"
  exit 1
fi

# 檢查環境變數
if [ ! -f ".env.local" ]; then
  echo "📝 創建 .env.local..."
  cat > .env.local << EOF
# 本地開發環境變數
API_ENDPOINT=http://localhost:8787
EOF
fi

echo "✅ 所有設定檢查完成"
echo ""

# 檢查端口是否被佔用
if lsof -Pi :8787 -sTCP:LISTEN -t >/dev/null 2>&1; then
  echo "⚠️  警告：端口 8787 已被佔用"
  echo "正在嘗試釋放..."
  kill -9 $(lsof -ti:8787) 2>/dev/null
  sleep 1
fi

echo "================================"
echo "🎬 啟動服務..."
echo "================================"
echo ""

# 創建日誌目錄
mkdir -p logs

# 啟動 Worker（背景執行）
echo "📡 啟動 Cloudflare Worker (http://localhost:8787)..."
cd worker
npm run dev > ../logs/worker.log 2>&1 &
WORKER_PID=$!
cd ..

# 等待 Worker 啟動
echo "⏳ 等待 Worker 初始化..."
sleep 5

# 檢查 Worker 是否成功啟動
if ! lsof -Pi :8787 -sTCP:LISTEN -t >/dev/null 2>&1; then
  echo "❌ Worker 啟動失敗！查看日誌："
  cat logs/worker.log
  exit 1
fi

# 測試 Worker 健康檢查
echo "🔍 檢查 Worker 健康狀態..."
HEALTH_CHECK=$(curl -s http://localhost:8787/health 2>/dev/null)
if [ -z "$HEALTH_CHECK" ]; then
  echo "❌ Worker 健康檢查失敗！查看日誌："
  tail -20 logs/worker.log
  kill $WORKER_PID 2>/dev/null
  exit 1
fi

echo "✅ Worker 正常運行"
echo ""

# 啟動前端
echo "🎨 啟動前端應用程式..."
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✨ 開發環境已啟動！"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📡 Worker API: http://localhost:8787"
echo "🌐 前端介面: http://localhost:3000"
echo ""
echo "💡 提示："
echo "   - 按 Ctrl+C 停止所有服務"
echo "   - Worker 日誌: logs/worker.log"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 啟動前端（前景執行）
npm run dev

# 清理：前端停止後，終止 Worker
echo ""
echo "🛑 正在停止服務..."
kill $WORKER_PID 2>/dev/null
echo "✅ 所有服務已停止"
