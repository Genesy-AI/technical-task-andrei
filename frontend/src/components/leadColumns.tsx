import { ReactNode } from 'react'
import { LeadsGetManyOutput } from '../api/types/leads/getMany'
import { PhoneCell } from './PhoneCell'

export type Lead = LeadsGetManyOutput[number]

export interface LeadColumn {
  key: string
  header: string
  // Classes for the <td>. Defaults to DEFAULT_CELL_CLASS.
  cellClassName?: string
  render: (lead: Lead) => ReactNode
}

export const DEFAULT_CELL_CLASS = 'px-6 py-4 whitespace-nowrap'

const formatDate = (dateString: string) =>
  new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })

const Text = ({ children }: { children: ReactNode }) => (
  <div className="text-sm text-gray-900">{children}</div>
)

// Shows "-" for null/undefined/empty string, but keeps 0.
const orDash = (value: string | number | null | undefined) =>
  value === null || value === undefined || value === '' ? '-' : value

// To add a column: add one entry here. Order = order in the table.
export const LEAD_COLUMNS: LeadColumn[] = [
  {
    key: 'name',
    header: 'Name',
    render: (lead) => (
      <div className="text-sm font-medium text-gray-900">
        {lead.firstName} {lead.lastName || ''}
      </div>
    ),
  },
  {
    key: 'email',
    header: 'Email',
    render: (lead) => (
      <Text>
        {orDash(lead.email)} {lead.emailVerified === null ? '❓' : lead.emailVerified ? '✅' : '❌'}
      </Text>
    ),
  },
  {
    key: 'phoneNumber',
    header: 'Phone',
    render: (lead) => <PhoneCell lead={lead} />,
  },
  {
    key: 'linkedinUrl',
    header: 'LinkedIn',
    render: (lead) =>
      lead.linkedinUrl ? (
        <a
          href={lead.linkedinUrl}
          target="_blank"
          rel="noopener noreferrer"
          title={lead.linkedinUrl}
          className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
        >
          Profile ↗
        </a>
      ) : (
        <Text>-</Text>
      ),
  },
  {
    key: 'jobTitle',
    header: 'Job Title',
    render: (lead) => <Text>{orDash(lead.jobTitle)}</Text>,
  },
  {
    key: 'companyName',
    header: 'Company',
    render: (lead) => <Text>{orDash(lead.companyName)}</Text>,
  },
  {
    key: 'yearsAtCompany',
    header: 'Years at Company',
    render: (lead) => <Text>{orDash(lead.yearsAtCompany)}</Text>,
  },
  {
    key: 'countryCode',
    header: 'Country',
    render: (lead) => <Text>{orDash(lead.countryCode)}</Text>,
  },
  {
    key: 'message',
    header: 'Message',
    cellClassName: 'px-6 py-4',
    render: (lead) => (
      <div className="text-sm text-gray-900 max-w-xs truncate" title={lead.message || ''}>
        {orDash(lead.message)}
      </div>
    ),
  },
  {
    key: 'createdAt',
    header: 'Created',
    cellClassName: 'px-6 py-4 whitespace-nowrap text-sm text-gray-500',
    render: (lead) => formatDate(lead.createdAt),
  },
]
