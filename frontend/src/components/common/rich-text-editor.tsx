import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Underline from "@tiptap/extension-underline"
import Link from "@tiptap/extension-link"
import Placeholder from "@tiptap/extension-placeholder"
import { useCallback, useEffect } from "react"
import { cn } from "@/lib/utils"

interface RichTextEditorProps {
  content: string
  onUpdate: (markdown: string) => void
  placeholder?: string
  className?: string
}

// Convert basic markdown to HTML for the editor
function markdownToHtml(md: string): string {
  if (!md) return ""
  let html = md
  // Headers
  html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>")
  html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>")
  html = html.replace(/^# (.+)$/gm, "<h1>$1</h1>")
  // Bullet lists: lines starting with "- "
  html = html.replace(
    /^(- .+(\n- .+)*)$/gm,
    (match) => {
      const items = match
        .split("\n")
        .map((line) => `<li>${line.replace(/^- /, "")}</li>`)
        .join("")
      return `<ul>${items}</ul>`
    }
  )
  // Links: [text](url)
  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2">$1</a>'
  )
  // Bold: **text**
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
  // Underline: __text__
  html = html.replace(/__(.+?)__/g, "<u>$1</u>")
  // Italic: *text*
  html = html.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, "<em>$1</em>")
  // Paragraphs — split on double newlines
  html = html
    .split(/\n\n+/)
    .map((block) => {
      if (block.startsWith("<h") || block.startsWith("<ul")) return block
      return `<p>${block.replace(/\n/g, "<br>")}</p>`
    })
    .join("")
  return html
}

// Convert editor HTML back to markdown
function htmlToMarkdown(html: string): string {
  if (!html || html === "<p></p>") return ""
  let md = html
  // Headers
  md = md.replace(/<h1>(.*?)<\/h1>/gi, "# $1\n\n")
  md = md.replace(/<h2>(.*?)<\/h2>/gi, "## $1\n\n")
  md = md.replace(/<h3>(.*?)<\/h3>/gi, "### $1\n\n")
  // Links
  md = md.replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, "[$2]($1)")
  // Bold
  md = md.replace(/<strong>(.*?)<\/strong>/gi, "**$1**")
  // Underline
  md = md.replace(/<u>(.*?)<\/u>/gi, "__$1__")
  // Italic
  md = md.replace(/<em>(.*?)<\/em>/gi, "*$1*")
  // List items
  md = md.replace(/<li><p>(.*?)<\/p><\/li>/gi, "- $1\n")
  md = md.replace(/<li>(.*?)<\/li>/gi, "- $1\n")
  md = md.replace(/<\/?[ou]l>/gi, "")
  // Paragraphs and breaks
  md = md.replace(/<br\s*\/?>/gi, "\n")
  md = md.replace(/<\/p>\s*<p>/gi, "\n\n")
  md = md.replace(/<\/?p>/gi, "")
  // Clean up remaining tags
  md = md.replace(/<[^>]+>/g, "")
  // Decode entities
  md = md.replace(/&amp;/g, "&")
  md = md.replace(/&lt;/g, "<")
  md = md.replace(/&gt;/g, ">")
  md = md.replace(/&quot;/g, '"')
  return md.trim()
}

function ToolbarButton({
  active,
  onClick,
  children,
  title,
}: {
  active?: boolean
  onClick: () => void
  children: React.ReactNode
  title: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        "flex h-7 w-7 items-center justify-center text-xs font-medium transition-colors",
        active
          ? "bg-accent text-accent-foreground"
          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
      )}
    >
      {children}
    </button>
  )
}

function Toolbar({ editor }: { editor: ReturnType<typeof useEditor> }) {
  if (!editor) return null

  const setLink = useCallback(() => {
    const previousUrl = editor.getAttributes("link").href
    const url = window.prompt("URL", previousUrl)
    if (url === null) return
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run()
      return
    }
    editor
      .chain()
      .focus()
      .extendMarkRange("link")
      .setLink({ href: url })
      .run()
  }, [editor])

  return (
    <div className="flex items-center gap-0.5 border-b px-2 py-1">
      <ToolbarButton
        title="Bold"
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <span className="font-bold">B</span>
      </ToolbarButton>
      <ToolbarButton
        title="Italic"
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <span className="italic">I</span>
      </ToolbarButton>
      <ToolbarButton
        title="Underline"
        active={editor.isActive("underline")}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <span className="underline">U</span>
      </ToolbarButton>

      <div className="mx-1 h-4 w-px bg-border" />

      <ToolbarButton
        title="Heading 1"
        active={editor.isActive("heading", { level: 1 })}
        onClick={() =>
          editor.chain().focus().toggleHeading({ level: 1 }).run()
        }
      >
        H1
      </ToolbarButton>
      <ToolbarButton
        title="Heading 2"
        active={editor.isActive("heading", { level: 2 })}
        onClick={() =>
          editor.chain().focus().toggleHeading({ level: 2 }).run()
        }
      >
        H2
      </ToolbarButton>
      <ToolbarButton
        title="Heading 3"
        active={editor.isActive("heading", { level: 3 })}
        onClick={() =>
          editor.chain().focus().toggleHeading({ level: 3 }).run()
        }
      >
        H3
      </ToolbarButton>

      <div className="mx-1 h-4 w-px bg-border" />

      <ToolbarButton
        title="Bullet list"
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <span className="text-[10px]">&#8226;</span>
      </ToolbarButton>

      <ToolbarButton
        title="Link"
        active={editor.isActive("link")}
        onClick={setLink}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </svg>
      </ToolbarButton>
    </div>
  )
}

export function RichTextEditor({
  content,
  onUpdate,
  placeholder,
  className,
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-primary underline",
        },
      }),
      Placeholder.configure({
        placeholder: placeholder ?? "",
      }),
    ],
    content: markdownToHtml(content),
    editorProps: {
      attributes: {
        class: cn(
          "prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-24 px-3 py-2",
          "prose-headings:mt-2 prose-headings:mb-1 prose-p:my-1"
        ),
      },
    },
    onUpdate: ({ editor }) => {
      onUpdate(htmlToMarkdown(editor.getHTML()))
    },
  })

  // Sync external content changes
  useEffect(() => {
    if (editor && !editor.isFocused) {
      const currentMd = htmlToMarkdown(editor.getHTML())
      if (currentMd !== content) {
        editor.commands.setContent(markdownToHtml(content))
      }
    }
  }, [content, editor])

  return (
    <div
      className={cn(
        "border bg-background text-sm",
        "focus-within:ring-1 focus-within:ring-ring",
        className
      )}
    >
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  )
}
