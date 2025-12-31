
import { GoogleGenAI, Type } from "@google/genai";
import { ColorTheme, GeneratedContent, SupplementaryInfo } from '../types';

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

const responseSchema = {
    type: Type.OBJECT,
    properties: {
        blogPostHtml: {
            type: Type.STRING,
            description: "The full HTML content of the blog post with inline styles."
        },
        supplementaryInfo: {
            type: Type.OBJECT,
            properties: {
                keywords: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: "An array of 10 relevant SEO keywords."
                },
                imagePrompt: {
                    type: Type.STRING,
                    description: "A detailed DALL-E prompt in English to generate a featured image."
                },
                altText: {
                    type: Type.STRING,
                    description: "A concise, descriptive alt text in Korean for the featured image, optimized for SEO and accessibility."
                },
                seoTitles: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: "블로그 썸네일에 사용하기 적합한, 강력하고 요약된 제목 5개의 배열입니다. 제목은 간결하고 시선을 사로잡아야 합니다. 썸네일에서의 더 나은 시각적 구성을 위해, 제안하는 줄바꿈 위치에 슬래시('/')를 사용해주세요."
                },
                subImagePrompts: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            prompt: {
                                type: Type.STRING,
                                description: "A detailed DALL-E prompt in English for a sub-image."
                            },
                            altText: {
                                type: Type.STRING,
                                description: "A concise, descriptive alt text in Korean for the sub-image, optimized for SEO and accessibility. It should be directly related to the topic."
                            }
                        },
                        required: ["prompt", "altText"]
                    },
                    description: "An array of 2-3 objects, each containing a detailed DALL-E prompt and a corresponding Korean alt text for sub-images to be placed sequentially within the blog post, corresponding to <!--SUB_IMAGE_PLACEHOLDER_N--> placeholders. Should be an empty array if sub-images are not requested."
                }
            },
            required: ["keywords", "imagePrompt", "altText", "seoTitles", "subImagePrompts"]
        },
        socialMediaPosts: {
            type: Type.OBJECT,
            properties: {
                threads: {
                    type: Type.STRING,
                    description: "A short, engaging post for Threads in Korean, written in an informal 'ban-mal' tone. Must include emojis, encourage conversation, contain exactly one relevant hashtag, and use line breaks for readability."
                },
                instagram: {
                    type: Type.STRING,
                    description: "A visually-focused caption for Instagram in Korean with line breaks for readability. It must include 5-10 relevant hashtags and a call-to-action."
                },
                facebook: {
                    type: Type.STRING,
                    description: "A slightly longer post for Facebook in Korean that summarizes the blog post, using line breaks to separate paragraphs. It should encourage shares and comments."
                },
                x: {
                    type: Type.STRING,
                    description: "A concise post for X (formerly Twitter) in Korean, under 280 characters, with line breaks for readability. It must include 2-3 key hashtags and a link placeholder [BLOG_POST_LINK]."
                }
            },
            required: ["threads", "instagram", "facebook", "x"]
        }
    },
    required: ["blogPostHtml", "supplementaryInfo", "socialMediaPosts"]
};

const regenerationResponseSchema = {
    type: Type.OBJECT,
    properties: {
        blogPostHtml: {
            type: Type.STRING,
            description: "The full, revised HTML content of the blog post with inline styles, based on the user's feedback."
        }
    },
    required: ["blogPostHtml"]
};

