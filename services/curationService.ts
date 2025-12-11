import { GoogleGenAI, Type } from "@google/genai";
import { ScrapedContent, ArchitectDraft } from "../types";

// ==========================================
// 1. Configuration: 公司語態設定 (Style Guide)
// ==========================================
const COMPANY_STYLE_GUIDE = `
【公司寫作風格指南】
1. **語氣設定**：專業但不嚴肅，像是一位資深繁體中文台灣用語新聞編輯用淺白方式科普。
2. **格式要求**：
   - 小標題 (H2) 請使用「問句」或「強烈觀點」的寫法，例如「為什麼你需要...?」而非「背景介紹」。
   - 每一段落長度控制在 250-550 字之間，避免閱讀疲勞。
   - 拒絕廢話，第一句話就切入重點。
3. **術語規範**：遇到英文專有名詞，第一次出現時請標註中文解釋。標點符號一律使用全形。
4. **絕對禁語**：不要使用「讓我們繼續看下去」、「小編」、「總而言之」、「綜上所述」這類農場文或過度煽情激動的用語。英文與數字前後不可加入半形空格。
`;

// ==========================================
// Stage 0: The Search Assistant (資料蒐集助理)
// ==========================================
const fetchAndCleanUrl = async (url: string, id: number): Promise<ScrapedContent> => {
  const proxies = [
    (u: string) => `https://corsproxy.io/?${encodeURIComponent(u)}`,
    (u: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`
  ];

  let htmlText = '';
  let fetched = false;

  for (const proxyGen of proxies) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); 

      const response = await fetch(proxyGen(url), { signal: controller.signal });
      clearTimeout(timeoutId);

      if (response.ok) {
        htmlText = await response.text();
        if (htmlText.length > 500) {
            fetched = true;
            break;
        }
      }
    } catch (e) {
      console.warn(`Proxy failed for ${url}`, e);
    }
  }

  if (!fetched) {
    return { id, url, title: "Load Failed", content: "" };
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlText, "text/html");

  const removeTags = ['script', 'style', 'nav', 'footer', 'iframe', 'noscript', 'svg', 'header', 'aside', 'form', 'button', 'ads'];
  removeTags.forEach(tag => {
    const elements = doc.querySelectorAll(tag);
    elements.forEach(el => el.remove());
  });

  const title = doc.title || "Untitled Article";
  const bodyText = doc.body.innerText.replace(/\s+/g, ' ').trim();
  const truncatedContent = bodyText.slice(0, 20000); 

  return {
    id,
    url,
    title,
    content: truncatedContent
  };
};

// ==========================================
// Stage 1: The Architect (架構師 - 結構化輸出)
// ==========================================
const runArchitectStage = async (
  ai: GoogleGenAI, 
  topic: string, 
  outline: string[], 
  scrapedData: ScrapedContent[]
): Promise<ArchitectDraft[]> => {
  
  const validData = scrapedData.filter(d => d.content.length > 100);
  
  if (validData.length === 0) {
    throw new Error("無法讀取任何有效內容。請檢查網址是否公開且無防火牆阻擋。");
  }

  const dataContext = validData.map(d => `[Source ID: ${d.id}] (Title: ${d.title})\n${d.content}`).join("\n\n---\n\n");

  const systemInstruction = `
    你是一名資訊架構師。你的任務是閱讀「原始資料」，並根據使用者提供的「大綱」，將資料分配到大綱的每一個段落中。
    
    【嚴格規則】
    1. **結構一致性**：必須嚴格遵守使用者的大綱順序，不可遺漏任何一點，也不可自行增加大綱以外的段落。
    2. **內容豐富度**：每個段落必須提取充足的資訊（數據、案例、觀點），足以讓編輯擴寫成 300 字以上的段落。
    3. **來源標記**：必須標記資訊來源 ID (Source ID)。
    4. **缺漏處理**：如果某個大綱段落找不到相關資料，請在 contentDraft 中明確標註「無直接資料，請根據常識與主題邏輯撰寫」，不要瞎掰來源。
  `;

  const userPrompt = `
    主題：${topic}
    
    使用者大綱 (請為以下每一點生成內容草稿)：
    ${JSON.stringify(outline)}

    原始資料：
    ${dataContext}
  `;

  // 修正 1: 使用 Type 而不是 SchemaType
  const schema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        sectionTitle: { type: Type.STRING, description: "對應的使用者大綱標題" },
        contentDraft: { type: Type.STRING, description: "該段落的詳細事實筆記，包含數據與引用" },
        sourceIds: { 
          type: Type.ARRAY, 
          items: { type: Type.NUMBER },
          description: "該段落引用的來源 ID 列表" 
        }
      },
      required: ["sectionTitle", "contentDraft", "sourceIds"]
    }
  };

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash-exp", 
      contents: [{ parts: [{ text: userPrompt }] }],
      config: {
        systemInstruction: { parts: [{ text: systemInstruction }] },
        responseMimeType: "application/json",
        responseSchema: schema,
      },
    });

    // 修正 2: 移除括號。新版 SDK 中 text 是屬性不是方法。
    // 原本: response.text() -> 錯誤
    // 現在: response.text   -> 正確
    const text = response.text; 
    
    if (!text) throw new Error("AI 回傳空內容");

    return JSON.parse(text) as ArchitectDraft[];

  } catch (error: any) {
    console.error("Architect stage failed detail:", error);
    throw new Error(`文章架構生成失敗: ${error.message || "未知錯誤"}`);
  }
};

// ==========================================
// Stage 2: The Chief Editor (總編輯 - 風格潤飾)
// ==========================================
const runEditorStage = async (
  ai: GoogleGenAI, 
  topic: string,
  userIntro: string,
  architectDrafts: ArchitectDraft[],
  sources: ScrapedContent[]
): Promise<string> => {

  const sourcesMetadata = JSON.stringify(sources.map(s => ({ id: s.id, url: s.url, title: s.title })));
  const draftContext = JSON.stringify(architectDrafts);

  const systemInstruction = `
    ${COMPANY_STYLE_GUIDE}

    你現在是總編輯。你的任務是將架構師提供的「段落草稿」改寫成一篇完整的 HTML 懶人包文章。
    
    【執行細節】
    1. **開場 (Intro)**：根據使用者的指示 (${userIntro}) 寫一段淺白生動，不煽情的開場白。
    2. **內文擴寫**：針對 JSON 中的每一個 sectionTitle，使用 contentDraft 寫出一段完整的內容。
       - 使用 <h2> 作為段落標題。
       - 內容長度必須控制在 300-500 字左右，保持各段落平衡。
       - 適當使用 <ul>, <li> 條列式呈現複雜資訊，增加易讀性。
    3. **引用來源**：在每個段落結束後，根據 sourceIds，加入延伸閱讀連結。
       - 格式：<br><small>(延伸閱讀：<a href="{URL}" target="_blank">{Title}</a>)</small>
    4. **結語**：自動產生一段總結。
    
    【輸出格式】
    僅回傳 HTML <body> 內的代碼，不要 Markdown 標記，不要 <html> 標籤。
  `;

  const userPrompt = `
    文章主題：${topic}
    
    架構師提供的草稿 (JSON)：
    ${draftContext}

    來源資料對照表：
    ${sourcesMetadata}
  `;

  try {
      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash-exp", 
        contents: [{ parts: [{ text: userPrompt }] }],
        config: {
          systemInstruction: { parts: [{ text: systemInstruction }] },
        },
      });

      // 修正 2: 同樣移除括號
      let html = response.text || "";
      
      html = html.replace(/```html/g, '').replace(/```/g, '').trim();
      return html;
  } catch (error: any) {
      console.error("Editor stage failed:", error);
      throw new Error(`文章撰寫失敗: ${error.message}`);
  }
};

// ==========================================
// Main Function (主程式入口)
// ==========================================
export const generateCuratedArticle = async (
  topic: string, 
  intro: string, 
  outline: string[],
  urls: string[], 
  onStatusChange: (status: 'scraping' | 'analyzing' | 'writing' | 'done') => void
): Promise<string> => {
  if (!process.env.API_KEY) throw new Error("API Key missing");
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  // 1. Scraping
  onStatusChange('scraping');
  const scrapedData: ScrapedContent[] = [];
  
  const promises = urls.slice(0, 6).map((url, index) => fetchAndCleanUrl(url, index + 1));
  const results = await Promise.allSettled(promises);

  results.forEach((res) => {
    if (res.status === 'fulfilled' && res.value.content) {
      scrapedData.push(res.value);
    }
  });

  if (scrapedData.filter(d => d.content.length > 100).length === 0) {
    throw new Error("所有提供的網址都無法讀取，或內容過短。請確認網址是否公開且無防火牆。");
  }

  // 2. Architect
  onStatusChange('analyzing');
  const effectiveOutline = (outline && outline.length > 0) 
    ? outline 
    : ["背景與前言", "核心議題分析", "主要優勢與挑戰", "未來展望與建議"];
    
  const drafts = await runArchitectStage(ai, topic, effectiveOutline, scrapedData);

  // 3. Editor
  onStatusChange('writing');
  const finalHtml = await runEditorStage(ai, topic, intro, drafts, scrapedData);

  onStatusChange('done');
  return finalHtml;
};