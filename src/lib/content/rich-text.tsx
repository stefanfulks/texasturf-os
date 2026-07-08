/**
 * Minimal, dependency-free rich text for editable content blocks.
 *
 * Formatting (admin-authored, so intentionally tiny):
 *   - Blank line separates paragraphs.
 *   - **wrap** → bold.
 * Renders real React nodes (no dangerouslySetInnerHTML), so there is no HTML
 * injection surface even though only admins can edit.
 */
import { Fragment, type ReactNode } from "react";

/** Split a line into text + <strong> segments on `**bold**` pairs. */
export function inlineNodes(line: string): ReactNode[] {
  const parts = line.split("**");
  return parts.map((part, i) =>
    // Odd indices are the content between a pair of `**`.
    i % 2 === 1 ? <strong key={i} className="font-semibold text-ink">{part}</strong> : <Fragment key={i}>{part}</Fragment>,
  );
}

/** Prose: blank line = new <p>; single newlines become <br/> within a paragraph. */
export function RichText({ text, className = "" }: { text: string; className?: string }) {
  const paragraphs = text.split(/\n\s*\n/);
  return (
    <>
      {paragraphs.map((para, pi) => {
        const lines = para.split("\n");
        return (
          <p key={pi} className={className || undefined}>
            {lines.map((line, li) => (
              <Fragment key={li}>
                {inlineNodes(line)}
                {li < lines.length - 1 ? <br /> : null}
              </Fragment>
            ))}
          </p>
        );
      })}
    </>
  );
}

/** Bulleted list: one <li> per non-empty line. */
export function RichList({ text, className = "list-disc space-y-1 pl-5" }: { text: string; className?: string }) {
  const items = text.split("\n").map((l) => l.trim()).filter(Boolean);
  return (
    <ul className={className}>
      {items.map((line, i) => (
        <li key={i}>{inlineNodes(line)}</li>
      ))}
    </ul>
  );
}

/** Single line of inline-formatted text (no wrapping element). */
export function RichInline({ text }: { text: string }) {
  return <>{inlineNodes(text)}</>;
}
