#!/bin/bash

echo "🔍 SEO LazyPack API Key 檢查工具"
echo "================================"
echo ""

# 檢查檔案是否存在
if [ ! -f "worker/.dev.vars" ]; then
  echo "❌ 錯誤：worker/.dev.vars 不存在"
  echo ""
  echo "請執行以下指令創建："
  echo "echo 'GEMINI_API_KEY=你的實際API_Key' > worker/.dev.vars"
  exit 1
fi

# 讀取 API Key
API_KEY=$(grep GEMINI_API_KEY worker/.dev.vars | cut -d '=' -f2)

echo "📝 目前的 API Key 設定："
echo "檔案位置：worker/.dev.vars"
echo "API Key：$API_KEY"
echo ""

# 檢查是否為預設值
if [ "$API_KEY" = "YOUR_ACTUAL_GEMINI_API_KEY_HERE" ]; then
  echo "❌ 錯誤：API Key 還是預設值，尚未設定真實的 Key"
  echo ""
  echo "📖 如何設定："
  echo "1. 前往：https://aistudio.google.com/apikey"
  echo "2. 登入 Google 帳號並建立 API Key"
  echo "3. 執行以下指令（替換成你的實際 Key）："
  echo ""
  echo "   echo 'GEMINI_API_KEY=AIzaSyDxxxxx...' > worker/.dev.vars"
  echo ""
  exit 1
fi

# 檢查格式
if [[ ! "$API_KEY" =~ ^AIza ]]; then
  echo "⚠️  警告：API Key 格式可能不正確"
  echo "   Gemini API Key 通常以 'AIza' 開頭"
  echo ""
fi

# 檢查長度
KEY_LENGTH=${#API_KEY}
if [ $KEY_LENGTH -lt 30 ]; then
  echo "⚠️  警告：API Key 長度太短（$KEY_LENGTH 字元）"
  echo "   正常的 API Key 長度約 39 字元"
  echo ""
fi

echo "✅ API Key 格式檢查通過"
echo ""

# 測試 Worker 端點
echo "🔍 檢查 Worker 狀態..."
if lsof -Pi :8787 -sTCP:LISTEN -t >/dev/null 2>&1; then
  echo "✅ Worker 正在運行（Port 8787）"

  # 測試健康檢查
  HEALTH=$(curl -s http://localhost:8787/health 2>/dev/null)
  if [ ! -z "$HEALTH" ]; then
    echo "✅ Worker 健康檢查通過"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "🎉 所有檢查通過！"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "💡 提示："
    echo "   如果仍然出現錯誤，請重新啟動 Worker："
    echo ""
    echo "   pkill -f 'wrangler dev'"
    echo "   cd worker && npm run dev"
    echo ""
  else
    echo "⚠️  Worker 運行中但健康檢查失敗"
  fi
else
  echo "❌ Worker 未啟動（Port 8787 未使用）"
  echo ""
  echo "請啟動 Worker："
  echo "cd worker && npm run dev"
fi

echo ""
echo "📊 模型版本檢查："
grep -h "gemini.*flash" worker/src/index.js | head -1 | sed 's/^[ \t]*//'
echo ""
