/**
 * Text formatter for chat display.
 * Strips markdown formatting and separates dialogue into its own paragraphs.
 */

const DIALOGUE_PATTERN = /("[^"]*")/g;
const BOLD_PATTERN = /\*\*(.+?)\*\*/g;
const ITALIC_PATTERN = /(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g;
const BOLD_ITALIC_PATTERN = /\*\*\*(.+?)\*\*\*/g;

export function formatChatText(raw: string): string {
  let text = stripMarkdown(raw);
  text = separateDialogue(text);
  return text.trim();
}

export function stripMarkdown(text: string): string {
  let result = text;
  result = result.replace(BOLD_ITALIC_PATTERN, '$1');
  result = result.replace(BOLD_PATTERN, '$1');
  result = result.replace(ITALIC_PATTERN, '$1');
  return result;
}

export function separateDialogue(text: string): string {
  const lines = text.split('\n');
  const result: string[] = [];

  for (const line of lines) {
    if (line.trim() === '') {
      result.push(line);
      continue;
    }

    if (containsInlineDialogue(line)) {
      const parts = splitAroundDialogue(line);
      for (const part of parts) {
        if (part.trim()) {
          result.push(part);
        }
      }
    } else {
      result.push(line);
    }
  }

  return result.join('\n');
}

function containsInlineDialogue(line: string): boolean {
  const trimmed = line.trim();
  if (/^"/.test(trimmed)) return false;

  const matches = trimmed.match(DIALOGUE_PATTERN);
  if (!matches) return false;

  const beforeFirstQuote = trimmed.substring(0, trimmed.indexOf('"')).trimEnd();
  return beforeFirstQuote.length > 0;
}

function splitAroundDialogue(line: string): string[] {
  const parts: string[] = [];
  let remaining = line;

  while (remaining.length > 0) {
    const quoteStart = remaining.indexOf('"');
    if (quoteStart === -1) {
      if (remaining.trim()) parts.push(remaining);
      break;
    }

    const quoteEnd = remaining.indexOf('"', quoteStart + 1);
    if (quoteEnd === -1) {
      if (remaining.trim()) parts.push(remaining);
      break;
    }

    const before = remaining.substring(0, quoteStart).trim();
    const dialogue = remaining.substring(quoteStart, quoteEnd + 1);
    remaining = remaining.substring(quoteEnd + 1).trimStart();

    if (before) parts.push(before);
    parts.push(dialogue);
  }

  return parts;
}
