/**
 * Global persona: one user-owned personality prompt, contributed to every
 * session's system prompt.
 *
 * The text lives in this row's own config (`persona`), marked volatile so the
 * Settings document may write it. `dsh-settings` persists a write through the
 * active profile's patch and applies it immediately, so the next request of
 * every session — including sessions that were already running — assembles the
 * new persona. The section text is resolved per assembly from the live config
 * reference, so an in-place update is visible without remounting the row.
 *
 * Placement: right after the deployment persona prefix (order 0), so the
 * persona reads as an identity statement rather than a footnote. An empty value
 * contributes no section: the prompt renderer drops empty text.
 *
 * @module dsh-global-persona
 */
import z from "@deepseek-ai/schemastery";

/** Cordis plugin name. */
export const name = "global-persona";

/** The prompt registry this row contributes to. */
export const inject = ["systemPrompt"];

/** Runtime schema for the row. `persona` is the editable text. */
export const Config = z.object({
  persona: z.string().default("").volatile(),
});

/** Prompt section name. Stable so a later reload replaces the same slot. */
const SECTION_NAME = "user:global-persona";

/**
 * Read the current persona text from a config value that may be a plain string
 * or a volatile reference (`.volatile()` wraps the value).
 * @param value - the row's `persona` config entry.
 * @returns the trimmed text, or an empty string when unset.
 */
function personaText(value) {
  const text =
    typeof value === "string"
      ? value
      : value !== null && typeof value === "object" && typeof value.get === "function"
        ? value.get()
        : "";
  return typeof text === "string" ? text.trim() : "";
}

/**
 * Register the persona section for the deployment scope.
 * @param ctx - the plugin context.
 * @param config - the row configuration.
 */
export function apply(ctx, config) {
  ctx.effect(
    () =>
      ctx.systemPrompt.section({
        name: SECTION_NAME,
        order: ctx.systemPrompt.getSectionOrder
          ? ctx.systemPrompt.getSectionOrder("DEPLOYMENT_PERSONA_PREFIX") + 1
          : 1,
        // User prose is literal: braces in code samples or JSON must not be
        // parsed as prompt-template variables (an unknown reference would
        // otherwise fail assembly before every request).
        interpolate: false,
        text: () => personaText(config?.persona),
      }),
    "global-persona.section()",
  );
}
