export const FREE_PLAN_PROJECT_LIMIT = 1;

export type Plan = "free" | "team";

export function deriveProjectName(fileName: string) {
  return fileName.replace(".zip", "");
}
