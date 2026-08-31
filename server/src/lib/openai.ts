/**
 * OpenAI 客户端单例
 *
 * 阶段5启用：流式对话、AI 自动评论。
 * 当前占位实现 - 调用时若未配置 OPENAI_API_KEY 直接抛错。
 */
import OpenAI from 'openai';

let _client: OpenAI | null = null;

export function getOpenAI(): OpenAI {
  if (_client) return _client;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY 未配置，无法调用 AI');
  }
  _client = new OpenAI({
    apiKey,
    baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
  });
  return _client;
}

export const AI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
