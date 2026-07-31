export function normalizeMarkdown(markdown: string): string {
  return markdown.trim().replace(/\n{3,}/g, "\n\n");
}
