import { GoogleGenAI, SchemaType } from "@google/genai";
import { ScrapedContent, ArchitectDraft } from "../types";

// ==========================================
// Configuration: 公司語態設定
// ==========================================
const COMPANY_STYLE_GUIDE = `
【公司寫作風格指南】
1. **語氣設定**：專業但不嚴肅，像是善用淺白語言讓外行人讀者理解的新聞編輯。
2. **格式要求**：
   - 每個小標的風格是入門者想要知道的問題問法，小標後此段內容就是用來回答此問題。如：TPU是什麼？
   - 每一段落長度控制在 250-350 字之間，避免閱讀疲勞。
   - 拒絕廢話，第一句話就切入重點。
3. **術語規範**：遇到英文專有名詞，第一次出現時請標註中文解釋。標點符號皆為全形。
4. **絕對禁語**：不要使用「讓我們繼續看下去」、「小編」、「總而言之」這類農場文用語。英文或數字前後不要有空格。
`;

// ==========================================
// Stage 0: The Search Assistant (資料蒐集)
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
      const timeoutId = setTimeout(() => controller.abort(), 10000); 

      const response = await fetch(proxyGen(url), { signal: controller.signal });
      clearTimeout(timeoutId);

      if (response.ok) {
        htmlText = await response.text();
        fetched = true;
        break;
      }
    } catch (e) {
      console.warn(`Proxy failed for ${url}`, e);
    }
  }

  if (!fetched) {
    return {
        id,
        url,
        title: "Load Failed",
        content: ""
    };
  }

  // Parse and Clean
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlText, "text/html");

  const removeTags = ['script', 'style', 'nav', 'footer', 'iframe', 'noscript', 'svg', 'header', 'aside'];
  removeTags.forEach(tag => {
    const elements = doc.querySelectorAll(tag);
    elements.forEach(el => el.remove());
  });

  const title = doc.title || "Untitled Article";
  const bodyText = doc.body.innerText.replace(/\s+/g, ' ').trim();
  const truncatedContent = bodyText.slice(0, 12000); // Limit context

  return {
    id,
    url,
    title,
    content: truncatedContent
  };
};

// ==========================================
// Stage 1: The Architect (架構師 - JSON Schema)
// ==========================================
const runArchitectStage = async (
  ai: GoogleGenAI, 
  topic: string, 
  outline: string[], 
  scrapedData: ScrapedContent[]
): Promise<ArchitectDraft[]> => {
  
  // Filter out empty content
  const validData = scrapedData.filter(d => d.content.length > 50);
  const dataContext = validData.map(d => `[Source ID: ${d.id}] (Title: ${d.title})\n${d.content}`).join("\n\n---\n\n");

  const systemInstruction = `
    你是一名資訊架構師。你的任務是閱讀「原始資料」，並根據使用者提供的「大綱」，
    將資料分配到大綱的每一個段落中。
    
    規則：
    1. **必須嚴格遵守使用者的大綱順序**，不可遺漏任何一點。
    2. 每個段落必須提取充足的資訊，足以讓編輯擴寫成 200 字以上的段落。
    3. 必須標記資訊來源 ID (Source ID)。
    4. 如果某個大綱段落找不到相關資料，請在 contentDraft 中標註「無資料，請根據常識撰寫」。
  `;

  const userPrompt = `
    主題：${topic}
    
    使用者大綱 (請為以下每一點生成內容草稿)：
    ${JSON.stringify(outline)}

    原始資料：
    ${dataContext}
  `;

  // Define Schema strictly
  const schema = {
    type: SchemaType.ARRAY,
    items: {
      type: SchemaType.OBJECT,
      properties: {
        sectionTitle: { type: SchemaType.STRING, description: "對應的使用者大綱標題" },
        contentDraft: { type: SchemaType.STRING, description: "該段落的詳細事實筆記，包含數據與引用" },
        sourceIds: { 
          type: SchemaType.ARRAY, 
          items: { type: SchemaType.NUMBER },
          description: "該段落引用的來源 ID 列表" 
        }
      },
      required: ["sectionTitle", "contentDraft", "sourceIds"]
    }
  };

  try {
    const response = await ai.models.generateContent({
      model: "gemini-1.5-pro",
      contents: [{ parts: [{ text: userPrompt }] }],
      config: {
        systemInstruction: { parts: [{ text: systemInstruction }] },
        responseMimeType: "application/json",
        responseSchema: schema,
      },
    });

    const text = response.text() || "[]";
    return JSON.parse(text) as ArchitectDraft[];

  } catch (error) {
    console.error("Architect stage failed:", error);
    throw new Error("文章架構生成失敗，請稍後再試。");
  }
};

// ==========================================
// Stage 2: The Chief Editor (總編輯 - Style Enforcement)
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
    
    執行細節：
    1. **開場 (Intro)**：根據使用者的指示 (${userIntro}) 寫一段精彩的開場白。
    2. **內文擴寫**：針對 JSON 中的每一個 sectionTitle，使用 contentDraft 寫出一段完整的內容。
       - 使用 <h2> 作為段落標題。
       - 內容長度必須均勻，每段約 150-250 字。
       - 適當使用 <ul>, <li> 條列式呈現複雜資訊。
    3. **引用來源**：在每個段落結束後，根據 sourceIds，加入延伸閱讀連結。
       - 格式：<br><small>(延伸閱讀：<a href="{URL}" target="_blank">{Title}</a>)</small>
    4. **結語**：自動產生一段總結。
    
    輸出格式：
    僅回傳 HTML <body> 內的代碼，不要 Markdown 標記，不要 <html> 標籤。
  `;

  const userPrompt = `
    文章主題：${topic}
    
    架構師提供的草稿 (JSON)：
    ${draftContext}

    來源資料對照表：
    ${sourcesMetadata}
  `;

  const response = await ai.models.generateContent({
    model: "gemini-1.5-pro",
    contents: [{ parts: [{ text: userPrompt }] }],
    config: {
      systemInstruction: { parts: [{ text: systemInstruction }] },
    },
  });

  let html = response.text() || "";
  html = html.replace(/```html/g, '').replace(/```/g, '').trim();
  return html;
};

// ==========================================
// Main Function
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
  
  const promises = urls.slice(0, 5).map((url, index) => fetchAndCleanUrl(url, index + 1));
  const results = await Promise.allSettled(promises);

  results.forEach((res) => {
    if (res.status === 'fulfilled' && res.value.content) {
      scrapedData.push(res.value);
    }
  });

  if (scrapedData.length === 0) {
    throw new Error("無法讀取任何提供的網址內容。");
  }

  // 2. Architect (The Planner)
  onStatusChange('analyzing');
  const effectiveOutline = outline.length > 0 ? outline : ["背景介紹", "核心重點", "詳細分析", "結論"];
  const drafts = await runArchitectStage(ai, topic, effectiveOutline, scrapedData);

  // 3. Editor (The Writer)
  onStatusChange('writing');
  const finalHtml = await runEditorStage(ai, topic, intro, drafts, scrapedData);

  onStatusChange('done');
  return finalHtml;
};
