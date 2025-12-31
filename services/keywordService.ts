
import type { WeatherData, SearchSource, KeywordData, BlogPostData, NaverNewsData, GoogleSerpData, PaaItem, KeywordMetrics, GeneratedTopic, BlogStrategyReportData, RecommendedKeyword, SustainableTopicCategory, SerpStrategyReportData, NewsStrategyIdea } from '../types';
import { GoogleGenAI, Type } from "@google/genai";

/**
 * Extracts and parses a JSON object from a string that may contain markdown and other text.
 * It intelligently finds the end of the JSON structure by balancing brackets.
 * @param text The raw string from the AI response.
 * @returns The parsed JSON object.
 * @throws An error if JSON cannot be found or parsed.
 */
function extractJsonFromText(text: string): any {
    let jsonString = text.trim();

    // Attempt to find JSON within markdown code blocks first
    const markdownMatch = jsonString.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (markdownMatch && markdownMatch[1]) {
        jsonString = markdownMatch[1].trim();
    }

    const startIndex = jsonString.search(/[[{]/);
    if (startIndex === -1) {
        throw new Error('AI 응답에서 유효한 JSON을 찾을 수 없습니다.');
    }

    const startChar = jsonString[startIndex];
    const endChar = startChar === '[' ? ']' : '}';
    let openCount = 0;
    let endIndex = -1;

    // Find the matching closing bracket/brace, ignoring those inside strings
    let inString = false;
    let escapeChar = false;
    for (let i = startIndex; i < jsonString.length; i++) {
        const char = jsonString[i];

        if (escapeChar) {
            escapeChar = false;
            continue;
        }
        if (char === '\\') {
            escapeChar = true;
            continue;
        }
        if (char === '"') {
            inString = !inString;
        }

        if (!inString) {
            if (char === startChar) {
                openCount++;
            } else if (char === endChar) {
                openCount--;
            }
        }

        if (openCount === 0) {
            endIndex = i;
            break;
        }
    }
    
    // Fallback to old logic if bracket matching fails for some reason
    if (endIndex === -1) {
        const lastBrace = jsonString.lastIndexOf('}');
        const lastBracket = jsonString.lastIndexOf(']');
        endIndex = Math.max(lastBrace, lastBracket);
    }
    
    if (endIndex === -1) {
        throw new Error('AI 응답에서 유효한 JSON의 끝을 찾을 수 없습니다.');
    }

    const potentialJson = jsonString.substring(startIndex, endIndex + 1);

    try {
        return JSON.parse(potentialJson);
    } catch (error) {
        console.error("JSON 파싱 실패. 원본 텍스트:", text);
        console.error("추출된 JSON 문자열:", potentialJson);
        if (error instanceof Error) {
            throw new Error(`AI가 반환한 데이터의 형식이 잘못되었습니다. 오류: ${error.message}`);
        }
        throw new Error('AI가 반환한 데이터의 형식이 잘못되었습니다.');
    }
}

export const fetchCurrentWeather = async (): Promise<WeatherData> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `
    오늘 서울의 현재 날씨를 Google 검색을 사용해서 알려주세요. 
    온도, 날씨 상태(예: 맑음, 구름 많음), 풍속, 습도를 포함해야 합니다. 
    다른 설명 없이 JSON 코드 블록 형식으로만 응답해주세요.
    
    \`\`\`json
    {
        "temperature": "...",
        "condition": "...",
        "wind": "...",
        "humidity": "..."
    }
    \`\`\`
    `.trim();

    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: prompt,
            config: {
                tools: [{ googleSearch: {} }],
            }
        });
        const parsed = extractJsonFromText(response.text);
        if (parsed.temperature && parsed.condition && parsed.wind && parsed.humidity) {
            return parsed as WeatherData;
        } else {
            throw new Error('AI 응답이 날씨 데이터 형식이 아닙니다.');
        }
    } catch (error) {
        console.error("날씨 정보 조회 중 Gemini API 오류:", error);
        if (error instanceof Error) {
            throw new Error(`실시간 날씨 정보를 가져오는 데 실패했습니다: ${error.message}`);
        }
        throw new Error("실시간 날씨 정보를 가져오는 데 실패했습니다.");
    }
};

