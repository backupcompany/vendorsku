export const searchTokens = (query: string): string[] =>
  query.trim().toLowerCase().split(/\s+/).filter(Boolean);

export const matchesSearch = (tokens: string[], ...fields: (string | number | null | undefined)[]): boolean => {
  if (tokens.length === 0) return true;
  const haystack = fields.filter((f) => f !== null && f !== undefined).join(' ').toLowerCase();
  return tokens.every((t) => haystack.includes(t));
};
