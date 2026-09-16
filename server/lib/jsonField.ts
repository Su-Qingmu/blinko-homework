// SQLite + Prisma 5.x 不支持原生 Json 类型,JSON 字段在 schema 里用 String 存 JSON 文本
// 写入前调用 serializeJsonField,读取后调用 parseJsonField,即可让前端当对象使用

export function parseJsonField<T = any>(s: string | null | undefined): T | null {
  if (s == null) return null;
  try { return JSON.parse(s) as T; } catch { return null; }
}

export function serializeJsonField<T = any>(value: T): string {
  return JSON.stringify(value);
}

// aiModels 行解析:capabilities / config 都是 String 字段,需 parse
export function parseModelRow<T extends { capabilities: string; config: string | null }>(row: T): T & { capabilities: any; config: any } {
  return { ...row, capabilities: parseJsonField(row.capabilities), config: parseJsonField(row.config) };
}

// aiProviders 行解析:config 是 String 字段
export function parseProviderRow<T extends { config: string | null }>(row: T): T & { config: any } {
  return { ...row, config: parseJsonField(row.config) };
}