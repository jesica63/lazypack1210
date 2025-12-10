import React, { useState } from 'react';
import { Globe, AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';

interface SitemapInputProps {
  onUrlsParsed: (urls: string[]) => void;
}

const SitemapInput: React.FC<SitemapInputProps> = ({ onUrlsParsed }) => {
  const [mode, setMode] = useState<'url' | 'manual'>('url');
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successCount, setSuccessCount] = useState<number | null>(null);

  const extractUrlsFromText = (text: string, baseUrl: string): string[] => {
    const urls: Set<string> = new Set();
    
    // 1. Try Parsing as XML
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(text, "text/xml");
      const locElements = xmlDoc.getElementsByTagName("loc");
      
      // Check if it's a valid XML parse (no parser error tags)
      if (xmlDoc.getElementsByTagName("parsererror").length === 0 && locElements.length > 0) {
         for (let i = 0; i < locElements.length; i++) {
            if (locElements[i].textContent) {
              urls.add(locElements[i].textContent!.trim());
            }
          }
          return Array.from(urls);
      }
    } catch (e) {
        // Ignore XML errors, try HTML
    }

    // 2. Try Parsing as HTML (Crawler mode for "Sitemap Extractor")
    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, "text/html");
        const links = doc.getElementsByTagName("a");
        
        const baseOrigin = new URL(baseUrl).origin;

        for (let i = 0; i < links.length; i++) {
            const href = links[i].getAttribute('href');
            if (href) {
                // Resolve relative URLs
                try {
                    const fullUrl = new URL(href, baseUrl).toString();
                    // Only keep internal links (same origin)
                    if (fullUrl.startsWith(baseOrigin)) {
                        urls.add(fullUrl);
                    }
                } catch (e) {
                    // Invalid URL, skip
                }
            }
        }
    } catch (e) {
        console.error("HTML parsing failed", e);
    }
    
    return Array.from(urls);
  };

  const handleFetch = async () => {
    if (!inputValue) return;
    setLoading(true);
    setError(null);
    setSuccessCount(null);
    
    // Normalize URL
    let targetUrl = inputValue.trim();
    if (!targetUrl.startsWith('http')) {
        targetUrl = 'https://' + targetUrl;
    }

    // Try a list of proxies to get around CORS
    const proxies = [
        (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
        (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`
    ];

    let content = '';
    let fetchSuccess = false;

    for (const proxyGen of proxies) {
        try {
            const proxyUrl = proxyGen(targetUrl);
            const response = await fetch(proxyUrl);
            if (response.ok) {
                content = await response.text();
                fetchSuccess = true;
                break;
            }
        } catch (err) {
            console.warn("Proxy failed", err);
        }
    }

    if (!fetchSuccess) {
        setError(`無法讀取網址。這通常是因為網站防火牆阻擋了代理伺服器。請嘗試手動複製 XML/HTML 內容到「手動輸入」分頁。`);
        setLoading(false);
        return;
    }

    const extractedUrls = extractUrlsFromText(content, targetUrl);

    if (extractedUrls.length > 0) {
        setSuccessCount(extractedUrls.length);
        onUrlsParsed(extractedUrls);
    } else {
        setError("未找到有效的 URL。請確認這是 Sitemap XML 或是包含文章連結的列表頁面。");
    }
    
    setLoading(false);
  };

  const handleManualSubmit = () => {
    // Basic line splitting detection
    const lines = inputValue.split('\n').map(u => u.trim()).filter(u => u.length > 0);
    
    // Check if it looks like XML content
    if (inputValue.includes('<loc>')) {
        const extracted = extractUrlsFromText(inputValue, 'http://manual-input.com');
        if (extracted.length > 0) {
            setSuccessCount(extracted.length);
            onUrlsParsed(extracted);
            setError(null);
            return;
        }
    }

    // Treat as line-separated list
    const validUrls = lines.filter(l => l.startsWith('http'));

    if (validUrls.length > 0) {
      setSuccessCount(validUrls.length);
      onUrlsParsed(validUrls);
      setError(null);
    } else {
      setError("找不到有效的 URL。請貼上 XML 內容或以 http 開頭的網址列表。");
    }
  };

  return (
    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4">
      <div className="flex items-center justify-between mb-2">
        <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
          <Globe className="w-4 h-4 text-indigo-600" />
          Sitemap / 連結來源
        </label>
        <div className="flex bg-slate-100 p-1 rounded-lg">
          <button
            onClick={() => { setMode('url'); setError(null); }}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${mode === 'url' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            網址抓取
          </button>
          <button
            onClick={() => { setMode('manual'); setError(null); }}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${mode === 'manual' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            手動輸入
          </button>
        </div>
      </div>

      {mode === 'url' ? (
        <div className="space-y-2">
            <div className="flex gap-2">
            <input
                type="url"
                placeholder="輸入 Sitemap.xml 或 文章列表頁網址..."
                className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleFetch()}
                disabled={loading}
            />
            <button
                onClick={handleFetch}
                disabled={loading || !inputValue}
                className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 min-w-[80px] justify-center"
            >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : '抓取'}
            </button>
            </div>
            <p className="text-[10px] text-slate-400 pl-1">
                支援 XML Sitemap 或一般的文章列表頁面 (HTML)。
            </p>
        </div>
      ) : (
        <div className="space-y-2">
          <textarea
            placeholder="請在此貼上 sitemap.xml 的內容，或是貼上一串網址..."
            className="w-full h-32 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none font-mono text-xs"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
          />
          <button
            onClick={handleManualSubmit}
            disabled={!inputValue}
            className="w-full py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            分析內容
          </button>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 text-xs text-red-600 bg-red-50 p-2 rounded-lg border border-red-100">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {successCount !== null && (
        <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 p-2 rounded-lg border border-emerald-100">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <p>成功解析 <strong>{successCount}</strong> 個連結。</p>
        </div>
      )}
    </div>
  );
};

export default SitemapInput;