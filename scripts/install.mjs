#!/usr/bin/env node
/**
 * Install the two DSH add-ons into an existing profile.
 *
 * Usage:
 *   node scripts/install.mjs                 # auto-detect the profile
 *   node scripts/install.mjs --check         # print what would change, write nothing
 *   node scripts/install.mjs --profile=<dir> # explicit profile directory
 *
 * The script is idempotent: it replaces the plugin copies, keeps the profile
 * manifest entries unique, and re-links the packages.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const REPO = path.resolve(import.meta.dirname, "..");
const PLUGIN_DIRS = ["global-persona", "skill-menu"];
const CHECK = process.argv.includes("--check");

/**
 * Read `--name=value` from the command line.
 * @param name - flag name without dashes.
 * @returns the value, or undefined.
 */
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
  console.error("Start DSH once (or pass --profile=<dir>) so the profile exists, then re-run.");
  process.exit(1);
}

/**
 * Parse a JSON file, tolerating a UTF-8 BOM written by some Windows editors.
 * @param file - absolute path.
 * @returns the parsed value.
 */
function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
}

const manifest = readJson(manifestPath);
manifest.dependencies ??= {};
manifest.dsh ??= {};
manifest.dsh.profile ??= {};
manifest.dsh.profile.bundles ??= [];

const planned = PLUGIN_DIRS.map((dir) => {
  const source = path.join(REPO, "plugins", dir);
  const pkg = readJson(path.join(source, "package.json"));
  const target = path.join(profile, "plugins", pkg.name);
  return { dir, source, name: pkg.name, target };
});

/** Locate the pnpm and node bundled with the desktop runtime. */
function bundledToolchain() {
  const root = path.join(dshHome, "dsh-runtimes");
  if (!fs.existsSync(root)) return undefined;
  for (const runtime of fs.readdirSync(root)) {
    const dependencies = path.join(root, runtime, "dependencies");
    const pnpm = path.join(dependencies, "pnpm", "bin", "pnpm.cjs");
    const node = path.join(dependencies, "node", "bin", process.platform === "win32" ? "node.exe" : "node");
    if (fs.existsSync(pnpm) && fs.existsSync(node)) return { node, pnpm };
  }
  return undefined;
}

/** Run `pnpm install` in the profile. */
function installDependencies() {
  const bundled = bundledToolchain();
  try {
    if (bundled !== undefined) {
      execFileSync(bundled.node, [bundled.pnpm, "install", "--ignore-scripts"], { cwd: profile, stdio: "inherit" });
    } else {
      execFileSync("pnpm", ["install", "--ignore-scripts"], {
        cwd: profile,
        stdio: "inherit",
        shell: process.platform === "win32",
      });
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Last-resort linking when pnpm is unavailable: junction each package straight
 * into the profile's node_modules.
 */
function linkManually() {
  const nodeModules = path.join(profile, "node_modules");
  fs.mkdirSync(nodeModules, { recursive: true });
  for (const item of planned) {
    const link = path.join(nodeModules, item.name);
    fs.rmSync(link, { recursive: true, force: true });
    fs.symlinkSync(item.target, link, "junction");
  }
}

if (CHECK) {
  console.log(JSON.stringify({
    profile,
    dshHome,
    plugins: planned.map((item) => ({
      name: item.name,
      target: item.target,
      installed: fs.existsSync(item.target),
      dependency: manifest.dependencies[item.name] ?? null,
      bundle: manifest.dsh.profile.bundles.includes(item.name),
    })),
    toolchain: bundledToolchain() === undefined ? "system pnpm (or manual link)" : "bundled pnpm",
  }, null, 2));
  process.exit(0);
}

for (const item of planned) {
  fs.rmSync(item.target, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(item.target), { recursive: true });
  fs.cpSync(item.source, item.target, { recursive: true });
  manifest.dependencies[item.name] = `link:./plugins/${item.name}`;
  if (!manifest.dsh.profile.bundles.includes(item.name)) {
    manifest.dsh.profile.bundles.push(item.name);
  }
  console.log(`copied ${item.name} -> ${item.target}`);
}

fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`updated ${manifestPath}`);

if (!installDependencies()) {
  console.log("pnpm was unavailable; linking packages directly instead.");
  linkManually();
}

for (const item of planned) {
  const resolved = path.join(profile, "node_modules", item.name, "package.json");
  if (!fs.existsSync(resolved)) {
    console.error(`Could not link ${item.name} into ${profile}/node_modules`);
    process.exit(1);
  }
}

console.log("");
console.log("Installed:");
console.log("  • Global persona — Settings → Personality (个性)");
console.log("  • Skill menu    — the “Skills” (技能菜单) row in the sidebar");
console.log("");
console.log("Restart DSH completely (quit the app, not just the window) to load the new plugins.");
