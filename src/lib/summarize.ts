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

function cleanTitle(title: string): string {
  return title.replace(/ - .*$/, "").trim();
}

function truncate(text: string, maxLength: number): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 3).trim()}...`;
}

function extractKeyIssues(articles: NewsArticle[]): string[] {
  const seen = new Set<string>();
  const issues: string[] = [];

  for (const article of articles) {
    const clean = cleanTitle(article.title);
    const key = clean.toLowerCase();
    if (!clean || seen.has(key)) continue;
    seen.add(key);
    issues.push(clean);
    if (issues.length >= 5) break;
  }

  return issues;
}

function findArticleForIssue(articles: NewsArticle[], issue: string, index: number) {
  return articles.find((a) => cleanTitle(a.title) === issue) ?? articles[index];
}

function isDistinctSnippet(issue: string, snippet: string): boolean {
  if (snippet.length < 30) return false;
  const normalizedIssue = issue.replace(/\s+/g, "").toLowerCase();
  const normalizedSnippet = snippet.replace(/\s+/g, "").toLowerCase();
  return !normalizedSnippet.startsWith(normalizedIssue.slice(0, Math.min(20, normalizedIssue.length)));
}

function buildOverviewFromKeyIssues(
  keyword: string,
  articles: NewsArticle[],
  keyIssues: string[]
): string {
  if (keyIssues.length === 0) {
    return `"${keyword}" 관련 최근 7일 이내 뉴스를 찾지 못했습니다.`;
  }

  const issueDetails = keyIssues.map((issue, index) => {
    const article = findArticleForIssue(articles, issue, index);
    const snippet = article?.snippet?.replace(/\s+/g, " ").trim() ?? "";
    return { issue, snippet };
  });

  const intro = `최근 7일간 "${keyword}" 관련 뉴스 ${articles.length}건을 분석한 결과, ${keyIssues.length}가지 주요 이슈가 확인되었습니다.`;

  const topIssues = issueDetails.slice(0, 3);
  const issueDescriptions = topIssues.map(({ issue, snippet }) => {
    if (isDistinctSnippet(issue, snippet)) {
      return `${issue}은(는) ${truncate(snippet, 80)}`;
    }
    return issue;
  });

  const mainBody =
    issueDescriptions.length === 1
      ? `가장 두드러진 이슈는 '${issueDescriptions[0]}'입니다.`
      : `우선 ${issueDescriptions
          .map((desc, i) => `${i + 1}) ${desc.includes("은(는)") ? desc : `'${desc}'`}`)
          .join(", ")} 등이 핵심 이슈로 분류됩니다.`;

  const remainingCount = keyIssues.length - topIssues.length;
  const extraNote =
    remainingCount > 0
      ? ` 추가로 ${issueDetails
          .slice(3)
          .map(({ issue }) => `'${issue}'`)
          .join(", ")} 등 ${remainingCount}건의 관련 동향도 함께 보도되었습니다.`
      : "";

  const themes = topIssues.map(({ issue }) => issue.split(/[,·…]/)[0]?.trim() || issue);
  const conclusion = `이들 이슈를 종합하면, "${keyword}" 분야는 ${themes.join(", ")} 등 여러 영역에서 활발한 움직임이 이어지고 있습니다.`;

  return `${intro} ${mainBody}${extraNote} ${conclusion}`;
}

function buildFallbackReport(keyword: string, articles: NewsArticle[]): NewsReport {
  const keyIssues = extractKeyIssues(articles);
  const overview = buildOverviewFromKeyIssues(keyword, articles, keyIssues);

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
      summary: items.map((i) => cleanTitle(i.title)).join(" · "),
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
      title: cleanTitle(a.title),
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
  "keyIssues": ["주요 이슈 1", "주요 이슈 2", ...],
  "overview": "keyIssues에 정리한 주요 이슈들을 종합한 3-4문장 요약. 기사 건수나 출처 나열 없이, 이슈 간 연관성과 전체 흐름을 분석해 서술",
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
      title: cleanTitle(a.title),
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
