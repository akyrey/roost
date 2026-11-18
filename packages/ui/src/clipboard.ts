/** Copies text to the system clipboard. Rejects when the webview refuses. */
export function copyText(text: string): Promise<void> {
  return navigator.clipboard.writeText(text);
}
