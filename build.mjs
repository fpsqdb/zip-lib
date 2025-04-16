import * as fs from "node:fs/promises";

await fs.copyFile("./LICENSE", "./pkg/LICENSE");
await fs.copyFile("./README.md", "./pkg/README.md");
await fs.copyFile("./package.json", "./pkg/package.json");