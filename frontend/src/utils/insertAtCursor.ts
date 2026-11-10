// Inserts `token` into `text` at the selection [start, end], replacing any
// selected text. Returns the new text and the cursor position after the token.
export const insertAtCursor = (
  text: string,
  start: number,
  end: number,
  token: string
): { text: string; cursor: number } => {
  const from = Math.min(start, end)
  const to = Math.max(start, end)
  return {
    text: text.slice(0, from) + token + text.slice(to),
    cursor: from + token.length,
  }
}
