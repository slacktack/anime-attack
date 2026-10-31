export function htmlToText(html: string | null | undefined): string {
  if (!html) return "";

  let text = html
    .replace(/~!([\s\S]*?)!~/g, "")
    .replace(/__([\s\S]+?)__/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "");

  text = text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ");

  text = text.replace(/\n{3,}/g, "\n\n").trim();

  return text;
}
