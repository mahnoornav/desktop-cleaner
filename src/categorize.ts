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

  zip: "Archives & Downloads",
  rar: "Archives & Downloads",
  "7z": "Archives & Downloads",
  tar: "Archives & Downloads",
  gz: "Archives & Downloads",
  dmg: "Archives & Downloads",
  pkg: "Archives & Downloads",
};

export function getName(path: string): string {
  return path.split("/").pop() ?? path;
}

export function getExtension(name: string): string {
  const dot = name.lastIndexOf(".");
  if (dot <= 0) return "";
  return name.slice(dot + 1).toLowerCase();
}

export function categorize(name: string): Category {
  return EXTENSION_MAP[getExtension(name)] ?? "Other / Needs Review";
}

export function makeFileItem(path: string): FileItem {
  const name = getName(path);
  return { path, name, category: categorize(name) };
}