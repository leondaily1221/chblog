
import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { COLOR_THEMES, EEAT_CATEGORIES_DATA, EVERGREEN_SUBCATEGORIES } from './constants';
import { ColorTheme, GeneratedContent } from './types';
import { generateBlogPost, generateEeatTopicSuggestions, generateCategoryTopicSuggestions, generateEvergreenTopicSuggestions, suggestInteractiveElementForTopic, generateImage, generateTopicsFromMemo, generateLongtailTopicSuggestions, regenerateBlogPostHtml } from './services/geminiService';
import { CurrentStatus } from './components/CurrentStatus';
import { Shortcuts } from './components/Shortcuts';
import { GoogleGenAI } from "@google/genai";

// API 키 로컬 관리 유틸리티
const STORAGE_KEY = 'user_custom_gemini_api_key';
const getStoredKey = () => {
  const encrypted = localStorage.getItem(STORAGE_KEY);
  if (!encrypted) return null;
  try {
    return atob(encrypted);
  } catch (e) {
    return null;
  }
};
const setStoredKey = (key: string) => localStorage.setItem(STORAGE_KEY, btoa(key));
const clearStoredKey = () => localStorage.removeItem(STORAGE_KEY);

const ApiKeyModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const [status, setStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [inputKey, setInputKey] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      const saved = getStoredKey();
      if (saved) setInputKey(saved);
      setStatus('idle');
      setErrorMessage('');
    }
  }, [isOpen]);

  const handleSaveAndApply = async () => {
    if (!inputKey.trim()) {
      setErrorMessage('API 키를 입력해주세요.');
      setStatus('error');
      return;
    }
    setStoredKey(inputKey.trim());
    setStatus('success');
    setTimeout(() => {
        onClose();
        window.location.reload(); // 키 적용을 위해 새로고침 권장
    }, 1000);
  };

  const handleResetKey = () => {
    clearStoredKey();
    setInputKey('');
    setStatus('idle');
    setErrorMessage('API 키가 초기화되었습니다. 시스템 기본키 또는 새 키를 입력하세요.');
  };

  const handleTestConnection = async () => {
    const keyToTest = inputKey.trim() || process.env.API_KEY;
    if (!keyToTest) {
      setErrorMessage('테스트할 API 키가 없습니다.');
      setStatus('error');
      return;
    }

    setStatus('testing');
    setErrorMessage('');
    try {
      const ai = new GoogleGenAI({ apiKey: keyToTest });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: 'Connection test. Respond with "OK".',
      });
      if (response.text) {
        setStatus('success');
      } else {
        throw new Error('응답 형식이 올바르지 않습니다.');
      }
    } catch (err: any) {
      setStatus('error');
      setErrorMessage(err.message || '연결에 실패했습니다. 키 유효성 및 네트워크를 확인하세요.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6 border border-gray-700 transform transition-all" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-white flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
            API 키 보안 관리
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors p-1">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Gemini API Key 직접 입력</label>
            <input
              type="password"
              value={inputKey}
              onChange={(e) => setInputKey(e.target.value)}
              placeholder="API 키를 입력하세요"
              className="w-full bg-gray-900 border border-gray-600 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 transition-all outline-none"
            />
            <p className="text-[11px] text-gray-500 mt-2 leading-relaxed">
              * 입력된 키는 브라우저 로컬 저장소에 암호화되어 저장되며, 서버로 전송되지 않습니다.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleSaveAndApply}
              className="flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl shadow-lg transition-all active:scale-[0.98]"
            >
              <span>저장 및 적용</span>
            </button>
            <button
              onClick={handleResetKey}
              className="flex items-center justify-center space-x-2 bg-gray-700 hover:bg-gray-600 text-white font-semibold py-3 rounded-xl transition-all"
            >
              <span>초기화(리셋)</span>
            </button>
          </div>
          
          <button
            onClick={handleTestConnection}
            disabled={status === 'testing'}
            className="w-full flex items-center justify-center space-x-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-all"
          >
            {status === 'testing' ? (
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            )}
            <span>연결 테스트 실행</span>
          </button>

          {status === 'success' && (
            <div className="bg-green-500/10 border border-green-500/30 text-green-400 p-3.5 rounded-xl text-sm flex items-center animate-in fade-in zoom-in duration-300">
              <svg className="w-5 h-5 mr-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
              <div>
                <p className="font-bold">연결 성공!</p>
                <p className="text-xs opacity-80">API 키가 정상적으로 작동합니다.</p>
              </div>
            </div>
          )}

          {status === 'error' && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3.5 rounded-xl text-sm animate-in fade-in zoom-in duration-300">
              <div className="flex items-center mb-1">
                <svg className="w-5 h-5 mr-2 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <span className="font-bold">오류 발생</span>
              </div>
              <p className="text-xs opacity-90 break-words ml-7">{errorMessage}</p>
            </div>
          )}
        </div>
        
        <div className="mt-6 pt-5 border-t border-gray-700 text-center">
           <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:text-blue-300 transition-colors inline-flex items-center">
             <span>결제 한도 및 요금 정책 확인하기</span>
             <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
           </a>
        </div>
      </div>
    </div>
  );
};

const Header: React.FC<{ onOpenHelp: () => void; onOpenKey: () => void; }> = ({ onOpenHelp, onOpenKey }) => (
  <header className="relative text-center p-6 border-b border-gray-700">
    <h1 className="text-4xl font-bold text-white tracking-tight">
      최감독의 올인원 블로깅<sup className="text-yellow-400 text-2xl ml-1">POWER</sup>
    </h1>
    <p className="text-gray-400 mt-2">AI와 함께 아이디어 발굴부터 SEO 최적화 포스팅까지, 블로깅의 모든 것을 한 곳에서 해결하세요.</p>
    <div className="absolute top-1/2 right-6 -translate-y-1/2 flex items-center space-x-2">
      <button
        onClick={onOpenKey}
        className="text-gray-400 hover:text-white transition-colors p-2.5 rounded-full hover:bg-gray-800 border border-transparent hover:border-gray-700 group"
        aria-label="API 키 설정"
        title="API 키 보안 설정"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 group-hover:text-blue-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-.1.43-.563A6 6 0 1121.75 8.25z" />
        </svg>
      </button>
      <button
        onClick={onOpenHelp}
        className="text-gray-400 hover:text-white transition-colors p-2.5 rounded-full hover:bg-gray-800 border border-transparent hover:border-gray-700 group"
        aria-label="사용법 보기"
        title="도움말"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 group-hover:text-cyan-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      </button>
    </div>
  </header>
);

const Footer: React.FC = () => (
  <footer className="text-center p-6 mt-8 border-t border-gray-700 text-gray-500 text-sm">
    <p>최감독 운영 개발</p>
  </footer>
);

const CopyToClipboardButton: React.FC<{ textToCopy: string }> = ({ textToCopy }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!textToCopy) return;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button onClick={handleCopy} className="flex items-center space-x-1 text-xs bg-gray-700 text-gray-300 px-2 py-1 rounded-md hover:bg-gray-600 transition-colors disabled:opacity-50" disabled={copied}>
      {copied ? <span className="text-green-400">✅</span> : <span>📋</span>}
      <span>{copied ? '복사됨!' : '복사'}</span>
    </button>
  );
};

const SocialMediaPostCard: React.FC<{ platform: string; content: string; icon: string }> = ({ platform, content, icon }) => {
  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-semibold text-lg text-white flex items-center">
          <span className="mr-2 text-xl">{icon}</span>
          {platform} 포스트
        </h3>
        <CopyToClipboardButton textToCopy={content} />
      </div>
      <p className="text-gray-300 text-sm bg-gray-900 p-3 rounded-md whitespace-pre-wrap font-korean">{content}</p>
    </div>
  );
};

