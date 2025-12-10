import { GoogleGenAI } from "@google/genai";

interface ScrapedContent {
  id: number;
  url: string;
  title: string;
  content: string;
}

// Stage 0: Client-Side Scraping (Simulated Backend)
// We use proxies to bypass CORS, similar to SitemapInput
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
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout per proxy

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
    throw new Error(`Failed to fetch content from: ${url}`);
  }

  // Parse and Clean
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlText, "text/html");

  // Remove noise
  const removeTags = ['script', 'style', 'nav', 'footer', 'iframe', 'noscript', 'svg'];
  removeTags.forEach(tag => {
    const elements = doc.querySelectorAll(tag);
    elements.forEach(el => el.remove());
  });

  // Extract Title and Main Content (Simple Heuristic)
  const title = doc.title || "Untitled Article";
  const bodyText = doc.body.innerText.replace(/\s+/g, ' ').trim(); // Collapse whitespace

  // Limit content length to prevent token overflow (approx 15k chars per article is safe for Gemini Pro)
  const truncatedContent = bodyText.slice(0, 15000);

  return {
    id,
    url,
    title,
    content: truncatedContent
  };
};

// Stage 1: The Analyst
const runAnalystStage = async (ai: GoogleGenAI, topic: string, scrapedData: ScrapedContent[]): Promise<string> => {
  const jsonString = JSON.stringify(scrapedData.map(d => ({
    id: d.id,
    title: d.title,
    content: d.content
  })));

  const systemInstruction = `
You are a meticulous Research Analyst. Your job is to read the provided raw text and extract key information relevant to the User's Topic.

Strict Rules:
1. Only extract facts present in the text. Do not add outside knowledge.
2. Group facts by "Sub-themes" (e.g., Hardware, Software, Tips, History).
3. Crucial: Maintain the Source ID (e.g., [Source: 1]) for every fact or quote so we can cite it later.
4. If the articles are irrelevant to the topic, state that clearly.

Output Format:
Return a structured set of notes in Markdown.
`;

  const userPrompt = `
Topic: ${topic}
Raw Data: ${jsonString}
`;

  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: userPrompt,
    config: {
      systemInstruction: systemInstruction,
      thinkingConfig: { thinkingBudget: 4096 } // Increased thinking budget for better extraction
    },
  });

  return response.text || "No analysis generated.";
};

// Stage 2: The Editor
const runEditorStage = async (ai: GoogleGenAI, intro: string, researchNotes: string, sources: ScrapedContent[]): Promise<string> => {
  
  const sourceMetadata = sources.map(s => `ID: ${s.id} -> URL: ${s.url} (Title: ${s.title})`).join("\n");

  const systemInstruction = `
You are a Senior Content Curator. Your job is to write a cohesive "Lazy Pack" (Summary Article) based on the Research Notes provided.

Instructions:
1. **Title**: Generate an engaging, SEO-friendly <h1> title based on the Topic at the very beginning of the HTML.
2. **Tone**: Analyze the User Intro provided below and mimic its tone exactly (e.g., professional, casual, witty, sarcastic). Start the article with a polished version of that intro.
3. **Structure**: Use HTML <h2> tags to organize the content by logical sub-themes. Use <ul> and <li> for lists.
4. **Linking**: At the end of every section or after specific claims, insert a "Read More" link using the source metadata provided.
5. **Format**: Return ONLY valid HTML code inside the body tag (do not include <html>, <head>, or <body> tags). Use <h1>, <h2>, <p>, <ul>, <li>, <strong>.
6. **Language**: Traditional Chinese (繁體中文).
7. **Citation Format**: STRICTLY use this format: (延伸閱讀：<a href="{Original_URL}" target="_blank">{Original_Title}</a>). Do NOT use English like "Extended Reading".

Do not use Markdown. Output raw HTML.
`;

  const userPrompt = `
User Intro (Set the Tone): ${intro}

Research Notes (from Analyst):
${researchNotes}

Source Metadata:
${sourceMetadata}
`;

  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: userPrompt,
    config: {
      systemInstruction: systemInstruction,
      thinkingConfig: { thinkingBudget: 2048 } // Added budget for creative writing structure
    },
  });

  // Clean markdown code blocks if Gemini returns them (```html ... ```)
  let html = response.text || "";
  html = html.replace(/```html/g, '').replace(/```/g, '').trim();
  
  return html;
};

export const generateCuratedArticle = async (
  topic: string, 
  intro: string, 
  urls: string[], 
  onStatusChange: (status: 'scraping' | 'analyzing' | 'writing' | 'done') => void
): Promise<string> => {
  if (!process.env.API_KEY) throw new Error("API Key missing");
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  // 1. Scraping
  onStatusChange('scraping');
  const scrapedData: ScrapedContent[] = [];
  
  // Parallel fetch (limited to 5 to avoid browser/proxy throttling issues)
  const promises = urls.slice(0, 5).map((url, index) => fetchAndCleanUrl(url, index + 1));
  const results = await Promise.allSettled(promises);

  results.forEach((res) => {
    if (res.status === 'fulfilled') {
      scrapedData.push(res.value);
    } else {
      console.error("Scraping error:", res.reason);
    }
  });

  if (scrapedData.length === 0) {
    throw new Error("Could not scrape any provided URLs. Please check the links.");
  }

  // 2. Analyst
  onStatusChange('analyzing');
  const researchNotes = await runAnalystStage(ai, topic, scrapedData);

  // 3. Editor
  onStatusChange('writing');
  const finalHtml = await runEditorStage(ai, intro, researchNotes, scrapedData);

  onStatusChange('done');
  return finalHtml;
};