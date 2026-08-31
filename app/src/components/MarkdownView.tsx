import ReactMarkdown from 'react-markdown';

/**
 * markdown 渲染 - 复用 index.css 中的 .markdown 样式
 * 输入 markdown 文本,输出已转义的安全 HTML(react-markdown 默认转义)
 */
export function MarkdownView({ content }: { content: string }) {
  return (
    <div className="markdown">
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  );
}