const InteractiveCodeModal: React.FC<{ code: string; onClose: () => void; }> = ({ code, onClose }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  const highlightedCode = useMemo(() => {
    if (!code) return '';
    const formattedCode = code
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    const tokenizer = /(&lt;!--[\s\S]*?--&gt;)|(&lt;\/?[\w-]+)|(\s+[\w-:]+="[^"]*")|(&gt;)|([^&<>]+)/g;

    return formattedCode.replace(tokenizer, (match, comment, tag, attribute, closingBracket, text) => {
        if (comment) return `<span class="text-gray-500">${comment}</span>`;
        if (tag) {
            const tagName = tag.replace(/&lt;\/?/, '');
            const bracket = tag.substring(0, tag.indexOf(tagName));
            return `<span class="text-gray-400">${bracket}</span><span class="text-red-400">${tagName}</span>`;
        }
        if (attribute) {
            const parts = attribute.match(/(\s+)([\w-:]+)=(".*")/);
            if (parts) {
                const [, whitespace, attrName, attrValue] = parts;
                return `${whitespace}<span class="text-green-300">${attrName}</span>=<span class="text-yellow-300">${attrValue}</span>`;
            }
        }
        if (closingBracket) return `<span class="text-gray-400">${closingBracket}</span>`;
        if (text) return `<span class="text-white">${text}</span>`;
        return match;
    });
  }, [code]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-gray-800 rounded-lg shadow-xl max-w-3xl w-full max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-gray-700 flex justify-between items-center">
          <h2 className="text-lg font-bold text-white">인터랙티브 요소 코드</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-3xl font-light">&times;</button>
        </div>
        <div className="p-4 overflow-y-auto custom-scrollbar flex-grow bg-gray-900">
          <pre className="text-sm whitespace-pre-wrap break-all font-mono">
            <code dangerouslySetInnerHTML={{ __html: highlightedCode }} />
          </pre>
        </div>
        <div className="p-4 border-t border-gray-700 flex justify-end bg-gray-800">
          <button onClick={handleCopy} className="flex items-center space-x-2 bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors text-sm disabled:bg-gray-500" disabled={copied}>
            {copied ? <span>✅</span> : <span>📋</span>}
            <span>{copied ? '복사 완료!' : '코드 복사'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};


const ResultDisplay: React.FC<{
  htmlContent: string;
  isLoading: boolean;
  supplementaryInfo: GeneratedContent['supplementaryInfo'] | null;
  socialMediaPosts: GeneratedContent['socialMediaPosts'] | null;
  imageBase64: string | null;
  subImages: GeneratedContent['subImages'] | null;
  onGenerateImage: () => Promise<void>;
  isGeneratingImage: boolean;
  onGenerateSubImage: (index: number) => Promise<void>;
  isGeneratingSubImages: Record<number, boolean>;
  shouldAddThumbnailText: boolean;
  onGenerateThumbnail: () => Promise<void>;
  isGeneratingThumbnail: boolean;
  thumbnailDataUrl: string | null;
  thumbnailAspectRatio: '16:9' | '1:1';
}> = ({
  htmlContent,
  isLoading,
  supplementaryInfo,
  socialMediaPosts,
  imageBase64,
  subImages,
  onGenerateImage,
  isGeneratingImage,
  onGenerateSubImage,
  isGeneratingSubImages,
  shouldAddThumbnailText,
  onGenerateThumbnail,
  isGeneratingThumbnail,
  thumbnailDataUrl,
  thumbnailAspectRatio
}) => {
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<'preview' | 'html'>('preview');
  const [isInteractiveCodeModalOpen, setIsInteractiveCodeModalOpen] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  const charCountNoSpaces = useMemo(() => {
    if (!htmlContent) {
      return 0;
    }
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;

    // Explicitly remove script and style tags to prevent their content from being counted.
    tempDiv.querySelectorAll('script, style').forEach(el => el.remove());

    // Use textContent for a more reliable result on non-rendered elements.
    const textOnly = tempDiv.textContent || '';

    // Remove all whitespace characters (spaces, newlines, tabs) and get the length.
    return textOnly.replace(/\s/g, '').length;
  }, [htmlContent]);

  const interactiveCode = useMemo(() => {
    if (!htmlContent) return null;
    const startMarker = '<!-- Interactive Element Start -->';
    const endMarker = '<!-- Interactive Element End -->';
    const startIndex = htmlContent.indexOf(startMarker);
    const endIndex = htmlContent.indexOf(endMarker);

    if (startIndex !== -1 && endIndex !== -1) {
      return htmlContent.substring(startIndex + startMarker.length, endIndex).trim();
    }
    return null;
  }, [htmlContent]);


  const imageUrl = imageBase64 ? `data:image/jpeg;base64,${imageBase64}` : null;
  
  const imageHtml = imageUrl
    ? `<figure style="margin: 25px 0;">
         <img src="${imageUrl}" alt="${supplementaryInfo?.altText || 'Blog post image'}" style="width: 100%; max-height: 400px; border-radius: 8px; object-fit: contain;">
         <figcaption style="text-align: center; font-size: 14px; color: #6c757d; margin-top: 8px;">${supplementaryInfo?.altText || ''}</figcaption>
       </figure>`
    : '';

  const htmlToCopyAndShow = htmlContent
    .replace('<!--IMAGE_PLACEHOLDER-->', '')
    .replace(/<!--SUB_IMAGE_PLACEHOLDER_\d+-->/g, '');
  
  const highlightedHtmlCode = useMemo(() => {
    if (!htmlToCopyAndShow) return '';

    const code = htmlToCopyAndShow
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    // This regex tokenizes the HTML string into parts for highlighting
    const tokenizer = /(&lt;!--[\s\S]*?--&gt;)|(&lt;\/?[\w-]+)|(\s+[\w-:]+="[^"]*")|(&gt;)|([^&<>]+)/g;

    return code.replace(tokenizer, (match, comment, tag, attribute, closingBracket, text) => {
        if (comment) return `<span class="text-gray-500">${comment}</span>`;
        if (tag) {
            const tagName = tag.replace(/&lt;\/?/, '');
            const bracket = tag.substring(0, tag.indexOf(tagName));
            return `<span class="text-gray-400">${bracket}</span><span class="text-red-400">${tagName}</span>`;
        }
        if (attribute) {
            const parts = attribute.match(/(\s+)([\w-:]+)=(".*")/);
            if (parts) {
                const [, whitespace, attrName, attrValue] = parts;
                return `${whitespace}<span class="text-green-300">${attrName}</span>=<span class="text-yellow-300">${attrValue}</span>`;
            }
        }
        if (closingBracket) return `<span class="text-gray-400">${closingBracket}</span>`;
        if (text) return `<span class="text-white">${text}</span>`;
        return match; // Fallback
    });
  }, [htmlToCopyAndShow]);


  const handleCopy = () => {
    navigator.clipboard.writeText(htmlToCopyAndShow);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  useEffect(() => {
    if (viewMode === 'preview' && previewRef.current && htmlContent) {
        const container = previewRef.current;
        container.innerHTML = ''; // Clear previous content to prevent script duplication

        let htmlToPreview = htmlContent.replace('<!--IMAGE_PLACEHOLDER-->', imageHtml);

        // Replace sub-image placeholders
        if (subImages) {
            subImages.forEach((image, index) => {
                if (image.base64) {
                    const subImageUrl = `data:image/jpeg;base64,${image.base64}`;
                    const subImageHtml = `<figure style="margin: 25px 0;">
                                              <img src="${subImageUrl}" alt="${image.altText}" style="width: 100%; max-height: 400px; border-radius: 8px; object-fit: contain;">
                                              <figcaption style="text-align: center; font-size: 14px; color: #6c757d; margin-top: 8px;">${image.altText}</figcaption>
                                          </figure>`;
                    htmlToPreview = htmlToPreview.replace(`<!--SUB_IMAGE_PLACEHOLDER_${index + 1}-->`, subImageHtml);
                }
            });
        }
        
        // Use a temporary div to parse the HTML string and extract scripts
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = htmlToPreview;

        const scripts = Array.from(tempDiv.getElementsByTagName('script'));
        
        // Remove script tags from the temporary div before appending its content
        scripts.forEach(script => script.parentNode?.removeChild(script));

        // Append the sanitized HTML (without scripts) to the container
        while (tempDiv.firstChild) {
            container.appendChild(tempDiv.firstChild);
        }

        // Create new script elements and append them to the container to execute them
        scripts.forEach(oldScript => {
            const newScript = document.createElement('script');
            // Copy all attributes
            Array.from(oldScript.attributes).forEach(attr => {
                newScript.setAttribute(attr.name, attr.value);
            });
            // Copy the script content
            newScript.text = oldScript.text;
            container.appendChild(newScript);
        });
    }
}, [htmlContent, viewMode, imageHtml, subImages]);


  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-10 bg-gray-800 rounded-lg h-96">
        <span className="text-5xl animate-pulse">✨</span>
        <p className="text-white mt-4 text-lg">블로그 포스트를 생성 중입니다...</p>
        <p className="text-gray-400">잠시만 기다려 주세요. 최대 1분 정도 소요될 수 있습니다.</p>
      </div>
    );
  }

  if (!htmlContent) {
    return (
      <div className="flex flex-col items-center justify-center p-10 bg-gray-800 rounded-lg h-96 text-center">
        <span className="text-5xl text-gray-500">✨</span>
        <p className="text-white mt-4 text-lg">생성된 콘텐츠가 여기에 표시됩니다.</p>
        <p className="text-gray-400">위에서 주제를 입력하고 테마를 선택한 후 생성 버튼을 클릭하세요.</p>
      </div>
    );
  }

  return (
    <div className="mt-8">
      <h2 className="text-2xl font-semibold text-white mb-4">생성된 콘텐츠</h2>
      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bg-gray-800 rounded-lg shadow-lg overflow-hidden">
          <div className="flex justify-between items-center p-3 bg-gray-800 border-b border-gray-700">
            <div className="flex space-x-1 items-center">
              <button onClick={() => setViewMode('preview')} className={`px-3 py-1 text-sm rounded-md ${viewMode === 'preview' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>
                <span role="img" aria-label="preview" className="mr-1">👀</span>미리보기
              </button>
              <button onClick={() => setViewMode('html')} className={`px-3 py-1 text-sm rounded-md ${viewMode === 'html' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>
                <span role="img" aria-label="code" className="mr-1">💻</span>HTML
              </button>
               <div className="text-xs text-gray-400 ml-4 border-l border-gray-700 pl-4">
                  <span>글자수(공백제외): {charCountNoSpaces.toLocaleString()}자</span>
              </div>
            </div>
            <div className="flex items-center space-x-2">
               <button
                  onClick={() => setIsInteractiveCodeModalOpen(true)}
                  disabled={!interactiveCode}
                  className="px-3 py-1 text-sm rounded-md bg-teal-600 text-white hover:bg-teal-700 transition-colors flex items-center disabled:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span role="img" aria-label="interactive" className="mr-1">🎮</span>
                  인터랙티브 코드
                </button>
                <button onClick={handleCopy} className="flex items-center space-x-2 bg-green-600 text-white px-3 py-1 rounded-md hover:bg-green-700 transition-colors text-sm disabled:bg-gray-500" disabled={copied}>
                  {copied ? <span>✅</span> : <span>📋</span>}
                  <span>{copied ? '복사 완료!' : 'HTML 복사'}</span>
                </button>
            </div>
          </div>

          {viewMode === 'preview' ? (
            <div ref={previewRef} className="p-4 bg-white font-korean" />
          ) : (
            <pre className="p-4 text-sm bg-gray-900 overflow-y-auto whitespace-pre-wrap break-all font-mono">
              <code dangerouslySetInnerHTML={{ __html: highlightedHtmlCode }} />
            </pre>
          )}
        </div>

        {/* Right Column Wrapper */}
        <div className="flex flex-col gap-6">
          {supplementaryInfo && (
            <div className="bg-gray-800 rounded-lg shadow-lg p-4 flex flex-col space-y-6">
              
              {/* Image Section */}
              <div>
                 <h3 className="font-semibold text-lg text-white mb-2 border-b border-gray-700 pb-2">대표 이미지</h3>
                 <div className="mt-4">
                    {imageUrl ? (
                        <img src={imageUrl} alt={supplementaryInfo.altText} className="rounded-lg mb-3 w-full" style={{ aspectRatio: thumbnailAspectRatio === '16:9' ? '16 / 9' : '1 / 1', objectFit: 'cover' }} />
                    ): (
                        <div className="rounded-lg mb-3 w-full bg-gray-700 flex items-center justify-center text-gray-400" style={{ aspectRatio: thumbnailAspectRatio === '16:9' ? '16 / 9' : '1 / 1' }}>이미지가 생성되지 않았습니다</div>
                    )}
                    <div className="flex justify-between items-center mb-2">
                        <h4 className="font-semibold text-md text-gray-300">이미지 생성 프롬프트</h4>
                        <CopyToClipboardButton textToCopy={supplementaryInfo.imagePrompt} />
                    </div>
                    <p className="text-gray-400 bg-gray-900 p-3 rounded-md text-sm mb-3">{supplementaryInfo.imagePrompt}</p>

                    <div className="flex justify-between items-center mb-2">
                        <h4 className="font-semibold text-md text-gray-300">Alt 태그</h4>
                        <CopyToClipboardButton textToCopy={supplementaryInfo.altText} />
                    </div>
                    <p className="text-gray-400 bg-gray-900 p-3 rounded-md text-sm mb-3">{supplementaryInfo.altText}</p>

                    <div className="grid grid-cols-2 gap-2">
                        {imageUrl && (
                             <a href={imageUrl} download="featured-image.jpeg" className="text-center bg-green-600 text-white font-bold py-2 px-4 rounded-md hover:bg-green-700 transition-colors duration-200 inline-block text-sm">
                                다운로드
                            </a>
                        )}
                        <button
                            onClick={onGenerateImage}
                            disabled={isGeneratingImage}
                            className={`text-center bg-purple-600 text-white font-bold py-2 px-4 rounded-md hover:bg-purple-700 transition-colors duration-200 disabled:bg-gray-500 flex items-center justify-center text-sm ${!imageUrl ? 'col-span-2' : ''}`}
                        >
                        {isGeneratingImage ? (
                            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>
                        ) : (imageBase64 ? '재생성' : '생성')}
                        </button>
                    </div>

                    {shouldAddThumbnailText && (
                      <button
                        onClick={onGenerateThumbnail}
                        disabled={isGeneratingThumbnail || !imageBase64}
                        className="mt-3 w-full text-center bg-teal-600 text-white font-bold py-2 px-4 rounded-md hover:bg-teal-700 transition-colors duration-200 disabled:bg-gray-500 flex items-center justify-center"
                      >
                        {isGeneratingThumbnail ? (
                           <>
                            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>
                            생성 중...
                          </>
                        ) : '🖼️ 썸네일 생성'}
                      </button>
                    )}
                 </div>
                 {thumbnailDataUrl && (
                  <div className="mt-4">
                    <h4 className="text-md font-medium text-gray-400 mb-2">생성된 썸네일</h4>
                    <img src={thumbnailDataUrl} alt="Generated thumbnail" className="rounded-lg mb-3 w-full" />
                    <a href={thumbnailDataUrl} download="thumbnail.jpeg" className="w-full text-center bg-green-600 text-white font-bold py-2 px-4 rounded-md hover:bg-green-700 transition-colors duration-200 inline-block">
                      썸네일 다운로드
                    </a>
                  </div>
                )}
              </div>

              {/* Sub Images Section */}
              {subImages && subImages.length > 0 && (
                 <div>
                    <h3 className="font-semibold text-lg text-white mb-2 border-b border-gray-700 pb-2">서브 이미지 (16:9)</h3>
                    <div className="space-y-6 mt-4">
                        {subImages.map((subImage, index) => (
                            <div key={index}>
                                <h4 className="text-md font-medium text-gray-400 mb-2">서브 이미지 #{index + 1}</h4>
                                {subImage.base64 ? (
                                    <img src={`data:image/jpeg;base64,${subImage.base64}`} alt={subImage.altText} className="rounded-lg mb-3 w-full" style={{ aspectRatio: '16 / 9', objectFit: 'cover' }} />
                                ) : (
                                    <div className="rounded-lg mb-3 w-full bg-gray-700 flex items-center justify-center text-gray-400" style={{ aspectRatio: '16 / 9' }}>이미지가 생성되지 않았습니다</div>
                                )}
                                <div className="flex justify-between items-center mb-2">
                                    <h4 className="font-semibold text-md text-gray-300">이미지 생성 프롬프트</h4>
                                    <CopyToClipboardButton textToCopy={subImage.prompt} />
                                </div>
                                <p className="text-gray-400 bg-gray-900 p-3 rounded-md text-sm mb-3">{subImage.prompt}</p>

                                <div className="flex justify-between items-center mb-2">
                                    <h4 className="font-semibold text-md text-gray-300">Alt 태그</h4>
                                    <CopyToClipboardButton textToCopy={subImage.altText} />
                                </div>
                                <p className="text-gray-400 bg-gray-900 p-3 rounded-md text-sm mb-3">{subImage.altText}</p>

                                <div className="grid grid-cols-2 gap-2">
                                    {subImage.base64 && (
                                        <a href={`data:image/jpeg;base64,${subImage.base64}`} download={`sub-image-${index + 1}.jpeg`} className="text-center bg-green-600 text-white font-bold py-2 px-4 rounded-md hover:bg-green-700 transition-colors duration-200 inline-block text-sm">
                                            다운로드
                                        </a>
                                    )}
                                    <button onClick={() => onGenerateSubImage(index)} disabled={isGeneratingSubImages[index]} className={`text-center bg-purple-600 text-white font-bold py-2 px-4 rounded-md hover:bg-purple-700 transition-colors duration-200 disabled:bg-gray-500 flex items-center justify-center text-sm ${!subImage.base64 ? 'col-span-2' : ''}`}>
                                         {isGeneratingSubImages[index] ? (
                                            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>
                                        ) : (subImage.base64 ? '재생성' : '생성')}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
              )}

              {/* SEO and Prompt Section */}
              <div>
                <h3 className="font-semibold text-lg text-white mb-2">SEO 제목 제안</h3>
                <ul className="list-disc list-inside text-gray-300 space-y-1 text-sm">
                  {supplementaryInfo.seoTitles.map((title, i) => <li key={i}>{title}</li>)}
                </ul>
              </div>
              <div>
                <div className="flex justify-between items-center mb-2">
                   <h3 className="font-semibold text-lg text-white">핵심 키워드</h3>
                   <CopyToClipboardButton textToCopy={supplementaryInfo.keywords.join(', ')} />
                </div>
                <p className="text-blue-300 text-sm bg-gray-900 p-3 rounded-md">
                  {supplementaryInfo.keywords.join(', ')}
                </p>
              </div>
            </div>
          )}
          {socialMediaPosts && (
            <div className="bg-gray-800 rounded-lg shadow-lg p-4 flex flex-col space-y-6">
              <h2 className="text-xl font-semibold text-white mb-2 border-b border-gray-700 pb-2">소셜 미디어 포스트</h2>
              <SocialMediaPostCard platform="Threads" content={socialMediaPosts.threads} icon="🧵" />
              <SocialMediaPostCard platform="Instagram" content={socialMediaPosts.instagram} icon="📸" />
              <SocialMediaPostCard platform="Facebook" content={socialMediaPosts.facebook} icon="👍" />
              <SocialMediaPostCard platform="X" content={socialMediaPosts.x} icon="✖️" />
            </div>
          )}
        </div>
      </div>
      {isInteractiveCodeModalOpen && interactiveCode && (
        <InteractiveCodeModal code={interactiveCode} onClose={() => setIsInteractiveCodeModalOpen(false)} />
      )}
    </div>
  );
};

const THUMBNAIL_COLORS = ['#FFFFFF', '#000000', '#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#F7B801', '#E53935', '#3498DB', '#2ECC71', '#F39C12', '#9B59B6'];

const ManualSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="space-y-2">
    <h3 className="text-xl font-bold text-cyan-400 border-b-2 border-cyan-700/50 pb-2 mb-3">{title}</h3>
    <div className="space-y-2 text-sm text-slate-300">{children}</div>
  </section>
);

const HelpModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-slate-800 rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto custom-scrollbar" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-slate-700 sticky top-0 bg-slate-800 z-10 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-white">GPT PARK 올인원 블로깅 매뉴얼</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-3xl font-light">&times;</button>
        </div>
        <div className="p-6 space-y-8">
          <ManualSection title="[시작하며] 이 앱은 무엇인가요?">
            <p>GPT PARK의 올인원 블로깅은 아이디어 발굴부터 SEO(검색엔진최적화) 분석, 고품질의 기사 작성, 소셜 미디어 홍보까지 블로그 운영의 전 과정을 돕는 강력한 AI 어시스턴트입니다.</p>
            <p>복잡한 과정을 2개의 핵심 탭 <span className="text-yellow-300 font-semibold">'주제 아이디어 얻기', '트렌드 바로가기'</span>으로 단순화하여 누구나 쉽게 전문적인 블로그 콘텐츠를 만들 수 있도록 지원합니다.</p>
          </ManualSection>

          <ManualSection title="[Part 1] 주제 아이디어 얻기">
            <p>어떤 글을 써야 할지 막막할 때 사용하는 기능입니다. 5가지의 서로 다른 AI 분석 모델을 통해 다양한 관점의 주제를 추천받을 수 있습니다.</p>
            <ul className="list-disc list-inside space-y-2 pl-2">
              <li><strong className="text-slate-100">E-E-A-T 기반:</strong> 구글 SEO의 핵심인 '경험, 전문성, 권위성, 신뢰성'을 높일 수 있는 주제를 추천받아 블로그의 신뢰도를 높입니다.</li>
              <li><strong className="text-slate-100">카테고리별:</strong> IT, 건강, 재테크 등 특정 카테고리 내에서 독자의 흥미를 끌 만한 최신 트렌드 주제를 발굴합니다.</li>
              <li><strong className="text-slate-100">에버그린 콘텐츠:</strong> 시간이 지나도 가치가 변하지 않아 꾸준한 트래픽을 유도할 수 있는 '스테디셀러' 주제를 추천받습니다.</li>
              <li><strong className="text-slate-100">롱테일 키워드 주제:</strong> 실시간 구글 검색을 통해 경쟁이 낮고, 명확한 목적을 가진 사용자를 타겟으로 하는 구체적인 주제를 찾아냅니다.</li>
              <li><strong className="text-slate-100">메모/파일 기반:</strong> 가지고 있는 아이디어 메모, 초안, 자료 파일 등을 업로드하면 AI가 핵심을 분석하여 최적의 블로그 주제를 제안합니다.</li>
            </ul>
          </ManualSection>

          <ManualSection title="[Part 2] 포스트 생성하기">
            <p>추천받았거나 직접 입력한 주제로 실제 블로그 포스트를 생성하는 핵심 기능입니다.</p>
            <ul className="list-disc list-inside space-y-2 pl-2">
              <li><strong className="text-slate-100">블로그 주제:</strong> 생성할 포스트의 주제를 입력합니다. '주제 아이디어 얻기'에서 추천받은 주제를 클릭하면 자동으로 입력됩니다.</li>
              <li><strong className="text-slate-100">컬러 테마:</strong> 생성될 포스트의 전체적인 디자인(제목, 표, 정보 박스 등)에 적용될 색상 테마를 선택합니다.</li>
              <li><strong className="text-slate-100">추가 요청사항:</strong> '특정 내용을 더 강조해달라'거나 '초보자 눈높이에서 쉽게 설명해달라'는 등 구체적인 요구사항을 AI에게 전달할 수 있습니다.</li>
              <li><strong className="text-slate-100">고급 옵션:</strong>
                <ul className="list-['-_'] list-inside space-y-1 pl-4 mt-1">
                    <li><strong className="text-yellow-300">이미지 생성:</strong> 대표 이미지와 본문 이미지를 AI가 자동으로 생성하고 배치합니다.</li>
                    <li><strong className="text-yellow-300">썸네일 텍스트 추가:</strong> 대표 이미지 위에 원하는 텍스트를 추가하여 클릭을 유도하는 썸네일을 제작합니다. 글꼴, 색상, 크기 등을 자유롭게 조절할 수 있습니다.</li>
                    <li><strong className="text-yellow-300">인터랙티브 요소:</strong> 독자가 직접 참여할 수 있는 계산기, 퀴즈 등을 포스트에 포함시켜 체류 시간을 늘립니다.</li>
                </ul>
              </li>
            </ul>
          </ManualSection>
          
           <ManualSection title="[Part 3] 결과물 확인 및 활용">
            <p>포스트 생성이 완료되면 결과물을 확인하고 다양하게 활용할 수 있습니다.</p>
            <ul className="list-disc list-inside space-y-2 pl-2">
                <li><strong className="text-slate-100">미리보기/HTML:</strong> 생성된 포스트의 실제 모습과 블로그에 바로 붙여넣을 수 있는 HTML 소스 코드를 확인할 수 있습니다.</li>
                <li><strong className="text-slate-100">이미지 관리:</strong> 생성된 대표 이미지와 서브 이미지를 다시 생성하거나 PC에 다운로드할 수 있습니다.</li>
                <li><strong className="text-slate-100">SEO 정보:</strong> AI가 제안하는 다양한 SEO 최적화 제목과 핵심 키워드를 복사하여 블로그 포스팅 시 활용할 수 있습니다.</li>
                <li><strong className="text-slate-100">소셜 미디어 포스트:</strong> 블로그 홍보를 위해 Threads, 인스타그램, 페이스북, X(트위터)에 최적화된 홍보 문구를 AI가 자동으로 생성해 줍니다.</li>
            </ul>
          </ManualSection>

           <ManualSection title="[Part 4] 피드백 및 재작성">
            <p>AI가 생성한 글이 마음에 들지 않을 경우, 구체적인 수정 요청사항을 입력하여 기사 본문만 다시 생성할 수 있습니다. 이 기능을 통해 결과물의 완성도를 더욱 높일 수 있습니다.</p>
          </ManualSection>
        </div>
      </div>
    </div>
  );
};


function App() {
  const [topic, setTopic] = useState<string>('');
  const [selectedTheme, setSelectedTheme] = useState<ColorTheme>(COLOR_THEMES[0]);
  const [generatedContent, setGeneratedContent] = useState<GeneratedContent | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState<boolean>(false);
  const [isGeneratingSubImages, setIsGeneratingSubImages] = useState<Record<number, boolean>>({});
  const [regenerationFeedback, setRegenerationFeedback] = useState<string>('');
  const [isRegenerating, setIsRegenerating] = useState<boolean>(false);
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState<boolean>(false);


  // --- Main Tab State ---
  type MainTab = 'generator' | 'shortcuts';
  const [mainTab, setMainTab] = useState<MainTab>('generator');
  const [isHelpModalOpen, setIsHelpModalOpen] = useState<boolean>(false);

  // --- Topic Suggestion State ---
  type TopicSuggestionTab = 'eeat' | 'category' | 'evergreen' | 'longtail' | 'memo';
  const [activeSuggestionTab, setActiveSuggestionTab] = useState<TopicSuggestionTab>('category');
  const [suggestedTopics, setSuggestedTopics] = useState<string[]>([]);
  const [isSuggestingTopics, setIsSuggestingTopics] = useState<boolean>(false);
  const [suggestionError, setSuggestionError] = useState<string | null>(null);

  // E-E-A-T Tab State
  const EEAT_CATEGORIES = Object.keys(EEAT_CATEGORIES_DATA);
  const [selectedEeatCategory, setSelectedEeatCategory] = useState<string>(EEAT_CATEGORIES[0]);
  const [selectedEeatSubCategory, setSelectedEeatSubCategory] = useState<string>(EEAT_CATEGORIES_DATA[EEAT_CATEGORIES[0]][0]);

  // Category Tab State
  const GENERAL_CATEGORIES = [
    "재정/투자 (부동산, 주식, 연금, 세금, 대출 등)",
    "IT/기술 (프로그래밍, 앱 사용법, 소프트웨어, 디지털기기 등)",
    "생활/라이프스타일 (인테리어, 요리, 미니멀라이프, 반려동물 등)",
    "건강/자기계발 (운동, 독서, 습관, 정신건강 등)",
    "교육/학습 (외국어, 자격증, 온라인강의, 공부법 등)",
    "쇼핑/소비 (온라인쇼핑, 중고거래, 할인혜택, 가성비제품 등)",
    "자동차/교통 (자동차보험, 중고차, 대중교통, 주차 등)",
    "취업/직장 (이직, 연차, 퇴사, 직장생활, 4대보험 등)",
    "기타(사용자입력)"
  ];
  const [selectedGenCategory, setSelectedGenCategory] = useState<string>(GENERAL_CATEGORIES[0]);
  const [customGenCategory, setCustomGenCategory] = useState<string>('');
  
  // Evergreen Tab State
  const EVERGREEN_CATEGORIES = [
    "사례 연구(Case Study)",
    "백서(White Paper)",
    "통계 및 데이터 정리",
    "제품 리뷰 (업데이트 가능)",
    "역사적 배경 설명",
    "How-to 가이드",
    "초보자 가이드",
    "리스트 콘텐츠 (Top 10, 체크리스트 등)",
    "체크리스트",
    "용어집(Glossary) & 정의",
    "베스트 프랙티스 (Best Practices)",
    "실패 사례 공유",
    "성공 사례 공유",
    "스토리텔링 기반 글",
    "FAQ(자주 묻는 질문) 정리",
    "튜토리얼 (단계별 안내)",
    "리소스 모음/큐레이션 (추천 툴·사이트 모음)",
    "비교 콘텐츠 (제품·서비스 비교)",
    "전문가 인터뷰",
    "종합 가이드(Ultimate Guide)",
    "문제 해결형 글 (솔루션 제시)",
    "핵심 팁 모음 (Tips & Tricks)",
    "오해와 진실(신화 깨기, Myth Busting)",
    "업계/분야 베스트 사례 아카이브"
  ];
  const [selectedEvergreenCategory, setSelectedEvergreenCategory] = useState<string>(EVERGREEN_CATEGORIES[0]);
  const [selectedEvergreenSubCategory, setSelectedEvergreenSubCategory] = useState<string>(EVERGREEN_SUBCATEGORIES[0]);

  // Long-tail Tab State
  const LONGTAIL_CATEGORIES = [
    "계절/이벤트",
    "건강/피트니스",
    "재테크/금융",
    "IT/기술/소프트웨어",
    "부동산/인테리어",
    "교육/학습/자기계발",
    "취업/커리어",
    "쇼핑/제품 리뷰",
    "여행 (국내/해외)",
    "자동차 (구매/관리)",
    "법률/세금",
  ];
  const [selectedLongtailCategory, setSelectedLongtailCategory] = useState<string>(LONGTAIL_CATEGORIES[0]);
  
  // Memo Tab State
  const [memoContent, setMemoContent] = useState<string>('');
  const [uploadedFileNames, setUploadedFileNames] = useState<string[]>([]);
  const [additionalRequest, setAdditionalRequest] = useState<string>('');

  // --- Generation Options State ---
  const [shouldGenerateImage, setShouldGenerateImage] = useState<boolean>(true);
  const [shouldGenerateSubImages, setShouldGenerateSubImages] = useState<boolean>(true);
  const [shouldIncludeInteractiveElement, setShouldIncludeInteractiveElement] = useState<boolean>(false);
  const [interactiveElementIdea, setInteractiveElementIdea] = useState<string | null>(null);
  const [isSuggestingInteractiveElement, setIsSuggestingInteractiveElement] = useState<boolean>(false);
  
  // --- Thumbnail Generation State ---
  const [shouldAddThumbnailText, setShouldAddThumbnailText] = useState<boolean>(false);
  const [thumbnailText, setThumbnailText] = useState<string>('');
  const [thumbnailDataUrl, setThumbnailDataUrl] = useState<string | null>(null);
  const [isGeneratingThumbnail, setIsGeneratingThumbnail] = useState<boolean>(false);
  const [thumbnailAspectRatio, setThumbnailAspectRatio] = useState<'16:9' | '1:1'>('16:9');
  const [thumbnailFont, setThumbnailFont] = useState<string>('Pretendard');
  const [thumbnailColor, setThumbnailColor] = useState<string>('#FFFFFF');
  const [thumbnailFontSize, setThumbnailFontSize] = useState<number>(100);
  const [thumbnailOutlineWidth, setThumbnailOutlineWidth] = useState<number>(8);

  useEffect(() => {
    // Reset subcategory when main E-E-A-T category changes
    setSelectedEeatSubCategory(EEAT_CATEGORIES_DATA[selectedEeatCategory][0]);
  }, [selectedEeatCategory]);

  useEffect(() => {
    if (generatedContent?.supplementaryInfo?.seoTitles?.length) {
      setThumbnailText(generatedContent.supplementaryInfo.seoTitles[0]);
    } else {
      setThumbnailText('');
    }
    setThumbnailDataUrl(null);
  }, [generatedContent]);

  useEffect(() => {
    if (!shouldGenerateImage) {
        setShouldAddThumbnailText(false);
    }
  }, [shouldGenerateImage]);


  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsHelpModalOpen(false);
        setIsApiKeyModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleOpenKey = async () => {
    setIsApiKeyModalOpen(true);
  };


  const handleSuggestionTabChange = (tab: TopicSuggestionTab) => {
    setActiveSuggestionTab(tab);
    setSuggestedTopics([]);
    setSuggestionError(null);
  }
  
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      let combinedText = '';
      const names: string[] = [];
      let totalSize = 0;

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file) {
            totalSize += file.size;
        }
      }

      if (totalSize > 5 * 1024 * 1024) { // 5MB total limit
        setSuggestionError("총 파일 크기는 5MB를 초과할 수 없습니다.");
        return;
      }

      try {
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (file) {
                names.push(file.name);
                const text = await file.text();
                combinedText += `\n\n--- START OF FILE: ${file.name} ---\n\n${text}\n\n--- END OF FILE: ${file.name} ---\n\n`;
            }
        }
        setMemoContent(combinedText.trim());
        setUploadedFileNames(names);
        setSuggestionError(null);
      } catch (err) {
        setSuggestionError("파일을 읽는 중 오류가 발생했습니다.");
      }
    }
  };

  const handleSuggestTopics = useCallback(async (generator: (currentDate: string) => Promise<string[]>) => {
    setIsSuggestingTopics(true);
    setSuggestionError(null);
    setSuggestedTopics([]);
    try {
      const currentDate = new Date();
      const formattedDate = new Intl.DateTimeFormat('ko-KR', {
        year: 'numeric', month: 'long', day: 'numeric', weekday: 'long'
      }).format(currentDate);
      const topics = await generator(formattedDate);
      setSuggestedTopics(topics);
    } catch (err) {
      const message = err instanceof Error ? err.message : '주제 추천 중 알 수 없는 오류가 발생했습니다.';
      setSuggestionError(message);
    } finally {
      setIsSuggestingTopics(false);
    }
  }, []);

  const handleTopicSelect = (selectedTopic: string) => {
    setTopic(selectedTopic);
    window.scrollTo({
        top: document.getElementById('generation-section')?.offsetTop || 0,
        behavior: 'smooth'
    });
  };

  useEffect(() => {
    setInteractiveElementIdea(null);
    if (shouldIncludeInteractiveElement && topic.trim()) {
      setIsSuggestingInteractiveElement(true);
      const handler = setTimeout(async () => {
        try {
          const idea = await suggestInteractiveElementForTopic(topic);
          setInteractiveElementIdea(idea);
        } catch (e) {
          console.error("Failed to suggest interactive element", e);
          setInteractiveElementIdea("오류: 인터랙티브 요소 아이디어를 가져오지 못했습니다.");
        } finally {
          setIsSuggestingInteractiveElement(false);
        }
      }, 800); // Debounce API call

      return () => {
        clearTimeout(handler);
        setIsSuggestingInteractiveElement(false);
      };
    }
  }, [shouldIncludeInteractiveElement, topic]);


  const handleGenerate = useCallback(async () => {
    if (!topic) {
      setError('블로그 주제를 입력해주세요.');
      return;
    }
    setError(null);
    setIsLoading(true);
    setGeneratedContent(null);

    try {
      const finalInteractiveElementIdea = shouldIncludeInteractiveElement ? interactiveElementIdea : null;
      const finalRawContent = activeSuggestionTab === 'memo' ? memoContent : null;
      
      const currentDate = new Date();
      const formattedDate = new Intl.DateTimeFormat('ko-KR', {
        year: 'numeric', month: 'long', day: 'numeric', weekday: 'long'
      }).format(currentDate);

      const content = await generateBlogPost(topic, selectedTheme, shouldGenerateImage, shouldGenerateSubImages, finalInteractiveElementIdea, finalRawContent, additionalRequest, thumbnailAspectRatio, formattedDate);
      setGeneratedContent(content);
    } catch (err: any) {
      const msg = err.message || '';
      if (msg.includes('Requested entity was not found')) {
        setError('유효한 API 키가 설정되지 않았습니다. 상단 열쇠 아이콘을 클릭하여 키를 설정해주세요.');
        setIsApiKeyModalOpen(true);
      } else {
        setError(msg || '알 수 없는 오류가 발생했습니다.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [topic, selectedTheme, shouldGenerateImage, shouldGenerateSubImages, interactiveElementIdea, shouldIncludeInteractiveElement, activeSuggestionTab, memoContent, additionalRequest, thumbnailAspectRatio]);

  const handleGenerateImage = async () => {
    if (!generatedContent?.supplementaryInfo.imagePrompt) return;

    setIsGeneratingImage(true);
    setError(null);
    try {
        const newImageBase64 = await generateImage(generatedContent.supplementaryInfo.imagePrompt, thumbnailAspectRatio);
        if (newImageBase64) {
            setGeneratedContent(prev => {
                if (!prev) return null;
                return { ...prev, imageBase64: newImageBase64 };
            });
        } else {
             setError("이미지를 생성하지 못했습니다.");
        }
    } catch (err: any) {
        const msg = err.message || '';
        if (msg.includes('Requested entity was not found')) {
          setError('유효한 API 키가 설정되지 않았습니다. 상단 열쇠 아이콘을 클릭하여 키를 설정해주세요.');
          setIsApiKeyModalOpen(true);
        } else {
          setError(msg || '이미지 생성 중 알 수 없는 오류가 발생했습니다.');
        }
    } finally {
        setIsGeneratingImage(false);
    }
  };
  
  const handleGenerateSubImage = async (index: number) => {
    if (!generatedContent?.subImages?.[index]?.prompt) return;

    setIsGeneratingSubImages(prev => ({ ...prev, [index]: true }));
    setError(null);
    try {
        const prompt = generatedContent.subImages[index].prompt;
        const newImageBase64 = await generateImage(prompt, '16:9');
        if (newImageBase64) {
            setGeneratedContent(prev => {
                if (!prev || !prev.subImages) return prev;
                const newSubImages = [...prev.subImages];
                newSubImages[index] = { ...newSubImages[index], base64: newImageBase64 };
                return { ...prev, subImages: newSubImages };
            });
        } else {
            setError(`서브 이미지 #${index + 1}을(를) 생성하지 못했습니다.`);
        }
    } catch (err: any) {
        const msg = err.message || '';
        if (msg.includes('Requested entity was not found')) {
          setError('유효한 API 키가 설정되지 않았습니다. 상단 열쇠 아이콘을 클릭하여 키를 설정해주세요.');
          setIsApiKeyModalOpen(true);
        } else {
          setError(msg || '서브 이미지 생성 중 알 수 없는 오류가 발생했습니다.');
        }
    } finally {
        setIsGeneratingSubImages(prev => ({ ...prev, [index]: false }));
    }
  };

  const handleRegenerate = useCallback(async () => {
    if (!regenerationFeedback.trim() || !generatedContent) {
      setError('피드백을 입력해주세요.');
      return;
    }
    setError(null);
    setIsRegenerating(true);

    try {
      const currentDate = new Date();
      const formattedDate = new Intl.DateTimeFormat('ko-KR', {
        year: 'numeric', month: 'long', day: 'numeric', weekday: 'long'
      }).format(currentDate);
      
      const newHtml = await regenerateBlogPostHtml(generatedContent.blogPostHtml, regenerationFeedback, selectedTheme, formattedDate);
      setGeneratedContent(prev => {
        if (!prev) return null;
        return { ...prev, blogPostHtml: newHtml };
      });
      setRegenerationFeedback('');
      document.querySelector('.md\\:col-span-2.bg-gray-800')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (err: any) {
      const msg = err.message || '';
      if (msg.includes('Requested entity was not found')) {
        setError('유효한 API 키가 설정되지 않았습니다. 상단 열쇠 아이콘을 클릭하여 키를 설정해주세요.');
        setIsApiKeyModalOpen(true);
      } else {
        setError(msg || '기사 재작성 중 알 수 없는 오류가 발생했습니다.');
      }
    } finally {
      setIsRegenerating(false);
    }
  }, [generatedContent, regenerationFeedback, selectedTheme]);

  const createThumbnail = (
      baseImageSrc: string, 
      text: string, 
      aspectRatio: '16:9' | '1:1',
      font: string,
      color: string,
      size: number,
      outlineWidth: number
  ): Promise<string> => {
    return new Promise((resolve, reject) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            return reject(new Error('Could not get canvas context'));
        }

        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            const targetWidth = 1200;
            const targetAspectRatioValue = aspectRatio === '16:9' ? 16 / 9 : 1;
            const targetHeight = Math.round(targetWidth / targetAspectRatioValue);

            canvas.width = targetWidth;
            canvas.height = targetHeight;
            
            // Center-crop logic
            const sourceAspectRatio = img.width / img.height;
            let sx = 0, sy = 0, sWidth = img.width, sHeight = img.height;

            if (sourceAspectRatio > targetAspectRatioValue) {
                sWidth = img.height * targetAspectRatioValue;
                sx = (img.width - sWidth) / 2;
            } else if (sourceAspectRatio < targetAspectRatioValue) {
                sHeight = img.width / targetAspectRatioValue;
                sy = (img.height - sHeight) / 2;
            }

            ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, targetWidth, targetHeight);
            
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            const padding = Math.floor(targetWidth * 0.1);
            const maxWidth = targetWidth - padding;
            const maxHeight = targetHeight - padding;

            const getWrappedLines = (context: CanvasRenderingContext2D, textToWrap: string, maxWidth: number): string[] => {
                const words = textToWrap.trim().split(/\s+/).filter(w => w.length > 0);
                if (words.length === 0) return [];
                let line = '';
                const lines: string[] = [];
                
                if (words.length === 1 && context.measureText(words[0]).width > maxWidth) {
                    return [words[0]];
                }

                for (const word of words) {
                    const testLine = line ? `${line} ${word}` : word;
                    if (context.measureText(testLine).width > maxWidth && line) {
                        lines.push(line);
                        line = word;
                    } else {
                        line = testLine;
                    }
                }
                if (line) lines.push(line);
                
                // Balance the last line if it's too short
                if (lines.length > 1) {
                    const lastLine = lines[lines.length - 1];
                    const secondLastLine = lines[lines.length - 2];
                    const lastLineWords = lastLine.split(' ');
                    if (lastLineWords.length <= 2) {
                        const secondLastLineWords = secondLastLine.split(' ');
                        if (secondLastLineWords.length > 1) {
                            const wordToMove = secondLastLineWords.pop();
                            lines[lines.length - 2] = secondLastLineWords.join(' ');
                            lines[lines.length - 1] = `${wordToMove} ${lastLine}`;
                        }
                    }
                }
                
                return lines;
            };

            const textForWrapping = text.replace(/\s*\/\s*/g, '\n');
            let fontSize = size;
            let lines: string[] = [];
            let lineHeight = 0;

            while (fontSize > 20) {
                ctx.font = `700 ${fontSize}px '${font}', sans-serif`;
                lineHeight = fontSize * 1.2;
                
                const paragraphs = textForWrapping.split('\n');
                const tempLines: string[] = [];
                paragraphs.forEach(p => {
                    tempLines.push(...getWrappedLines(ctx, p, maxWidth));
                });
                lines = tempLines;
                
                const totalTextHeight = lines.length * lineHeight;
                const isAnyWordTooWide = textForWrapping.replace('\n', ' ').split(/\s+/).some(word => ctx.measureText(word).width > maxWidth);

                if (totalTextHeight <= maxHeight && !isAnyWordTooWide) {
                    break;
                }
                fontSize -= 4;
            }

            const totalTextHeight = lines.length * lineHeight;
            let currentY = (targetHeight - totalTextHeight) / 2 + lineHeight / 2;

            // Set styles for text outline to ensure readability on any background
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.75)';
            ctx.lineWidth = outlineWidth;
            ctx.lineJoin = 'round';

            for (const line of lines) {
                if (outlineWidth > 0) {
                    // Draw outline first
                    ctx.strokeText(line, targetWidth / 2, currentY);
                }
                // Draw white text on top
                ctx.fillStyle = color;
                ctx.fillText(line, targetWidth / 2, currentY);
                currentY += lineHeight;
            }
            
            resolve(canvas.toDataURL('image/jpeg', 0.9));
        };
        img.onerror = () => reject(new Error('Failed to load image for thumbnail.'));
        img.src = baseImageSrc;
    });
  };

  const handleGenerateThumbnail = async () => {
      if (!generatedContent?.imageBase64 || !thumbnailText) return;
      setIsGeneratingThumbnail(true);
      setError(null);
      try {
          const imageSrc = `data:image/jpeg;base64,${generatedContent.imageBase64}`;
          const dataUrl = await createThumbnail(imageSrc, thumbnailText, thumbnailAspectRatio, thumbnailFont, thumbnailColor, thumbnailFontSize, thumbnailOutlineWidth);
          setThumbnailDataUrl(dataUrl);
      } catch (err) {
          const message = err instanceof Error ? err.message : '썸네일 생성 중 알 수 없는 오류가 발생했습니다.';
          setError(message);
      } finally {
          setIsGeneratingThumbnail(false);
      }
  };
  
  const mainTabButtonStyle = (tabName: MainTab) => 
    `px-6 py-3 text-lg font-bold transition-colors duration-300 rounded-t-lg focus:outline-none ${
      mainTab === tabName
      ? 'bg-gray-800 text-white'
      : 'bg-gray-700 text-gray-400 hover:bg-gray-700/70 hover:text-white'
    }`;
  
  const suggestionTabButtonStyle = (tabName: TopicSuggestionTab) => 
    `px-4 py-2 text-base font-semibold border-b-2 transition-colors duration-200 focus:outline-none ${
      activeSuggestionTab === tabName
      ? 'border-blue-500 text-blue-400'
      : 'border-transparent text-gray-400 hover:text-white'
    }`;
  
  const SuggestionButton: React.FC<{ onClick: () => void, disabled: boolean, text: string }> = ({ onClick, disabled, text }) => (
     <button
        onClick={onClick}
        disabled={disabled}
        className="w-full bg-indigo-600 text-white font-bold py-2 px-4 rounded-md hover:bg-indigo-700 transition-all duration-200 disabled:bg-gray-500 disabled:cursor-not-allowed flex items-center justify-center"
      >
        {disabled ? (
          <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
        ) : text}
      </button>
  );

  return (
    <div className="min-h-screen bg-gray-900 text-gray-200 font-sans flex flex-col">
      <div className="flex-grow">
        <Header onOpenHelp={() => setIsHelpModalOpen(true)} onOpenKey={handleOpenKey} />
        <main className="container mx-auto p-6">
          <CurrentStatus />
          
          {/* --- Main Tab Navigation --- */}
          <div className="flex justify-between items-center border-b border-gray-700">
            <div className="flex space-x-2">
                <button onClick={() => setMainTab('generator')} className={mainTabButtonStyle('generator')}>
                주제 아이디어 얻기
                </button>
                <button onClick={() => setMainTab('shortcuts')} className={mainTabButtonStyle('shortcuts')}>
                트렌드 바로가기
                </button>
            </div>
            <a 
                href="https://creator-advisor.naver.com/naver_blog" 
                target="_blank" 
                rel="noopener noreferrer"
                className="group flex items-center rounded-md bg-gradient-to-r from-yellow-500 via-amber-500 to-orange-500 px-4 py-2 text-sm font-bold text-slate-900 shadow-lg transition-transform duration-200 hover:scale-105"
            >
                <span className="mr-2 filter drop-shadow">⭐</span>
                <span>네이버 creator-advisor</span>
            </a>
          </div>
          
          <div className="bg-gray-800 p-6 rounded-b-lg shadow-2xl mb-8">
            {mainTab === 'generator' && (
              <div>
                {/* --- Topic Suggestion Section --- */}
                <div>
                  {/* Tab Navigation */}
                  <div className="border-b border-gray-700 mb-4">
                      <nav className="-mb-px flex space-x-4" aria-label="Tabs">
                          <button onClick={() => handleSuggestionTabChange('category')} className={suggestionTabButtonStyle('category')}>카테고리별</button>
                          <button onClick={() => handleSuggestionTabChange('eeat')} className={suggestionTabButtonStyle('eeat')}>E-E-A-T 기반</button>
                          <button onClick={() => handleSuggestionTabChange('evergreen')} className={suggestionTabButtonStyle('evergreen')}>에버그린 콘텐츠</button>
                          <button onClick={() => handleSuggestionTabChange('longtail')} className={suggestionTabButtonStyle('longtail')}>롱테일 키워드 주제</button>
                          <button onClick={() => handleSuggestionTabChange('memo')} className={suggestionTabButtonStyle('memo')}>메모/파일 기반</button>
                      </nav>
                  </div>

                  {/* Tab Content */}
                  <div className="pt-4">
                    {activeSuggestionTab === 'eeat' && (
                      <div className="space-y-4">
                        <p className="text-gray-400 text-sm">구글 SEO의 핵심인 E-E-A-T(경험, 전문성, 권위성, 신뢰성) 원칙을 만족시키는 주제를 추천받으세요. 사용자의 실제 경험과 전문 지식을 효과적으로 보여주어 블로그의 신뢰도를 높이고 검색 순위 상승을 목표로 합니다.</p>
                        <div className="grid md:grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="eeat-category" className="block text-sm font-medium text-gray-300 mb-2">콘텐츠 유형 선택</label>
                                <select id="eeat-category" value={selectedEeatCategory} onChange={(e) => setSelectedEeatCategory(e.target.value)}
                                  className="w-full bg-gray-900 border border-gray-600 rounded-md px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                                  {EEAT_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                </select>
                            </div>
                             <div>
                                <label htmlFor="eeat-subcategory" className="block text-sm font-medium text-gray-300 mb-2">세부 분야 선택</label>
                                <select id="eeat-subcategory" value={selectedEeatSubCategory} onChange={(e) => setSelectedEeatSubCategory(e.target.value)}
                                  className="w-full bg-gray-900 border border-gray-600 rounded-md px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                                  {EEAT_CATEGORIES_DATA[selectedEeatCategory].map(subcat => <option key={subcat} value={subcat}>{subcat}</option>)}
                                </select>
                            </div>
                        </div>
                        <SuggestionButton
                              onClick={() => handleSuggestTopics((currentDate) => generateEeatTopicSuggestions(selectedEeatCategory, selectedEeatSubCategory, currentDate))}
                              disabled={isSuggestingTopics}
                              text="E-E-A-T 주제 추천받기"
                          />
                      </div>
                    )}
                    {activeSuggestionTab === 'category' && (
                      <div className="space-y-4">
                        <p className="text-gray-400 text-sm">선택한 카테고리 내에서 독자의 흥미를 끌고 소셜 미디어 공유를 유도할 만한 최신 트렌드 및 인기 주제를 추천받으세요. 광범위한 독자층을 대상으로 하는 매력적인 콘텐츠 아이디어를 얻을 수 있습니다.</p>
                        <div>
                          <label htmlFor="gen-category" className="block text-sm font-medium text-gray-300 mb-2">카테고리 선택</label>
                          <select id="gen-category" value={selectedGenCategory} onChange={(e) => setSelectedGenCategory(e.target.value)} className="w-full bg-gray-900 border border-gray-600 rounded-md px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                            {GENERAL_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                          </select>
                        </div>
                        {selectedGenCategory === '기타(사용자입력)' && (
                          <div>
                            <label htmlFor="custom-gen-category" className="block text-sm font-medium text-gray-300 mb-2">사용자 입력</label>
                            <input type="text" id="custom-gen-category" value={customGenCategory} onChange={(e) => setCustomGenCategory(e.target.value)} placeholder="관심 카테고리를 입력하세요" className="w-full bg-gray-900 border border-gray-600 rounded-md px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                          </div>
                        )}
                        <SuggestionButton 
                          onClick={() => handleSuggestTopics((currentDate) => generateCategoryTopicSuggestions(selectedGenCategory === '기타(사용자입력)' ? customGenCategory : selectedGenCategory, currentDate))}
                          disabled={isSuggestingTopics || (selectedGenCategory === '기타(사용자입력)' && !customGenCategory.trim())}
                          text="카테고리별 주제 추천받기"
                        />
                      </div>
                    )}

                    {activeSuggestionTab === 'evergreen' && (
                      <div className="space-y-4">
                        <p className="text-gray-400 text-sm">시간이 흘러도 가치가 변하지 않아 꾸준한 검색 트래픽을 유도할 수 있는 '에버그린' 주제를 추천받으세요. 'How-to 가이드', '궁극의 가이드' 등 한번 작성해두면 장기적으로 블로그의 자산이 되는 콘텐츠 아이디어를 얻을 수 있습니다.</p>
                         <div className="grid md:grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="evergreen-category" className="block text-sm font-medium text-gray-300 mb-2">콘텐츠 형식 선택</label>
                                <select id="evergreen-category" value={selectedEvergreenCategory} onChange={(e) => setSelectedEvergreenCategory(e.target.value)} className="w-full bg-gray-900 border border-gray-600 rounded-md px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                                    {EVERGREEN_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                </select>
                            </div>
                            <div>
                                <label htmlFor="evergreen-subcategory" className="block text-sm font-medium text-gray-300 mb-2">주제 분야 선택</label>
                                <select id="evergreen-subcategory" value={selectedEvergreenSubCategory} onChange={(e) => setSelectedEvergreenSubCategory(e.target.value)} className="w-full bg-gray-900 border border-gray-600 rounded-md px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                                    {EVERGREEN_SUBCATEGORIES.map(subcat => <option key={subcat} value={subcat}>{subcat}</option>)}
                                </select>
                            </div>
                        </div>
                        <SuggestionButton 
                          onClick={() => handleSuggestTopics((currentDate) => generateEvergreenTopicSuggestions(selectedEvergreenCategory, selectedEvergreenSubCategory, currentDate))}
                          disabled={isSuggestingTopics}
                          text="에버그린 주제 추천받기"
                        />
                      </div>
                    )}

                    {activeSuggestionTab === 'longtail' && (
                      <div className="space-y-4">
                          <p className="text-gray-400 text-sm">실시간 구글 검색을 활용하여, 검색량은 적지만 명확한 목적을 가진 사용자를 타겟으로 하는 '롱테일 키워드' 주제를 추천받으세요. 경쟁이 낮아 상위 노출에 유리하며, 구매나 특정 행동으로 이어질 확률이 높은 잠재고객을 유치하는 데 효과적입니다.</p>
                          <div>
                              <label htmlFor="longtail-category" className="block text-sm font-medium text-gray-300 mb-2">콘텐츠 유형 선택</label>
                              <select id="longtail-category" value={selectedLongtailCategory} onChange={(e) => setSelectedLongtailCategory(e.target.value)} className="w-full bg-gray-900 border border-gray-600 rounded-md px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                                  {LONGTAIL_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                              </select>
                          </div>
                          <SuggestionButton 
                              onClick={() => handleSuggestTopics((currentDate) => generateLongtailTopicSuggestions(selectedLongtailCategory, currentDate))}
                              disabled={isSuggestingTopics}
                              text="롱테일 주제 추천받기"
                          />
                      </div>
                    )}

                    {activeSuggestionTab === 'memo' && (
                      <div className="space-y-4">
                        <p className="text-gray-400 text-sm">가지고 있는 아이디어 메모, 초안, 강의 노트, 관련 자료 파일 등을 기반으로 블로그 주제를 추천받으세요. AI가 핵심 내용을 분석하여 가장 매력적이고 발전 가능성이 높은 포스트 제목을 제안해 드립니다.</p>
                        <div>
                          <label htmlFor="memo-content" className="block text-sm font-medium text-gray-300 mb-2">메모/초안 입력</label>
                          <textarea id="memo-content" value={memoContent} onChange={(e) => setMemoContent(e.target.value)} rows={6} placeholder="여기에 아이디어를 자유롭게 작성하거나 아래 버튼을 통해 파일을 업로드하세요." className="w-full bg-gray-900 border border-gray-600 rounded-md px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"></textarea>
                        </div>
                        <div className="flex items-center space-x-2">
                            <label htmlFor="file-upload" className="cursor-pointer bg-gray-700 text-white font-bold py-2 px-4 rounded-md hover:bg-gray-600 transition-colors duration-200 inline-flex items-center">
                                <span className="mr-2">📤</span>
                                <span>파일 업로드 (.txt, .md 등)</span>
                            </label>
                            <input id="file-upload" type="file" multiple accept=".txt,.md,.html,.js,.jsx,.ts,.tsx,.json,.css" className="hidden" onChange={handleFileChange} />
                            {uploadedFileNames.length > 0 && (
                                <span className="text-sm text-gray-400 truncate">{uploadedFileNames.join(', ')}</span>
                            )}
                        </div>
                        <SuggestionButton 
                          onClick={() => handleSuggestTopics((currentDate) => generateTopicsFromMemo(memoContent, currentDate))}
                          disabled={isSuggestingTopics || !memoContent.trim()}
                          text="메모 기반 주제 추천받기"
                        />
                      </div>
                    )}
                  </div>

                  {/* Topic Suggestion Results */}
                  {suggestionError && (
                    <div className="mt-4 p-3 bg-red-900/50 border border-red-700 text-red-300 rounded-md text-sm">{suggestionError}</div>
                  )}
                  {suggestedTopics.length > 0 && (
                    <div className="mt-4 p-4 bg-gray-900/50 border border-gray-700 rounded-lg">
                        <h4 className="text-md font-semibold text-white mb-3">추천 주제:</h4>
                        <ul className="space-y-2">
                            {suggestedTopics.map((sTopic, index) => (
                                <li key={index} 
                                    onClick={() => handleTopicSelect(sTopic)}
                                    className="p-3 bg-gray-800 rounded-md cursor-pointer hover:bg-blue-600 hover:text-white transition-colors duration-200 text-sm text-gray-300">
                                    {sTopic}
                                </li>
                            ))}
                        </ul>
                    </div>
                  )}
                </div>
              </div>
            )}

            {mainTab === 'shortcuts' && (
                <Shortcuts />
            )}
          </div>
          
          {/* --- Main Generation Section --- */}
          <div id="generation-section" className="bg-gray-800 p-6 rounded-lg shadow-2xl mb-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
              <span role="img" aria-label="magic wand" className="w-6 h-6 mr-2 text-blue-400 text-xl">✨</span>
              포스트 생성하기
            </h3>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4 flex flex-col">
                {/* Blog Topic Input */}
                <div>
                  <label htmlFor="blog-topic" className="block text-sm font-medium text-gray-300 mb-2">블로그 주제</label>
                  <input
                    type="text"
                    id="blog-topic"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="예: 2024년 최고의 AI 생산성 도구 5가지"
                    className="w-full bg-gray-900 border border-gray-600 rounded-md px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                {/* Color Theme Selector */}
                <div>
                  <label htmlFor="color-theme" className="block text-sm font-medium text-gray-300 mb-2">컬러 테마</label>
                  <select
                    id="color-theme"
                    value={selectedTheme.name}
                    onChange={(e) => setSelectedTheme(COLOR_THEMES.find(t => t.name === e.target.value) || COLOR_THEMES[0])}
                    className="w-full bg-gray-900 border border-gray-600 rounded-md px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {COLOR_THEMES.map(theme => (
                      <option key={theme.name} value={theme.name}>{theme.name} - {theme.description}</option>
                    ))}
                  </select>
                </div>

                {/* Additional Request Input */}
                <div className="flex-grow flex flex-col">
                    <label htmlFor="additional-request" className="block text-sm font-medium text-gray-300 mb-2">
                        {activeSuggestionTab === 'memo' ? '메모 기반 생성 추가 요청사항' : '기사에 반영할 추가 요청사항'}
                    </label>
                    <textarea 
                        id="additional-request" 
                        value={additionalRequest} 
                        onChange={(e) => setAdditionalRequest(e.target.value)} 
                        placeholder={activeSuggestionTab === 'memo' ? "예: 초보자의 시각에서 더 쉽게 설명해주세요." : "예: 글 마지막에 행동 촉구 문구를 추가해주세요."} 
                        className="w-full flex-grow bg-gray-900 border border-gray-600 rounded-md px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                </div>
              </div>

              {/* Generation Options */}
              <div className="space-y-4 bg-gray-900/50 p-4 rounded-lg border border-gray-700">
                <h4 className="text-md font-semibold text-white mb-2">고급 옵션</h4>
                
                <div className="flex items-start">
                    <div className="flex items-center h-5">
                        <input id="generate-image" type="checkbox" checked={shouldGenerateImage} onChange={(e) => setShouldGenerateImage(e.target.checked)} className="focus:ring-blue-500 h-4 w-4 text-blue-600 bg-gray-700 border-gray-600 rounded" />
                    </div>
                    <div className="ml-3 text-sm">
                        <label htmlFor="generate-image" className="font-medium text-gray-300">대표 이미지 자동 생성</label>
                        <p className="text-gray-400">AI가 포스트와 어울리는 대표 이미지를 생성합니다.</p>
                    </div>
                </div>
                
                <div className="flex items-start">
                    <div className="flex items-center h-5">
                        <input id="generate-sub-images" type="checkbox" checked={shouldGenerateSubImages} onChange={(e) => setShouldGenerateSubImages(e.target.checked)} className="focus:ring-blue-500 h-4 w-4 text-blue-600 bg-gray-700 border-gray-600 rounded" />
                    </div>
                    <div className="ml-3 text-sm">
                        <label htmlFor="generate-sub-images" className="font-medium text-gray-300">본문 서브 이미지 자동 생성</label>
                        <p className="text-gray-400">AI가 글의 흐름에 맞춰 2~3개의 이미지를 생성하여 본문에 자동 배치합니다.</p>
                    </div>
                </div>

                <div className="flex items-start">
                    <div className="flex items-center h-5">
                        <input id="add-thumbnail-text" type="checkbox" checked={shouldAddThumbnailText} onChange={(e) => setShouldAddThumbnailText(e.target.checked)} disabled={!shouldGenerateImage} className="focus:ring-blue-500 h-4 w-4 text-blue-600 bg-gray-700 border-gray-600 rounded disabled:opacity-50" />
                    </div>
                    <div className="ml-3 text-sm">
                        <label htmlFor="add-thumbnail-text" className={`font-medium ${!shouldGenerateImage ? 'text-gray-500' : 'text-gray-300'}`}>썸네일용 텍스트 추가</label>
                        <p className={`text-gray-400 ${!shouldGenerateImage ? 'text-gray-500' : ''}`}>대표 이미지에 텍스트를 추가하여 썸네일을 생성합니다.</p>
                    </div>
                </div>
                
                {/* This block is now inside the main options area, not tied to thumbnail checkbox */}
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">대표 이미지/썸네일 비율</label>
                    <div className="flex space-x-2">
                        <button
                            type="button"
                            onClick={() => setThumbnailAspectRatio('16:9')}
                            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${thumbnailAspectRatio === '16:9' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>
                            16:9 (와이드)
                        </button>
                        <button
                            type="button"
                            onClick={() => setThumbnailAspectRatio('1:1')}
                            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${thumbnailAspectRatio === '1:1' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>
                            1:1 (정사각형)
                        </button>
                    </div>
                  </div>

                {shouldAddThumbnailText && (
                    <div className="pl-8 space-y-4 pt-2 border-t border-gray-700 mt-4">
                      <div>
                        <label htmlFor="thumbnail-text" className="block text-sm font-medium text-gray-300 mb-2">썸네일 텍스트</label>
                        <input type="text" id="thumbnail-text" value={thumbnailText} onChange={(e) => setThumbnailText(e.target.value)} placeholder="글 생성 후 SEO 제목이 자동으로 제안됩니다." className="w-full bg-gray-900 border border-gray-600 rounded-md px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                        <p className="text-xs text-gray-500 mt-1.5">/ 를 사용하여 강제로 줄바꿈할 수 있습니다.</p>
                      </div>

                      <div>
                          <label htmlFor="thumbnail-font" className="block text-sm font-medium text-gray-300 mb-2">글꼴</label>
                          <select id="thumbnail-font" value={thumbnailFont} onChange={(e) => setThumbnailFont(e.target.value)} className="w-full bg-gray-900 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 text-sm">
                            <option value="Pretendard">Pretendard (고딕)</option>
                            <option value="Gmarket Sans">Gmarket Sans (고딕)</option>
                            <option value="Noto Sans KR">Noto Sans KR (고딕)</option>
                            <option value="Cafe24Ssurround">카페24 써라운드 (장식)</option>
                            <option value="Gowun Dodum">Gowun Dodum (명조)</option>
                            <option value="Black Han Sans">Black Han Sans (두꺼운)</option>
                            <option value="Jua">Jua (손글씨)</option>
                            <option value="Nanum Pen Script">나눔 손글씨 펜 (손글씨)</option>
                          </select>
                      </div>

                      <div className="pt-2">
                          <label className="block text-sm font-medium text-gray-300 mb-2">글자 색상</label>
                          <div className="grid grid-cols-6 gap-2">
                              {THUMBNAIL_COLORS.map((color) => (
                                  <button
                                      key={color}
                                      type="button"
                                      onClick={() => setThumbnailColor(color)}
                                      className={`w-full h-8 rounded-md border-2 transition-all ${thumbnailColor.toUpperCase() === color.toUpperCase() ? 'ring-2 ring-offset-2 ring-offset-gray-800 ring-blue-500 border-white' : 'border-gray-600 hover:border-gray-400'}`}
                                      style={{ backgroundColor: color }}
                                      aria-label={`Select color ${color}`}
                                  />
                              ))}
                          </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 pt-2">
                        <div>
                          <label htmlFor="thumbnail-font-size" className="block text-sm font-medium text-gray-300 mb-2">크기: {thumbnailFontSize}px</label>
                          <input type="range" id="thumbnail-font-size" min="20" max="200" value={thumbnailFontSize} onChange={(e) => setThumbnailFontSize(Number(e.target.value))} className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer" />
                        </div>
                        <div>
                          <label htmlFor="thumbnail-outline-width" className="block text-sm font-medium text-gray-300 mb-2">외곽선 굵기: {thumbnailOutlineWidth}px</label>
                          <input type="range" id="thumbnail-outline-width" min="0" max="20" value={thumbnailOutlineWidth} onChange={(e) => setThumbnailOutlineWidth(Number(e.target.value))} className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer" />
                        </div>
                      </div>

                      {generatedContent?.supplementaryInfo?.seoTitles && generatedContent.supplementaryInfo.seoTitles.length > 0 && (
                        <div>
                          <p className="text-xs text-gray-400 mb-2">추천 텍스트 (클릭하여 사용):</p>
                          <div className="flex flex-wrap gap-2">
                            {generatedContent.supplementaryInfo.seoTitles.map((title, index) => (
                              <button
                                key={index}
                                type="button"
                                onClick={() => setThumbnailText(title)}
                                className="text-xs bg-gray-700 text-gray-300 px-3 py-1.5 rounded-full hover:bg-gray-600 hover:text-white transition-colors"
                              >
                                {title}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                )}

                <div className="flex items-start">
                    <div className="flex items-center h-5">
                        <input id="include-interactive" type="checkbox" checked={shouldIncludeInteractiveElement} onChange={(e) => setShouldIncludeInteractiveElement(e.target.checked)} className="focus:ring-blue-500 h-4 w-4 text-blue-600 bg-gray-700 border-gray-600 rounded" />
                    </div>
                    <div className="ml-3 text-sm">
                        <label htmlFor="include-interactive" className="font-medium text-gray-300">인터랙티브 요소 포함</label>
                        <p className="text-gray-400">독자의 참여를 유도하는 계산기, 퀴즈 등을 자동으로 제안하고 포함시킵니다.</p>
                    </div>
                </div>
                
                {shouldIncludeInteractiveElement && (
                    <div className="pl-8">
                        <label htmlFor="interactive-idea" className="block text-sm font-medium text-gray-300 mb-2">요소 아이디어</label>
                        <div className="relative">
                            <input type="text" id="interactive-idea" value={interactiveElementIdea || ''} onChange={(e) => setInteractiveElementIdea(e.target.value)} placeholder={isSuggestingInteractiveElement ? "AI가 아이디어를 제안 중..." : "자동 제안 또는 직접 입력"} className="w-full bg-gray-900 border border-gray-600 rounded-md px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                            {isSuggestingInteractiveElement && <div className="absolute inset-y-0 right-0 flex items-center pr-3"><svg className="animate-spin h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg></div>}
                        </div>
                    </div>
                )}
              </div>
            </div>
            <div className="mt-6">
              <button
                onClick={handleGenerate}
                disabled={isLoading || !topic}
                className="w-full bg-blue-600 text-white font-bold py-3 px-4 rounded-md hover:bg-blue-700 transition-all duration-200 disabled:bg-gray-500 disabled:cursor-not-allowed flex items-center justify-center text-lg"
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                    </svg>
                    생성 중...
                  </>
                ) : (
                  <>
                    <span role="img" aria-label="magic wand" className="mr-2">✨</span>
                    포스트 생성
                  </>
                )}
              </button>
            </div>
            {error && <p className="text-red-400 mt-4 text-center">{error}</p>}
          </div>

          <ResultDisplay
            htmlContent={generatedContent?.blogPostHtml || ''}
            isLoading={isLoading}
            supplementaryInfo={generatedContent?.supplementaryInfo || null}
            socialMediaPosts={generatedContent?.socialMediaPosts || null}
            imageBase64={generatedContent?.imageBase64 || null}
            subImages={generatedContent?.subImages || null}
            onGenerateImage={handleGenerateImage}
            isGeneratingImage={isGeneratingImage}
            onGenerateSubImage={handleGenerateSubImage}
            isGeneratingSubImages={isGeneratingSubImages}
            shouldAddThumbnailText={shouldAddThumbnailText}
            onGenerateThumbnail={handleGenerateThumbnail}
            isGeneratingThumbnail={isGeneratingThumbnail}
            thumbnailDataUrl={thumbnailDataUrl}
            thumbnailAspectRatio={thumbnailAspectRatio}
          />

          {/* --- Regeneration Section --- */}
          {!isLoading && generatedContent && (
            <div className="mt-8 bg-gray-800 p-6 rounded-lg shadow-2xl">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                <span role="img" aria-label="document with pencil" className="w-6 h-6 mr-2 text-green-400 text-xl">📝</span>
                피드백 및 재작성
              </h3>
              <p className="text-gray-400 text-sm mb-4">
                생성된 기사가 마음에 들지 않으시나요? 아래에 수정하고 싶은 부분을 구체적으로 작성하고 '기사 재작성' 버튼을 클릭하세요. <br />
                이미지, SEO 제목, 키워드 등은 그대로 유지한 채 **기사 본문만** 피드백에 맞춰 다시 생성됩니다.
              </p>
              <div>
                <label htmlFor="regeneration-feedback" className="block text-sm font-medium text-gray-300 mb-2">수정 요청사항</label>
                <textarea
                  id="regeneration-feedback"
                  value={regenerationFeedback}
                  onChange={(e) => setRegenerationFeedback(e.target.value)}
                  rows={4}
                  placeholder="예: 전체적으로 좀 더 전문적인 용어를 사용해주세요. / 3번째 문단의 내용을 더 자세하게 설명해주세요."
                  className="w-full bg-gray-900 border border-gray-600 rounded-md px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div className="mt-4">
                <button
                  onClick={handleRegenerate}
                  disabled={isRegenerating || !regenerationFeedback.trim()}
                  className="w-full bg-green-600 text-white font-bold py-3 px-4 rounded-md hover:bg-green-700 transition-all duration-200 disabled:bg-gray-500 disabled:cursor-not-allowed flex items-center justify-center text-lg"
                >
                  {isRegenerating ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                      </svg>
                      재작성 중...
                    </>
                  ) : (
                    '기사 재작성'
                  )}
                </button>
              </div>
            </div>
          )}
        </main>
      </div>
      <Footer />
      {isHelpModalOpen && <HelpModal onClose={() => setIsHelpModalOpen(false)} />}
      <ApiKeyModal isOpen={isApiKeyModalOpen} onClose={() => setIsApiKeyModalOpen(false)} />
    </div>
  );
}

export default App;
