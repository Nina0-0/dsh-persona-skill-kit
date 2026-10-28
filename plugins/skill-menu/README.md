# dsh-skill-menu

侧边栏里的「技能菜单 / Skills」：把本机 DSH 能加载的技能列出来，支持模糊检索、悬停看简介、一键复制名称。

## 它做什么

- **Host 端**（`lib/index.js`）扫描 DSH 的技能根目录，把一个只读的 JSON 目录注册到 `/skill-menu/catalog`：
  - `$DSH_HOME/skills`（跳过 `.system`）
  - `$DSH_AGENTS_HOME` 或 `~/.agents/skills`
  - 配置里的 `extraRoots`
- **Web 端**（`lib/client.js`）注册 `sidebar.panellist` 一行和 `main` 面板，读取上面的接口。
- 只列每个根目录的直接子目录（`<name>/SKILL.md`）或顶层 `<name>.md`，与 DSH 的发现规则一致，所以菜单里出现的技能都能被 agent 用 `skill` 工具加载。

## 界面

- 模糊检索：子序列匹配（`dsgn` → `design-md`），也搜简介和 `whenToUse`。
- 来源筛选：按根目录分组（DSH / Agents / Custom）。
- 悬停卡片：完整简介、适用场景、`SKILL.md` 路径。
- 点击卡片或「复制」按钮复制技能名。
- 「刷新」按钮重新读取，不用重启。

## 配置（可选）

```yaml
# <profile>/cordis.patch.yml
- id: skill-menu
  name: dsh-skill-menu
  config:
    extraRoots:
      - D:\my-skills
```

## 安全

- 接口只接受 loopback 请求（`127.0.0.1` / `::1` / mapped），非本机来源返回 403；即使 Web 服务绑定到局域网地址，也不会把技能列表暴露出去。
- 只读：不写文件、不改技能、不联网。
- 返回内容仅限技能文件里的 `name` / `description` / `whenToUse` / 路径。

## 已知限制

- 项目级技能目录默认不列出（随会话工作目录变化），需要时加 `extraRoots`。
- 简介来自各技能自己的 frontmatter，不做翻译。
- 技能文件必须是**无 BOM** 的 UTF-8：PowerShell 的 `Set-Content -Encoding utf8` 会写入 BOM，导致 DSH 判定为无效技能。
