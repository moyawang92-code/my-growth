#!/usr/bin/env node
/**
 * Optional AI proxy for growth reviews.
 *
 * The model API key is read from this process's environment and never reaches
 * the browser bundle; the frontend only knows the URL of this endpoint.
 *
 * Run:  AI_API_KEY=sk-... npm run ai-proxy
 * Then: VITE_AI_PROXY_URL=http://localhost:8787/api/review npm run dev
 */
import { createServer } from 'node:http';

const PORT = Number(process.env.AI_PROXY_PORT ?? 8787);
const API_KEY = process.env.AI_API_KEY ?? '';
const BASE_URL = process.env.AI_BASE_URL ?? 'https://api.openai.com/v1';
const MODEL = process.env.AI_MODEL ?? 'gpt-4o-mini';
const ALLOWED_ORIGIN = process.env.AI_ALLOWED_ORIGIN ?? 'http://localhost:5173';
const MAX_BODY_BYTES = 1024 * 1024;

if (!API_KEY) {
  console.error('AI_API_KEY is not set. Start with: AI_API_KEY=sk-... npm run ai-proxy');
  process.exit(1);
}

function applyCors(response) {
  response.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function sendJson(response, status, payload) {
  applyCors(response);
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(payload));
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    request.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error('Request body too large'));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    request.on('error', reject);
  });
}

const server = createServer(async (request, response) => {
  if (request.method === 'OPTIONS') {
    applyCors(response);
    response.writeHead(204);
    response.end();
    return;
  }

  if (request.method !== 'POST' || !request.url?.startsWith('/api/review')) {
    sendJson(response, 404, { error: 'Not found' });
    return;
  }

  let prompt;
  try {
    const parsed = JSON.parse(await readBody(request));
    prompt = typeof parsed?.prompt === 'string' ? parsed.prompt : '';
  } catch (error) {
    sendJson(response, 400, { error: `Invalid request body: ${error.message}` });
    return;
  }

  if (!prompt.trim()) {
    sendJson(response, 400, { error: 'prompt is required' });
    return;
  }

  try {
    const upstream = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.4,
        messages: [
          {
            role: 'system',
            content:
              '你只能基于用户提供的真实记录进行总结，不得编造任何事实。语气自然克制，不说教、不夸张鼓励、不贴人格标签，不把没有记录解释为懒惰或失败。数据不足时直接说明。',
          },
          { role: 'user', content: prompt },
        ],
      }),
    });

    if (!upstream.ok) {
      const detail = await upstream.text().catch(() => '');
      sendJson(response, 502, {
        error: `Upstream ${upstream.status}`,
        detail: detail.slice(0, 500),
      });
      return;
    }

    const payload = await upstream.json();
    const content = payload?.choices?.[0]?.message?.content?.trim();
    if (!content) {
      sendJson(response, 502, { error: 'Upstream returned empty content' });
      return;
    }
    sendJson(response, 200, { content });
  } catch (error) {
    sendJson(response, 502, { error: `Upstream request failed: ${error.message}` });
  }
});

server.listen(PORT, () => {
  console.log(`AI proxy listening on http://localhost:${PORT}/api/review`);
  console.log(`Model: ${MODEL} · Allowed origin: ${ALLOWED_ORIGIN}`);
});
