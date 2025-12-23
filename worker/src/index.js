/**
 * SEO LazyPack API Proxy - Cloudflare Worker
 *
 * This worker acts as a secure proxy between the frontend and Gemini API,
 * protecting the API key from being exposed to clients.
 */

// 允許的來源網域（CORS 設定）
// 🔧 部署後請修改為您的實際網域
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'https://yourdomain.com',  // ⚠️ 請改成您的網域
  'https://www.yourdomain.com'  // ⚠️ 請改成您的網域
];

// Gemini API 端點
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

// CORS Headers
function getCorsHeaders(origin) {
  const isAllowed = ALLOWED_ORIGINS.includes(origin);

  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

// 錯誤回應
function errorResponse(message, status = 500, origin = null) {
  return new Response(
    JSON.stringify({ error: message }),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
        ...(origin ? getCorsHeaders(origin) : {})
      }
    }
  );
}

// 成功回應
function successResponse(data, origin) {
  return new Response(
    JSON.stringify(data),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...getCorsHeaders(origin)
      }
    }
  );
}

// 呼叫 Gemini API
async function callGeminiAPI(apiKey, endpoint, requestBody) {
  // 使用 URL query parameter 傳遞 API key（Gemini API 的標準方式）
  const url = `${GEMINI_API_BASE}/${endpoint}?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
  }

  return response.json();
}

// 處理分析請求（內部連結分析）
async function handleAnalyze(request, env, origin) {
  try {
    const body = await request.json();
    const { articleContent, urlList, systemInstruction } = body;

    if (!articleContent || !urlList || !systemInstruction) {
      return errorResponse('Missing required fields: articleContent, urlList, systemInstruction', 400, origin);
    }

    // 限制 URL 列表長度
    const limitedUrls = urlList.slice(0, 500);

    // 構建請求體
    const userPrompt = `
文章內容 (Article Content):
${articleContent}

---
可用的 Sitemap URL 列表 (從中選擇最匹配的連結):
${limitedUrls.join('\n')}
    `.trim();

    const geminiRequest = {
      contents: [
        {
          parts: [{ text: userPrompt }]
        }
      ],
      systemInstruction: {
        parts: [{ text: systemInstruction }]
      },
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: body.responseSchema || undefined
      }
    };

    // 呼叫 Gemini API
    const result = await callGeminiAPI(
      env.GEMINI_API_KEY,
      'models/gemini-2.0-flash-exp:generateContent',
      geminiRequest
    );

    // 提取並解析回應
    const text = result.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      throw new Error('No text response from Gemini');
    }

    const parsedResult = JSON.parse(text);

    return successResponse(parsedResult, origin);

  } catch (error) {
    console.error('Analyze error:', error);
    return errorResponse(error.message || 'Analysis failed', 500, origin);
  }
}

// 處理懶人包生成請求
async function handleCuration(request, env, origin) {
  try {
    const body = await request.json();
    const { prompt, systemInstruction, responseSchema } = body;

    if (!prompt || !systemInstruction) {
      return errorResponse('Missing required fields: prompt, systemInstruction', 400, origin);
    }

    const geminiRequest = {
      contents: [
        {
          parts: [{ text: prompt }]
        }
      ],
      systemInstruction: {
        parts: [{ text: systemInstruction }]
      },
      generationConfig: responseSchema ? {
        responseMimeType: 'application/json',
        responseSchema: responseSchema
      } : {}
    };

    // 呼叫 Gemini API
    const result = await callGeminiAPI(
      env.GEMINI_API_KEY,
      'models/gemini-2.0-flash-exp:generateContent',
      geminiRequest
    );

    // 提取回應文字
    const text = result.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      throw new Error('No text response from Gemini');
    }

    // 如果有 responseSchema，解析為 JSON；否則返回純文字
    const responseData = responseSchema ? JSON.parse(text) : { text };

    return successResponse(responseData, origin);

  } catch (error) {
    console.error('Curation error:', error);
    return errorResponse(error.message || 'Curation failed', 500, origin);
  }
}

// 健康檢查端點
function handleHealth(origin) {
  return successResponse(
    {
      status: 'ok',
      service: 'SEO LazyPack API Proxy',
      version: '1.0.0',
      timestamp: new Date().toISOString()
    },
    origin
  );
}

// 主要的 Worker fetch handler
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin');

    // 處理 CORS 預檢請求
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: getCorsHeaders(origin)
      });
    }

    // 檢查 API Key 是否設定
    if (!env.GEMINI_API_KEY) {
      return errorResponse('API key not configured', 500, origin);
    }

    // 路由處理
    switch (url.pathname) {
      case '/health':
      case '/':
        return handleHealth(origin);

      case '/api/analyze':
        if (request.method !== 'POST') {
          return errorResponse('Method not allowed', 405, origin);
        }
        return handleAnalyze(request, env, origin);

      case '/api/curate':
        if (request.method !== 'POST') {
          return errorResponse('Method not allowed', 405, origin);
        }
        return handleCuration(request, env, origin);

      default:
        return errorResponse('Not found', 404, origin);
    }
  }
};
