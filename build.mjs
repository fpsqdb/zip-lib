import * as fs from "node:fs/promises";

await fs.copyFile("./LICENSE", "./lib/LICENSE");
await fs.copyFile("./README.md", "./lib/README.md");
await fs.copyFile("./package.json", "./lib/package.json");