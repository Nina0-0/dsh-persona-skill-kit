#!/usr/bin/env node
/**
 * Remove the two add-ons from a profile. Plugin copies, dependency entries and
 * bundle selections are removed; the personality text the user saved lives in
 * the profile patch and is left untouched.
 *
 * Usage: node scripts/uninstall.mjs [--profile=<dir>]
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const NAMES = ["dsh-global-persona", "dsh-skill-menu"];

function flag(name) {
  const prefix = `--${name}=`;
  const hit = process.argv.find((arg) => arg.startsWith(prefix));
  return hit === undefined ? undefined : hit.slice(prefix.length);
}

const dshHome = path.resolve(process.env.DSH_HOME || path.join(os.homedir(), ".dsh"));
const profile = path.resolve(
  flag("profile") || process.env.DSH_PROFILE_DIR || path.join(dshHome, "profiles", "desktop"),
);
const manifestPath = path.join(profile, "package.json");
if (!fs.existsSync(manifestPath)) {
  console.error(`No DSH profile at ${profile}`);
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8").replace(/^\uFEFF/, ""));
for (const name of NAMES) {
  delete manifest.dependencies?.[name];
  const bundles = manifest.dsh?.profile?.bundles;
  if (Array.isArray(bundles)) {
    const at = bundles.indexOf(name);
    if (at >= 0) bundles.splice(at, 1);
  }
  fs.rmSync(path.join(profile, "plugins", name), { recursive: true, force: true });
  fs.rmSync(path.join(profile, "node_modules", name), { recursive: true, force: true });
  console.log(`removed ${name}`);
}
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log("Restart DSH to unload the plugins. Your saved personality text stays in cordis.patch.yml.");
