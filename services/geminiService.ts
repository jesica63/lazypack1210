import { Type, Schema } from "@google/genai";
import { AnalysisResult } from "../types";
import { SYSTEM_INSTRUCTION } from "./prompts";

// 🔒 Security Fix: Use backend API proxy instead of direct Gemini API calls
// API 端點配置
const API_ENDPOINT = process.env.API_ENDPOINT || 'http://localhost:8787';

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

export const analyzeArticleWithGemini = async (
  articleContent: string,
  urlList: string[]
): Promise<AnalysisResult> => {
  try {
    // 呼叫後端 API 代理，而非直接呼叫 Gemini
    const response = await fetch(`${API_ENDPOINT}/api/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        articleContent,
        urlList,
        systemInstruction: SYSTEM_INSTRUCTION,
        responseSchema
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `API request failed: ${response.status}`);
    }

    const result = await response.json() as AnalysisResult;
    return result;

  } catch (error) {
    console.error("Analysis Error occurred.", error);
    throw error;
  }
};