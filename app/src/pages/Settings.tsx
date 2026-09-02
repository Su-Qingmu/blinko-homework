import { useState, useEffect } from 'react';
import { PageHeader } from '../components/AppShell';
import { CollapsibleCard } from '../components/CollapsibleCard';
import { Icon } from '../components/Icon';
import { trpc } from '../lib/trpc';
import clsx from 'clsx';

const MODEL_PRESETS = [
  { value: 'gpt-4o-mini', label: 'GPT-4o mini · 推荐(便宜快)', desc: 'OpenAI 默认,128K 上下文' },
  { value: 'gpt-4o', label: 'GPT-4o · 旗舰', desc: '最强,较贵' },
  { value: 'gpt-4-turbo', label: 'GPT-4 Turbo', desc: '稳定版 4 系列' },
  { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo', desc: '最便宜,能力较弱' },
  { value: 'o1-mini', label: 'o1-mini · 推理', desc: '慢但逻辑强' },
  { value: '__custom__', label: '自定义模型', desc: '输入自定义名称' },
];

const DEFAULT_CHAT_PROMPT =
  '你是 Blinko 笔记助手，一个简洁、友好、专业的 AI 伙伴。请用中文回答，控制在 200 字以内，除非用户明确要求长文。';

const DEFAULT_COMMENT_PROMPT =
  '你是一个笔记评论助手。对用户的笔记给出 1-2 句有建设性的反馈、补充或提问。不要重复笔记内容。语气温和,像朋友间的点评。';

/**
 * AI 设置页 /settings
 * 沿用 Blinko 原版 CollapsibleCard 风格
 *
 * 三个分组:
 * 1. AI Provider & Models(API Key / Base URL / 测试连接)
 * 2. Default Model(下拉选择 + 自定义)
 * 3. Global Prompts(chat + comment 两个 textarea)
 */
export default function Settings() {
  const utils = trpc.useUtils();
  const settings = trpc.ai.getSettings.useQuery();
  const updateSettings = trpc.ai.updateSettings.useMutation({
    onSuccess: () => utils.ai.getSettings.invalidate(),
  });
  const testConn = trpc.ai.testConnection.useMutation();

  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [baseURL, setBaseURL] = useState('');
  const [model, setModel] = useState('gpt-4o-mini');
  const [customModel, setCustomModel] = useState('');
  const [chatPrompt, setChatPrompt] = useState(DEFAULT_CHAT_PROMPT);
  const [commentPrompt, setCommentPrompt] = useState(DEFAULT_COMMENT_PROMPT);

  // 同步远端 → 本地
  useEffect(() => {
    if (settings.data) {
      setBaseURL(settings.data.openai.baseURL);
      const presetValues = MODEL_PRESETS.filter((p) => p.value !== '__custom__').map((p) => p.value);
      if (settings.data.openai.defaultModel && !presetValues.includes(settings.data.openai.defaultModel)) {
        setModel('__custom__');
        setCustomModel(settings.data.openai.defaultModel);
      } else {
        setModel(settings.data.openai.defaultModel || 'gpt-4o-mini');
      }
      setChatPrompt(settings.data.prompts.chat);
      setCommentPrompt(settings.data.prompts.comment);
    }
  }, [settings.data]);

  const save = () => {
    const finalModel = model === '__custom__' ? customModel.trim() : model;
    updateSettings.mutate({
      openai: {
        ...(apiKey ? { apiKey } : {}),
        baseURL: baseURL.trim(),
        defaultModel: finalModel || 'gpt-4o-mini',
      },
      prompts: {
        chat: chatPrompt,
        comment: commentPrompt,
      },
    });
  };

  const testNow = () => testConn.mutate(undefined);

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <PageHeader
        title={
          <span className="inline-flex items-center gap-2">
            <Icon icon="hugeicons:settings-01" width={20} height={20} className="text-primary" />
            AI 设置
          </span>
        }
        subtitle={
          settings.data
            ? `配置文件: ${settings.data.settingsFilePath}`
            : '加载中…'
        }
        actions={
          <button
            type="button"
            className="btn-primary flex items-center gap-1.5"
            onClick={save}
            disabled={updateSettings.isPending}
          >
            {updateSettings.isPending ? (
              <>
                <Icon icon="hugeicons:loading-03" width={14} height={14} className="animate-spin" />
                保存中…
              </>
            ) : (
              <>
                <Icon icon="hugeicons:disk-01" width={14} height={14} />
                保存设置
              </>
            )}
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto px-6 py-6 max-w-4xl w-full mx-auto space-y-4">
        {/* ===== 1. Provider & Connection ===== */}
        <CollapsibleCard icon="hugeicons:ai-magic" title="AI Provider · OpenAI">
          <div className="space-y-4">
            <div>
              <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1.5">
                <Icon icon="hugeicons:key-01" width={12} height={12} />
                API Key
              </label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    className="input pr-9 font-mono text-xs"
                    type={showKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={
                      settings.data?.openai.apiKeySet
                        ? settings.data.openai.apiKeyMasked + ' (留空保持原值)'
                        : 'sk-...'
                    }
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 rounded hover:bg-accent"
                  >
                    <Icon
                      icon={showKey ? 'hugeicons:view-off-slash' : 'hugeicons:view'}
                      width={14}
                      height={14}
                    />
                  </button>
                </div>
                {settings.data?.openai.apiKeySet && (
                  <button
                    type="button"
                    className="btn-outline text-xs text-destructive hover:bg-destructive/10"
                    onClick={() =>
                      updateSettings.mutate({
                        openai: { apiKey: '__CLEAR__' as any },
                      })
                    }
                    title="清空 API Key"
                  >
                    <Icon icon="hugeicons:delete-02" width={14} height={14} />
                  </button>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                留空 = 保持当前值。修改后下次 AI 调用立即生效。
              </p>
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1.5">
                <Icon icon="hugeicons:link-01" width={12} height={12} />
                Base URL
              </label>
              <input
                className="input font-mono text-xs"
                type="url"
                value={baseURL}
                onChange={(e) => setBaseURL(e.target.value)}
                placeholder="https://api.openai.com/v1"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                自定义端点可对接 OpenAI 兼容 API(如 Azure、本地 vLLM)。
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-border">
              <button
                type="button"
                className="btn-outline flex items-center gap-1.5"
                onClick={testNow}
                disabled={testConn.isPending}
              >
                {testConn.isPending ? (
                  <>
                    <Icon icon="hugeicons:loading-03" width={14} height={14} className="animate-spin" />
                    测试中…
                  </>
                ) : (
                  <>
                    <Icon icon="hugeicons:signal" width={14} height={14} />
                    测试连接
                  </>
                )}
              </button>
              {testConn.data && (
                <div
                  className={clsx(
                    'flex-1 text-xs px-3 py-1.5 rounded-md flex items-center gap-1.5',
                    testConn.data.ok
                      ? 'bg-green-50 text-green-700 border border-green-200'
                      : 'bg-destructive/10 text-destructive border border-destructive/30',
                  )}
                >
                  <Icon
                    icon={testConn.data.ok ? 'hugeicons:tick-double-01' : 'hugeicons:alert-circle'}
                    width={14}
                    height={14}
                  />
                  {testConn.data.message}
                </div>
              )}
            </div>
          </div>
        </CollapsibleCard>

        {/* ===== 2. Default Model ===== */}
        <CollapsibleCard icon="hugeicons:cpu" title="默认模型">
          <div className="space-y-2">
            <div className="grid gap-2 sm:grid-cols-2">
              {MODEL_PRESETS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setModel(p.value)}
                  className={clsx(
                    'flex items-start gap-2 p-3 rounded-md border text-left transition',
                    model === p.value
                      ? 'bg-primary-50 border-primary text-primary'
                      : 'bg-card border-border hover:bg-accent text-foreground',
                  )}
                >
                  <Icon
                    icon={model === p.value ? 'hugeicons:radio-checked' : 'hugeicons:radio-unchecked'}
                    width={16}
                    height={16}
                    className={clsx('shrink-0 mt-0.5', model === p.value ? 'text-primary' : 'text-muted-foreground')}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold">{p.label}</div>
                    <div className="text-[10px] text-muted-foreground">{p.desc}</div>
                  </div>
                </button>
              ))}
            </div>

            {model === '__custom__' && (
              <div className="pt-2">
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  自定义模型名
                </label>
                <input
                  className="input font-mono text-xs"
                  value={customModel}
                  onChange={(e) => setCustomModel(e.target.value)}
                  placeholder="gpt-4o-mini-2024-07-18 / deepseek-chat / ..."
                />
              </div>
            )}

            <p className="text-[10px] text-muted-foreground pt-2 border-t border-border">
              模型影响 AI 对话和 AI 评论的速度与质量。设置立即生效。
            </p>
          </div>
        </CollapsibleCard>

        {/* ===== 3. Global Prompts ===== */}
        <CollapsibleCard icon="hugeicons:message-text-01" title="全局 Prompt">
          <div className="space-y-5">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Icon icon="hugeicons:chatting-01" width={12} height={12} />
                  对话系统 Prompt
                </label>
                <button
                  type="button"
                  className="text-[10px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                  onClick={() => setChatPrompt(DEFAULT_CHAT_PROMPT)}
                >
                  <Icon icon="hugeicons:refresh" width={10} height={10} />
                  重置默认
                </button>
              </div>
              <textarea
                className="input font-mono text-xs leading-relaxed"
                rows={4}
                value={chatPrompt}
                onChange={(e) => setChatPrompt(e.target.value)}
                maxLength={4000}
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                每次 AI 对话前都会带上。控制 AI 的人设、回答风格、长度等。
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Icon icon="hugeicons:message-01" width={12} height={12} />
                  AI 评论系统 Prompt
                </label>
                <button
                  type="button"
                  className="text-[10px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                  onClick={() => setCommentPrompt(DEFAULT_COMMENT_PROMPT)}
                >
                  <Icon icon="hugeicons:refresh" width={10} height={10} />
                  重置默认
                </button>
              </div>
              <textarea
                className="input font-mono text-xs leading-relaxed"
                rows={4}
                value={commentPrompt}
                onChange={(e) => setCommentPrompt(e.target.value)}
                maxLength={4000}
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                用户点 "AI 帮我评论" 时使用。建议简短,1-2 句点评风格。
              </p>
            </div>
          </div>
        </CollapsibleCard>

        {/* 帮助卡 */}
        <div className="card p-4 bg-primary-50/40 border-primary/20">
          <div className="flex items-start gap-2">
            <Icon icon="hugeicons:help-circle" width={18} height={18} className="text-primary shrink-0 mt-0.5" />
            <div className="text-xs text-foreground space-y-1">
              <div className="font-semibold text-foreground">小提示</div>
              <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
                <li>设置存到 <code className="px-1 py-0.5 bg-muted rounded font-mono">{settings.data?.settingsFilePath ?? 'data/settings.json'}</code></li>
                <li>环境变量 <code className="px-1 py-0.5 bg-muted rounded font-mono">OPENAI_API_KEY</code> 等仅作为初始默认值</li>
                <li>修改后无需重启,下次 AI 调用立即生效</li>
                <li>详细使用见 <code className="px-1 py-0.5 bg-muted rounded font-mono">SIMPLIFIED.md</code> §六</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}