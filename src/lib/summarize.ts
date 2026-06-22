import OpenAI from "openai";
import type { NewsArticle } from "./news";

export interface NewsReport {
  keyword: string;
  generatedAt: string;
  period: string;
  articleCount: number;
  overview: string;
  keyIssues: string[];
  timeline: { date: string; summary: string }[];
  articles: {
    title: string;
    source: string;
    publishedAt: string;
    link: string;
    summary: string;
  }[];
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function buildFallbackReport(keyword: string, articles: NewsArticle[]): NewsReport {
  const snippets = articles.map((a) => a.snippet).filter(Boolean);
  const overview =
    snippets.length > 0
      ? `최근 7일간 "${keyword}" 관련 뉴스 ${articles.length}건이 수집되었습니다. ` +
        `주요 보도는 ${articles
          .slice(0, 3)
          .map((a) => a.source)
          .filter((s, i, arr) => arr.indexOf(s) === i)
          .join(", ")} 등에서 이루어졌습니다.`
      : `"${keyword}" 관련 최근 7일 이내 뉴스를 찾지 못했습니다.`;

  const keyIssues = articles.slice(0, 5).map((a) => {
    const clean = a.title.replace(/ - .*$/, "").trim();
    return clean;
  });

  const dateGroups = new Map<string, NewsArticle[]>();
  for (const article of articles) {
    const dateKey = formatDate(article.publishedAt);
    const group = dateGroups.get(dateKey) ?? [];
    group.push(article);
    dateGroups.set(dateKey, group);
  }

  const timeline = Array.from(dateGroups.entries())
    .slice(0, 7)
    .map(([date, items]) => ({
      date,
      summary: items.map((i) => i.title.replace(/ - .*$/, "")).join(" · "),
    }));

  return {
    keyword,
    generatedAt: new Date().toISOString(),
    period: "최근 7일",
    articleCount: articles.length,
    overview,
    keyIssues,
    timeline,
    articles: articles.map((a) => ({
      title: a.title.replace(/ - .*$/, ""),
      source: a.source,
      publishedAt: a.publishedAt,
      link: a.link,
      summary: a.snippet || a.title,
    })),
  };
}

async function buildAiReport(keyword: string, articles: NewsArticle[]): Promise<NewsReport> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const articleText = articles
    .map(
      (a, i) =>
        `[${i + 1}] ${a.title}\n출처: ${a.source} | 날짜: ${formatDate(a.publishedAt)}\n${a.snippet}`
    )
    .join("\n\n");

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.3,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `당신은 뉴스 분석 전문가입니다. 주어진 뉴스 기사들을 분석하여 한국어 JSON 리포트를 작성하세요.
반드시 다음 JSON 형식으로만 응답하세요:
{
  "overview": "전체 상황 2-3문장 요약",
  "keyIssues": ["주요 이슈 1", "주요 이슈 2", ...],
  "timeline": [{"date": "날짜", "summary": "해당일 주요 뉴스 요약"}],
  "articleSummaries": [{"index": 0, "summary": "기사 한 줄 요약"}, ...]
}`,
      },
      {
        role: "user",
        content: `키워드: "${keyword}"\n\n수집된 뉴스 (${articles.length}건):\n\n${articleText}`,
      },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("AI 응답 없음");

  const parsed = JSON.parse(content) as {
    overview: string;
    keyIssues: string[];
    timeline: { date: string; summary: string }[];
    articleSummaries: { index: number; summary: string }[];
  };

  const summaryMap = new Map(
    parsed.articleSummaries.map((s) => [s.index, s.summary])
  );

  return {
    keyword,
    generatedAt: new Date().toISOString(),
    period: "최근 7일",
    articleCount: articles.length,
    overview: parsed.overview,
    keyIssues: parsed.keyIssues,
    timeline: parsed.timeline,
    articles: articles.map((a, i) => ({
      title: a.title.replace(/ - .*$/, ""),
      source: a.source,
      publishedAt: a.publishedAt,
      link: a.link,
      summary: summaryMap.get(i) ?? a.snippet ?? a.title,
    })),
  };
}

export async function generateReport(
  keyword: string,
  articles: NewsArticle[]
): Promise<NewsReport> {
  if (articles.length === 0) {
    return buildFallbackReport(keyword, articles);
  }

  if (process.env.OPENAI_API_KEY) {
    try {
      return await buildAiReport(keyword, articles);
    } catch {
      return buildFallbackReport(keyword, articles);
    }
  }

  return buildFallbackReport(keyword, articles);
}
