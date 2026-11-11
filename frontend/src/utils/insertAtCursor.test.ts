import { describe, it, expect } from 'vitest'
import { insertAtCursor } from './insertAtCursor'

describe('insertAtCursor', () => {
  it('inserts into empty text', () => {
    expect(insertAtCursor('', 0, 0, '{firstName}')).toEqual({ text: '{firstName}', cursor: 11 })
  })

  it('inserts in the middle and puts the cursor after the token', () => {
    expect(insertAtCursor('Hi , bye', 3, 3, '{firstName}')).toEqual({
      text: 'Hi {firstName}, bye',
      cursor: 14,
    })
  })

  it('inserts at the end', () => {
    expect(insertAtCursor('Hi ', 3, 3, '{firstName}')).toEqual({ text: 'Hi {firstName}', cursor: 14 })
  })

  it('replaces the selected text', () => {
    expect(insertAtCursor('Hi NAME!', 3, 7, '{firstName}')).toEqual({ text: 'Hi {firstName}!', cursor: 14 })
  })

  it('handles a backwards selection (start after end)', () => {
    expect(insertAtCursor('Hi NAME!', 7, 3, '{firstName}')).toEqual({ text: 'Hi {firstName}!', cursor: 14 })
  })
})