export const generateTopicsFromMainKeyword = async (mainKeyword: string): Promise<GeneratedTopic[]> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `"${mainKeyword}" 키워드 하나만을 사용하여, SEO에 최적화된 블로그 포스트 주제 3개를 생성해주세요. 각 주제에는 id(1부터 시작), title, thumbnailCopy(썸네일 문구), strategy(구체적인 공략법)가 포함되어야 합니다. JSON 배열 형식으로만 응답해주세요.`;
    const responseSchema = {
        type: Type.ARRAY,
        items: {
            type: Type.OBJECT,
            properties: {
                id: { type: Type.INTEGER },
                title: { type: Type.STRING },
                thumbnailCopy: { type: Type.STRING },
                strategy: { type: Type.STRING },
            },
            required: ['id', 'title', 'thumbnailCopy', 'strategy'],
        }
    };
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: { responseMimeType: "application/json", responseSchema }
    });
    return JSON.parse(response.text);
};

export const generateTopicsFromAllKeywords = async (mainKeyword: string, relatedKeywords: string[]): Promise<GeneratedTopic[]> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `메인 키워드 "${mainKeyword}"와 연관 키워드 [${relatedKeywords.join(', ')}]를 조합하여, SEO에 최적화된 블로그 포스트 주제 3개를 생성해주세요. 각 주제에는 id(1부터 시작), title, thumbnailCopy(썸네일 문구), strategy(구체적인 공략법)가 포함되어야 합니다. JSON 배열 형식으로만 응답해주세요.`;
    const responseSchema = {
        type: Type.ARRAY,
        items: {
            type: Type.OBJECT,
            properties: {
                id: { type: Type.INTEGER },
                title: { type: Type.STRING },
                thumbnailCopy: { type: Type.STRING },
                strategy: { type: Type.STRING },
            },
            required: ['id', 'title', 'thumbnailCopy', 'strategy'],
        }
    };
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: { responseMimeType: "application/json", responseSchema }
    });
    return JSON.parse(response.text);
};

export const generateBlogStrategy = async (mainKeyword: string, blogPosts: BlogPostData[]): Promise<BlogStrategyReportData> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const postTitles = blogPosts.map(p => p.title).join('\n');
    const prompt = `메인 키워드 "${mainKeyword}"에 대한 상위 블로그 포스트 제목들입니다:\n${postTitles}\n\n이 제목들을 분석하여 다음 정보를 포함하는 공략 리포트를 생성해주세요:\n- analysis: { structure, characteristics, commonKeywords } - 제목들의 구조적/감성적 특징 및 공통 키워드 분석.\n- suggestions: 1위를 공략하기 위한 새로운 블로그 주제 제안 3개 (id, title, thumbnailCopy, strategy 포함). JSON 형식으로만 응답해주세요.`;
    const responseSchema = {
        type: Type.OBJECT,
        properties: {
            analysis: {
                type: Type.OBJECT,
                properties: {
                    structure: { type: Type.STRING },
                    characteristics: { type: Type.STRING },
                    commonKeywords: { type: Type.STRING },
                },
                required: ['structure', 'characteristics', 'commonKeywords'],
            },
            suggestions: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        id: { type: Type.INTEGER },
                        title: { type: Type.STRING },
                        thumbnailCopy: { type: Type.STRING },
                        strategy: { type: Type.STRING },
                    },
                    required: ['id', 'title', 'thumbnailCopy', 'strategy'],
                }
            }
        },
        required: ['analysis', 'suggestions'],
    };
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: { responseMimeType: "application/json", responseSchema }
    });
    return JSON.parse(response.text);
};

export const fetchRecommendedKeywords = async (): Promise<RecommendedKeyword[]> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `오늘 날짜를 기준으로 대한민국에서 블로그 주제로 다루기 좋은 최신 이슈 키워드 4개를 추천해주세요. 구글 검색을 활용하여 실시간 트렌드를 반영해야 합니다. 각 키워드에는 id, keyword, reason(선정 이유), title(추천 블로그 제목), thumbnailCopy, strategy가 포함되어야 합니다. JSON 배열 형식으로만 응답해주세요.`;
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: { tools: [{ googleSearch: {} }] }
    });
    return extractJsonFromText(response.text);
};

export const generateSustainableTopics = async (keyword: string): Promise<SustainableTopicCategory[]> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `"${keyword}"라는 하나의 키워드를 가지고, 4가지 다른 관점(초보자 가이드, 심층 분석, 문제 해결, 최신 트렌드)에서 블로그 주제를 발굴해주세요. 각 카테고리별로 3개의 주제를 제안해야 합니다. 각 주제에는 title, keywords(관련 키워드 배열), strategy가 포함되어야 합니다. JSON 배열(SustainableTopicCategory[]) 형식으로만 응답해주세요.`;
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
    });
    return extractJsonFromText(response.text);
};

