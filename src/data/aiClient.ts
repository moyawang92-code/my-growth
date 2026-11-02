import { buildAiPrompt, type ReviewSourceData } from '../domain/reviewInput';

/**
 * Talks to the optional AI proxy (`server/ai-proxy.mjs`). The model key lives
 * only in that process's environment — the browser bundle never sees it, and
 * `VITE_AI_PROXY_URL` is just an endpoint path.
 */
const PROXY_URL = import.meta.env.VITE_AI_PROXY_URL ?? '';

export function isAiConfigured(): boolean {
  return PROXY_URL.trim().length > 0;
}

export class AiUnavailableError extends Error {}

export async function generateAiReview(source: ReviewSourceData): Promise<string> {
  if (!isAiConfigured()) {
    throw new AiUnavailableError('未配置 AI 服务');
  }

  let response: Response;
  try {
    response = await fetch(PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: buildAiPrompt(source), periodType: source.periodType }),
    });
  } catch (error) {
    throw new AiUnavailableError(
      `无法连接 AI 服务：${error instanceof Error ? error.message : '网络错误'}`,
    );
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new AiUnavailableError(
      `AI 服务返回 ${response.status}${detail ? `：${detail.slice(0, 200)}` : ''}`,
    );
  }

  const payload = (await response.json().catch(() => null)) as { content?: string } | null;
  const content = payload?.content?.trim();
  if (!content) {
    throw new AiUnavailableError('AI 服务返回了空内容');
  }
  return content;
}
