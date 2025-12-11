import React, { useEffect, useRef, useState } from 'react';
import { PenTool, Upload, AlertCircle, Download, FileCode, List, Target, ChevronRight, Hash, Type, Wand2, X, Loader2 } from 'lucide-react';
import * as mammoth from 'mammoth';
import Quill from 'quill';
import { marked } from 'marked';
import { generateCuratedArticle } from '../services/curationService';
import { CurationStatus } from '../types';

interface ArticleEditorProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  onCurationComplete?: (html: string) => void;
}

interface OutlineItem {
  id: string;
  text: string;
  tag: string; // h1, h2, h3
  index: number;
}

const ArticleEditor: React.FC<ArticleEditorProps> = ({ value, onChange, disabled, onCurationComplete }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const quillRef = useRef<Quill | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const lastEmittedValue = useRef<string>(value);

  // New State for SEO & Outline
  const [outline, setOutline] = useState<OutlineItem[]>([]);
  const [showOutline, setShowOutline] = useState(true);
  const [focusKeyword, setFocusKeyword] = useState('');
  const [stats, setStats] = useState({ wordCount: 0, hasH1: false, keywordCount: 0 });

  // Deep Curation State
  const [showCurationModal, setShowCurationModal] = useState(false);
  const [curationTopic, setCurationTopic] = useState('');
  const [curationIntro, setCurationIntro] = useState('');
  const [curationOutlineStr, setCurationOutlineStr] = useState(''); // New: String input for outline
  const [curationUrls, setCurationUrls] = useState('');
  const [curationStatus, setCurationStatus] = useState<CurationStatus>('idle');

  // Update Outline & Stats function
  const updateDocumentMetrics = () => {
    if (!quillRef.current) return;

    const root = quillRef.current.root;
    
    // 1. Generate Outline
    const headers = root.querySelectorAll('h1, h2, h3');
    const newOutline: OutlineItem[] = Array.from(headers).map((item, idx) => {
      const header = item as Element;
      return {
        id: `header-${idx}`,
        text: header.textContent || '',
        tag: header.tagName.toLowerCase(),
        index: idx
      };
    });
    setOutline(newOutline);

    // 2. Calculate Stats
    const text = root.innerText || '';
    const wordCount = text.trim().length;
    const hasH1 = root.querySelector('h1') !== null;
    
    let keywordCount = 0;
    if (focusKeyword.trim()) {
        const regex = new RegExp(focusKeyword.trim(), 'gi');
        const matches = text.match(regex);
        keywordCount = matches ? matches.length : 0;
    }

    setStats({ wordCount, hasH1, keywordCount });
  };

  // Scroll to header
  const scrollToHeader = (index: number) => {
    if (!quillRef.current) return;
    const headers = quillRef.current.root.querySelectorAll('h1, h2, h3');
    if (headers[index]) {
      headers[index].scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  // Initialize Quill
  useEffect(() => {
    if (editorContainerRef.current && !quillRef.current) {
      quillRef.current = new Quill(editorContainerRef.current, {
        theme: 'snow',
        placeholder: "您可以：\n1. 在此貼上文章草稿，進行「內部連結優化」。\n2. 或是點擊上方「魔法棒」，輸入網址自動生成懶人包。",
        modules: {
          toolbar: [
            [{ 'header': [1, 2, 3, false] }],
            ['bold', 'italic', 'underline', 'strike'],
            [{ 'list': 'ordered'}, { 'list': 'bullet' }],
            ['link', 'image'],
            ['clean']
          ],
        },
      });

      // Handle text changes
      quillRef.current.on('text-change', () => {
        if (quillRef.current) {
          const html = quillRef.current.root.innerHTML;
          lastEmittedValue.current = html;
          onChange(html);
          updateDocumentMetrics();
        }
      });
    }
  }, []); // Run once on mount

  // Sync value from props
  useEffect(() => {
    if (quillRef.current && value !== lastEmittedValue.current) {
        const currentContent = quillRef.current.root.innerHTML;
        if (value !== currentContent) {
           quillRef.current.root.innerHTML = value;
           lastEmittedValue.current = value;
           // Wait for DOM update then calculate metrics
           setTimeout(updateDocumentMetrics, 0);
        }
    }
  }, [value]);

  // Sync metrics when keyword changes
  useEffect(() => {
    updateDocumentMetrics();
  }, [focusKeyword]);

  // Handle Disable state
  useEffect(() => {
    if (quillRef.current) {
      quillRef.current.enable(!disabled);
    }
  }, [disabled]);


  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    try {
      let contentToAdd = '';

      if (file.name.endsWith('.docx')) {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.convertToHtml({ arrayBuffer });
        contentToAdd = result.value;
      } else if (file.name.endsWith('.md') || file.name.endsWith('.markdown')) {
        const text = await file.text();
        contentToAdd = await marked.parse(text);
      } else {
        const text = await file.text();
        contentToAdd = `<p>${text.replace(/\n/g, '<br/>')}</p>`;
      }

      const currentContent = quillRef.current?.root.innerHTML || '';
      let newContent = (!currentContent || currentContent === '<p><br></p>') 
        ? contentToAdd 
        : currentContent + contentToAdd;
      
      onChange(newContent);

    } catch (err) {
      console.error("File upload failed", err);
      alert("檔案讀取失敗，請確認檔案格式是否正確。");
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleExportHtml = () => {
    if (!quillRef.current) return;
    const content = quillRef.current.root.innerHTML;
    const fullHtml = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Exported Content</title>
<style>
body { font-family: sans-serif; max-width: 800px; margin: 2rem auto; padding: 0 1rem; line-height: 1.6; color: #333; }
img { max-width: 100%; height: auto; }
h1, h2, h3 { margin-top: 1.5em; margin-bottom: 0.5em; }
p { margin-bottom: 1em; }
a { color: #4f46e5; text-decoration: underline; }
blockquote { border-left: 4px solid #cbd5e1; padding-left: 1rem; color: #64748b; font-style: italic; }
</style>
</head>
<body>
${content}
</body>
</html>`;
    const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `article-${new Date().toISOString().slice(0,10)}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCurationSubmit = async () => {
    if (!curationTopic || !curationIntro || !curationUrls) return;
    
    // Split URLs
    const urlsToProcess = curationUrls
      .split('\n')
      .map(u => u.trim())
      .filter(u => u.startsWith('http'));

    // Split Outline
    const outlineToProcess = curationOutlineStr
      .split('\n')
      .map(o => o.trim())
      .filter(o => o.length > 0);

    if (urlsToProcess.length === 0) {
      alert("請輸入至少一個有效的 URL (需包含 http/https)");
      return;
    }
    
    if (outlineToProcess.length === 0) {
        alert("請輸入文章大綱，每行一個標題。");
        return;
    }

    try {
      setCurationStatus('scraping');
      const generatedHtml = await generateCuratedArticle(
        curationTopic, 
        curationIntro, 
        outlineToProcess, // Pass outline
        urlsToProcess,
        (status) => setCurationStatus(status)
      );
      
      if (onCurationComplete) {
        onCurationComplete(generatedHtml);
      }
      
      setShowCurationModal(false);
      // Reset form
      setCurationTopic('');
      setCurationIntro('');
      setCurationUrls('');
      setCurationOutlineStr('');
      setCurationStatus('idle');

    } catch (e: any) {
      console.error(e);
      alert(`生成失敗: ${e.message}`);
      setCurationStatus('idle');
    }
  };

  // Helper to pre-fill template
  const applyTemplate = () => {
    setCurationIntro("[主題]是近期熱門趨勢。以下《遠見》帶你快速理解...");
    setCurationOutlineStr("背景與現況\n核心功能介紹\n主要優缺點分析\n誰適合使用？\n總結與建議");
  }

  return (
    <div className="flex flex-row h-full gap-4 relative">
        
        {/* Deep Curation Modal */}
        {showCurationModal && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm rounded-xl">
             <div className="bg-white w-[600px] max-h-[95%] flex flex-col rounded-xl shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between p-4 border-b border-slate-100 flex-shrink-0">
                  <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    <Wand2 className="w-4 h-4 text-indigo-600" />
                    Deep Curation (懶人包生成器 v2.0)
                  </h3>
                  {!['scraping', 'analyzing', 'writing'].includes(curationStatus) && (
                    <button onClick={() => setShowCurationModal(false)} className="text-slate-400 hover:text-slate-600">
                      <X className="w-5 h-5" />
                    </button>
                  )}
                </div>
                
                <div className="p-6 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
                   {curationStatus !== 'idle' && curationStatus !== 'done' ? (
                     <div className="flex flex-col items-center justify-center py-12 space-y-6">
                        <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
                        <div className="text-center space-y-2">
                          <p className="font-semibold text-lg text-slate-800">
                            {curationStatus === 'scraping' && '資料蒐集助理正在閱讀網頁...'}
                            {curationStatus === 'analyzing' && '架構師正在將資料填入大綱...'}
                            {curationStatus === 'writing' && '總編輯正在撰寫文章...'}
                          </p>
                          <p className="text-sm text-slate-500">
                             {curationStatus === 'analyzing' ? '確保每個段落結構完整...' : '應用公司語態風格...'}
                          </p>
                        </div>
                        {/* Progress Bar */}
                        <div className="w-64 h-2 bg-slate-100 rounded-full overflow-hidden mt-2">
                           <div 
                             className="h-full bg-indigo-500 transition-all duration-1000 ease-in-out" 
                             style={{ 
                               width: curationStatus === 'scraping' ? '30%' : curationStatus === 'analyzing' ? '60%' : '90%' 
                             }}
                           />
                        </div>
                     </div>
                   ) : (
                     <>
                      <div className="flex justify-end">
                        <button onClick={applyTemplate} className="text-xs text-indigo-600 hover:underline">
                            套用預設範本
                        </button>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-700">主題 (Topic)</label>
                        <input 
                          type="text" 
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                          placeholder="例如：2024年最佳電競筆電推薦"
                          value={curationTopic}
                          onChange={e => setCurationTopic(e.target.value)}
                        />
                      </div>
                      
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-700">引言/語氣 (Intro Tone)</label>
                        <textarea 
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none h-16 resize-none"
                          placeholder="設定這篇文章的開場與語氣..."
                          value={curationIntro}
                          onChange={e => setCurationIntro(e.target.value)}
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-700 flex justify-between">
                            <span>文章大綱 (Outline) - AI 將嚴格遵守此結構</span>
                            <span className="text-slate-400 font-normal">每行一個標題</span>
                        </label>
                        <textarea 
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none h-32 resize-none"
                          placeholder={`背景介紹\n重點功能\n優缺點分析\n結論`}
                          value={curationOutlineStr}
                          onChange={e => setCurationOutlineStr(e.target.value)}
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-700">參考連結 (URLs)</label>
                        <textarea 
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none h-24 font-mono text-xs"
                          placeholder={`https://example.com/article1\nhttps://example.com/article2`}
                          value={curationUrls}
                          onChange={e => setCurationUrls(e.target.value)}
                        />
                      </div>
                     </>
                   )}
                </div>

                {!['scraping', 'analyzing', 'writing'].includes(curationStatus) && (
                  <div className="p-4 border-t border-slate-100 bg-slate-50 rounded-b-xl flex justify-end gap-2 flex-shrink-0">
                    <button 
                      onClick={() => setShowCurationModal(false)}
                      className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
                    >
                      取消
                    </button>
                    <button 
                      onClick={handleCurationSubmit}
                      disabled={!curationTopic || !curationUrls || !curationOutlineStr}
                      className="px-4 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
                    >
                      <Wand2 className="w-3 h-3" />
                      開始生成
                    </button>
                  </div>
                )}
             </div>
          </div>
        )}

        {/* LEFT: Main Editor Area */}
        <div className="flex-1 flex flex-col bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden min-w-0">
            {/* Header */}
            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between flex-shrink-0 flex-wrap gap-2">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 text-slate-700">
                        <PenTool className="w-4 h-4 text-indigo-600" />
                        <span className="text-sm font-semibold hidden sm:inline">編輯器</span>
                    </div>
                    
                    {/* Focus Keyword Input */}
                    <div className="flex items-center gap-2 bg-white px-2 py-1 rounded border border-slate-200 focus-within:ring-1 focus-within:ring-indigo-500 focus-within:border-indigo-500 transition-all">
                        <Target className="w-3 h-3 text-slate-400" />
                        <input 
                            type="text" 
                            placeholder="輸入焦點關鍵字..." 
                            className="text-xs outline-none w-24 sm:w-32 placeholder:text-slate-400 text-slate-700"
                            value={focusKeyword}
                            onChange={(e) => setFocusKeyword(e.target.value)}
                        />
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {/* NEW: Magic Wand Button */}
                    <button
                      onClick={() => setShowCurationModal(true)}
                      disabled={disabled || isProcessing}
                      className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-white bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 border border-transparent rounded shadow-sm transition-all mr-2"
                      title="AI 懶人包生成器 (Deep Curation)"
                    >
                      <Wand2 className="w-3 h-3" />
                      <span className="hidden sm:inline">懶人包生成</span>
                    </button>

                    <button 
                        onClick={handleExportHtml}
                        disabled={disabled}
                        className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded hover:bg-slate-50 hover:text-indigo-600 transition-colors"
                        title="匯出 HTML"
                    >
                        <FileCode className="w-3 h-3" />
                        <span className="hidden sm:inline">HTML</span>
                    </button>
                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        disabled={disabled || isProcessing}
                        className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded hover:bg-slate-50 hover:text-indigo-600 transition-colors"
                        title="上傳檔案"
                    >
                        {isProcessing ? <span className="animate-spin">⌛</span> : <Upload className="w-3 h-3" />}
                        <span className="hidden sm:inline">匯入</span>
                    </button>
                    <input type="file" ref={fileInputRef} className="hidden" accept=".txt,.md,.markdown,.docx" onChange={handleFileUpload} />
                    
                    <div className="w-px h-4 bg-slate-200 mx-1"></div>

                    <button
                        onClick={() => setShowOutline(!showOutline)}
                        className={`p-1.5 rounded transition-colors ${showOutline ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                        title="切換大綱視圖"
                    >
                        <List className="w-4 h-4" />
                    </button>
                </div>
            </div>
            
            {/* Body: Quill */}
            <div className="relative flex-1 overflow-hidden flex flex-col bg-white">
                <div ref={editorContainerRef} className="flex-1 overflow-y-auto"></div>
            </div>

            {/* Footer: SEO Stats */}
            <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 flex justify-between items-center flex-shrink-0 text-[10px] sm:text-xs text-slate-500">
                <div className="flex gap-4">
                    <span className="flex items-center gap-1.5" title="文章字數">
                        <Type className="w-3 h-3 text-slate-400" />
                        {stats.wordCount} 字
                    </span>
                    <span className={`flex items-center gap-1.5 ${!stats.hasH1 ? 'text-amber-600 font-medium' : 'text-green-600'}`} title={!stats.hasH1 ? "缺少 H1 標題" : "H1 設定良好"}>
                        <Hash className="w-3 h-3" />
                        {stats.hasH1 ? 'H1 OK' : '缺少 H1'}
                    </span>
                </div>
                
                {focusKeyword && (
                    <div className="flex items-center gap-1.5">
                        <span>關鍵字 "{focusKeyword}": </span>
                        <span className={`font-medium ${stats.keywordCount > 0 ? 'text-green-600' : 'text-slate-400'}`}>
                            {stats.keywordCount} 次
                        </span>
                    </div>
                )}
            </div>
        </div>

        {/* RIGHT: Collapsible Sidebar */}
        {showOutline && (
        <div className="w-64 flex-shrink-0 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col overflow-hidden transition-all duration-300">
            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 font-semibold text-xs text-slate-700 flex items-center justify-between">
                <span>文章結構</span>
                <span className="text-[10px] text-slate-400 font-normal">{outline.length} 個標題</span>
            </div>
            
            <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                {outline.length === 0 ? (
                    <div className="text-center py-8 text-slate-400 text-xs">
                        <p>尚未偵測到標題</p>
                        <p className="mt-1 opacity-60">請使用 H1, H2, H3 來組織文章</p>
                    </div>
                ) : (
                    outline.map((item) => {
                        const isKeywordIncluded = focusKeyword && item.text.toLowerCase().includes(focusKeyword.toLowerCase());
                        return (
                            <button
                                key={item.id}
                                onClick={() => scrollToHeader(item.index)}
                                className={`
                                    w-full text-left px-2 py-1.5 rounded-lg text-xs transition-colors flex items-center gap-2 group
                                    hover:bg-indigo-50 hover:text-indigo-700 text-slate-600
                                    ${item.tag === 'h1' ? 'font-bold text-slate-900 pl-2' : ''}
                                    ${item.tag === 'h2' ? 'font-medium text-slate-800 pl-4' : ''}
                                    ${item.tag === 'h3' ? 'text-slate-600 pl-8' : ''}
                                `}
                            >
                                {isKeywordIncluded && (
                                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" title="包含焦點關鍵字" />
                                )}
                                {!isKeywordIncluded && (
                                    <ChevronRight className={`w-3 h-3 text-slate-300 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity`} />
                                )}
                                <span className="truncate">{item.text || '(無標題)'}</span>
                            </button>
                        );
                    })
                )}
            </div>
        </div>
        )}
    </div>
  );
};

export default ArticleEditor;
