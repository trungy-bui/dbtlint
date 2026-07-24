type ProjectCardIdentity = {
  source: "upload" | "github";
  scanId: string;
};

export function getProjectCardId({
  source,
  scanId,
}: ProjectCardIdentity): string {
  return `${source}:${scanId}`;
}

export function getNextOpenProjectMenuId(
  currentMenuId: string | null,
  cardId: string,
  open: boolean,
): string | null {
  if (open) return cardId;
  return currentMenuId === cardId ? null : currentMenuId;
}
