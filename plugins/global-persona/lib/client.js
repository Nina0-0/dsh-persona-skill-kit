/**
 * Global persona — browser half.
 *
 * Renders the "Personality" page of the Settings dialog. The page edits the
 * `persona` field of this plugin's own Host entry (`global-persona`) through
 * the shared settings document: staged text, one Save, and the Host persists
 * the value to the active profile patch and applies it immediately.
 *
 * This file is a prebuilt client bundle: it registers a factory with the
 * module loader and resolves only baseline modules, exactly like the shipped
 * client packages.
 */
window.__ModuleLoader__.load({
	id: "dsh-global-persona",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react_jsx_runtime = require("react/jsx-runtime");
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		let _deepseek_ai_dsh_client_store = require("@deepseek-ai/dsh-client-store");

		//#region locales
		/** Locale bundles for the personality page. */
		const en = {
			nav: "Personality",
			title: "Global personality prompt",
			description:
				"Applies to every session. It is added to the system prompt of each request, so it shapes tone, style, and what the assistant should always remember about you.",
			label: "Personality prompt",
			hint: "Plain text or Markdown. Keep it short and specific: tone, language, habits, and the facts about you the assistant should always know. Leave it empty to turn the persona off.",
			placeholder:
				"Example:\n- Talk like a concise senior engineer; Chinese by default.\n- Skip the preamble, lead with the answer.\n- I work on Windows with PowerShell; prefer it over bash.\n- Remember: my timezone is Asia/Shanghai.",
			clear: "Clear",
			characters: "{count} characters",
			unavailable: "This entry is not loaded, so it cannot be configured right now.",
			readOnly: "This deployment stores settings read-only.",
			save: "Save",
			saving: "Saving…",
			saveFailed: "The deployment did not accept this text; it was left for you to correct.",
			empty: "Empty — the global persona is currently off.",
			active: "Active — appended to the system prompt of every session.",
		};
		/** Simplified Chinese copy. */
		const zh = {
			nav: "个性",
			title: "全局个性提示词",
			description:
				"对所有会话生效。它会被加入每次请求的系统提示词，用来塑造语气、风格，以及希望助手始终记住的关于你的事情。",
			label: "个性提示词",
			hint: "纯文本或 Markdown 均可。建议写得短而具体：语气、语言、习惯，以及希望助手始终知道的事实。留空即关闭全局个性。",
			placeholder:
				"例如：\n- 说话像一位简洁的资深工程师，默认用中文。\n- 不要开场白，先给结论。\n- 我在 Windows 上使用 PowerShell，优先用它而不是 bash。\n- 记住：我的时区是 Asia/Shanghai。",
			clear: "清空",
			characters: "{count} 字",
			unavailable: "该插件当前未加载，暂时无法配置。",
			readOnly: "本部署以只读方式保存设置。",
			save: "保存",
			saving: "保存中…",
			saveFailed: "本部署没有接受这段内容，已保留供你修改。",
			empty: "当前为空 —— 全局个性未启用。",
			active: "已启用 —— 将加入每个会话的系统提示词。",
		};
		//#endregion

		//#region page
		/** Dictionary namespace owned by this plugin. */
		const NS = "settings.globalPersona";
		/** Loader entry id whose `persona` field this page edits. */
		const ENTRY_ID = "global-persona";
		/** Config field carrying the persona text. */
		const FIELD = "persona";
		/** Required services. */
		const inject = ["slots", "locale", "configForms"];

		/** Shared styling for the page frame. */
		const styles = {
			page: {
				display: "grid",
				gap: "8px",
				padding: "4px 0 8px",
			},
			title: {
				margin: 0,
				fontSize: "16px",
				lineHeight: "24px",
				fontWeight: 600,
				color: "var(--dsw-alias-label-primary, inherit)",
			},
			description: {
				margin: 0,
				fontSize: "12px",
				lineHeight: "18px",
				color: "var(--dsw-alias-label-secondary, inherit)",
			},
			field: {
				display: "grid",
				gap: "6px",
				paddingTop: "8px",
			},
			labelRow: {
				display: "flex",
				alignItems: "baseline",
				justifyContent: "space-between",
				gap: "12px",
			},
			label: {
				fontSize: "13px",
				lineHeight: "20px",
				fontWeight: 500,
				color: "var(--dsw-alias-label-primary, inherit)",
			},
			meta: {
				display: "flex",
				alignItems: "center",
				gap: "10px",
			},
			counter: {
				fontSize: "11px",
				color: "var(--dsw-alias-label-tertiary, inherit)",
			},
			clear: {
				border: "none",
				background: "none",
				padding: 0,
				cursor: "pointer",
				fontSize: "12px",
				color: "var(--dsw-alias-link, #4d6bfe)",
			},
			textarea: {
				boxSizing: "border-box",
				width: "100%",
				minHeight: "260px",
				resize: "vertical",
				padding: "10px 12px",
				borderRadius: "8px",
				border: "1px solid var(--dsw-alias-border-l2, rgba(127,127,127,0.35))",
				background: "transparent",
				color: "inherit",
				font: "inherit",
				fontSize: "13px",
				lineHeight: "20px",
				outline: "none",
			},
			hint: {
				margin: 0,
				fontSize: "12px",
				lineHeight: "18px",
				color: "var(--dsw-alias-label-tertiary, inherit)",
			},
			status: {
				margin: 0,
				fontSize: "12px",
				lineHeight: "18px",
				color: "var(--dsw-alias-label-tertiary, inherit)",
			},
		};

		/**
		 * Render the personality settings page.
		 * @param props - composed slot props: `t`, the persona snapshot, and the form actions.
		 * @returns the page element tree.
		 */
		function PersonaSection(props) {
			const { t } = props;
			const state = props.usePersona((snapshot) => snapshot);
			const field = state.persona;
			const disabled = !state.writable || state.saving;
			const text = field.text;
			const jsx = react_jsx_runtime.jsx;
			const jsxs = react_jsx_runtime.jsxs;
			return jsx("div", {
				style: styles.page,
				children: jsxs(_deepseek_ai_dsh_client_ui_primitives.SettingsForm, {
					labels: {
						unavailable: t("unavailable"),
						readOnly: t("readOnly"),
						saveFailed: t("saveFailed"),
						save: t("save"),
						saving: t("saving"),
					},
					state,
					onSave: props.save,
					onDiscard: props.discard,
					children: [
						jsxs("div", {
							children: [
								jsx("h2", { style: styles.title, children: t("title") }),
								jsx("p", { style: styles.description, children: t("description") }),
							],
						}),
						jsxs("div", {
							style: styles.field,
							children: [
								jsxs("div", {
									style: styles.labelRow,
									children: [
										jsx("label", {
											style: styles.label,
											htmlFor: "global-persona-text",
											children: t("label"),
										}),
										jsxs("div", {
											style: styles.meta,
											children: [
												jsx("span", {
													style: styles.counter,
													children: t("characters", { count: text.length }),
												}),
												jsx("button", {
													type: "button",
													style: styles.clear,
													disabled,
													onClick: () => {
														props.edit("");
													},
													children: t("clear"),
												}),
											],
										}),
									],
								}),
								jsx("textarea", {
									id: "global-persona-text",
									style: styles.textarea,
									value: text,
									disabled,
									spellCheck: false,
									placeholder: t("placeholder"),
									onChange: (event) => {
										props.edit(event.target.value);
									},
								}),
								jsx("p", {
									style: styles.hint,
									children: t("hint"),
								}),
								jsx("p", {
									style: styles.status,
									children: text.trim() === "" ? t("empty") : t("active"),
								}),
							],
						}),
					],
				}),
			});
		}

		/**
		 * Mount the personality page into the Settings dialog.
		 * @param ctx - the browser plugin context.
		 */
		function apply(ctx) {
			const t = ctx.locale.bind(NS);
			ctx.effect(() => ctx.locale.register(NS, { zh, en }), "global-persona:dictionaries");
			let form;
			try {
				form = new _deepseek_ai_dsh_client_ui_primitives.SettingsFormModel(
					ctx.configForms.get(ENTRY_ID),
					[_deepseek_ai_dsh_client_ui_primitives.settingsTextField(FIELD)],
				);
			} catch (error) {
				console.warn("[global-persona] settings entry unavailable", error);
				return;
			}			const project = () => ({
				...form.shell(),
				[FIELD]: form.field(FIELD),
			});
			const store = _deepseek_ai_dsh_client_store.createSnapshotStore(project());
			const publish = () => {
				store.set(project());
			};
			const off = form.bind(() => form.shell()).subscribe(publish);
			ctx.effect(() => () => {
				off();
				form.dispose();
			}, "global-persona:form");
			const face = {
				hooks: { persona: store },
				edit: (text) => {
					form.actions().edit(FIELD, text);
				},
				save: () => {
					form.save();
				},
				discard: () => {
					form.actions().discard();
				},
			};
			ctx.effect(
				() =>
					ctx.slots.inject("settings.section", () =>
						ctx.slots.register(
							{
								name: "settings.section",
								id: "global-persona",
								order: 5,
								label: () => t("nav"),
								locale: NS,
								inject: () => face,
							},
							PersonaSection,
						),
					),
				"global-persona:page",
			);
		}
		//#endregion

		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	},
});
