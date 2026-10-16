import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const items = JSON.parse(
  readFileSync(new URL("../testset/testset.json", import.meta.url), "utf8"),
);

const desktop = join(homedir(), "Desktop");
let right = 0;
for (const { name, expected } of items) {
  if (existsSync(join(desktop, expected, name))) right += 1;
  else console.log(`NOT in ${expected}: ${name}`);
}
console.log(`${right}/${items.length} files are in their expected folder.`);