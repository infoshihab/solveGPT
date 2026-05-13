/**
 * Wrap image URL for CommonMark when it contains spaces or parentheses,
 * which otherwise break `![alt](url)` parsing.
 */
export function wrapMarkdownImageUrl(url: string): string {
  const t = url.trim();
  if (!t) return t;
  if (t.startsWith("<") && t.endsWith(">")) return t;
  if (/[\s()]/.test(t)) return `<${t}>`;
  return t;
}
