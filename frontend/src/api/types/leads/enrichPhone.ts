export type LeadsEnrichPhoneInput = {
  leadIds: number[]
}

export type EnrichPhoneSkipReason = 'not_found' | 'already_has_phone' | 'already_running'

/** 202 response: workflows run in the background, progress is on each lead. */
export type LeadsEnrichPhoneOutput = {
  started: number[]
  skipped: Array<{ leadId: number; reason: EnrichPhoneSkipReason }>
  /** Leads that could not be started. No error details: those stay on the server. */
  errors: Array<{ leadId: number }>
}
