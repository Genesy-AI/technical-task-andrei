export type LeadsGetManyInput = undefined

export type PhoneProvider = 'ORION' | 'ASTRA' | 'NIMBUS'
export type PhoneEnrichmentStatus = 'PENDING' | 'RUNNING' | 'FOUND' | 'NO_DATA' | 'FAILED'

export type LeadsGetManyOutput = {
  id: number
  createdAt: string
  updatedAt: string
  firstName: string
  lastName: string | null
  email: string | null
  jobTitle: string | null
  countryCode: string | null
  companyName: string | null
  message: string | null
  emailVerified: boolean | null
  phoneNumber: string | null
  yearsAtCompany: number | null
  linkedinUrl: string | null
  phoneSource: PhoneProvider | null
  phoneEnrichmentStatus: PhoneEnrichmentStatus | null
  phoneEnrichmentProvider: PhoneProvider | null
  phoneEnrichmentError: string | null
  /** ISO date of the last enrichment request. */
  phoneEnrichmentRequestedAt: string | null
}[]
