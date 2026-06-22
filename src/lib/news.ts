import Parser from "rss-parser";

export interface NewsArticle {
  title: string;
  link: string;
  source: string;
  publishedAt: string;
  snippet: string;
}

const parser = new Parser({
  customFields: {
    item: [["source", "source"]],
  },
});

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

function parseSource(source: unknown): string {
  if (typeof source === "object" && source !== null && "_" in source) {
    const named = source as { _: string };
    return named._;
  }
  if (typeof source === "string") return source;
  return "알 수 없음";
}

function isWithinLast7Days(dateStr: string): boolean {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return true;
  return Date.now() - date.getTime() <= SEVEN_DAYS_MS;
}

async function fetchFromGoogleNewsRss(keyword: string): Promise<NewsArticle[]> {
  const query = encodeURIComponent(`${keyword} when:7d`);
  const url = `https://news.google.com/rss/search?q=${query}&hl=ko&gl=KR&ceid=KR:ko`;

  const feed = await parser.parseURL(url);

  return (feed.items ?? [])
    .filter((item) => item.pubDate && isWithinLast7Days(item.pubDate))
    .map((item) => ({
      title: item.title ?? "제목 없음",
      link: item.link ?? "",
      source: parseSource((item as { source?: unknown }).source),
      publishedAt: item.pubDate ?? new Date().toISOString(),
      snippet: stripHtml(item.contentSnippet ?? item.content ?? ""),
    }))
    .slice(0, 15);
}

interface GoogleCseItem {
  title?: string;
  link?: string;
  snippet?: string;
  displayLink?: string;
  pagemap?: {
    metatags?: Array<{ "article:published_time"?: string; "og:site_name"?: string }>;
  };
}

async function fetchFromGoogleCustomSearch(keyword: string): Promise<NewsArticle[]> {
  const apiKey = process.env.GOOGLE_API_KEY;
  const cseId = process.env.GOOGLE_CSE_ID;

  if (!apiKey || !cseId) return [];

  const params = new URLSearchParams({
    key: apiKey,
    cx: cseId,
    q: keyword,
    dateRestrict: "w1",
    num: "10",
    lr: "lang_ko",
    sort: "date",
  });

  const response = await fetch(
    `https://www.googleapis.com/customsearch/v1?${params.toString()}`,
    { next: { revalidate: 0 } }
  );

  if (!response.ok) return [];

  const data = (await response.json()) as { items?: GoogleCseItem[] };

  return (data.items ?? [])
    .map((item) => {
      const meta = item.pagemap?.metatags?.[0];
      const publishedAt =
        meta?.["article:published_time"] ?? new Date().toISOString();

      return {
        title: item.title ?? "제목 없음",
        link: item.link ?? "",
        source: meta?.["og:site_name"] ?? item.displayLink ?? "알 수 없음",
        publishedAt,
        snippet: item.snippet ?? "",
      };
    })
    .filter((item) => isWithinLast7Days(item.publishedAt));
}

function deduplicateArticles(articles: NewsArticle[]): NewsArticle[] {
  const seen = new Set<string>();
  return articles.filter((article) => {
    const key = article.title.toLowerCase().slice(0, 60);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function fetchNews(keyword: string): Promise<NewsArticle[]> {
  const trimmed = keyword.trim();
  if (!trimmed) return [];

  const [rssArticles, cseArticles] = await Promise.all([
    fetchFromGoogleNewsRss(trimmed),
    fetchFromGoogleCustomSearch(trimmed),
  ]);

  const merged = deduplicateArticles([...cseArticles, ...rssArticles]);

  return merged.sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );
}
