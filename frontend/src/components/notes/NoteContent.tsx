import ReactMarkdown from 'react-markdown';
import { useEntityModalContext } from '../../context/EntityModalContext';

interface NoteContentProps {
  content: string;
  caseId: number;
}

export function NoteContent({ content, caseId }: NoteContentProps) {
  const { openModal } = useEntityModalContext();

  return (
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
                className="text-primary-600 dark:text-primary-400 hover:underline font-medium"
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
  );
}
