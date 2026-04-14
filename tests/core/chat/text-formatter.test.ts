import { describe, it, expect } from 'vitest';
import { formatChatText, stripMarkdown, separateDialogue } from '../../../src/lib/core/chat/text-formatter';

describe('stripMarkdown', () => {
  it('strips bold markers', () => {
    expect(stripMarkdown('**bold text**')).toBe('bold text');
  });

  it('strips italic markers', () => {
    expect(stripMarkdown('*italic text*')).toBe('italic text');
  });

  it('strips bold-italic markers', () => {
    expect(stripMarkdown('***bold italic***')).toBe('bold italic');
  });

  it('leaves plain text unchanged', () => {
    expect(stripMarkdown('plain text')).toBe('plain text');
  });

  it('handles mixed content', () => {
    expect(stripMarkdown('**bold** and *italic* and plain')).toBe('bold and italic and plain');
  });
});

describe('separateDialogue', () => {
  it('separates inline dialogue into its own line', () => {
    const input = 'She looked at him. "I see." He nodded.';
    const result = separateDialogue(input);
    const lines = result.split('\n').filter((l) => l.trim());
    expect(lines).toEqual([
      'She looked at him.',
      '"I see."',
      'He nodded.',
    ]);
  });

  it('leaves standalone dialogue unchanged', () => {
    const input = '"Hello there."';
    const result = separateDialogue(input);
    expect(result.trim()).toBe('"Hello there."');
  });

  it('handles dialogue already on its own line', () => {
    const input = 'Some narration.\n\n"Dialogue here."\n\nMore narration.';
    const result = separateDialogue(input);
    expect(result).toBe(input);
  });

  it('handles multiple inline dialogues in one line', () => {
    const input = 'He said "yes" and she said "no"';
    const result = separateDialogue(input);
    const lines = result.split('\n').filter((l) => l.trim());
    expect(lines).toEqual([
      'He said',
      '"yes"',
      'and she said',
      '"no"',
    ]);
  });
});

describe('formatChatText', () => {
  it('strips markdown and separates dialogue', () => {
    const input = 'She **smiled** warmly. "Thank you." He nodded.';
    const result = formatChatText(input);
    const lines = result.split('\n').filter((l) => l.trim());
    expect(lines).toEqual([
      'She smiled warmly.',
      '"Thank you."',
      'He nodded.',
    ]);
  });

  it('handles novel-style formatting', () => {
    const input = 'The scenery was beautiful. The crimson horizon stretched endlessly.\n\n"It\'s beautiful."\n\nI quietly took in the view.';
    const result = formatChatText(input);
    expect(result).toContain('The scenery was beautiful.');
    expect(result).toContain('"It\'s beautiful."');
    expect(result).not.toContain('**');
  });

  it('leaves non-assistant content path unchanged when called directly', () => {
    const input = '**bold** text';
    expect(stripMarkdown(input)).toBe('bold text');
  });
});
