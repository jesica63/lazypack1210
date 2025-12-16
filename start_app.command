#!/bin/bash

# 1. 切換到這個檔案所在的資料夾 (這行在 Mac 很重要，不然會找不到專案)
cd "$(dirname "$0")"

# 2. 顯示訊息
echo "正在啟動 LinkWeaver AI..."

# 3. 先打開瀏覽器 (Mac 用 open 指令)
open http://localhost:5173

# 4. 啟動伺服器
npm run dev
```

### 步驟 2：賦予執行權限 (最關鍵的一步！) 🔑

剛建立好的 `.command` 檔在 Mac 上預設是「純文字」，不能執行。你需要用終端機告訴 Mac：「這是一個程式」。

1.  打開 VS Code 的終端機。
2.  輸入以下指令並按 Enter：
    ```bash
    chmod +x start_app.command