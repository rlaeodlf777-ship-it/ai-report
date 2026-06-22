import nodemailer from "nodemailer";
import type { NewsReport } from "./summarize";

const DEFAULT_RECIPIENT = "kimddll@naver.com";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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

function buildReportHtml(report: NewsReport): string {
  const keyIssuesHtml = report.keyIssues
    .map(
      (issue, i) =>
        `<li style="margin-bottom:8px;"><strong>${i + 1}.</strong> ${escapeHtml(issue)}</li>`
    )
    .join("");

  const timelineHtml = report.timeline
    .map(
      (item) =>
        `<tr>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;color:#1d9bf0;font-weight:600;white-space:nowrap;">${escapeHtml(item.date)}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;">${escapeHtml(item.summary)}</td>
        </tr>`
    )
    .join("");

  const articlesHtml = report.articles
    .map(
      (article) =>
        `<div style="margin-bottom:16px;padding:16px;background:#f8f9fa;border-radius:8px;">
          <a href="${escapeHtml(article.link)}" style="color:#1a1a1a;font-weight:600;text-decoration:none;">${escapeHtml(article.title)}</a>
          <p style="margin:6px 0 0;font-size:12px;color:#666;">${escapeHtml(article.source)} · ${escapeHtml(formatDate(article.publishedAt))}</p>
          <p style="margin:8px 0 0;font-size:14px;color:#444;line-height:1.5;">${escapeHtml(article.summary)}</p>
        </div>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="ko">
<head><meta charset="UTF-8"></head>
<body style="font-family:'Malgun Gothic','Apple SD Gothic Neo',sans-serif;max-width:640px;margin:0 auto;padding:24px;color:#1a1a1a;">
  <div style="background:#1d9bf0;color:#fff;padding:20px 24px;border-radius:12px 12px 0 0;">
    <h1 style="margin:0;font-size:20px;">AI 뉴스 리포트</h1>
    <p style="margin:8px 0 0;opacity:0.9;font-size:14px;">키워드: <strong>${escapeHtml(report.keyword)}</strong> · ${escapeHtml(report.period)} · ${report.articleCount}건</p>
  </div>
  <div style="border:1px solid #e1e8ed;border-top:none;padding:24px;border-radius:0 0 12px 12px;">
    <h2 style="font-size:16px;margin:0 0 12px;color:#1d9bf0;">종합 요약</h2>
    <p style="line-height:1.7;margin:0 0 24px;">${escapeHtml(report.overview)}</p>

    ${report.keyIssues.length > 0 ? `
    <h2 style="font-size:16px;margin:0 0 12px;color:#1d9bf0;">주요 이슈</h2>
    <ol style="padding-left:20px;margin:0 0 24px;line-height:1.7;">${keyIssuesHtml}</ol>` : ""}

    ${report.timeline.length > 0 ? `
    <h2 style="font-size:16px;margin:0 0 12px;color:#1d9bf0;">타임라인</h2>
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;font-size:14px;">${timelineHtml}</table>` : ""}

    ${report.articles.length > 0 ? `
    <h2 style="font-size:16px;margin:0 0 12px;color:#1d9bf0;">수집된 기사</h2>
    ${articlesHtml}` : ""}

    <p style="margin-top:24px;font-size:12px;color:#8899a6;text-align:center;">
      리포트 생성: ${escapeHtml(formatDate(report.generatedAt))}
    </p>
  </div>
</body>
</html>`;
}

export async function sendReportEmail(
  report: NewsReport
): Promise<{ sent: boolean; error?: string }> {
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  if (!smtpUser || !smtpPass) {
    return { sent: false, error: "SMTP 설정이 필요합니다." };
  }

  const recipient = process.env.REPORT_RECIPIENT_EMAIL ?? DEFAULT_RECIPIENT;

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? "smtp.naver.com",
    port: Number(process.env.SMTP_PORT ?? 465),
    secure: process.env.SMTP_SECURE !== "false",
    auth: { user: smtpUser, pass: smtpPass },
  });

  try {
    await transporter.sendMail({
      from: `"AI 뉴스 리포트" <${process.env.SMTP_FROM ?? smtpUser}>`,
      to: recipient,
      subject: `[AI 뉴스 리포트] "${report.keyword}" 최근 7일 이슈 요약`,
      html: buildReportHtml(report),
    });
    return { sent: true };
  } catch (err) {
    console.error("Email send failed:", err);
    return {
      sent: false,
      error: err instanceof Error ? err.message : "메일 발송 실패",
    };
  }
}
