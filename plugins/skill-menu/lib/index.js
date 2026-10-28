/**
 * Skill menu — host half.
 *
 * Scans the directories DSH itself loads skills from (the harness home's
 * `skills` root and the shared agents root) and serves the resulting summaries
 * to the browser panel as read-only JSON. Everything listed here is therefore a
 * skill the agent can actually load — the panel never advertises files DSH
 * would ignore.
 *
 * The route is narrow: a loopback-only GET returning names and descriptions of
 * files that already live on this machine. It is not an authenticated API; the
 * loopback check keeps it off a non-local interface even when the Web server
 * binds to a LAN address.
 *
 * @module dsh-skill-menu
 */
import { readdir, readFile, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

/** Cordis plugin name. */
export const name = "skill-menu";

/** Services this plugin needs before `apply` runs. */
export const inject = ["webServer"];

/** Exact path the browser panel fetches. Keep in sync with lib/client.js. */
const ROUTE_PATH = "/skill-menu/catalog";

/** Addresses that count as the local machine. */
const LOOPBACK = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);

/** Skill names DSH accepts: kebab-case. */
const SKILL_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Whether one request comes from the local machine.
 * @param req - the incoming request.
 * @returns true for loopback IPv4/IPv6 (including mapped forms).
 */
function isLoopback(req) {
  const address = req.socket?.remoteAddress ?? "";
  return LOOPBACK.has(address) || address.startsWith("127.") || address.startsWith("::ffff:127.");
}

/**
 * Write one JSON response.
 * @param res - the response.
 * @param status - HTTP status code.
 * @param body - JSON-serializable body.
 */
function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "content-length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

/**
 * Resolve the roots a DSH installation loads skills from.
 * @param config - the plugin config, optionally carrying extra roots.
 * @returns absolute roots with the label shown on a badge.
 */
function skillRoots(config) {
  const dshHome = process.env.DSH_HOME || join(homedir(), ".dsh");
  const agentsHome = process.env.DSH_AGENTS_HOME || join(homedir(), ".agents");
  const roots = [
    { path: join(dshHome, "skills"), label: "DSH", skipSystem: true },
    { path: join(agentsHome, "skills"), label: "Agents", skipSystem: false },
  ];
  for (const extra of config?.extraRoots ?? []) {
    if (typeof extra === "string" && extra.length > 0) {
      roots.push({ path: extra, label: "Custom", skipSystem: false });
    }
  }
  return roots;
}

/**
 * Parse the small YAML subset a skill frontmatter uses.
 *
 * Handles `key: value`, quoted values, and `|` / `>` block scalars. Anything
 * else is ignored; the catalog only needs name, description, whenToUse, and the
 * model-invocation flag.
 * @param source - the skill file text.
 * @returns the frontmatter fields, or undefined when there is no frontmatter.
 */
function parseFrontmatter(source) {
  const text = source.replace(/^\uFEFF/, "");
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  if (match === null) return undefined;
  const fields = {};
  const lines = match[1].split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const pair = /^([A-Za-z][\w-]*):(?:\s*(.*))?$/.exec(line);
    if (pair === null) continue;
    const key = pair[1];
    let value = (pair[2] ?? "").trim();
    if (value === "|" || value === ">" || value === "") {
      const block = [];
      while (index + 1 < lines.length && (/^\s+/.test(lines[index + 1]) || lines[index + 1].trim() === "")) {
        block.push(lines[index + 1].trim());
        index += 1;
      }
      value = block.join(value === "|" ? "\n" : " ").trim();
    } else {
      value = value.replace(/^["'](.*)["']$/, "$1");
    }
    fields[key] = value;
  }
  return fields;
}

/**
 * Read one skill file into the panel's row shape.
 * @param file - absolute path to `SKILL.md`.
 * @param source - root label.
 * @returns the row, or undefined when the file is not a usable skill.
 */
async function readSkill(file, source) {
  let text;
  try {
    text = await readFile(file, "utf8");
  } catch {
    return undefined;
  }
  const fields = parseFrontmatter(text);
  if (fields === undefined) return undefined;
  const skillName = typeof fields.name === "string" ? fields.name.trim() : "";
  const description = typeof fields.description === "string" ? fields.description.trim() : "";
  if (!SKILL_NAME.test(skillName) || description === "") return undefined;
  const whenToUse = typeof fields.whenToUse === "string" ? fields.whenToUse.trim() : "";
  const manual = /^(true|yes|on|1)$/i.test(fields["disable-model-invocation"] ?? "");
  return {
    name: skillName,
    description,
    whenToUse,
    source,
    path: file,
    modelInvocable: !manual,
  };
}

/**
 * Scan one root for direct-child skills.
 * @param root - the root descriptor.
 * @returns the rows found under it.
 */
async function scanRoot(root) {
  let entries;
  try {
    entries = await readdir(root.path, { withFileTypes: true });
  } catch {
    return [];
  }
  const rows = [];
  for (const entry of entries) {
    if (root.skipSystem && entry.name === ".system") continue;
    const target = join(root.path, entry.name);
    if (entry.isFile() && entry.name.endsWith(".md")) {
      const row = await readSkill(target, root.label);
      if (row !== undefined) rows.push(row);
      continue;
    }
    // Junctions and symlinks to a skill folder report neither isDirectory nor
    // isFile in readdir; stat() follows them.
    let info;
    try {
      info = await stat(target);
    } catch {
      continue;
    }
    if (!info.isDirectory()) continue;
    const row = await readSkill(join(target, "SKILL.md"), root.label);
    if (row !== undefined) rows.push(row);
  }
  return rows;
}

/**
 * Register the read-only catalog route.
 * @param ctx - the plugin context.
 * @param config - optional `{ extraRoots: string[] }`.
 */
export function apply(ctx, config) {
  ctx.effect(
    () =>
      ctx.webServer.register({
        kind: "exact",
        path: ROUTE_PATH,
        handler: async (req, res) => {
          if (req.method !== "GET" && req.method !== "HEAD") {
            sendJson(res, 405, { error: "method not allowed" });
            return;
          }
          if (!isLoopback(req)) {
            sendJson(res, 403, { error: "loopback only" });
            return;
          }
          try {
            const seen = new Set();
            const skills = [];
            for (const root of skillRoots(config)) {
              for (const row of await scanRoot(root)) {
                if (seen.has(row.name)) continue;
                seen.add(row.name);
                skills.push(row);
              }
            }
            skills.sort((left, right) => left.name.localeCompare(right.name));
            sendJson(res, 200, { skills });
          } catch (error) {
            ctx.logger?.warn?.(`skill-menu: catalog read failed: ${error?.message ?? error}`);
            sendJson(res, 500, { error: "catalog unavailable" });
          }
        },
      }),
    "skill-menu:catalog",
  );
}
