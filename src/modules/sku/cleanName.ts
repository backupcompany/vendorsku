/**
 * Strips internal ERP artifacts like "[MERGED]", "[merged]", "(merged)" from names & specifications
 */
export function cleanCommodityName(name?: string): string {
  if (!name) return '';
  return name
    .replace(/\[\s*merged\s*\]/gi, '')
    .replace(/\(\s*merged\s*\)/gi, '')
    .replace(/^merged\s*[-:]?\s*/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
