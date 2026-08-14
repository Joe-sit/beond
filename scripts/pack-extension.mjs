// Package extension/ for the Edge Add-ons / Chrome Web Store upload.
// Named after the manifest version so uploads are never ambiguous.
import { execFileSync } from "node:child_process";
import { readFileSync, rmSync } from "node:fs";

const { version } = JSON.parse(readFileSync("extension/manifest.json", "utf8"));
const out = `beond-extension-${version}.zip`;
rmSync(out, { force: true });
// Exclude the repo-facing README and dotfiles — the store gets code + assets.
execFileSync("zip", ["-qr", `../${out}`, ".", "-x", ".*", "README.md", "store/*"], { cwd: "extension" });
console.log(out);
