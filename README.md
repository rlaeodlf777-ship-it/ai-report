# AI 뉴스 리포트

키워드를 입력하면 Google 뉴스에서 **최근 7일 이내** 관련 기사를 검색하고, 이슈를 분석하여 리포트를 생성하는 웹 애플리케이션입니다.

## 기능

- 키워드 기반 Google 뉴스 검색 (최근 7일)
- 종합 요약, 주요 이슈, 타임라인 생성
- 수집된 기사 목록 및 개별 요약
- OpenAI API 연동 시 AI 기반 심층 분석 (선택)

## 시작하기

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경 변수 설정 (선택)

`.env.example`을 `.env.local`로 복사한 후 필요한 API 키를 입력합니다.

```bash
cp .env.example .env.local
```

| 변수 | 필수 | 설명 |
|------|------|------|
| `OPENAI_API_KEY` | 선택 | AI 요약 기능 (없으면 기본 요약 사용) |
| `GOOGLE_API_KEY` | 선택 | Google Custom Search API |
| `GOOGLE_CSE_ID` | 선택 | Programmable Search Engine ID |

> API 키 없이도 Google News RSS를 통해 기본 뉴스 검색 및 요약이 동작합니다.

### 3. 개발 서버 실행

```bash
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)을 열어 사용합니다.

## 사용 방법

1. 검색창에 관심 키워드 입력 (예: 인공지능, 삼성전자)
2. **리포트 생성** 버튼 클릭
3. 종합 요약, 주요 이슈, 타임라인, 기사 목록 확인

## 기술 스택

- **Next.js 15** (App Router)
- **TypeScript**
- **Tailwind CSS**
- **Google News RSS** — 뉴스 수집
- **OpenAI GPT-4o-mini** — AI 요약 (선택)

## Google Custom Search 설정 (선택)

더 정확한 검색을 원할 경우:

1. [Google Cloud Console](https://console.cloud.google.com/)에서 Custom Search API 활성화
2. [Programmable Search Engine](https://programmablesearchengine.google.com/) 생성 (전체 웹 검색)
3. API 키와 Search Engine ID를 `.env.local`에 설정

## 라이선스

MIT
