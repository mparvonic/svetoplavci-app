import { Fragment, type ReactNode } from "react";

import { cn } from "@/lib/utils";

type SimpleMarkdownProps = {
  text: string;
  className?: string;
  paragraphClassName?: string;
  listClassName?: string;
  listItemClassName?: string;
};

function renderInlineMarkdown(input: string): ReactNode[] {
  const parts = input.split(/(\*\*[^*\n]+\*\*|\*[^*\n]+\*)/g);
  return parts.map((part, index) => {
    if (!part) return null;
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return <strong key={`strong-${index}`}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
      return <em key={`em-${index}`}>{part.slice(1, -1)}</em>;
    }
    return <Fragment key={`text-${index}`}>{part}</Fragment>;
  });
}

export function SimpleMarkdown({
  text,
  className,
  paragraphClassName,
  listClassName,
  listItemClassName,
}: SimpleMarkdownProps) {
  const lines = text.split("\n");
  const blocks: ReactNode[] = [];
  let index = 0;
  let key = 0;

  while (index < lines.length) {
    const line = lines[index];
    const unorderedMatch = line.match(/^\s*[-*]\s+(.+)$/);
    const orderedMatch = line.match(/^\s*\d+\.\s+(.+)$/);

    if (unorderedMatch) {
      const items: ReactNode[] = [];
      while (index < lines.length) {
        const match = lines[index].match(/^\s*[-*]\s+(.+)$/);
        if (!match) break;
        items.push(<li key={`ul-item-${key}-${index}`} className={listItemClassName}>{renderInlineMarkdown(match[1])}</li>);
        index += 1;
      }
      blocks.push(
        <ul key={`ul-${key}`} className={cn("list-disc pl-5", listClassName)}>
          {items}
        </ul>,
      );
      key += 1;
      continue;
    }

    if (orderedMatch) {
      const items: ReactNode[] = [];
      while (index < lines.length) {
        const match = lines[index].match(/^\s*\d+\.\s+(.+)$/);
        if (!match) break;
        items.push(<li key={`ol-item-${key}-${index}`} className={listItemClassName}>{renderInlineMarkdown(match[1])}</li>);
        index += 1;
      }
      blocks.push(
        <ol key={`ol-${key}`} className={cn("list-decimal pl-5", listClassName)}>
          {items}
        </ol>,
      );
      key += 1;
      continue;
    }

    const trimmed = line.trim();
    if (!trimmed) {
      index += 1;
      continue;
    }

    blocks.push(
      <p key={`p-${key}`} className={paragraphClassName}>
        {renderInlineMarkdown(line)}
      </p>,
    );
    key += 1;
    index += 1;
  }

  if (blocks.length === 0) return null;
  return <div className={className}>{blocks}</div>;
}
