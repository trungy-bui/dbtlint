export function normalizeForSearch(value: string): string {
  return value
    .toLocaleLowerCase()
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function matchesProjectSearch(
  projectName: string,
  search: string,
): boolean {
  const normalizedProjectName = normalizeForSearch(projectName);
  const searchTokens = normalizeForSearch(search).split(" ").filter(Boolean);

  return searchTokens.every((token) => normalizedProjectName.includes(token));
}
