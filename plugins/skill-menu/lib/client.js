/**
 * Skill menu — browser half.
 *
 * A full-page panel in the Web GUI's main column, opened from a sidebar row.
 * It reads the host's live skill catalog from `/skill-menu/catalog` and offers
 * fuzzy search, source filters, one-click copy, and a hover card with the full
 * description. No catalog data is embedded: every installation shows its own
 * skills.
 */
window.__ModuleLoader__.load({
	id: "dsh-skill-menu",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_dom = require("react-dom");
		let react_jsx_runtime = require("react/jsx-runtime");
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");

		/** Panel id shared by the sidebar row and the main registration. */
		const PANEL_ID = "skill-menu";

		/** Services this plugin needs before `apply` runs. */
		const inject = ["slots"];

		/** Host route serving the catalog. Keep in sync with lib/index.js. */
		const CATALOG_URL = "/skill-menu/catalog";

		/** Untranslated skill text stays as authored; only the chrome is bilingual. */
		const ZH = typeof navigator !== "undefined" && /^zh/i.test(navigator.language || "");

		/**
		 * Pick Chinese or English chrome copy.
		 * @param zh - Chinese text.
		 * @param en - English text.
		 * @returns the active language's text.
		 */
		function T(zh, en) {
			return ZH ? zh : en;
		}

		/** Theme-neutral colors read from the hosting shell. */
		const C = {
			text: "var(--dsw-alias-label-primary, inherit)",
			secondary: "var(--dsw-alias-label-secondary, inherit)",
			tertiary: "var(--dsw-alias-label-tertiary, inherit)",
			border: "var(--dsw-alias-border-l2, rgba(127,127,127,0.22))",
			hover: "var(--dsw-alias-interactive-bg-hover, rgba(127,127,127,0.08))",
			card: "var(--dsw-hovercard-bg, rgba(28,32,30,0.98))",
			accent: "var(--dsw-alias-link, #4d6bfe)",
			shadow: "var(--dsw-elevation-panel, 0 18px 48px rgba(0,0,0,0.28))",
			mono: "ui-monospace, SFMono-Regular, Consolas, 'Liberation Mono', Menlo, monospace",
		};

		/** Friendly labels for the registry's source keys. */
		const SOURCE_LABELS = {
			"user-dsh": T("DSH 用户目录", "DSH home"),
			"user-agents": T("共享 agents 目录", "Shared agents"),
			"project-dsh": T("项目 .dsh", "Project .dsh"),
			"project-agents": T("项目 .agents", "Project .agents"),
			custom: T("自定义目录", "Custom"),
			bundled: T("内置", "Bundled"),
			runtime: T("运行时注册", "Runtime"),
		};

		/**
		 * Human label for one source key.
		 * @param source - registry source key.
		 * @returns the label shown on a badge.
		 */
		function sourceLabel(source) {
			return SOURCE_LABELS[source] || source || T("未知来源", "Unknown");
		}

		//#region fuzzy search
		/**
		 * Score one text against a lowercase query by subsequence matching.
		 * Contiguous runs and matches at word boundaries score higher.
		 * @param text - haystack, already lowercased.
		 * @param query - needle, already lowercased.
		 * @returns a positive score, or -1 when the query is not a subsequence.
		 */
		function subsequenceScore(text, query) {
			let cursor = 0;
			let score = 0;
			let run = 0;
			for (const ch of query) {
				const at = text.indexOf(ch, cursor);
				if (at < 0) return -1;
				run = at === cursor ? run + 1 : 0;
				score += 1 + (run > 0 ? run * 3 : 0);
				const before = at === 0 ? "" : text[at - 1];
				if (before === "" || before === "-" || before === " " || before === "_" || before === ".") score += 4;
				cursor = at + 1;
			}
			return score - text.length * 0.02 - query.length * 0.1;
		}

		/**
		 * Rank skills for one query and source filter.
		 * @param skills - the catalog.
		 * @param query - raw user input.
		 * @param source - active source key, or "all".
		 * @returns the ranked skills.
		 */
		function rankSkills(skills, query, source) {
			const needle = query.trim().toLowerCase();
			const pool = source === "all" ? skills : skills.filter((skill) => skill.source === source);
			if (needle === "") {
				return [...pool].sort((a, b) => a.name.localeCompare(b.name));
			}
			const ranked = [];
			for (const skill of pool) {
				const name = skill.name.toLowerCase();
				const description = skill.description.toLowerCase();
				const when = skill.whenToUse.toLowerCase();
				const best = Math.max(
					subsequenceScore(name, needle) + (name.startsWith(needle) ? 30 : 0),
					description.includes(needle) ? 14 : -1,
					when.includes(needle) ? 10 : -1,
				);
				if (best > -1) ranked.push({ skill, score: best });
			}
			return ranked
				.sort((a, b) => b.score - a.score || a.skill.name.localeCompare(b.skill.name))
				.map((row) => row.skill);
		}
		//#endregion

		//#region clipboard
		/**
		 * Copy one skill name, falling back to a hidden textarea.
		 * @param name - the exact skill name.
		 * @returns whether the copy was attempted successfully.
		 */
		async function copyName(name) {
			try {
				await navigator.clipboard.writeText(name);
				return true;
			} catch {}
			try {
				const area = document.createElement("textarea");
				area.value = name;
				area.setAttribute("readonly", "");
				area.style.position = "fixed";
				area.style.opacity = "0";
				document.body.appendChild(area);
				area.select();
				const ok = document.execCommand("copy");
				area.remove();
				return ok;
			} catch {
				return false;
			}
		}
		//#endregion

		//#region view
		/** Sidebar row icon. */
		function SkillMenuIcon({ size }) {
			return react_jsx_runtime.jsx(_deepseek_ai_dsh_client_ui_primitives.IconSkillOutlineRegular, {
				size: size ?? 16,
			});
		}

		/**
		 * Render the floating detail card for the hovered row.
		 * @param props - hover state.
		 * @returns the portal element, or nothing.
		 */
		function HoverCard({ hover }) {
			if (hover === null) return null;
			const { skill, left, top } = hover;
			const jsx = react_jsx_runtime.jsx;
			const jsxs = react_jsx_runtime.jsxs;
			return react_dom.createPortal(
				jsxs("div", {
					style: {
						position: "fixed",
						left,
						top,
						width: "440px",
						maxWidth: "calc(100vw - 32px)",
						maxHeight: "340px",
						overflow: "hidden",
						zIndex: 80,
						padding: "14px 16px",
						borderRadius: "12px",
						border: `1px solid ${C.border}`,
						background: C.card,
						boxShadow: C.shadow,
						color: C.text,
						pointerEvents: "none",
					},
					children: [
						jsxs("div", {
							style: { display: "flex", alignItems: "baseline", gap: "8px", flexWrap: "wrap" },
							children: [
								jsx("span", {
									style: { fontFamily: C.mono, fontSize: "13px", fontWeight: 600, color: C.accent },
									children: skill.name,
								}),
								jsx("span", {
									style: {
										fontSize: "11px",
										color: C.secondary,
										border: `1px solid ${C.border}`,
										borderRadius: "999px",
										padding: "1px 8px",
									},
									children: sourceLabel(skill.source),
								}),
							],
						}),
						jsx("p", {
							style: { margin: "8px 0 0", fontSize: "13px", lineHeight: "21px", color: C.text },
							children: skill.description || T("（技能未提供简介）", "(no description)"),
						}),
						skill.whenToUse === ""
							? null
							: jsxs("p", {
									style: { margin: "6px 0 0", fontSize: "12px", lineHeight: "18px", color: C.secondary },
									children: [T("何时使用：", "When to use: "), skill.whenToUse],
								}),
						skill.path === ""
							? null
							: jsx("p", {
									style: {
										margin: "8px 0 0",
										fontSize: "11px",
										lineHeight: "16px",
										color: C.tertiary,
										fontFamily: C.mono,
										wordBreak: "break-all",
									},
									children: skill.path,
								}),
						jsx("p", {
							style: { margin: "8px 0 0", fontSize: "11px", color: C.tertiary },
							children: T("点击卡片任意位置即可复制名称", "Click anywhere on the card to copy the name"),
						}),
					],
				}),
				document.body,
			);
		}

		/**
		 * Render one skill row.
		 * @param props - skill, copy state, and handlers.
		 * @returns the row element.
		 */
		function SkillRow({ skill, copied, onCopy, onHover, onLeave }) {
			const jsx = react_jsx_runtime.jsx;
			const jsxs = react_jsx_runtime.jsxs;
			const isCopied = copied === skill.name;
			return jsxs("article", {
				role: "button",
				tabIndex: 0,
				"aria-label": `${T("复制", "Copy")} ${skill.name}`,
				onMouseEnter: (event) => onHover(skill, event.currentTarget.getBoundingClientRect()),
				onMouseLeave: onLeave,
				onFocus: (event) => onHover(skill, event.currentTarget.getBoundingClientRect()),
				onBlur: onLeave,
				onClick: () => onCopy(skill.name),
				onKeyDown: (event) => {
					if (event.key === "Enter" || event.key === " ") {
						event.preventDefault();
						onCopy(skill.name);
					}
				},
				style: {
					display: "flex",
					gap: "14px",
					alignItems: "flex-start",
					padding: "12px 14px",
					borderRadius: "10px",
					border: `1px solid ${isCopied ? C.accent : "transparent"}`,
					background: isCopied ? C.hover : "transparent",
					cursor: "pointer",
					outline: "none",
				},
				children: [
					jsxs("div", {
						style: { flex: "1 1 auto", minWidth: 0 },
						children: [
							jsxs("div", {
								style: { display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" },
								children: [
									jsx("span", {
										style: { fontFamily: C.mono, fontSize: "13px", fontWeight: 600, color: C.accent },
										children: skill.name,
									}),
									jsx("span", {
										style: {
											fontSize: "11px",
											color: C.secondary,
											border: `1px solid ${C.border}`,
											borderRadius: "999px",
											padding: "0 8px",
											lineHeight: "18px",
										},
										children: sourceLabel(skill.source),
									}),
									skill.modelInvocable
										? null
										: jsx("span", {
												style: {
													fontSize: "11px",
													color: C.tertiary,
													border: `1px dashed ${C.border}`,
													borderRadius: "999px",
													padding: "0 8px",
													lineHeight: "18px",
												},
												children: T("仅手动", "Manual only"),
											}),
								],
							}),
							jsx("p", {
								style: {
									margin: "5px 0 0",
									fontSize: "13px",
									lineHeight: "20px",
									color: C.text,
									display: "-webkit-box",
									WebkitLineClamp: 2,
									WebkitBoxOrient: "vertical",
									overflow: "hidden",
								},
								children: skill.description || T("（技能未提供简介）", "(no description)"),
							}),
							skill.whenToUse === ""
								? null
								: jsx("p", {
										style: {
											margin: "3px 0 0",
											fontSize: "12px",
											lineHeight: "18px",
											color: C.tertiary,
											display: "-webkit-box",
											WebkitLineClamp: 1,
											WebkitBoxOrient: "vertical",
											overflow: "hidden",
										},
										children: skill.whenToUse,
									}),
						],
					}),
					jsx("button", {
						type: "button",
						onClick: (event) => {
							event.stopPropagation();
							onCopy(skill.name);
						},
						style: {
							flex: "0 0 auto",
							marginTop: "2px",
							padding: "4px 10px",
							borderRadius: "7px",
							border: `1px solid ${isCopied ? C.accent : C.border}`,
							background: "transparent",
							color: isCopied ? C.accent : C.secondary,
							fontSize: "12px",
							cursor: "pointer",
						},
						children: isCopied ? T("已复制 ✓", "Copied ✓") : T("复制", "Copy"),
					}),
				],
			});
		}

		/**
		 * Read the catalog from the host route.
		 * @returns the skill rows.
		 */
		async function fetchCatalog() {
			const response = await fetch(CATALOG_URL, { headers: { accept: "application/json" } });
			if (!response.ok) throw new Error(`HTTP ${response.status}`);
			const body = await response.json();
			if (!Array.isArray(body.skills)) throw new Error("malformed catalog response");
			return body.skills.map((row) => ({
				name: String(row.name ?? ""),
				description: String(row.description ?? ""),
				whenToUse: String(row.whenToUse ?? ""),
				source: String(row.source ?? ""),
				path: String(row.path ?? ""),
				modelInvocable: row.modelInvocable !== false,
			}));
		}

		/** The full-page panel. */
		function SkillMenuPage() {
			const jsx = react_jsx_runtime.jsx;
			const jsxs = react_jsx_runtime.jsxs;
			const [status, setStatus] = react.useState("loading");
			const [skills, setSkills] = react.useState([]);
			const [failure, setFailure] = react.useState("");
			const [query, setQuery] = react.useState("");
			const [source, setSource] = react.useState("all");
			const [copied, setCopied] = react.useState("");
			const [hover, setHover] = react.useState(null);
			const [attempt, setAttempt] = react.useState(0);
			const timer = react.useRef(0);

			react.useEffect(() => {
				let alive = true;
				setStatus("loading");
				fetchCatalog()
					.then((rows) => {
						if (!alive) return;
						setSkills(rows);
						setStatus("ready");
					})
					.catch((error) => {
						if (!alive) return;
						setFailure(String(error?.message ?? error));
						setStatus("error");
					});
				return () => {
					alive = false;
				};
			}, [attempt]);

			react.useEffect(() => () => window.clearTimeout(timer.current), []);

			const sources = react.useMemo(() => {
				const counts = new Map();
				for (const skill of skills) counts.set(skill.source, (counts.get(skill.source) ?? 0) + 1);
				return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
			}, [skills]);
			const rows = react.useMemo(() => rankSkills(skills, query, source), [skills, query, source]);

			const handleCopy = (name) => {
				copyName(name).then((ok) => {
					if (!ok) return;
					setCopied(name);
					window.clearTimeout(timer.current);
					timer.current = window.setTimeout(() => setCopied(""), 1600);
				});
			};
			const handleHover = (skill, rect) => {
				const width = 440;
				const left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12));
				const below = rect.bottom + 8;
				const top = below + 320 > window.innerHeight ? Math.max(12, rect.top - 320) : below;
				setHover({ skill, left, top });
			};

			const chip = (key, label, count) =>
				jsx(
					"button",
					{
						type: "button",
						onClick: () => setSource(key),
						style: {
							padding: "4px 11px",
							borderRadius: "999px",
							border: `1px solid ${source === key ? C.accent : C.border}`,
							background: source === key ? C.hover : "transparent",
							color: source === key ? C.accent : C.secondary,
							fontSize: "12px",
							lineHeight: "18px",
							cursor: "pointer",
						},
						children: `${label} ${count}`,
					},
					key,
				);

			return jsxs("div", {
				style: {
					height: "100%",
					display: "flex",
					flexDirection: "column",
					minHeight: 0,
					background: "transparent",
					color: C.text,
				},
				children: [
					jsxs("header", {
						style: {
							flex: "0 0 auto",
							padding: "22px 28px 14px",
							display: "grid",
							gap: "12px",
							borderBottom: `1px solid ${C.border}`,
						},
						children: [
							jsxs("div", {
								style: { display: "flex", alignItems: "baseline", gap: "10px", flexWrap: "wrap" },
								children: [
									jsx("h1", {
										style: { margin: 0, fontSize: "19px", lineHeight: "26px", fontWeight: 650, letterSpacing: "-0.01em" },
										children: T("技能菜单", "Skills"),
									}),
									jsx("span", {
										style: { fontSize: "12px", color: C.tertiary },
										children:
											status === "ready"
												? T(
														`${skills.length} 个技能 · 点击卡片或「复制」即可复制名称`,
														`${skills.length} skills · click a card or Copy to copy the name`,
													)
												: T("正在读取技能…", "Loading skills…"),
									}),
									jsx("button", {
										type: "button",
										onClick: () => setAttempt((value) => value + 1),
										style: {
											marginLeft: "auto",
											padding: "3px 10px",
											borderRadius: "7px",
											border: `1px solid ${C.border}`,
											background: "transparent",
											color: C.secondary,
											fontSize: "12px",
											cursor: "pointer",
										},
										children: T("刷新", "Refresh"),
									}),
								],
							}),
							jsxs("div", {
								style: {
									display: "flex",
									alignItems: "center",
									gap: "8px",
									padding: "0 10px",
									borderRadius: "10px",
									border: `1px solid ${C.border}`,
									background: C.hover,
								},
								children: [
									jsx(_deepseek_ai_dsh_client_ui_primitives.IconSearchOutlineRegular, {
										size: 15,
										style: { color: C.tertiary, flex: "0 0 auto" },
									}),
									jsx("input", {
										value: query,
										onChange: (event) => setQuery(event.target.value),
										placeholder: T(
											"搜索：名称、简介、适用场景（支持模糊匹配，如 dsgn → design）",
											"Search name, description, or when-to-use (fuzzy: dsgn → design)",
										),
										style: {
											flex: "1 1 auto",
											minWidth: 0,
											padding: "9px 0",
											border: "none",
											outline: "none",
											background: "transparent",
											color: "inherit",
											font: "inherit",
											fontSize: "13px",
										},
									}),
									query === ""
										? null
										: jsx("button", {
												type: "button",
												onClick: () => setQuery(""),
												style: {
													border: "none",
													background: "transparent",
													color: C.tertiary,
													fontSize: "12px",
													cursor: "pointer",
													padding: "2px 4px",
												},
												children: T("清空", "Clear"),
											}),
								],
							}),
							status === "ready" && sources.length > 1
								? jsxs("div", {
										style: { display: "flex", gap: "6px", flexWrap: "wrap" },
										children: [
											chip("all", T("全部", "All"), skills.length),
											...sources.map(([key, count]) => chip(key, sourceLabel(key), count)),
										],
									})
								: null,
						],
					}),
					jsx("div", {
						style: { flex: "1 1 auto", minHeight: 0, overflowY: "auto", padding: "10px 18px 24px" },
						children:
							status === "loading"
								? jsx("p", {
										style: { padding: "40px 0", textAlign: "center", color: C.tertiary, fontSize: "13px" },
										children: T("正在读取技能目录…", "Reading the skill catalog…"),
									})
								: status === "error"
									? jsxs("div", {
											style: { padding: "40px 0", textAlign: "center", color: C.tertiary, fontSize: "13px" },
											children: [
												jsx("p", { style: { margin: 0 }, children: T("读取技能失败：", "Could not read skills: ") + failure }),
												jsx("button", {
													type: "button",
													onClick: () => setAttempt((value) => value + 1),
													style: {
														marginTop: "10px",
														padding: "4px 12px",
														borderRadius: "7px",
														border: `1px solid ${C.border}`,
														background: "transparent",
														color: C.secondary,
														fontSize: "12px",
														cursor: "pointer",
													},
													children: T("重试", "Retry"),
												}),
											],
										})
									: skills.length === 0
										? jsxs("div", {
												style: { padding: "40px 0", textAlign: "center", color: C.tertiary, fontSize: "13px", lineHeight: "22px" },
												children: [
													jsx("p", { style: { margin: 0 }, children: T("还没有发现任何技能。", "No skills found yet.") }),
													jsx("p", {
														style: { margin: "6px 0 0" },
														children: T(
															"把技能目录（含 SKILL.md）放到 ~/.dsh/skills/ 下，或安装 DSH 技能插件后点「刷新」。",
															"Put skill folders (each with a SKILL.md) under ~/.dsh/skills/, or install a skill plugin, then press Refresh.",
														),
													}),
												],
											})
										: rows.length === 0
											? jsx("p", {
													style: { padding: "40px 0", textAlign: "center", color: C.tertiary, fontSize: "13px" },
													children: T("没有匹配的技能，换个关键词试试。", "No match. Try another keyword."),
												})
											: jsx("div", {
													style: { display: "grid", gap: "2px", maxWidth: "920px", margin: "0 auto" },
													children: rows.map((skill) =>
														jsx(
															SkillRow,
															{
																skill,
																copied,
																onCopy: handleCopy,
																onHover: handleHover,
																onLeave: () => setHover(null),
															},
															skill.name,
														),
													),
												}),
					}),
					jsx(HoverCard, { hover }),
				],
			});
		}

		/** Mount the sidebar row and the main panel. */
		function apply(ctx) {
			try {
				ctx.effect(
					() =>
						ctx.slots.inject("main", () =>
							ctx.slots.register({ name: "main", key: PANEL_ID }, SkillMenuPage),
						),
					"skill-menu:page",
				);
				ctx.effect(
					() =>
						ctx.slots.inject("sidebar.panellist", () =>
							ctx.slots.register(
								{
									name: "sidebar.panellist",
									id: PANEL_ID,
									order: 5,
									label: T("技能菜单", "Skills"),
								},
								SkillMenuIcon,
							),
						),
					"skill-menu:sidebar",
				);
			} catch (error) {
				// A UI-only plugin must never block application boot.
				console.error("[skill-menu] activation failed; panel disabled", error);
			}
		}
		//#endregion

		exports.PANEL_ID = PANEL_ID;
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	},
});
