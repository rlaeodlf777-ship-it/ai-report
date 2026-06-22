import type { NewsArticle } from "./news";
import { generateWithGemini, generateWithOpenAI } from "./ai-report";
import type { AiReportPayload } from "./ai-report";

export interface KeyIssue {
  title: string;
  detail: string;
  source: string;
}

export interface TimelineEntry {
  date: string;
  summary: string;
  highlights: string[];
}

export interface NewsReport {
  keyword: string;
  generatedAt: string;
  period: string;
  articleCount: number;
  overview: string;
  keyIssues: KeyIssue[];
  timeline: TimelineEntry[];
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

function isDistinctSnippet(title: string, snippet: string): boolean {
  if (snippet.length < 30) return false;
  const normalizedIssue = title.replace(/\s+/g, "").toLowerCase();
  const normalizedSnippet = snippet.replace(/\s+/g, "").toLowerCase();
  return !normalizedSnippet.startsWith(
    normalizedIssue.slice(0, Math.min(20, normalizedIssue.length))
  );
}

function buildIssueDetail(article: NewsArticle, title: string): string {
  const snippet = article.snippet?.replace(/\s+/g, " ").trim() ?? "";

  if (isDistinctSnippet(title, snippet)) {
    return truncate(snippet, 180);
  }

  return `${article.source} 등에서 '${title}' 관련 보도가 나왔으며, 해당 이슈가 최근 한 주간 ${title.split(/[,·…]/)[0]?.trim() || "관련 분야"}에서 지속적으로 주목받고 있습니다.`;
}

function buildDetailedKeyIssues(articles: NewsArticle[]): KeyIssue[] {
  const seen = new Set<string>();
  const issues: KeyIssue[] = [];

  for (const article of articles) {
    const title = cleanTitle(article.title);
    const key = title.toLowerCase();
    if (!title || seen.has(key)) continue;
    seen.add(key);

    issues.push({
      title,
      detail: buildIssueDetail(article, title),
      source: article.source,
    });
    if (issues.length >= 5) break;
  }

  return issues;
}

function buildTimelineSummary(items: NewsArticle[]): string {
  const titles = items.map((i) => cleanTitle(i.title));
  const snippets = items
    .map((i) => i.snippet?.replace(/\s+/g, " ").trim() ?? "")
    .filter((s) => s.length >= 30);

  if (snippets.length > 0 && isDistinctSnippet(titles[0]!, snippets[0]!)) {
    const lead = truncate(snippets[0]!, 140);
    if (items.length === 1) return lead;
    return `${items.length}건의 관련 기사가 보도되었습니다. ${lead}`;
  }

  if (items.length === 1) {
    return `'${truncate(titles[0]!, 60)}' 기사가 ${items[0]!.source} 등을 통해 보도되었습니다.`;
  }

  return `총 ${items.length}건의 관련 기사가 보도되었습니다. '${truncate(titles[0]!, 45)}'를 시작으로 ${titles.slice(1, 3).map((t) => `'${truncate(t, 35)}'`).join(", ")}${items.length > 3 ? ` 등 ${items.length}건` : ""}의 이슈가 집중 보도되었습니다.`;
}

function buildDetailedTimeline(articles: NewsArticle[]): TimelineEntry[] {
  const dateGroups = new Map<string, NewsArticle[]>();

  for (const article of articles) {
    const dateKey = formatDate(article.publishedAt);
    const group = dateGroups.get(dateKey) ?? [];
    group.push(article);
    dateGroups.set(dateKey, group);
  }

  return Array.from(dateGroups.entries())
    .slice(0, 7)
    .map(([date, items]) => ({
      date,
      summary: buildTimelineSummary(items),
      highlights: items.slice(0, 4).map((i) => cleanTitle(i.title)),
    }));
}

function buildOverviewFromKeyIssues(
  keyword: string,
  articles: NewsArticle[],
  keyIssues: KeyIssue[]
): string {
  if (keyIssues.length === 0) {
    return `"${keyword}" 관련 최근 7일 이내 뉴스를 찾지 못했습니다.`;
  }

  const intro = `최근 7일간 "${keyword}" 관련 뉴스 ${articles.length}건을 분석한 결과, ${keyIssues.length}가지 주요 이슈가 확인되었습니다.`;

  const topIssues = keyIssues.slice(0, 3);
  const mainBody =
    topIssues.length === 1
      ? `핵심 이슈는 '${topIssues[0]!.title}'로, ${truncate(topIssues[0]!.detail, 100)}`
      : `우선 ${topIssues
          .map(
            (issue, i) =>
              `${i + 1}) ${issue.title}(${truncate(issue.detail, 70)})`
          )
          .join(", ")} 등이 핵심 이슈로 분류됩니다.`;

  const remainingCount = keyIssues.length - topIssues.length;
  const extraNote =
    remainingCount > 0
      ? ` 추가로 ${keyIssues
          .slice(3)
          .map((issue) => `'${issue.title}'`)
          .join(", ")} 등 ${remainingCount}건의 관련 동향도 함께 보도되었습니다.`
      : "";

  const themes = topIssues.map((issue) => issue.title.split(/[,·…]/)[0]?.trim() || issue.title);
  const conclusion = `이들 이슈를 종합하면, "${keyword}" 분야는 ${themes.join(", ")} 등 여러 영역에서 활발한 움직임이 이어지고 있습니다.`;

  return `${intro} ${mainBody}${extraNote} ${conclusion}`;
}

function buildFallbackReport(keyword: string, articles: NewsArticle[]): NewsReport {
  const keyIssues = buildDetailedKeyIssues(articles);
  const overview = buildOverviewFromKeyIssues(keyword, articles, keyIssues);
  const timeline = buildDetailedTimeline(articles);

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

function buildReportFromAi(
  keyword: string,
  articles: NewsArticle[],
  parsed: AiReportPayload
): NewsReport {
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

  if (process.env.GEMINI_API_KEY?.trim()) {
    try {
      const parsed = await generateWithGemini(keyword, articles);
      return buildReportFromAi(keyword, articles, parsed);
    } catch (error) {
      console.error("Gemini report failed:", error);
    }
  }

  if (process.env.OPENAI_API_KEY?.trim()) {
    try {
      const parsed = await generateWithOpenAI(keyword, articles);
      return buildReportFromAi(keyword, articles, parsed);
    } catch (error) {
      console.error("OpenAI report failed:", error);
    }
  }

  return buildFallbackReport(keyword, articles);
}
