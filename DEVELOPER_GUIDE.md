# SEO LazyPack 開發維護指南

> 適用對象：基層開發助理、初階工程師
> 目的：協助團隊成員快速上手專案維護與功能優化

---

## 📝 目錄
1. [如何優化懶人包寫作指令（Prompt Engineering）](#1-如何優化懶人包寫作指令prompt-engineering)
2. [如何在頁面上增加新功能](#2-如何在頁面上增加新功能)
3. [TypeScript 基本認識](#3-typescript-基本認識)

---

## 1. 如何優化懶人包寫作指令（Prompt Engineering）

### 📍 核心概念

本專案使用 Google Gemini AI 產生內容，AI 的輸出品質取決於「System Instruction」（系統指令）。

有兩大類指令需要優化：
- **SEO 內部連結優化指令**：`services/prompts.ts`
- **懶人包生成指令**：`services/curationService.ts`

---

### 🎯 任務一：優化 SEO 內部連結指令

**檔案位置**：`services/prompts.ts`

**現有指令結構**：

```typescript
export const SYSTEM_INSTRUCTION = `
你是一位世界級的 SEO 專家與內容策略師。
你的任務是分析提供的文章草稿與網站地圖 (Sitemap) URL 列表，並進行內部連結優化。
...
`;
```

**如何修改**：

1. **調整連結數量規則**（第 6-10 行）
   ```typescript
   連結數量規則 (根據文章長度):
   - < 1200 字: 建議 2-3 個連結 (適用資訊型短文)
   - 1200-2000 字: 建議 3-5 個連結 (主流建議)
   ```

   👉 **修改建議**：根據實際 SEO 測試結果調整數字

2. **優化錨點文字策略**（第 15-20 行）
   ```typescript
   - **拒絕泛用詞**：絕對嚴禁使用「點擊這裡」、「更多資訊」...
   ```

   👉 **修改建議**：新增或刪除禁用詞彙

3. **調整上下文整合規則**（第 21-24 行）

   👉 **修改建議**：可加入「避免過度優化」等 SEO 規範

**測試方式**：
1. 修改 `services/prompts.ts`
2. 執行 `npm run dev`
3. 在編輯器貼上文章，點擊「生成內鏈建議」
4. 檢查 AI 輸出是否符合預期

---

### 🎯 任務二：優化懶人包生成指令

**檔案位置**：`services/curationService.ts`

這個檔案包含「三位小助理」的指令：

#### A. 公司語態設定（最常需要調整）

**位置**：`services/curationService.ts:10-19`

```typescript
const COMPANY_STYLE_GUIDE = `
【公司寫作風格指南】
1. **語氣設定**：專業但不嚴肅，像是一位資深繁體中文台灣用語新聞編輯用淺白方式科普。
2. **格式要求**：
   - 小標題 (H2) 請使用「問句」或「強烈觀點」的寫法...
3. **術語規範**：遇到英文專有名詞，第一次出現時請標註中文解釋。標點符號一律使用全形。
4. **絕對禁語**：不要使用「讓我們繼續看下去」、「小編」...
`;
```

**常見優化需求**：

| 需求 | 修改位置 | 範例 |
|------|---------|------|
| 改變語氣風格 | 第 12 行 | 改為「專業嚴謹」、「輕鬆幽默」等 |
| 調整段落長度 | 第 15 行 | 改為 `150-300 字` |
| 新增禁用詞 | 第 18 行 | 加入「總而言之」、「由此可見」等 |
| 修改標點規範 | 第 17 行 | 改為「半形標點」（不建議） |

#### B. 架構師指令（控制資料分配邏輯）

**位置**：`services/curationService.ts:95-103`

```typescript
const systemInstruction = `
你是一名資訊架構師。你的任務是閱讀「原始資料」，並根據使用者提供的「大綱」，將資料分配到大綱的每一個段落中。

【嚴格規則】
1. **結構一致性**：必須嚴格遵守使用者的大綱順序，不可遺漏任何一點...
2. **內容豐富度**：每個段落必須提取充足的資訊（數據、案例、觀點）...
```

**常見優化**：
- 調整「內容豐富度」標準（如改為 200 字、500 字）
- 新增「引用來源數量」限制

#### C. 總編輯指令（控制最終文章風格）

**位置**：`services/curationService.ts:173-190`

```typescript
const systemInstruction = `
${COMPANY_STYLE_GUIDE}  // 繼承公司語態

你現在是總編輯。你的任務是將架構師提供的「段落草稿」改寫成一篇完整的 HTML 懶人包文章。
```

**常見優化**：
- 調整開場指示（第 179 行）
- 修改引用來源格式（第 185 行）
- 變更 HTML 輸出規則（第 188 行）

---

### ⚡ 快速測試流程

```bash
# 1. 修改指令
vim services/curationService.ts

# 2. 重新啟動開發伺服器（如果已經在運行）
# 按 Ctrl+C 停止，然後重新執行：
npm run dev

# 3. 測試「懶人包生成」功能
# - 點擊編輯器的「魔法棒」按鈕
# - 輸入主題、大綱、參考網址
# - 檢查生成結果是否符合新指令
```

---

## 2. 如何在頁面上增加新功能

### 📂 專案架構圖

```
lazypack1210/
├── App.tsx                    ← 主畫面（協調所有組件）
├── components/                ← UI 組件資料夾
│   ├── ArticleEditor.tsx      ← 左側編輯器
│   ├── ResultView.tsx         ← 右側結果顯示
│   └── SitemapInput.tsx       ← Sitemap 輸入框
├── services/                  ← 後端邏輯
│   ├── curationService.ts     ← 懶人包生成邏輯
│   ├── geminiService.ts       ← AI API 呼叫
│   └── prompts.ts             ← SEO 內鏈指令
├── types.ts                   ← TypeScript 型別定義
└── worker/                    ← Cloudflare Worker 後端
    └── src/index.js
```

---

### 🛠️ 實戰範例：新增「文章字數統計」功能

假設我們想在右側面板新增一個「文章統計」區塊。

#### 步驟 1：修改型別定義

**檔案**：`types.ts`

```typescript
// 新增一個統計介面
export interface ArticleStats {
  totalWords: number;
  totalParagraphs: number;
  readingTime: number; // 預估閱讀時間（分鐘）
}
```

#### 步驟 2：在 `App.tsx` 新增狀態

**檔案**：`App.tsx`

```typescript
import { ArticleStats } from './types'; // 引入型別

const App: React.FC = () => {
  const [articleContent, setArticleContent] = useState<string>('');

  // 新增統計狀態
  const [stats, setStats] = useState<ArticleStats>({
    totalWords: 0,
    totalParagraphs: 0,
    readingTime: 0
  });

  // 監聽文章內容變化，自動計算統計
  useEffect(() => {
    const text = articleContent.replace(/<[^>]*>/g, ''); // 移除 HTML 標籤
    const words = text.length;
    const paragraphs = (text.match(/\n\n/g) || []).length + 1;
    const readingTime = Math.ceil(words / 400); // 假設每分鐘讀 400 字

    setStats({ totalWords: words, totalParagraphs: paragraphs, readingTime });
  }, [articleContent]);

  return (
    <div>
      {/* 傳遞統計資料給 ResultView */}
      <ResultView result={result} loading={appState === AppState.ANALYZING} stats={stats} />
    </div>
  );
};
```

#### 步驟 3：修改 `ResultView` 組件顯示統計

**檔案**：`components/ResultView.tsx`

```typescript
import { ArticleStats } from '../types';

interface ResultViewProps {
  result: AnalysisResult | null;
  loading: boolean;
  stats?: ArticleStats; // 新增 props
}

const ResultView: React.FC<ResultViewProps> = ({ result, loading, stats }) => {
  return (
    <div>
      {/* 新增統計區塊 */}
      {stats && (
        <div className="bg-blue-50 p-4 rounded-lg mb-4">
          <h3 className="font-bold text-sm mb-2">📊 文章統計</h3>
          <p>總字數：{stats.totalWords} 字</p>
          <p>段落數：{stats.totalParagraphs}</p>
          <p>預估閱讀時間：{stats.readingTime} 分鐘</p>
        </div>
      )}

      {/* 原有的結果顯示 */}
      {loading && <p>分析中...</p>}
      {result && <div>{result.revisedArticle}</div>}
    </div>
  );
};
```

#### 步驟 4：測試新功能

```bash
# 1. 儲存檔案後，開發伺服器會自動重新載入
npm run dev

# 2. 在瀏覽器檢查右側面板是否出現「文章統計」區塊
# 3. 輸入文章內容，檢查統計數字是否正確更新
```

---

### 🎨 UI 組件開發注意事項

1. **Tailwind CSS 類別**
   專案使用 Tailwind CSS，常用類別：
   ```typescript
   className="bg-blue-50 p-4 rounded-lg mb-4"
   // bg-blue-50: 淡藍色背景
   // p-4: 內邊距 1rem
   // rounded-lg: 圓角
   // mb-4: 下邊距 1rem
   ```

2. **圖示使用**
   專案使用 `lucide-react`：
   ```typescript
   import { TrendingUp } from 'lucide-react';

   <TrendingUp className="w-4 h-4 text-indigo-600" />
   ```

3. **狀態管理原則**
   - 全域狀態放在 `App.tsx`
   - 組件內部狀態用 `useState`
   - 跨組件通訊用 props

---

## 3. TypeScript 基本認識

### 🧩 什麼是 TypeScript？

TypeScript 是 JavaScript 的「加強版」，主要差異是**需要定義變數的型別**。

**JavaScript（不用宣告型別）**：
```javascript
let name = "Alice";
name = 123; // OK，但容易造成錯誤
```

**TypeScript（必須宣告型別）**：
```typescript
let name: string = "Alice";
name = 123; // ❌ 錯誤！型別不符
```

---

### 📌 常用型別語法

#### 1. 基本型別

```typescript
let name: string = "Alice";         // 字串
let age: number = 25;                // 數字
let isActive: boolean = true;        // 布林值
let tags: string[] = ["SEO", "AI"];  // 字串陣列
```

#### 2. 介面（Interface）

用來定義物件的「形狀」：

```typescript
// 定義一個「文章」介面
interface Article {
  title: string;
  content: string;
  wordCount: number;
  isPublished?: boolean;  // ?: 表示這是選填欄位
}

// 使用介面
const myArticle: Article = {
  title: "SEO 指南",
  content: "內容...",
  wordCount: 1500
  // isPublished 可以不填
};
```

#### 3. 函數型別

```typescript
// 定義參數和回傳值的型別
function calculateReadingTime(wordCount: number): number {
  return Math.ceil(wordCount / 400);
}

// 箭頭函數
const getTitle = (article: Article): string => {
  return article.title;
};
```

#### 4. 聯合型別（Union Types）

```typescript
// status 可以是這三種字串之一
type CurationStatus = 'idle' | 'scraping' | 'analyzing' | 'writing' | 'done';

let status: CurationStatus = 'idle';
status = 'scraping';  // ✅ OK
status = 'finished';  // ❌ 錯誤！不在允許的值內
```

---

### 🎓 本專案常見型別

#### `types.ts:9-12` - 分析結果

```typescript
export interface AnalysisResult {
  revisedArticle: string;        // AI 修訂後的文章
  suggestions: LinkSuggestion[]; // 連結建議陣列
}
```

**使用範例**：
```typescript
// 在 App.tsx 中
const [result, setResult] = useState<AnalysisResult | null>(null);
//                                    ^^^^^^^^^^^^^^^^^^^ 型別註解
//                                                      | null 表示可能是空值
```

#### `types.ts:1-7` - 連結建議

```typescript
export interface LinkSuggestion {
  anchorText: string;   // 錨點文字
  targetUrl: string;    // 目標網址
  reason: string;       // 推薦原因
}
```

**使用範例**：
```typescript
const suggestion: LinkSuggestion = {
  anchorText: "最佳 SEO 工具",
  targetUrl: "https://example.com/seo-tools",
  reason: "提供完整的工具比較"
};
```

#### `types.ts:14-20` - App 狀態

```typescript
export enum AppState {
  IDLE = 'IDLE',
  ANALYZING = 'ANALYZING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR',
}
```

**使用範例**：
```typescript
const [appState, setAppState] = useState<AppState>(AppState.IDLE);

if (appState === AppState.ANALYZING) {
  console.log("正在分析中...");
}
```

---

### 🔍 如何查看型別定義

1. **使用 VS Code**
   - 將滑鼠移到變數上，會自動顯示型別
   - 按住 `Cmd/Ctrl + 點擊` 可跳轉到型別定義

2. **查看 `types.ts` 檔案**
   所有自訂型別都集中在這個檔案

3. **看 Props 定義**
   每個組件頂部都會定義 Props 介面：
   ```typescript
   interface ArticleEditorProps {
     value: string;
     onChange: (value: string) => void;
     disabled?: boolean;
   }
   ```

---

### 🐛 常見錯誤與解決

#### 錯誤 1：型別不符

```typescript
// ❌ 錯誤
const age: number = "25";

// ✅ 正確
const age: number = 25;
```

#### 錯誤 2：缺少必填欄位

```typescript
interface User {
  name: string;
  email: string;
}

// ❌ 錯誤：缺少 email
const user: User = {
  name: "Alice"
};

// ✅ 正確
const user: User = {
  name: "Alice",
  email: "alice@example.com"
};
```

#### 錯誤 3：無法讀取可能為 null 的值

```typescript
const result: AnalysisResult | null = null;

// ❌ 錯誤：result 可能是 null
console.log(result.revisedArticle);

// ✅ 正確：先檢查是否為 null
if (result) {
  console.log(result.revisedArticle);
}

// ✅ 或使用可選鏈（Optional Chaining）
console.log(result?.revisedArticle);
```

---

### 📚 學習資源

1. **TypeScript 官方教學**
   https://www.typescriptlang.org/docs/handbook/typescript-in-5-minutes.html

2. **React + TypeScript 速查表**
   https://react-typescript-cheatsheet.netlify.app/

3. **本專案實戰學習法**
   - 修改現有組件，觀察 VS Code 的型別提示
   - 嘗試故意寫錯型別，理解錯誤訊息
   - 閱讀 `types.ts`，理解專案的資料結構

---

## 🚀 開發工作流程總結

### 優化寫作指令
```bash
1. 編輯 services/prompts.ts 或 services/curationService.ts
2. npm run dev（如果未執行）
3. 測試 AI 輸出
4. 重複調整直到滿意
```

### 新增頁面功能
```bash
1. 在 types.ts 定義型別（如果需要）
2. 在 App.tsx 或 components/ 修改組件
3. 檢查瀏覽器自動重新載入的結果
4. 使用瀏覽器開發者工具除錯（F12）
```

### TypeScript 開發技巧
```bash
1. 善用 VS Code 的自動完成（Ctrl+Space）
2. 看到紅色波浪線時，將滑鼠移上去看錯誤訊息
3. 遇到不懂的型別，按 Cmd/Ctrl+點擊跳轉查看
```

---

## ❓ 常見問題

### Q1: 修改程式碼後沒有看到變化？
**A**: 確認開發伺服器有在運行（`npm run dev`），並且瀏覽器已重新載入。若仍無效，按 `Ctrl+C` 停止伺服器，再重新執行 `npm run dev`。

### Q2: TypeScript 報錯但我不知道怎麼修？
**A**:
1. 複製錯誤訊息，Google 搜尋「TypeScript [錯誤訊息]」
2. 查看 `types.ts` 確認正確的型別定義
3. 將滑鼠移到紅色波浪線上，看 VS Code 的詳細說明

### Q3: 如何測試 AI 指令是否有效？
**A**: 使用「懶人包生成」功能測試：
- 點擊編輯器的「魔法棒」按鈕
- 輸入相同的主題和網址
- 比較修改前後的輸出差異

### Q4: 如何讓 Worker 後端生效？
**A**: 本地開發時：
```bash
cd worker
npm install
npm run dev  # 啟動在 localhost:8787

# 然後在專案根目錄的 .env.local 設定：
# API_ENDPOINT=http://localhost:8787
```

---

## 📞 需要協助？

1. **查看錯誤訊息**：瀏覽器按 F12 打開開發者工具，查看 Console 分頁
2. **檢查檔案路徑**：確認修改的檔案位置正確
3. **Git 版本控制**：使用 `git status` 查看修改了哪些檔案

---

**文件版本**: v1.0
**最後更新**: 2025-12-27
**維護者**: Claude Code
