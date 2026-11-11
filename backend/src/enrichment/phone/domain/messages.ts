// Texts that reach the user (stored on the lead, returned by the API).
// Never put provider or infrastructure details here: those stay in Temporal history and server logs.
export const USER_MESSAGES = {
  lookupFailed: 'Phone lookup failed. Please try again later.',
  startFailed: 'Could not start phone lookup. Please try again.',
} as const
