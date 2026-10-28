# Repository guidance for coding agents

This repository ships two DSH profile bundles plus an installer. It is not a
DSH fork.

- **Installing for a user**: follow [`INSTALL.md`](INSTALL.md) exactly. Run
  `scripts/install.mjs --check` first and show the user the resolved profile.
- **Never edit `cordis.patch.yml`**: it belongs to the user and holds their
  settings and personality text.
- **Keep the repo data-free**: no personal names, personal paths, skill
  catalogs, or machine-specific values. The skill panel scans the local DSH
  skill roots at runtime; do not bake catalogs into `plugins/skill-menu`.
- **Plugin contract**: both packages are DSH bundles. `package.json` declares
  `dsh.bundle.patch` and `dsh.client`; the host halves inject only public Cordis
  services (`systemPrompt`, `webServer`), and the browser halves require only
  baseline modules (`react`, `react-dom`, `react/jsx-runtime`,
  `@deepseek-ai/dsh-client-ui-primitives`).
- **Bundles are prebuilt and checked in**: `lib/client.js` is the shipped
  browser bundle. If you change it, keep it in the `window.__ModuleLoader__.load`
  wrapper and export `apply` plus `inject`.
- **Verification without a browser**: `node --check` the host file, then run the
  panel bundle against stubs. A real check boots a disposable profile and loads
  the page, because a browser-side exception can fail the whole web boot audit.