const getPrompt = (topic: string, theme: ColorTheme, interactiveElementIdea: string | null, rawContent: string | null, additionalRequest: string | null, currentDate: string): string => {
  const themeColors = JSON.stringify(theme.colors);
  const currentYear = new Date().getFullYear();
  
  let interactiveElementInstructions = '';
  if (interactiveElementIdea) {
    interactiveElementInstructions = `
    ### **중요**: 인터랙티브 요소 포함
    - **반드시** 포스트 본문 내에 아래 아이디어를 기반으로 한 인터랙티브 요소를 포함시켜 주세요.
    - **요소 아이디어**: "${interactiveElementIdea}"
    - **구현 요건**:
      - 순수 HTML, 인라인 CSS, 그리고 \`<script>\` 태그만을 사용하여 구현해야 합니다. 외부 라이브러리(jQuery 등)는 사용하지 마세요.
      - 이 요소는 완벽하게 작동해야 합니다. 사용자가 값을 입력하거나 옵션을 선택하고 버튼을 누르면, 결과가 명확하게 표시되어야 합니다.
      - 요소의 UI(입력 필드, 버튼, 결과 표시 영역 등)는 제공된 \`${theme.name}\` 컬러 테마에 맞춰 디자인해주세요. 특히 버튼에는 \`background-color: ${theme.colors.primary}; color: white; border: none; padding: 10px 15px; border-radius: 5px; cursor: pointer;\` 스타일과, 호버 시 \`background-color: ${theme.colors.primaryDark}\`를 적용하여 일관성을 유지해주세요.
      - 요소 전체를 감싸는 \`<div>\`에 \`background-color: ${theme.colors.highlightBg}; padding: 20px; border-radius: 8px; margin: 25px 0;\` 스타일을 적용하여 시각적으로 구분되게 만들어주세요.
      - 모든 텍스트의 색상은 ${theme.colors.text} 를 사용해주세요.
      - **가장 중요**: 생성된 인터랙티브 요소의 HTML 코드 시작 부분에 **빈 줄을 추가한 후** \`<!-- Interactive Element Start -->\` 주석을, 그리고 끝 부분에는 \`<!-- Interactive Element End -->\` 주석 **다음에 빈 줄을 추가**하여 코드 블록을 명확하게 구분해주세요.
    `;
  }

  let contentInstructions = '';
  if (rawContent) {
    contentInstructions = `
    ### **중요**: 제공된 메모 기반 작성
    - **반드시** 아래에 제공된 사용자의 메모/초안을 핵심 기반으로 삼아 블로그 포스트를 작성해야 합니다.
    - 메모의 핵심 아이디어, 주장, 구조를 유지하면서, 문체를 다듬고, 세부 정보를 보강하고, 가독성을 높여 완전한 블로그 포스트로 발전시켜 주세요.
    - 메모에 부족한 부분이 있다면, 주제와 관련된 일반적인 정보를 추가하여 내용을 풍성하게 만들어 주세요.
    - 최종 포스트의 제목은 "${topic}"으로 합니다.

    [사용자 제공 메모]
    ---
    ${rawContent}
    ---
    `;
  }

  let additionalRequestInstructions = '';
    if (additionalRequest) {
      const requestTitle = rawContent 
        ? "메모 기반 생성 추가 요청사항" 
        : "기사에 반영할 추가 요청사항";
      additionalRequestInstructions = `
### **중요**: ${requestTitle}
- **반드시** 아래의 추가 요청사항을 반영하여 포스트를 작성해주세요.

[추가 요청사항]
---
${additionalRequest}
---
    `;
    }

  const subImageInstructions = `
    - **서브 이미지**: **반드시** 본문 내용의 흐름상 적절한 위치 2~3곳에 \`<!--SUB_IMAGE_PLACEHOLDER_1-->\`, \`<!--SUB_IMAGE_PLACEHOLDER_2-->\` 와 같은 HTML 주석을 삽입해주세요. 이 주석들은 서브 이미지가 들어갈 자리를 표시하며, 숫자는 순서대로 증가해야 합니다. 각 플레이스홀더에 대해, 이미지를 생성할 상세한 영문 프롬프트와 SEO 및 접근성을 위한 간결하고 설명적인 한국어 alt 텍스트를 모두 생성하여 \`subImagePrompts\` 배열에 객체 형태로 순서대로 담아주세요.
  `;

  const instructions = `
    ### 기본 설정
    1.  **최종 산출물**: 인라인 스타일이 적용된 HTML 코드(HEAD, BODY 태그 제외)와 부가 정보(키워드, 이미지 프롬프트, SEO 제목), 그리고 소셜 미디어 포스트를 JSON 형식으로 제공합니다.
    2.  **분량**: 한글 기준 공백 포함 2500~3000자로 합니다.
    3.  **대상 독자**: 특정 주제에 관심이 있는 일반 독자층.
    4.  **코드 형식**: HTML 코드는 사람이 읽기 쉽도록 **반드시** 가독성 좋게 포맷팅해야 합니다. **절대로** HTML을 한 줄로 압축하지 마세요. 각 블록 레벨 요소(\`<div>\`, \`<h2>\`, \`<p>\`, \`<ul>\`, \`<li>\` 등)는 개별 라인에 위치해야 하며, 중첩 구조에 따라 명확하게 들여쓰기하여 개발자가 소스 코드를 쉽게 읽을 수 있도록 해야 합니다.
    5.  **연도 및 시점**: **가장 중요.** 오늘은 **${currentDate}** 입니다. 포스트의 제목이나 본문에 연도나 날짜가 필요할 경우, **반드시 오늘 날짜(${currentDate})를 기준**으로 최신 정보를 반영하여 작성해야 합니다. **하지만, 시의성을 나타낼 때 월과 일은 제외하고 현재 연도(${currentYear}년)만 표시해주세요.**

    ### 전체 HTML 구조
    - 모든 콘텐츠는 \`<div style="font-family: 'Noto Sans KR', sans-serif; line-height: 1.6; max-width: 800px; margin: 0 auto; font-size: 16px; box-sizing: border-box; color: ${theme.colors.text};">\` 로 감싸주세요.
    - **절대로** 본문 HTML에 \`<h1>\` 태그나 별도의 블로그 포스트 제목을 포함하지 마세요. 내용은 **메타 설명 박스**로 시작해야 합니다.

    ### 핵심 구성 요소 (HTML 본문에 포함)
    - **대표 이미지**: **반드시** \`<!--IMAGE_PLACEHOLDER-->\` 라는 HTML 주석을 첫 번째 \`<h2>\` 태그 바로 앞에 삽입해주세요. 이 주석은 대표 이미지가 들어갈 자리를 표시합니다.
    ${subImageInstructions}
    - **메타 설명 박스**: \`<div style="background-color: ${theme.colors.infoBoxBg}; padding: 15px; border-radius: 8px; font-style: italic; margin-bottom: 25px; font-size: 15px;">\`
    - **주요 섹션 제목 (\`<h2>\`)**: **반드시** 각 \`<h2>\` 태그 앞에 빈 줄을 하나 추가하여 섹션 간의 구분을 명확하게 해주세요. \`<h2 style="font-size: 22px; color: white; background: linear-gradient(to right, ${theme.colors.primary}, ${theme.colors.primaryDark}); margin: 30px 0 15px; border-radius: 10px; padding: 10px 25px; text-shadow: 1px 1px 2px rgba(0,0,0,0.2); font-weight: 700; box-shadow: 0 4px 8px rgba(0,0,0,0.1);"><strong>제목 텍스트</strong></h2>\` 스타일을 사용하고, 제목 텍스트는 반드시 \`<strong>\` 태그로 감싸주세요.
    - **텍스트 하이라이트**: 본문 내용 중 중요한 부분을 강조할 때는 \`<strong>\` 태그를 사용하세요.
    - **팁/알림 박스**: \`<div style="background-color: ${theme.colors.infoBoxBg}; border-left: 4px solid ${theme.colors.infoBoxBorder}; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0;">\` (아이콘: 💡 또는 📌)
    - **경고/주의 박스**: \`<div style="background-color: ${theme.colors.warningBoxBg}; border-left: 4px solid ${theme.colors.warningBoxBorder}; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0;">\` (아이콘: ⚠️)
    - **표 (\`<table>\`)**: thead 배경색은 \`${theme.colors.tableHeaderBg}\`, 짝수행 배경색은 \`${theme.colors.tableEvenRowBg}\`, 테두리 색은 \`${theme.colors.tableBorder}\`. 표 내부의 모든 텍스트 색상은 **반드시** \`${theme.colors.text}\`로 지정해 주세요.
    - **핵심 요약 카드**: **반드시** 'FAQ' 섹션 바로 앞에, 본문 내용 중 가장 중요한 4가지 핵심 사항을 요약한 카드를 삽입해주세요. 이 카드는 시각적으로 눈에 띄게 디자인해야 합니다.
    - **FAQ 섹션 및 JSON-LD 스키마**:
      - **반드시** 포스트 마지막 부분(마무리 인사 전)에 'FAQ' 섹션을 포함해야 합니다.
      - **가장 중요**: FAQ 섹션 바로 뒤에, SEO를 위한 JSON-LD 스키마를 **반드시** 포함해야 합니다.

    ### 소셜 미디어 포스트 생성 (가이드라인)
    - **중요**: 블로그 본문 내용 요약을 기반으로 홍보용 포스트를 작성해야 합니다. 줄바꿈을 적절히 사용하세요.
    
    ${interactiveElementInstructions}

    ### 콘텐츠 작성 지침
    ${contentInstructions}
    ${additionalRequestInstructions}
    - **문체와 톤**: 전문가이면서도 친근하고 자연스러운 대화체 ("~이에요", "~해요")를 사용하세요. 불필요한 자기소개는 제외하세요.
  `;

  const taskDescription = rawContent
    ? `Your primary task is to expand the user's provided notes into a complete, high-quality blog post titled "${topic}".`
    : `Your task is to generate a complete blog post on the following topic: "${topic}".`;

  return `
    You are an expert content creator and web developer specializing in creating visually stunning and SEO-optimized blog posts with inline HTML and CSS.
    ${taskDescription}
    You must use the "${theme.name}" color theme. Here are the specific colors to use: ${themeColors}.
    Follow these instructions:
    ${instructions}
    Final output must be a single, valid JSON object.
  `;
};

