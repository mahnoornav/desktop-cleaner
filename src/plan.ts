import type { FileItem, MoveStatus, PlannedMove } from "./types";

export function joinPath(...parts: string[]): string {
  return parts
    .map((part, i) =>
      i === 0 ? part.replace(/\/+$/, "") : part.replace(/^\/+|\/+$/g, ""),
    )
    .join("/");
}

export function planMoves(items: FileItem[], baseDir: string): PlannedMove[] {
  // Count how many files land on each destination (ignoring upper/lower case,
  // because a Mac treats "A.pdf" and "a.pdf" as the same file by default)
  const counts = new Map<string, number>();

  const planned = items.map((item) => {
    const destinationFolder = joinPath(baseDir, item.category);
    const destinationPath = joinPath(destinationFolder, item.name);
    const key = destinationPath.toLowerCase();
    counts.set(key, (counts.get(key) ?? 0) + 1);
    return { item, destinationFolder, destinationPath };
  });

  return planned.map((move) => {
    let status: MoveStatus = "ok";
    if (move.item.path === move.destinationPath) {
      status = "already-there";
    } else if ((counts.get(move.destinationPath.toLowerCase()) ?? 0) > 1) {
      status = "name-clash";
    }
    return { ...move, status };
  });
}