export const generateSerpStrategy = async (mainKeyword: string, serpData: GoogleSerpData): Promise<SerpStrategyReportData> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `메인 키워드 "${mainKeyword}"와 SERP 데이터(${JSON.stringify(serpData)})를 기반으로 콘텐츠 전략 리포트를 생성해주세요. analysis(핵심 사용자 의도 분석 및 필러 포스트 제안)와 suggestions(콘텐츠 갭을 공략할 주제 3개)를 포함해야 합니다. JSON 형식으로만 응답해주세요.`;
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
    });
    return extractJsonFromText(response.text);
};

export const generateStrategyFromNews = async (news: NaverNewsData[]): Promise<NewsStrategyIdea[]> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const newsTitles = news.map(n => n.title).join('\n');
    const prompt = `다음 최신 뉴스 제목들을 기반으로, 블로거가 시의성 있게 다룰 수 있는 블로그 포스트 아이디어 3개를 제안해주세요.\n${newsTitles}\n\n각 아이디어는 id, title, keywords(핵심 키워드 배열), strategy(콘텐츠 전략)를 포함해야 합니다. JSON 배열 형식으로만 응답해주세요.`;
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
    });
    return extractJsonFromText(response.text);
};

export const generateRelatedKeywords = async (keyword: string): Promise<GoogleSerpData> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `"${keyword}" 키워드에 대한 Google 검색 결과 페이지(SERP)를 분석하여 다음 정보를 추출해주세요.\n- related_searches: '관련 검색어' 목록에서 8개 추출.\n- people_also_ask: '다른 사람들이 함께 찾는 질문(PAA)' 섹션에서 질문 4개와 그에 대한 간단한 답변, 그리고 해당 질문에 대한 블로그 콘텐츠 갭 분석(공략 포인트)을 제공.\n\nJSON 형식으로만 응답해주세요.`;
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: { tools: [{ googleSearch: {} }] }
    });
    return extractJsonFromText(response.text);
};

export const fetchRelatedKeywords = async (keyword: string, source: SearchSource): Promise<KeywordData[]> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `"${keyword}"에 대한 ${source} 자동완성 연관검색어 10개를 생성해주세요. 다른 설명 없이 JSON 배열 형식(["키워드1", "키워드2", ...])으로만 응답해주세요.`;
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
    });
    const keywords: string[] = extractJsonFromText(response.text);
    return keywords.map((kw, index) => ({ id: index + 1, keyword: kw }));
};

export const fetchNaverBlogPosts = async (keyword: string, clientId: string, clientSecret: string): Promise<BlogPostData[]> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `"${keyword}"에 대한 네이버 블로그 검색 결과 상위 10개를 생성해주세요. 실제 검색 결과처럼 제목, URL, 간단한 설명을 포함해야 합니다. 다른 설명 없이 JSON 배열 형식으로만 응답해주세요. URL은 naver.com 도메인을 사용해주세요.`;
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
    });
    const parsed = extractJsonFromText(response.text);
    return parsed.map((item: any, index: number) => ({ ...item, id: index + 1 }));
};

export const analyzeKeywordCompetition = async (keyword: string): Promise<KeywordMetrics> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `당신은 SEO 및 콘텐츠 마케팅 전문가입니다. 키워드 "${keyword}"에 대한 심층적인 경쟁력 분석 리포트를 생성해주세요. Google 검색을 활용하여 최신 데이터를 반영해야 합니다. opportunityScore(0-100), searchVolumeEstimate(0-100), competitionScore(0-100), analysis 객체(title, reason, opportunity, threat, consumptionAndIssues, conclusion), 그리고 opportunityScore가 80 미만일 경우 strategy 객체(expandedKeywords, blogTopics)를 포함해야 합니다. JSON 형식으로만 응답해주세요.`;
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: { tools: [{ googleSearch: {} }] }
    });
    return extractJsonFromText(response.text);
};

export const fetchNaverNews = async (keyword: string, clientId: string, clientSecret: string): Promise<NaverNewsData[]> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `"${keyword}"에 대한 네이버 뉴스 검색 결과 5개를 생성해주세요. 실제 뉴스처럼 제목, URL, 간단한 설명, 발행일을 포함해야 합니다. 다른 설명 없이 JSON 배열 형식으로만 응답해주세요. URL은 news.naver.com 도메인을 사용해주세요. 발행일은 ISO 8601 형식으로 해주세요.`;
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: { tools: [{ googleSearch: {} }] }
    });
    const parsed = extractJsonFromText(response.text);
    return parsed.map((item: any, index: number) => ({ ...item, id: index + 1 }));
};
