"use client";

import { useState } from "react";

interface Report {
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
  emailSent?: boolean;
  emailError?: string;
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-6 animate-fade-in">
      <div className="flex gap-2">
        <span className="loading-dot w-3 h-3 rounded-full bg-[var(--accent)]" />
        <span className="loading-dot w-3 h-3 rounded-full bg-[var(--accent)]" />
        <span className="loading-dot w-3 h-3 rounded-full bg-[var(--accent)]" />
      </div>
      <div className="text-center">
        <p className="text-lg font-medium">뉴스를 수집하고 있습니다</p>
        <p className="text-[var(--muted)] mt-1 text-sm">
          Google 뉴스에서 최근 7일 이내 기사를 검색하고
          <br />
          리포트를 이메일로 발송 중...
        </p>
      </div>
    </div>
  );
}

function ReportView({ report }: { report: Report }) {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-6 md:p-8">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <span className="px-3 py-1 rounded-full bg-[var(--accent)]/15 text-[var(--accent)] text-sm font-medium">
            {report.keyword}
          </span>
          <span className="text-[var(--muted)] text-sm">{report.period}</span>
          <span className="text-[var(--muted)] text-sm">
            {report.articleCount}건 수집
          </span>
        </div>
        <h2 className="text-xl font-bold mb-3">종합 요약</h2>
        <p className="text-[var(--foreground)]/90 leading-relaxed">{report.overview}</p>
      </div>

      {report.keyIssues.length > 0 && (
        <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-6 md:p-8">
          <h2 className="text-xl font-bold mb-4">주요 이슈</h2>
          <ul className="space-y-3">
            {report.keyIssues.map((issue, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex-shrink-0 w-7 h-7 rounded-lg bg-[var(--accent)]/15 text-[var(--accent)] flex items-center justify-center text-sm font-bold">
                  {i + 1}
                </span>
                <span className="pt-0.5 leading-relaxed">{issue}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {report.timeline.length > 0 && (
        <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-6 md:p-8">
          <h2 className="text-xl font-bold mb-4">타임라인</h2>
          <div className="space-y-4">
            {report.timeline.map((item, i) => (
              <div key={i} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="w-2.5 h-2.5 rounded-full bg-[var(--accent)]" />
                  {i < report.timeline.length - 1 && (
                    <div className="w-px flex-1 bg-[var(--card-border)] mt-1" />
                  )}
                </div>
                <div className="pb-4">
                  <p className="text-sm text-[var(--accent)] font-medium mb-1">
                    {item.date}
                  </p>
                  <p className="text-[var(--foreground)]/85 leading-relaxed">
                    {item.summary}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {report.articles.length > 0 && (
        <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-6 md:p-8">
          <h2 className="text-xl font-bold mb-4">수집된 기사</h2>
          <div className="space-y-4">
            {report.articles.map((article, i) => (
              <article
                key={i}
                className="p-4 rounded-xl border border-[var(--card-border)] hover:border-[var(--accent)]/40 transition-colors"
              >
                <a
                  href={article.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-base font-semibold hover:text-[var(--accent)] transition-colors line-clamp-2"
                >
                  {article.title}
                </a>
                <div className="flex flex-wrap gap-2 mt-2 text-xs text-[var(--muted)]">
                  <span>{article.source}</span>
                  <span>·</span>
                  <span>{formatDate(article.publishedAt)}</span>
                </div>
                <p className="mt-2 text-sm text-[var(--foreground)]/75 leading-relaxed">
                  {article.summary}
                </p>
              </article>
            ))}
          </div>
        </div>
      )}

      <p className="text-center text-xs text-[var(--muted)]">
        리포트 생성: {formatDate(report.generatedAt)}
      </p>
    </div>
  );
}

export default function Home() {
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [report, setReport] = useState<Report | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!keyword.trim()) return;

    setLoading(true);
    setError("");
    setReport(null);

    try {
      const res = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword: keyword.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "오류가 발생했습니다.");
        return;
      }

      setReport(data);
    } catch {
      setError("네트워크 오류가 발생했습니다. 다시 시도해 주세요.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[var(--accent)]/5 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-3xl mx-auto px-4 py-12 md:py-20">
        <header className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[var(--card-border)] text-xs text-[var(--muted)] mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--success)]" />
            Google 뉴스 · 최근 7일
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">
            AI 뉴스 리포트
          </h1>
          <p className="text-[var(--muted)] max-w-md mx-auto">
            키워드를 입력하면 최근 7일 이내 주요 뉴스를 검색하고
            <br className="hidden sm:block" />
            이슈를 분석하여 리포트를 작성합니다.
          </p>
        </header>

        <form onSubmit={handleSubmit} className="mb-10">
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="예: 인공지능, 삼성전자, 기후변화..."
              className="flex-1 px-5 py-3.5 rounded-xl bg-[var(--card)] border border-[var(--card-border)] focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 transition-all placeholder:text-[var(--muted)]"
              disabled={loading}
              maxLength={100}
            />
            <button
              type="submit"
              disabled={loading || !keyword.trim()}
              className="px-8 py-3.5 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed font-semibold transition-colors whitespace-nowrap"
            >
              {loading ? "검색 중..." : "리포트 생성"}
            </button>
          </div>
        </form>

        {error && (
          <div className="mb-6 p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-sm animate-fade-in">
            {error}
          </div>
        )}

        {loading && <LoadingState />}

        {report && !loading && (
          <>
            {report.emailSent && (
              <div className="mb-6 p-4 rounded-xl border border-[var(--success)]/30 bg-[var(--success)]/10 text-[var(--success)] text-sm animate-fade-in">
                리포트가 kimddll@naver.com 으로 이메일 발송되었습니다.
              </div>
            )}
            {report.emailSent === false && report.articleCount > 0 && (
              <div className="mb-6 p-4 rounded-xl border border-yellow-500/30 bg-yellow-500/10 text-yellow-400 text-sm animate-fade-in">
                이메일 발송에 실패했습니다. SMTP 설정을 확인해 주세요.
                {report.emailError && (
                  <span className="block mt-1 text-xs opacity-80">{report.emailError}</span>
                )}
              </div>
            )}
            {report.articleCount === 0 ? (
              <div className="text-center py-16 animate-fade-in">
                <p className="text-lg font-medium mb-2">검색 결과가 없습니다</p>
                <p className="text-[var(--muted)] text-sm">
                  &quot;{report.keyword}&quot; 관련 최근 7일 이내 뉴스를 찾지
                  못했습니다. 다른 키워드로 시도해 보세요.
                </p>
              </div>
            ) : (
              <ReportView report={report} />
            )}
          </>
        )}

        {!report && !loading && !error && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
            {["인공지능", "반도체", "K-콘텐츠"].map((sample) => (
              <button
                key={sample}
                type="button"
                onClick={() => setKeyword(sample)}
                className="p-4 rounded-xl border border-[var(--card-border)] bg-[var(--card)]/50 hover:border-[var(--accent)]/40 hover:bg-[var(--card)] transition-all text-left"
              >
                <p className="text-sm text-[var(--muted)] mb-1">예시 키워드</p>
                <p className="font-medium">{sample}</p>
              </button>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
