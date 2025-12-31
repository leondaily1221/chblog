
import type { WeatherData, SearchSource, KeywordData, BlogPostData, NaverNewsData, GoogleSerpData, PaaItem, KeywordMetrics, GeneratedTopic, BlogStrategyReportData, RecommendedKeyword, SustainableTopicCategory, SerpStrategyReportData, NewsStrategyIdea } from '../types';
import { GoogleGenAI, Type } from "@google/genai";

const getApiKey = () => {
  const encrypted = localStorage.getItem('user_custom_gemini_api_key');
  if (encrypted) {
    try {
      return atob(encrypted);
    } catch (e) {
      return process.env.API_KEY;
    }
  }
  return process.env.API_KEY;
};

function extractJsonFromText(text: string): any {
    let jsonString = text.trim();
    const markdownMatch = jsonString.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (markdownMatch && markdownMatch[1]) {
        jsonString = markdownMatch[1].trim();
    }
    const startIndex = jsonString.search(/[[{]/);
    if (startIndex === -1) throw new Error('JSON not found');
    const potentialJson = jsonString.substring(startIndex);
    try {
        return JSON.parse(potentialJson);
    } catch (error) {
        // Simple balance bracket fallback
        return JSON.parse(jsonString.substring(startIndex, jsonString.lastIndexOf(jsonString[startIndex] === '[' ? ']' : '}') + 1));
    }
}

export const fetchCurrentWeather = async (): Promise<WeatherData> => {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: "Current weather in Seoul JSON format with temperature, condition, wind, humidity.",
        config: { tools: [{ googleSearch: {} }] }
    });
    return extractJsonFromText(response.text);
};

export const generateTopicsFromMainKeyword = async (mainKeyword: string): Promise<GeneratedTopic[]> => {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Generate 3 SEO topics for keyword: ${mainKeyword} JSON format.`,
        config: { responseMimeType: "application/json" }
    });
    return extractJsonFromText(response.text);
};

export const generateTopicsFromAllKeywords = async (mainKeyword: string, relatedKeywords: string[]): Promise<GeneratedTopic[]> => {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Combine ${mainKeyword} and ${relatedKeywords.join(', ')} into 3 SEO topics JSON.`,
        config: { responseMimeType: "application/json" }
    });
    return extractJsonFromText(response.text);
};

export const generateBlogStrategy = async (mainKeyword: string, blogPosts: BlogPostData[]): Promise<BlogStrategyReportData> => {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Analyze these titles for ${mainKeyword} and suggest 3 topics JSON: ${blogPosts.map(p => p.title).join('\n')}`,
        config: { responseMimeType: "application/json" }
    });
    return extractJsonFromText(response.text);
};

export const fetchRecommendedKeywords = async (): Promise<RecommendedKeyword[]> => {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: "Recommend 4 latest trending keywords for Korea blog topics JSON.",
        config: { tools: [{ googleSearch: {} }] }
    });
    return extractJsonFromText(response.text);
};

export const generateSustainableTopics = async (keyword: string): Promise<SustainableTopicCategory[]> => {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Generate sustainable topics for ${keyword} in 4 categories JSON.`,
    });
    return extractJsonFromText(response.text);
};

export const generateSerpStrategy = async (mainKeyword: string, serpData: GoogleSerpData): Promise<SerpStrategyReportData> => {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Generate strategy for ${mainKeyword} based on SERP ${JSON.stringify(serpData)} JSON.`,
    });
    return extractJsonFromText(response.text);
};

export const generateStrategyFromNews = async (news: NaverNewsData[]): Promise<NewsStrategyIdea[]> => {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Generate 3 strategy ideas from these news titles: ${news.map(n => n.title).join('\n')} JSON.`,
    });
    return extractJsonFromText(response.text);
};

export const generateRelatedKeywords = async (keyword: string): Promise<GoogleSerpData> => {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Analyze Google SERP for ${keyword} and return related searches and PAA JSON.`,
        config: { tools: [{ googleSearch: {} }] }
    });
    return extractJsonFromText(response.text);
};

export const fetchRelatedKeywords = async (keyword: string, source: SearchSource): Promise<KeywordData[]> => {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Generate 10 autocomplete searches for ${keyword} from ${source} JSON array.`,
    });
    const keywords: string[] = extractJsonFromText(response.text);
    return keywords.map((kw, index) => ({ id: index + 1, keyword: kw }));
};

export const fetchNaverBlogPosts = async (keyword: string, clientId: string, clientSecret: string): Promise<BlogPostData[]> => {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Generate 10 dummy Naver blog search results for ${keyword} JSON array.`,
    });
    const parsed = extractJsonFromText(response.text);
    return parsed.map((item: any, index: number) => ({ ...item, id: index + 1 }));
};

export const analyzeKeywordCompetition = async (keyword: string): Promise<KeywordMetrics> => {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Deep SEO competition analysis for ${keyword} JSON.`,
        config: { tools: [{ googleSearch: {} }] }
    });
    return extractJsonFromText(response.text);
};

export const fetchNaverNews = async (keyword: string, clientId: string, clientSecret: string): Promise<NaverNewsData[]> => {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Generate 5 dummy Naver news results for ${keyword} JSON array.`,
        config: { tools: [{ googleSearch: {} }] }
    });
    const parsed = extractJsonFromText(response.text);
    return parsed.map((item: any, index: number) => ({ ...item, id: index + 1 }));
};
