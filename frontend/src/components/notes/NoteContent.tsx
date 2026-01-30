import ReactMarkdown from 'react-markdown';
import { useEntityModalContext } from '../../context/EntityModalContext';

interface NoteContentProps {
  content: string;
  caseId: number;
}

export function NoteContent({ content, caseId }: NoteContentProps) {
  const { openModal } = useEntityModalContext();

  return (
    <>
      <ReactMarkdown
        components={{
          a: ({ href, children }) => {
            // Check if this is a person mention link
            const match = href?.match(/^person:(\d+)$/);
            if (match) {
              const personId = parseInt(match[1], 10);
              return (
                <button
                  type="button"
                  onClick={() =>
                    openModal({
                      type: 'person',
                      id: personId,
                      context: { caseId },
                    })
                  }
                  className="mention-chip-display"
                >
                  {children}
                </button>
              );
            }
            // Regular external links
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary-600 dark:text-primary-400 hover:underline"
              >
                {children}
              </a>
            );
          },
          // Keep paragraphs inline with note styling
          p: ({ children }) => <span>{children}</span>,
        }}
      >
        {content}
      </ReactMarkdown>

      {/* Styles for mention chips in saved notes */}
      <style>{`
        .mention-chip-display {
          display: inline-flex;
          align-items: center;
          background-color: rgb(219 234 254); /* blue-100 */
          color: rgb(29 78 216); /* blue-700 */
          padding: 0 6px;
          border-radius: 4px;
          font-size: 0.875rem;
          font-weight: 500;
          margin: 0 1px;
          cursor: pointer;
          border: none;
        }
        .mention-chip-display:hover {
          background-color: rgb(191 219 254); /* blue-200 */
        }
        .dark .mention-chip-display {
          background-color: rgb(30 58 138 / 0.4); /* blue-900/40 */
          color: rgb(147 197 253); /* blue-300 */
        }
        .dark .mention-chip-display:hover {
          background-color: rgb(30 58 138 / 0.6); /* blue-900/60 */
        }
      `}</style>
    </>
  );
}
