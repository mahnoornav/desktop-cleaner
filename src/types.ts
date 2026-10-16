export type Category =
  | "School Documents"
  | "Screenshots & Images"
  | "Code & Project Files"
  | "Archives & Downloads"
  | "Needs Review";

export const CATEGORIES: Category[] = [
  "School Documents",
  "Screenshots & Images",
  "Code & Project Files",
  "Archives & Downloads",
  "Needs Review",
];

export interface FileItem {
  path: string;
  name: string;
  category: Category;
  kind?: "file" | "folder";
}

export type MoveStatus = "ok" | "already-there" | "name-clash";

export type PathKind = "file" | "folder" | "missing" | "unreadable" | "other";

export interface PlannedMove {
  item: FileItem;
  destinationFolder: string;
  destinationPath: string;
  status: MoveStatus;
}

export type MoveOutcome =
  | { status: "moved"; to: string }
  | { status: "already-there" }
  | { status: "exists"; to: string }
  | { status: "failed"; reason: string };

export interface ReportEntry {
  item: FileItem;
  outcome: MoveOutcome;
}