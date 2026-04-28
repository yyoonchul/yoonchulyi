export interface CoverData {
  date: string;
  articleCount: number;
  categories: string[];
  // 커버 헤드라인. 현재 스킬은 headlineLines[0]에 메인 제목 하나를 담는다.
  // 비어 있으면 categories로 폴백.
  headlineLines?: string[];
}

export interface ArticleData {
  index: number;
  title: string;
  source: string;
  category: string;
  bullets: string[];
  // bullets[i]에 대응하는 콘텐츠 페이지 헤더. 길이는 bullets와 같아야 한다.
  // 비어 있으면 article.title이 폴백으로 사용된다.
  bulletHeaders?: string[];
}

export interface DigestData {
  datePath: string;
  cover: CoverData;
  articles: ArticleData[];
}
