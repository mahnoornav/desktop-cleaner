import type { Category, FileItem } from "./types";

const EXTENSION_MAP: Record<string, Category> = {
  pdf: "School Documents",
  doc: "School Documents",
  docx: "School Documents",
  txt: "School Documents",
  md: "School Documents",
  pages: "School Documents",
  ppt: "School Documents",
  pptx: "School Documents",
  rtf: "School Documents",

  png: "Screenshots & Images",
  jpg: "Screenshots & Images",
  jpeg: "Screenshots & Images",
  gif: "Screenshots & Images",
  webp: "Screenshots & Images",
  heic: "Screenshots & Images",
  svg: "Screenshots & Images",

  js: "Code & Project Files",
  ts: "Code & Project Files",
  tsx: "Code & Project Files",
  jsx: "Code & Project Files",
  py: "Code & Project Files",
  java: "Code & Project Files",
  c: "Code & Project Files",
  cpp: "Code & Project Files",
  h: "Code & Project Files",
  rs: "Code & Project Files",
  go: "Code & Project Files",
  html: "Code & Project Files",
  css: "Code & Project Files",
  json: "Code & Project Files",
  ipynb: "Code & Project Files",

  zip: "Archives & Downloads",
  rar: "Archives & Downloads",
  "7z": "Archives & Downloads",
  tar: "Archives & Downloads",
  gz: "Archives & Downloads",
  dmg: "Archives & Downloads",
  pkg: "Archives & Downloads",
};

export function getName(path: string): string {
  const parts = path.split("/").filter((part) => part !== "");
  return parts.pop() ?? path;
}

export function getExtension(name: string): string {
  const dot = name.lastIndexOf(".");
  if (dot <= 0) return "";
  return name.slice(dot + 1).toLowerCase();
}

const FILENAME_MAP: Record<string, Category> = {
  makefile: "Code & Project Files",
  dockerfile: "Code & Project Files",
  ".gitignore": "Code & Project Files",
};

const NAME_PATTERNS: { pattern: RegExp; category: Category }[] = [
  { pattern: /^screen ?(shot|recording)\b/i, category: "Screenshots & Images" },
];

function hasOwn(obj: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

export function categorize(name: string): Category {
  const lower = name.toLowerCase();
  if (hasOwn(FILENAME_MAP, lower)) return FILENAME_MAP[lower];

  for (const rule of NAME_PATTERNS) {
    if (rule.pattern.test(name)) return rule.category;
  }

  const ext = getExtension(name);
  if (hasOwn(EXTENSION_MAP, ext)) return EXTENSION_MAP[ext];

  return "Needs Review";
}

export function makeFileItem(path: string): FileItem {
  const name = getName(path);
  return { path, name, category: categorize(name) };
}