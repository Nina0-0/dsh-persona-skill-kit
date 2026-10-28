# Install instructions (for the DSH agent)

You are installing two bundle plugins into the user's **active DSH profile**:
`dsh-global-persona` (a Settings page) and `dsh-skill-menu` (a sidebar page).
Nothing here touches DSH itself; both are profile bundles.

## 1. Locate the profile

In order of preference:

1. An explicit destination the user gave you (`--profile=<dir>`).
2. `$DSH_PROFILE_DIR` (Windows: `$env:DSH_PROFILE_DIR`).
3. The default: `$DSH_HOME/profiles/desktop` (Desktop) or `$DSH_HOME/profiles/web` (CLI web), where `DSH_HOME` defaults to `~/.dsh`.

A profile is a directory containing `package.json`. If it does not exist, ask the user to start DSH once (which creates it) rather than creating one by hand.

## 2. Inspect first (writes nothing)

```bash
node scripts/install.mjs --check
```

Show the user the resolved profile, whether each plugin is already installed, and which package manager will be used. If the resolved profile is not the one they expect, stop and ask.

## 3. Install

```bash
node scripts/install.mjs
# or
node scripts/install.mjs --profile="/path/to/profile"
```

What the script does:

- copies `plugins/<name>` to `<profile>/plugins/<name>` (replacing an older copy);
- adds `"<name>": "link:./plugins/<name>"` to `dependencies`;
- appends `<name>` to `dsh.profile.bundles` if absent;
- runs `pnpm install --ignore-scripts` with DSH's bundled runtime when available, otherwise `pnpm` from `PATH`, and otherwise links the packages into `node_modules` directly.

It is idempotent and does **not** touch `cordis.patch.yml`.

## 4. Verify

```bash
node -e "const p=require(process.env.DSH_PROFILE_DIR + '/package.json'); console.log(p.dependencies, p.dsh.profile.bundles)"
```

Both names must appear in `dependencies` and in `dsh.profile.bundles`, and `<profile>/node_modules/<name>/package.json` must resolve.

## 5. Tell the user

- **Fully quit DSH and reopen it** (closing the window is not enough).
- After restart: **Settings → 个性 / Personality** for the prompt; the **技能菜单 / Skills** row in the sidebar for the catalog.
- The persona is empty until they write something; an empty value adds nothing to the system prompt.
- The skill menu reads their existing skills. If it is empty, point them at `~/.dsh/skills` (one folder per skill, each with `SKILL.md`) or at `README.md#技能菜单`.

## Guardrails

- **Never edit, rewrite or delete `cordis.patch.yml`.** It holds the user's settings and their personality text.
- Do not remove bundles or dependencies the user already had.
- Do not create `~/.dsh/skills` entries on their behalf unless they ask; the menu is read-only.
- If a step fails, stop and report the exact command and output. Do not work around a failed install by editing DSH's own files.

## If DSH fails to boot afterwards

Use the app's recovery dialog ("disable third-party plugins, back up the patch, restart"), then report the newest file under:

```
%APPDATA%\@deepseek-ai\dsh-desktop\logs\crash-*-web-boot.log
```

Both plugins are written to fail soft at the UI layer, but the bundle resolution itself can still be rejected by a DSH version mismatch; the crash log names the entry that failed.
