
import React, { useState } from 'react';
import { Layout, PlayCircle } from 'lucide-react';
import SitemapInput from './components/SitemapInput';
import ArticleEditor from './components/ArticleEditor';
import ResultView from './components/ResultView';
import { analyzeArticleWithGemini } from './services/geminiService';
import { AnalysisResult, AppState } from './types';
import TurndownService from 'turndown';

const App: React.FC = () => {
  const [articleContent, setArticleContent] = useState<string>(''); // Stores HTML
  const [urlList, setUrlList] = useState<string[]>([]);
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  const handleUrlsParsed = (urls: string[]) => {
    setUrlList(urls);
  };

  const handleAnalyze = async () => {
    // Check if content is empty (Quill often leaves <p><br></p>)
    const isContentEmpty = !articleContent || articleContent === '<p><br></p>';

    if (isContentEmpty || urlList.length === 0) return;

    setAppState(AppState.ANALYZING);
    try {
      // Convert HTML Editor content to Markdown for better AI processing
      const turndownService = new TurndownService({
        headingStyle: 'atx',
        codeBlockStyle: 'fenced'
      });
      const markdownContent = turndownService.turndown(articleContent);

      const analysis = await analyzeArticleWithGemini(markdownContent, urlList);
      setResult(analysis);
      setAppState(AppState.SUCCESS);
    } catch (error) {
      console.error(error);
      setAppState(AppState.ERROR);
      alert("分析失敗，請檢查您的 API Key 是否正確，或稍後再試。");
    }
  };

  const handleCurationComplete = (generatedHtml: string) => {
    // 1. Set the Result state immediately so it shows on the Right View
    setResult({
      revisedArticle: generatedHtml,
      suggestions: [] // Empty suggestions implies "Lazy Pack Mode" in ResultView
    });
    setAppState(AppState.SUCCESS);

    // 2. Sync the generated content to the Left Editor state
    // This allows the user to click "Generate Internal Links" later if they want to analyze this content.
    setArticleContent(generatedHtml);
  };

  // Helper to check valid content length (stripping tags)
  const getContentLength = (html: string) => {
      const div = document.createElement("div");
      div.innerHTML = html;
      return div.innerText.length;
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 h-16 flex items-center px-6 justify-between flex-shrink-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white">
            <Layout className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800 leading-tight">SEO LazyPack</h1>
            <p className="text-xs text-slate-500">懶人包生成助理</p>
          </div>
        </div>
        
        <button
          onClick={handleAnalyze}
          disabled={appState === AppState.ANALYZING || getContentLength(articleContent) < 50 || urlList.length === 0}
          className={`
            flex items-center gap-2 px-6 py-2.5 rounded-full font-semibold text-sm shadow-md transition-all
            ${appState === AppState.ANALYZING || getContentLength(articleContent) < 50 || urlList.length === 0
              ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none' 
              : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-lg hover:-translate-y-0.5'}
          `}
        >
          <PlayCircle className="w-4 h-4" />
          {appState === AppState.ANALYZING ? '處理中...' : '生成內鏈建議'}
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden p-6 gap-6">
        
        {/* Left Column: Input */}
        <div className="flex-1 flex flex-col gap-4 min-w-[300px] max-w-2xl">
           <div className="flex-shrink-0">
             <SitemapInput onUrlsParsed={handleUrlsParsed} />
           </div>
           <div className="flex-1 min-h-0">
             <ArticleEditor 
              value={articleContent} 
              onChange={setArticleContent} 
              disabled={appState === AppState.ANALYZING}
              onCurationComplete={handleCurationComplete}
            />
           </div>
        </div>

        {/* Right Column: Output */}
        <div className="flex-1 min-w-[300px]">
          <ResultView result={result} loading={appState === AppState.ANALYZING} />
        </div>

      </main>
    </div>
  );
};

export default App;
