/**
 * OpenAI 客户端单例 + 当前生效配置
 *
 * 配置来源(settings.json > env > 默认):
 * - apiKey / baseURL / model 在每次调用 getOpenAI() 时重新读取
 *   这样 settings 页面更新后无需重启服务
 */

import OpenAI from 'openai';
import { loadSettings } from './settings.js';

let _client: OpenAI | null = null;
let _clientSig = '';

function makeClient(): OpenAI {
  const s = loadSettings().openai;
  if (!s.apiKey) {
    throw new Error('未配置 OpenAI API Key,请在 AI 设置页或 .env 中填写');
  }
  return new OpenAI({
    apiKey: s.apiKey,
    baseURL: s.baseURL || 'https://api.openai.com/v1',
  });
}

export function getOpenAI(): OpenAI {
  const s = loadSettings().openai;
  const sig = `${s.apiKey}::${s.baseURL}`;
  if (_client && _clientSig === sig) return _client;
  _client = makeClient();
  _clientSig = sig;
  return _client;
}

/** 当前生效的模型(实时从 settings 读) */
export function getModel(): string {
  return loadSettings().openai.defaultModel || 'gpt-4o-mini';
}

/** 当前生效的 API Key 摘要(前 4 位 + 长度,用于 UI 展示) */
export function getApiKeyMask(): string {
  const k = loadSettings().openai.apiKey;
  if (!k) return '';
  if (k.length <= 8) return '****';
  return `${k.slice(0, 4)}…${k.slice(-4)}(len=${k.length})`;
}

/** 测试 OpenAI 连接 */
export async function testConnection(): Promise<{ ok: boolean; model: string; message: string }> {
  try {
    const s = loadSettings().openai;
    if (!s.apiKey) {
      return { ok: false, model: s.defaultModel, message: 'API Key 未配置' };
    }
    const client = makeClient();
    // 用一个极简请求测试连接
    const res = await client.chat.completions.create({
      model: s.defaultModel || 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'ping' }],
      max_tokens: 5,
    });
    const reply = res.choices[0]?.message?.content ?? '';
    return {
      ok: true,
      model: s.defaultModel || 'gpt-4o-mini',
      message: `连接成功 · 响应: "${reply.trim().slice(0, 20)}"`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, model: getModel(), message: `连接失败: ${msg}` };
  }
}
