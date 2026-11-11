export interface LeadsBulkImportInput {
  leads: {
    firstName: string
    lastName: string
    email: string
    jobTitle?: string
    countryCode?: string
    companyName?: string
    phoneNumber?: string
    yearsAtCompany?: number
    linkedinUrl?: string
  }[]
}

export interface LeadsBulkImportOutput {
  success: boolean
  importedCount: number
  duplicatesSkipped: number
  invalidLeads: number
  errors: Array<{
    lead: any
    error: string
  }>
  /** Optional values the server did not store because they were not valid. */
  warnings?: Array<{
    index: number
    email: string
    field: string
    message: string
  }>
}
