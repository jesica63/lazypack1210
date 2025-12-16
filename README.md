SEO LAzyPack - 智能懶人包與內鏈優化工具
這是一個基於 Google Gemini 2.0 Flash 模型開發的 AI 寫作助手。它具備「三位小助理」架構，能自動進行網頁資料蒐集、結構化大綱規劃，並撰寫成符合公司語態的懶人包文章。同時也保留了 SEO 內部連結優化功能。🚀 功能特色智能懶人包生成 (Deep Curation)：Searcher (資料蒐集)：自動爬取並清洗指定網址的內容。Architect (架構師)：強制使用 JSON Schema，確保產出內容嚴格遵守指定大綱，不漏段落。Editor (總編輯)：依照「公司語態設定 (Style Guide)」潤飾文章，產出專業 HTML。SEO 內部連結優化：分析現有文章與 Sitemap，提供高價值的內部連結建議。富文本預覽：支援所見即所得 (WYSIWYG) 的 HTML 預覽與一鍵複製。資安防護：內建 HTML 清洗機制，防範 XSS 攻擊。🛠️ 安裝與設定 (Installation)1. 環境準備請確保您的電腦已安裝 Node.js (建議安裝 LTS 版本)。下載 Node.js2. 下載專案git clone [https://github.com/jesica63/lazypack1210.git](https://github.com/jesica63/lazypack1210.git)
cd lazypack1210
3. 安裝依賴套件這是最重要的步驟，請在專案資料夾內開啟終端機 (Terminal)，執行：npm install
4. 設定 API Key為了安全起見，請勿將 API Key 直接寫在程式碼中。在專案根目錄建立一個名為 .env.local 的檔案。填入您的 Gemini API Key：GEMINI_API_KEY=AIzaSyDxxxxxxxxxxxxxxxxxxxxxxxxxxxx
▶️ 如何啟動 (Running the App)關鍵指令：啟動引擎在終端機輸入以下指令來啟動開發伺服器：npm run dev
看到 ➜ Local: http://localhost:5173/ 出現後，按住 Ctrl (或 Cmd) 點擊網址，即可在瀏覽器開啟。💡 給新手的觀念小補帖 (必讀！)Q: 為什麼我不能直接點兩下 index.html 來開啟程式？A: 因為這個專案使用了現代化的 React + TypeScript 技術，這些高級語法瀏覽器是「看不懂」的。npm run dev 就像是啟動了一位 「即時口譯員 (Vite)」。它會在背景幫你把程式碼翻譯成瀏覽器看得懂的語言。結論：只要你還在開發或使用這個工具，npm run dev 就是你每天打開電腦後的起手式！🍎 Mac 用戶專屬：一鍵啟動捷徑如果你覺得每次都要開終端機很麻煩，可以使用專案內附的 start_app.command 檔案。首次使用前的設定 (解除封印)：由於 Mac 的安全機制，第一次使用前需要賦予執行權限。請在終端機執行：# 1. 進入資料夾
cd 你的專案路徑/lazypack1210

# 2. 賦予執行權限
chmod +x start_app.command

# 3. (如果還是打不開) 移除 macOS 安全隔離標籤
xattr -c start_app.command
設定完成後，以後只要在 Finder 點兩下 start_app.command 即可自動啟動！📦 技術架構Frontend: React, TypeScript, Tailwind CSSBuild Tool: ViteAI Model: Google Gemini 2.0 Flash (Experimental)Security: DOMPurify (HTML Sanitization)⚠️ 注意事項本工具使用 Google Gemini API，請留意您的 API Quota (額度) 使用量。若遇到 "403 Forbidden" 錯誤，請檢查 Google Cloud Console 的 API Key 是否有設定正確的 HTTP Referrer (例如 http://localhost:5173/)。