import type { Components } from "react-markdown"
import Markdown from "react-markdown"
import remarkGfm from "remark-gfm"

const plugins = [remarkGfm]

const components: Components = {
  table: ({ node: _, children, ...props }) => (
    <div className="my-4 w-full overflow-x-auto border">
      <table className="w-full text-xs" {...props}>
        {children}
      </table>
    </div>
  ),
  th: ({ node: _, children, ...props }) => (
    <th
      className="bg-muted/50 px-3 py-2 text-left text-xs font-medium"
      {...props}
    >
      {children}
    </th>
  ),
  td: ({ node: _, children, ...props }) => (
    <td className="border-t px-3 py-2 text-xs" {...props}>
      {children}
    </td>
  ),
}

function preprocessStreamingMarkdown(
  content: string,
  isStreaming?: boolean
): string {
  if (!isStreaming) return content

  const trimmed = content.trimEnd()
  const lastDoubleNewline = trimmed.lastIndexOf("\n\n")
  const lastBlock =
    lastDoubleNewline === -1 ? trimmed : trimmed.slice(lastDoubleNewline + 2)
  const beforeBlock =
    lastDoubleNewline === -1 ? "" : trimmed.slice(0, lastDoubleNewline)

  const lines = lastBlock.split("\n")
  const pipeLines = lines.filter((l) => l.trimStart().startsWith("|"))

  if (pipeLines.length < 2) return content

  const hasSeparator = lines.some((l) => /^\|[\s\-:|]+\|$/.test(l.trim()))
  const lastLineComplete = /\|\s*$/.test(lines[lines.length - 1])

  if (hasSeparator && lastLineComplete) return content

  const placeholder = "\n\n*Generating table...*"
  return beforeBlock ? beforeBlock + placeholder : placeholder.trimStart()
}

interface AiMarkdownProps {
  children: string
  isStreaming?: boolean
}

export function AiMarkdown({ children, isStreaming }: AiMarkdownProps) {
  const content = preprocessStreamingMarkdown(children, isStreaming)

  return (
    <Markdown remarkPlugins={plugins} components={components}>
      {content}
    </Markdown>
  )
}
