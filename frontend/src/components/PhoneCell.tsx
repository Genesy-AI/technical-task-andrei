import { FC } from 'react'
import type { PhoneProvider } from '../api/types/leads/getMany'
import type { Lead } from './leadColumns'
import { isLookupStuck } from '../utils/phoneEnrichment'

const PROVIDER_LABEL: Record<PhoneProvider, string> = {
  ORION: 'Orion',
  ASTRA: 'Astra',
  NIMBUS: 'Nimbus',
}

const Busy: FC<{ label: string }> = ({ label }) => (
  <div role="status" className="flex items-center gap-2 text-sm text-blue-700">
    <span
      aria-hidden="true"
      className="h-3 w-3 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600"
    />
    {label}
  </div>
)

/** Phone column: the number (and who found it), or the live enrichment state. */
export const PhoneCell: FC<{ lead: Lead }> = ({ lead }) => {
  if (lead.phoneNumber) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-900">
        <span>{lead.phoneNumber}</span>
        {lead.phoneSource && (
          <span
            title={`Found by ${PROVIDER_LABEL[lead.phoneSource]}`}
            className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-600"
          >
            {PROVIDER_LABEL[lead.phoneSource]}
          </span>
        )}
      </div>
    )
  }

  if (isLookupStuck(lead)) {
    return (
      <div
        className="text-sm text-red-600 underline decoration-dotted"
        title="The phone lookup did not finish. Select the lead and run Enrich Phone again."
      >
        Timed out
      </div>
    )
  }

  switch (lead.phoneEnrichmentStatus) {
    case 'PENDING':
      return <Busy label="Pending…" />
    case 'RUNNING':
      return (
        <Busy
          label={
            lead.phoneEnrichmentProvider
              ? `Checking ${PROVIDER_LABEL[lead.phoneEnrichmentProvider]}…`
              : 'Searching…'
          }
        />
      )
    case 'NO_DATA':
      return <div className="text-sm italic text-gray-500">No data found</div>
    case 'FAILED':
      return (
        <div
          className="text-sm text-red-600 underline decoration-dotted"
          title={lead.phoneEnrichmentError || 'Phone enrichment failed'}
        >
          Failed
        </div>
      )
    default:
      return <div className="text-sm text-gray-900">-</div>
  }
}
