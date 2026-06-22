import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";
import type { NewsArticle } from "./news";
import type { KeyIssue, TimelineEntry } from "./summarize";

export interface AiReportPayload {
  overview: string;
  keyIssues: KeyIssue[];
  timeline: TimelineEntry[];
  articleSummaries: { index: number; summary: string }[];
}

const REPORT_PROMPT = `당신은 10년 경력의 뉴스 분석 전문 기자입니다.
주어진 뉴스 기사들을 깊이 분석하여 전문적인 한국어 JSON 리포트를 작성하세요.

반드시 아래 JSON 형식으로만 응답하세요 (다른 텍스트 금지):
{
  "overview": "종합 요약 4-5문장. 전체 흐름, 핵심 쟁점, 향후 전망을 분석적으로 서술",
  "keyIssues": [
    {
      "title": "이슈 제목 (간결하고 명확하게)",
      "detail": "배경·핵심 사실·업계/사회적 영향을 포함한 3-4문장 상세 분석",
      "source": "주요 출처"
    }
  ],
  "timeline": [
    {
      "date": "YYYY년 M월 D일 형식",
      "summary": "해당일 뉴스 흐름을 2-3문장으로 분석. 단순 나열 금지",
      "highlights": ["핵심 기사 제목1", "핵심 기사 제목2"]
    }
  ],
  "articleSummaries": [
    {"index": 0, "summary": "기사 핵심을 1-2문장으로 요약"}
  ]
}

작성 원칙:
- 사실에 기반하되 분석적 관점 유지 (왜 중요한지, 어떤 맥락인지)
- keyIssues 3~5개, 각 detail은 독립적으로 읽혀도 이해될 수 있게 작성
- timeline은 시간순 흐름과 이슈 간 연관성을 드러낼 것
- articleSummaries는 수집된 모든 기사(index 0부터)에 대해 작성
- 기사 건수·출처 나열 위주의 기계적 요약 금지
- 한국어로 자연스럽고 전문적인 문체 사용`;

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function buildArticleText(articles: NewsArticle[]): string {
  return articles
    .map(
      (a, i) =>
        `[${i}] 제목: ${a.title}\n출처: ${a.source} | 날짜: ${formatDate(a.publishedAt)}\n내용: ${a.snippet || "(요약 없음)"}`
    )
    .join("\n\n");
}

function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced?.[1]) return fenced[1].trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end !== -1) return text.slice(start, end + 1);
  return text.trim();
}

export function parseAiReportResponse(text: string): AiReportPayload {
  const parsed = JSON.parse(extractJson(text)) as AiReportPayload;

  if (!parsed.overview || !parsed.keyIssues || !parsed.timeline) {
    throw new Error("AI 응답 형식 오류");
  }

  return parsed;
}

export async function generateWithGemini(
  keyword: string,
  articles: NewsArticle[]
): Promise<AiReportPayload> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new Error("GEMINI_API_KEY 없음");

  const modelName = process.env.GEMINI_MODEL?.trim() || "gemini-2.0-flash";
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      temperature: 0.4,
      responseMimeType: "application/json",
    },
  });

  const prompt = `${REPORT_PROMPT}

키워드: "${keyword}"
분석 기간: 최근 7일
수집 기사 수: ${articles.length}건

--- 수집된 뉴스 ---
${buildArticleText(articles)}`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();
  if (!text) throw new Error("Gemini 응답 없음");

  return parseAiReportResponse(text);
}

export async function generateWithOpenAI(
  keyword: string,
  articles: NewsArticle[]
): Promise<AiReportPayload> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error("OPENAI_API_KEY 없음");

  const openai = new OpenAI({ apiKey });

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.3,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: REPORT_PROMPT },
      {
        role: "user",
        content: `키워드: "${keyword}"\n수집 기사 (${articles.length}건):\n\n${buildArticleText(articles)}`,
      },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("OpenAI 응답 없음");

  return parseAiReportResponse(content);
}
