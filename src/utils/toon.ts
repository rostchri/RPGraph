import { decode } from '@toon-format/toon';
import { isRecord } from './records';

export function stripStructuredResponse(text: string) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:toon)?\s*([\s\S]*?)\s*```$/i);
  return (fenced?.[1] ?? trimmed).trim();
}

export function parseToonObject(text: string) {
  const stripped = stripStructuredResponse(text);
  // A declared-empty TOON array header is an empty array — whether the length is
  // omitted (`name[]{}`) or explicitly zero with declared fields and an optional
  // header colon (`dialogue[0]{quoteId,speakerId}:`). The underlying decoder
  // throws on the length-0 header form, so recognise it up front and return the
  // empty array instead of letting the whole parse fail.
  const emptyArrayObject = stripped.match(/^([A-Za-z_][A-Za-z0-9_]*)\[0?\]\{[^}]*\}:?\s*$/);
  if (emptyArrayObject) {
    return { [emptyArrayObject[1]]: [] };
  }
  const decoded = decode(stripped);
  if (!isRecord(decoded)) {
    throw new Error('The model did not return TOON.');
  }
  return decoded;
}
