import React, { useState } from 'react';
import { AnalysisResult } from '../types';
import { FileText, ArrowRight, Sparkles, Download, Copy, Check } from 'lucide-react';
import { marked } from 'marked';

// Security Fix: Custom Sanitizer
// 自製清洗器：移除危險的腳本，但保留安全的 HTML 標籤 (如連結 a, 列表 ul/li, 標題 h2)
const sanitizeHtml = (html: string) => {
  if (!html) return "";
  // 1. 移除 script 標籤
  let clean = html.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gim, "");
  // 2. 移除事件監聽器 (如 onclick)
  clean = clean.replace(/ on\w+="[^"]*"/g, "");
  // 3. 移除 javascript: 偽協議
  clean = clean.replace(/javascript:/gi, "");
  return clean;
};

interface ResultViewProps {
  result: AnalysisResult | null;
  loading: boolean;
}

const ResultView: React.FC<ResultViewProps> = ({ result, loading }) => {
  const [copiedRich, setCopiedRich] = useState(false);

  if (loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center space-y-6 text-slate-400 p-8">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <Sparkles className="w-6 h-6 text-indigo-600 animate-pulse" />
          </div>
        </div>
        <div className="text-center space-y-2">
          <p className="text-lg font-medium text-slate-700">Gemini 正在分析中...</p>
          <p className="text-sm">正在計算字數並進行上下文關聯性分析</p>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
        <FileText className="w-12 h-12 mb-4 opacity-50" />
        <p className="text-sm font-medium">準備開始分析</p>
        <p className="text-xs text-slate-400 mt-1">請匯入 Sitemap 並輸入文章內容以開始</p>
      </div>
    );
  }

  // 🔥 核心修復：強力拆除 Markdown 包裝紙
  const cleanMarkdownWrapper = (content: string) => {
    if (!content) return "";
    // 移除 ```html, ```xml, 或純粹的 ```
    return content.replace(/^```[a-z]*\n?/gm, '').replace(/```$/gm, '').trim();
  };

  const getHtml = (content: string) => {
      try {
          // 1. 先拆包裝 (把 ``` 拿掉)
          const rawText = cleanMarkdownWrapper(content);
          
          // 2. 判斷是否需要 marked 解析
          // 如果內容看起來像 HTML (包含 <h2>, <p> 等)，就直接用，不要再用 marked 解析，
          // 因為 marked 有時候會把 HTML 標籤再次轉義 (Escaped)，導致變成原始碼。
          const isHtml = /<[a-z][\s\S]*>/i.test(rawText);
          
          let htmlToSanitize = "";
          if (isHtml) {
             htmlToSanitize = rawText; // 直接視為 HTML
          } else {
             htmlToSanitize = marked.parse(rawText) as string; // 視為 Markdown 轉 HTML
          }

          // 3. 資安清洗
          const cleanHtml = sanitizeHtml(htmlToSanitize);
          
          return { __html: cleanHtml };
      } catch (e) {
          console.error("Parsing error", e);
          return { __html: sanitizeHtml(content) };
      }
  };

  const handleCopyRichText = async () => {
    if (!result) return;
    try {
        const rawText = cleanMarkdownWrapper(result.revisedArticle);
        const isHtml = /<[a-z][\s\S]*>/i.test(rawText);
        let finalHtml = isHtml ? rawText : (await marked.parse(rawText));
        
        finalHtml = sanitizeHtml(finalHtml as string);

        const fullHtml = `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="UTF-8">
              <style>
                body { font-family: sans-serif; line-height: 1.6; }
                a { color: #4f46e5; text-decoration: underline; } /* 強制連結樣式 */
                h2 { margin-top: 1.5em; color: #333; }
                li { margin-bottom: 0.5em; }
              </style>
            </head>
            <body>${finalHtml}</body>
            </html>
        `;

        const blobHtml = new Blob([fullHtml], { type: "text/html" });
        const blobText = new Blob([result.revisedArticle], { type: "text/plain" });
        
        const data = [new ClipboardItem({ 
            "text/html": blobHtml,
            "text/plain": blobText 
        })];
        
        await navigator.clipboard.write(data);
        
        setCopiedRich(true);
        setTimeout(() => setCopiedRich(false), 2000);
    } catch (e) {
        console.error("Rich text copy failed", e);
        navigator.clipboard.writeText(result.revisedArticle);
        alert("複製失敗，已改為複製純文字。");
    }
  };

  const handleExportHtml = async () => {
      if(!result) return;
      
      const rawText = cleanMarkdownWrapper(result.revisedArticle);
      const isHtml = /<[a-z][\s\S]*>/i.test(rawText);
      let finalHtml = isHtml ? rawText : (await marked.parse(rawText));
      finalHtml = sanitizeHtml(finalHtml as string);

      const fullHtml = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Optimized Article</title>
<style>
body { font-family: 'Microsoft JhengHei', sans-serif; max-width: 800px; margin: 2rem auto; padding: 0 1rem; line-height: 1.8; color: #333; }
img { max-width: 100%; height: auto; }
h2 { font-size: 1.5em; border-bottom: 2px solid #eee; padding-bottom: 0.5rem; margin-top: 2rem; color: #2563eb; }
p { margin-bottom: 1.2em; text-align: justify; }
a { color: #2563eb; text-decoration: underline; font-weight: bold; }
a:hover { color: #1d4ed8; }
ul { padding-left: 1.5rem; margin-bottom: 1.5rem; }
li { margin-bottom: 0.5rem; }
</style>
</head>
<body>
${finalHtml}
</body>
</html>`;

    const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `lazypack-article-${new Date().toISOString().slice(0,10)}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const hasSuggestions = result.suggestions && result.suggestions.length > 0;

  return (
    <div className="flex flex-col h-full space-y-4 overflow-hidden">
      {/* Suggestions Summary - Only show if there are suggestions */}
      {hasSuggestions && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 flex-shrink-0 transition-all">
            <h3 className="text-sm font-bold text-indigo-900 flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-indigo-600" />
            建議的內部連結 ({result.suggestions.length})
            </h3>
            <div className="space-y-3 overflow-y-auto max-h-48 pr-2 custom-scrollbar">
            {result.suggestions.map((suggestion, idx) => (
                <div key={idx} className="bg-white p-3 rounded-lg border border-indigo-100 shadow-sm text-sm">
                <div className="flex items-start gap-2 mb-1">
                    <span className="bg-indigo-100 text-indigo-700 text-xs px-1.5 py-0.5 rounded font-bold mt-0.5 flex-shrink-0">連結</span>
                    <p className="font-semibold text-slate-800 break-all">"{suggestion.anchorText}"</p>
                </div>
                <p className="text-xs text-slate-500 truncate mb-2 flex items-center gap-1">
                    <ArrowRight className="w-3 h-3 flex-shrink-0" /> <span className="truncate">{suggestion.targetUrl}</span>
                </p>
                
                {suggestion.revisedSegment && (
                    <div className="mb-2 p-2 bg-slate-50 rounded text-xs text-slate-700 border-l-2 border-green-400">
                        <p className="font-medium text-[10px] text-slate-400 mb-1">上下文優化內容：</p>
                        "{suggestion.revisedSegment}"
                    </div>
                )}

                <div className="text-xs text-slate-600 bg-slate-50 p-2 rounded italic border-l-2 border-indigo-300">
                    "{suggestion.reason}"
                </div>
                </div>
            ))}
            </div>
        </div>
      )}

      {/* Revised Content View */}
      <div className={`flex-1 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden ${!hasSuggestions ? 'h-full' : ''}`}>
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between flex-shrink-0">
          <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <FileText className="w-4 h-4 text-indigo-600" />
            {hasSuggestions ? '修訂後內容 (預覽)' : '懶人包預覽 (可直接點擊連結)'}
          </h2>
          <div className="flex gap-2">
            <button 
                onClick={handleCopyRichText}
                className={`text-xs font-medium px-3 py-1.5 rounded transition-all flex items-center gap-1.5 border ${
                    copiedRich 
                    ? 'bg-green-50 text-green-700 border-green-200' 
                    : 'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700'
                }`}
                title="複製為帶格式的內容 (可直接貼上到 Word/Docs)"
            >
                {copiedRich ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                {copiedRich ? '已複製！' : '複製格式化全文'}
            </button>
            <button 
                onClick={handleExportHtml}
                className="text-xs font-medium px-3 py-1.5 rounded transition-all flex items-center gap-1.5 border text-slate-600 hover:text-indigo-600 border-slate-200 hover:bg-slate-50"
                title="下載 HTML 檔案 (可使用 Word 開啟)"
            >
                <Download className="w-3 h-3" />
                匯出 HTML
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-6 bg-white">
            <div 
                className="prose prose-slate max-w-none prose-sm sm:prose-base prose-headings:font-bold prose-a:text-indigo-600 prose-img:rounded-lg"
                dangerouslySetInnerHTML={getHtml(result.revisedArticle)}
            />
        </div>
      </div>
    </div>
  );
};

export default ResultView;