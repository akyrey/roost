/** Typographic quotes in SQL. macOS "smart quotes" can turn `"` into `“` while typing; SQL
 * only understands straight quotes, so the server reports a confusing syntax error. */
const DOUBLE = /[“”„‟″]/g;
const SINGLE = /[‘’‚‛′]/g;

export function hasTypographicQuotes(text: string): boolean {
  return /[“-‟‘-‛′″]/.test(text);
}

export function straightenQuotes(text: string): string {
  return text.replace(DOUBLE, '"').replace(SINGLE, "'");
}

/** Attributes that stop the webview substituting quotes, dashes and spelling in SQL inputs. */
export const NO_TEXT_SUBSTITUTION = {
  autoCorrect: "off",
  autoCapitalize: "off",
  autoComplete: "off",
  spellCheck: false,
} as const;
