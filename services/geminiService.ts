
import { GoogleGenAI, Type, Schema } from "@google/genai";
import { AnalysisResult } from "../types";
import { SYSTEM_INSTRUCTION } from "./prompts";

const processSitemapUrls = (urls: string[]): string => {
  // Truncate list if too long to save context.
  // We take the first 500 URLs to stay within reasonable context limits for a demo.
  return urls.slice(0, 500).join("\n");
};

export const analyzeArticleWithGemini = async (
  articleContent: string,
  urlList: string[]
): Promise<AnalysisResult> => {
  if (!process.env.API_KEY) {
    throw new Error("API Key is missing.");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  // Schema definition for structured output
  const responseSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      revisedArticle: {
        type: Type.STRING,
        description: "The full article content in Markdown format with the new internal links inserted using [anchor](url) syntax. Keep original H1, H2, H3 formatting.",
      },
      suggestions: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            originalSegment: {
              type: Type.STRING,
              description: "The original sentence or paragraph before modification.",
            },
            revisedSegment: {
              type: Type.STRING,
              description: "The contextually optimized sentence containing the new link.",
            },
            anchorText: {
              type: Type.STRING,
              description: "The exact anchor text used for the link.",
            },
            targetUrl: {
              type: Type.STRING,
              description: "The URL that was linked to.",
            },
            reason: {
              type: Type.STRING,
              description: "Explanation of why this link is SEO-friendly and relevant to the context (in Traditional Chinese).",
            },
          },
          required: ["anchorText", "targetUrl", "reason", "revisedSegment"],
        },
      },
    },
    required: ["revisedArticle", "suggestions"],
  };

  const userPrompt = `
    文章內容 (Article Content):
    ${articleContent}

    ---
    可用的 Sitemap URL 列表 (從中選擇最匹配的連結):
    ${processSitemapUrls(urlList)}
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview", // Using Pro for complex reasoning/SEO logic
      contents: userPrompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        thinkingConfig: { thinkingBudget: 1024 }
      },
    });

    const jsonText = response.text;
    if (!jsonText) {
      throw new Error("No response from Gemini.");
    }

    const result = JSON.parse(jsonText) as AnalysisResult;
    return result;
  } catch (error) {
    // Log generic error to avoid leaking prompt details in console if user opens devtools
    console.error("Gemini Analysis Error occurred.");
    throw error;
  }
};