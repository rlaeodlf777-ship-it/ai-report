import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI 뉴스 리포트",
  description: "키워드 기반 최근 7일 뉴스 검색 및 요약 리포트",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css"
        />
      </head>
      <body className="antialiased min-h-screen">{children}</body>
    </html>
  );
}
