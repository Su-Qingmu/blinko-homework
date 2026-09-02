import fs from 'node:fs';
import path from 'node:path';

/**
 * AI 设置 - JSON 文件持久化
 *
 * 设计取舍:
 * - 不引入 AiProvider / Config 表(SIMPLIFIED.md 砍掉)
 * - 单文件 data/settings.json,简单可读,git 可追踪
 * - 优先级:文件设置 > 环境变量 > 内置默认值
 */

const SETTINGS_DIR = path.resolve(process.cwd(), 'data');
const SETTINGS_FILE = path.join(SETTINGS_DIR, 'settings.json');

export interface AISettings {
  openai: {
    apiKey: string;
    baseURL: string;
    defaultModel: string;
  };
  prompts: {
    chat: string;
    comment: string;
  };
}

const DEFAULTS: AISettings = {
  openai: {
    apiKey: '',
    baseURL: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
  },
  prompts: {
    chat:
      '你是 Blinko 笔记助手，一个简洁、友好、专业的 AI 伙伴。请用中文回答，控制在 200 字以内，除非用户明确要求长文。',
    comment:
      '你是一个笔记评论助手。对用户的笔记给出 1-2 句有建设性的反馈、补充或提问。不要重复笔记内容。语气温和,像朋友间的点评。',
  },
};

/** 内存缓存,避免每次都读文件 */
let cache: AISettings | null = null;

/** 从环境变量构造初始默认(供没有 settings.json 时用) */
function envDefaults(): AISettings {
  return {
    openai: {
      apiKey: process.env.OPENAI_API_KEY ?? DEFAULTS.openai.apiKey,
      baseURL: process.env.OPENAI_BASE_URL ?? DEFAULTS.openai.baseURL,
      defaultModel: process.env.OPENAI_MODEL ?? DEFAULTS.openai.defaultModel,
    },
    prompts: { ...DEFAULTS.prompts },
  };
}

/** 深合并 settings.json 内容与默认 + 环境变量 */
function merge(stored: Partial<AISettings> | null): AISettings {
  const base = envDefaults();
  if (!stored) return base;
  return {
    openai: { ...base.openai, ...(stored.openai ?? {}) },
    prompts: { ...base.prompts, ...(stored.prompts ?? {}) },
  };
}

/** 读取当前 AI 设置 */
export function loadSettings(): AISettings {
  if (cache) return cache;
  try {
    if (!fs.existsSync(SETTINGS_FILE)) {
      cache = envDefaults();
      return cache;
    }
    const raw = fs.readFileSync(SETTINGS_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<AISettings>;
    cache = merge(parsed);
    return cache;
  } catch (err) {
    console.error('[settings] 读取失败,使用 env 默认:', err);
    cache = envDefaults();
    return cache;
  }
}

/** 保存 AI 设置 */
export function saveSettings(next: Partial<AISettings>): AISettings {
  const current = loadSettings();
  const merged: AISettings = {
    openai: { ...current.openai, ...(next.openai ?? {}) },
    prompts: { ...current.prompts, ...(next.prompts ?? {}) },
  };
  try {
    fs.mkdirSync(SETTINGS_DIR, { recursive: true });
    // 只保存用户实际写入的字段(空 apiKey 也保存,允许清空)
    const toStore: Partial<AISettings> = {};
    if (next.openai) toStore.openai = merged.openai;
    if (next.prompts) toStore.prompts = merged.prompts;
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(toStore, null, 2), 'utf-8');
    cache = merged;
    return merged;
  } catch (err) {
    console.error('[settings] 保存失败:', err);
    throw err;
  }
}

/** 清除缓存(用于测试) */
export function clearSettingsCache(): void {
  cache = null;
}

/** 设置文件路径(供前端展示) */
export function getSettingsFilePath(): string {
  return SETTINGS_FILE;
}
