# dsh-global-persona

给每个会话注入同一段「全局个性提示词」，并在 **设置 → 个性 / Personality** 里查看、修改，保存后立即生效。

## 它做什么

- **Host 端**（`lib/index.js`）在系统提示词里注册一个固定 section `user:global-persona`，位置紧跟 DSH 自己的部署人设（order 0 之后），对所有会话、所有 agent 生效。
- **Web 端**（`lib/client.js`）往设置面板注册一个「个性」页面，用 DSH 自带的 `SettingsForm` 渲染多行文本框和保存按钮。
- 文本保存在插件自己的配置项 `persona` 上，并标记为 `volatile`。保存时由 `dsh-settings` 写入当前 profile 的 `cordis.patch.yml` 并即时应用；下一次请求就会带上新内容，不需要重启、不需要新开会话。
- 内容为空时不产生任何 section，等于关闭。
- section 设了 `interpolate: false`，所以文本里出现 `{{...}}`（代码、JSON、模板）不会被当成提示词变量。

## 文本存在哪

```yaml
# <profile>/cordis.patch.yml
- id: global-persona
  name: dsh-global-persona
  config:
    persona: |
      ...你写的内容...
```

删掉这个 override（或在页面上清空后保存）即恢复默认的空内容。

## 挂载方式

`cordis.patch.yml` 是 bundle 补丁层，插入一行 `global-persona`；插件包本身由安装脚本复制进 `<profile>/plugins/` 并在 profile 的 `package.json` 里登记为 `link:` 依赖 + bundle。

## 可调项

- 位置：`ctx.systemPrompt.getSectionOrder("DEPLOYMENT_PERSONA_PREFIX") + 1`（`lib/index.js`）。
- 设置项在侧栏的顺序：`order: 5`（`lib/client.js` 的 `settings.section` 注册处）。

## 边界

- 不做检索、不做压缩：写多少就占多少 token，建议 200 字以内。
- 不覆盖 agent 预设自己的 persona：预设里若有更高优先级的 identity，以预设为准。
- 卸载：`node scripts/uninstall.mjs`（在仓库根目录），你写的文本会保留在 patch 里。
