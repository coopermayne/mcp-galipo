import { memo, useState, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Copy, Check } from 'lucide-react';

interface MarkdownContentProps {
  content: string;
}

interface CodeBlockProps {
  language: string;
  code: string;
}

function CodeBlock({ language, code }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [code]);

  return (
    <div className="relative group my-2 rounded-lg overflow-hidden">
      {/* Language badge and copy button */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-3 py-1.5 bg-bg-surface text-text-muted text-xs">
        <span>{language || 'code'}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 px-2 py-0.5 rounded hover:bg-bg-hover transition-colors"
          aria-label={copied ? 'Copied!' : 'Copy code'}
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5" />
              <span>Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <SyntaxHighlighter
        style={oneDark}
        language={language || 'text'}
        PreTag="div"
        customStyle={{
          margin: 0,
          paddingTop: '2.5rem',
          fontSize: '0.8125rem',
          borderRadius: '0.5rem',
        }}
        codeTagProps={{
          style: {
            fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
          },
        }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}

export const MarkdownContent = memo(function MarkdownContent({ content }: MarkdownContentProps) {
  return (
    <div className="markdown-content prose prose-sm dark:prose-invert max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Code blocks with syntax highlighting
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '');
            const code = String(children).replace(/\n$/, '');

            // Check if this is an inline code or a code block
            // Code blocks are wrapped in <pre> by react-markdown
            const isInline = !className && !code.includes('\n');

            if (isInline) {
              return (
                <code
                  className="px-1.5 py-0.5 rounded bg-bg-hover text-text font-mono text-xs"
                  {...props}
                >
                  {children}
                </code>
              );
            }

            return <CodeBlock language={match?.[1] || ''} code={code} />;
          },
          // Override pre to avoid double wrapping
          pre({ children }) {
            return <>{children}</>;
          },
          // Links open in new tab
          a({ href, children }) {
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 hover:underline"
              >
                {children}
              </a>
            );
          },
          // Style headers
          h1({ children }) {
            return <h1 className="text-lg font-bold mt-5 mb-2 first:mt-0 text-text border-b border-border pb-1">{children}</h1>;
          },
          h2({ children }) {
            return <h2 className="text-sm font-semibold uppercase tracking-wide mt-5 mb-1.5 first:mt-0 text-text-muted">{children}</h2>;
          },
          h3({ children }) {
            return <h3 className="text-xs font-semibold uppercase tracking-wide mt-4 mb-1 first:mt-0 text-text-muted">{children}</h3>;
          },
          // Style lists
          ul({ children }) {
            return <ul className="list-disc list-inside my-2 space-y-1">{children}</ul>;
          },
          ol({ children }) {
            return <ol className="list-decimal list-inside my-2 space-y-1">{children}</ol>;
          },
          li({ children }) {
            return <li className="text-sm">{children}</li>;
          },
          // Style paragraphs
          p({ children }) {
            return <p className="my-2 first:mt-0 last:mb-0">{children}</p>;
          },
          // Style blockquotes
          blockquote({ children }) {
            return (
              <blockquote className="border-l-4 border-border pl-3 my-2 italic text-text-secondary">
                {children}
              </blockquote>
            );
          },
          // Style horizontal rules
          hr() {
            return <hr className="my-4 border-border" />;
          },
          // Style strong/bold
          strong({ children }) {
            return <strong className="font-semibold">{children}</strong>;
          },
          // Style emphasis/italic
          em({ children }) {
            return <em className="italic">{children}</em>;
          },
          // Table components
          table({ children }) {
            return (
              <div className="overflow-x-auto my-3">
                <table className="min-w-full border-collapse text-sm">
                  {children}
                </table>
              </div>
            );
          },
          thead({ children }) {
            return <thead className="bg-bg-hover">{children}</thead>;
          },
          tbody({ children }) {
            return <tbody className="divide-y divide-border">{children}</tbody>;
          },
          tr({ children }) {
            return <tr className="border-b border-border">{children}</tr>;
          },
          th({ children }) {
            return (
              <th className="px-3 py-2 text-left font-semibold text-text border border-border">
                {children}
              </th>
            );
          },
          td({ children }) {
            return (
              <td className="px-3 py-2 text-text-secondary border border-border">
                {children}
              </td>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});