export const generateImage = async (prompt: string, aspectRatio: '16:9' | '1:1' = '16:9'): Promise<string | null> => {
    try {
        if (!prompt) return null;
        const ai = new GoogleGenAI({ apiKey: getApiKey() });
        const imageResponse = await ai.models.generateContent({
            model: 'gemini-3-pro-image-preview',
            contents: { parts: [{ text: prompt }] },
            config: {
                imageConfig: {
                    aspectRatio: aspectRatio,
                    imageSize: "1K"
                },
            },
        });

        for (const part of imageResponse.candidates[0].content.parts) {
            if (part.inlineData) {
                return part.inlineData.data;
            }
        }
        return null;
    } catch (error) {
        console.error("Error generating image:", error);
        throw error;
    }
};


export const generateBlogPost = async (topic: string, theme: ColorTheme, shouldGenerateImage: boolean, shouldGenerateSubImages: boolean, interactiveElementIdea: string | null, rawContent: string | null, additionalRequest: string | null, aspectRatio: '16:9' | '1:1', currentDate: string): Promise<GeneratedContent> => {
  try {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    const prompt = getPrompt(topic, theme, interactiveElementIdea, rawContent, additionalRequest, currentDate);
    const contentResponse = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: responseSchema,
        },
    });

    const jsonString = contentResponse.text;
    const parsedJson = JSON.parse(jsonString);

    let imageBase64: string | null = null;
    if (shouldGenerateImage) {
        imageBase64 = await generateImage(parsedJson.supplementaryInfo.imagePrompt, aspectRatio);
    }
    
    let subImages: { prompt: string; altText: string; base64: string | null }[] | null = null;
    if (parsedJson.supplementaryInfo.subImagePrompts && parsedJson.supplementaryInfo.subImagePrompts.length > 0) {
        const subImagePromptObjects: { prompt: string; altText: string }[] = parsedJson.supplementaryInfo.subImagePrompts;
        
        const subImageBase64s = shouldGenerateSubImages
            ? await Promise.all(subImagePromptObjects.map(p => generateImage(p.prompt, '16:9')))
            : subImagePromptObjects.map(() => null);

        subImages = subImagePromptObjects.map((pObj, index) => ({
            prompt: pObj.prompt,
            altText: pObj.altText,
            base64: subImageBase64s[index]
        }));
    }

    return {
        blogPostHtml: parsedJson.blogPostHtml,
        supplementaryInfo: parsedJson.supplementaryInfo,
        imageBase64: imageBase64,
        subImages: subImages,
        socialMediaPosts: parsedJson.socialMediaPosts,
    };
  } catch (error) {
    console.error("Error generating blog post:", error);
    throw error;
  }
};

