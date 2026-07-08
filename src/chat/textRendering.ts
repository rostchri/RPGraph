import type { ChatDialogueQuote } from '../types';

export type ExtractedQuote = {
  index: number;
  text: string;
};

export const dialogueColors = [
  '#d59645',
  '#3fa8c5',
  '#c75c9a',
  '#5fae68',
  '#8a73c9',
  '#c65f5f',
  '#c7af45',
  '#3aa091',
  '#7eb9c5',
  '#ad6ec5',
];

export function extractDialogueQuotes(text: string): ExtractedQuote[] {
  // Single left-to-right pass. Models and translators frequently MIX quote styles
  // (e.g. a German opening low-9 quote paired with a straight " close); a per-style
  // regex then mis-pairs the straight closers and captures the narration BETWEEN
  // quotes as a "quote". Opening on any opener and closing on the next matching
  // closer handles mixed and consistent styles alike, in text order (stable ids).
  const straight = '"';
  const low = String.fromCharCode(0x201e); // German opening low-9 quote
  const high = String.fromCharCode(0x201c); // German/curly opening high quote
  const right = String.fromCharCode(0x201d); // curly closing quote
  const guillemetOpen = String.fromCharCode(0xab);
  const guillemetClose = String.fromCharCode(0xbb);
  const closersByOpener: Record<string, string> = {
    [straight]: straight + right,
    [low]: straight + high + right,
    [high]: straight + right,
    [guillemetOpen]: guillemetClose,
    [guillemetClose]: guillemetOpen,
  };
  const quotes: ExtractedQuote[] = [];
  let cursor = 0;
  while (cursor < text.length) {
    const closers = closersByOpener[text[cursor]];
    if (closers) {
      let end = -1;
      for (let scan = cursor + 1; scan < text.length; scan += 1) {
        if (closers.includes(text[scan])) {
          end = scan;
          break;
        }
      }
      if (end >= 0) {
        quotes.push({ index: quotes.length, text: text.slice(cursor, end + 1) });
        cursor = end + 1;
        continue;
      }
    }
    cursor += 1;
  }
  return quotes;
}

export function coloredDialogueParts(text: string, dialogue: ChatDialogueQuote[]) {
  let searchFrom = 0;
  const ranges = dialogue
    .map((quote) => {
      const matchStart = text
        .toLocaleLowerCase()
        .indexOf(quote.text.toLocaleLowerCase(), searchFrom);
      if (matchStart < 0) {
        return undefined;
      }
      let start = matchStart;
      let end = matchStart + quote.text.length;
      if (start > 0 && /["“]/.test(text[start - 1])) {
        start -= 1;
      }
      if (end < text.length && /["”]/.test(text[end])) {
        end += 1;
      }
      searchFrom = end;
      return { start, end, quote };
    })
    .filter((range): range is NonNullable<typeof range> => !!range)
    .sort((left, right) => left.start - right.start)
    .filter((range, index, ranges) => index === 0 || range.start >= ranges[index - 1].end);

  if (ranges.length === 0) {
    return [{ text }];
  }

  const parts: Array<{ text: string; speakerName?: string }> = [];
  let cursor = 0;
  ranges.forEach((range) => {
    if (range.start > cursor) {
      parts.push({ text: text.slice(cursor, range.start) });
    }
    parts.push({ text: text.slice(range.start, range.end), speakerName: range.quote.speakerName });
    cursor = range.end;
  });
  if (cursor < text.length) {
    parts.push({ text: text.slice(cursor) });
  }
  return parts;
}

export function quotedSpeechParts(text: string) {
  // Reuse the shared quote tokenizer so mixed quote styles are handled exactly
  // like speaker highlighting. The previous per-style regex mis-bounded a German
  // opening closed by a straight quote and spilled trailing narration into the
  // speech span (also affecting TTS speech/narration segmentation).
  const quotes = extractDialogueQuotes(text);
  if (quotes.length === 0) {
    return [{ text }];
  }

  const parts: Array<{ text: string; isSpeech?: boolean }> = [];
  let cursor = 0;
  for (const quote of quotes) {
    const start = text.indexOf(quote.text, cursor);
    if (start < 0) {
      continue;
    }
    const end = start + quote.text.length;
    if (start > cursor) {
      parts.push({ text: text.slice(cursor, start) });
    }
    parts.push({ text: text.slice(start, end), isSpeech: true });
    cursor = end;
  }
  if (cursor < text.length) {
    parts.push({ text: text.slice(cursor) });
  }
  return parts;
}

export function thoughtParts(text: string) {
  const matches = [...text.matchAll(/\*[^*\n]+?\*/g)];
  if (matches.length === 0) {
    return [{ text }];
  }

  const parts: Array<{ text: string; isThought?: boolean }> = [];
  let cursor = 0;
  matches.forEach((match) => {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    if (start > cursor) {
      parts.push({ text: text.slice(cursor, start) });
    }
    parts.push({ text: text.slice(start, end), isThought: true });
    cursor = end;
  });
  if (cursor < text.length) {
    parts.push({ text: text.slice(cursor) });
  }
  return parts;
}

export function thoughtStyleClass(style: 'bold' | 'italic' | 'light') {
  return `thought-text ${style}`;
}
