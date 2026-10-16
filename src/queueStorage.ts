import { CATEGORIES, type Category, type FileItem } from "./types";

export function serializeQueue(queue: FileItem[]): string {
  return JSON.stringify(queue);
}

function isCategory(value: unknown): value is Category {
  return typeof value === "string" && (CATEGORIES as string[]).includes(value);
}

export function parseQueue(json: string): FileItem[] {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];

  const items: FileItem[] = [];
  for (const entry of data) {
    if (typeof entry !== "object" || entry === null) continue;
    const { path, name, category, kind } = entry as Record<string, unknown>;
    if (
      typeof path !== "string" ||
      typeof name !== "string" ||
      !isCategory(category)
    ) {
      continue;
    }
    const item: FileItem = { path, name, category };
    if (kind === "file" || kind === "folder") item.kind = kind;
    items.push(item);
  }
  return items;
}