export const regenerateBlogPostHtml = async (originalHtml: string, feedback: string, theme: ColorTheme, currentDate: string): Promise<string> => {
    try {
        const ai = new GoogleGenAI({ apiKey: getApiKey() });
        const prompt = `Revision task based on feedback: ${feedback}\nOriginal: ${originalHtml}`;
        const contentResponse = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: regenerationResponseSchema,
            },
        });
        const parsedJson = JSON.parse(contentResponse.text);
        return parsedJson.blogPostHtml;
    } catch (error) {
        console.error("Error regenerating blog post:", error);
        throw error;
    }
};

const topicSuggestionSchema = {
    type: Type.OBJECT,
    properties: {
        topics: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "An array of 10 creative blog topics."
        }
    },
    required: ["topics"]
};

const generateTopics = async (prompt: string, useSearch: boolean = false): Promise<string[]> => {
    try {
        const ai = new GoogleGenAI({ apiKey: getApiKey() });
        const config: any = {};
        if (useSearch) {
             config.tools = [{googleSearch: {}}];
        } else {
             config.responseMimeType = "application/json";
             config.responseSchema = topicSuggestionSchema;
        }
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: prompt,
            config: config,
        });
        if (useSearch) {
            const text = response.text;
            return text.split('\n').filter(t => t.trim()).map(t => t.replace(/^\d+\.\s*/, '').trim());
        }
        const parsedJson = JSON.parse(response.text);
        return parsedJson.topics;
    } catch (error) {
        console.error("Error generating topics:", error);
        throw error;
    }
};

export const generateEeatTopicSuggestions = (category: string, subCategory: string, currentDate: string) => 
    generateTopics(`Generate 10 SEO topics for ${category} - ${subCategory} based on E-E-A-T. Date: ${currentDate}`);

export const generateCategoryTopicSuggestions = (category: string, currentDate: string) => 
    generateTopics(`Generate 10 topics for category ${category}. Date: ${currentDate}`);

export const generateEvergreenTopicSuggestions = (category: string, subCategory: string, currentDate: string) => 
    generateTopics(`Generate 10 evergreen topics for ${category} - ${subCategory}. Date: ${currentDate}`);

export const generateLongtailTopicSuggestions = (category: string, currentDate: string) => 
    generateTopics(`Generate 10 long-tail keywords topics for ${category}. Date: ${currentDate}`, true);

export const generateTopicsFromMemo = (memo: string, currentDate: string) => 
    generateTopics(`Generate 10 topics based on this memo: ${memo}. Date: ${currentDate}`);

export const suggestInteractiveElementForTopic = async (topic: string): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Suggest a simple HTML/JS interactive element for topic: ${topic}. One sentence Korean.`,
    });
    return response.text.trim();
};
