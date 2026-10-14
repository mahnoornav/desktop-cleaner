export type Category =
  | "School Documents"
  | "Screenshots & Images"
  | "Code & Project Files"
  | "Archives & Downloads"
  | "Other / Needs Review";

export const CATEGORIES: Category[] = [
  "School Documents",
  "Screenshots & Images",
  "Code & Project Files",
  "Archives & Downloads",
  "Other / Needs Review",
];

export interface FileItem {
  path: string;
  name: string;
  category: Category;
}