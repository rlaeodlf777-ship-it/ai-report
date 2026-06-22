import { NextRequest, NextResponse } from "next/server";
import { sendReportEmail } from "@/lib/email";
import { fetchNews } from "@/lib/news";
import { generateReport } from "@/lib/summarize";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { keyword?: string };
    const keyword = body.keyword?.trim();

    if (!keyword) {
      return NextResponse.json(
        { error: "키워드를 입력해 주세요." },
        { status: 400 }
      );
    }

    if (keyword.length > 100) {
      return NextResponse.json(
        { error: "키워드는 100자 이내로 입력해 주세요." },
        { status: 400 }
      );
    }

    const articles = await fetchNews(keyword);
    const report = await generateReport(keyword, articles);

    const emailResult = await sendReportEmail(report);

    return NextResponse.json({
      ...report,
      emailSent: emailResult.sent,
      emailError: emailResult.error,
    });
  } catch (error) {
    console.error("Report generation failed:", error);
    return NextResponse.json(
      { error: "리포트 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." },
      { status: 500 }
    );
  }
}
