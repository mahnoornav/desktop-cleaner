import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const items = JSON.parse(
  readFileSync(new URL("../testset/testset.json", import.meta.url), "utf8"),
);

const outDir = join(homedir(), "bh-testset");
mkdirSync(outDir, { recursive: true });

for (const { name } of items) {
  // "a" creates the file if it is missing and never overwrites an existing one
  writeFileSync(join(outDir, name), "", { flag: "a" });
}

console.log(`Created ${items.length} empty files in ${outDir}`);