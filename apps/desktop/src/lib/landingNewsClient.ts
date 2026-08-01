import { GATEWAY_URL } from "./gatewayUrl";

export interface LandingNewsItem {
  title: string;
  source: string;
  published_at: string;
  url: string;
  summary: string;
}

interface LandingNewsResponse {
  items: LandingNewsItem[];
  updated_at: string;
}

export async function fetchLandingNews(): Promise<LandingNewsResponse> {
  const response = await fetch(`${GATEWAY_URL}/api/v1/kstock/landing-news`, {
    credentials: "omit",
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`财经新闻请求失败（${response.status}）`);
  return (await response.json()) as LandingNewsResponse;
}
