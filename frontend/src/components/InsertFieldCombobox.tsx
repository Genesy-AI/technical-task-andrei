import { FC, Fragment, useState } from 'react'
import { Combobox, ComboboxInput, ComboboxOption, ComboboxOptions } from '@headlessui/react'
import { TemplateField, TemplateFieldGroup } from '../api/types/leads/templateFields'

interface InsertFieldComboboxProps {
  fields: TemplateField[]
  onSelect: (key: string) => void
  isLoading?: boolean
  isError?: boolean
}

const GROUPS: { key: TemplateFieldGroup; label: string }[] = [
  { key: 'person', label: 'Person' },
  { key: 'company', label: 'Company' },
  { key: 'contact', label: 'Contact' },
]

const matches = (field: TemplateField, query: string) => {
  const q = query.trim().toLowerCase()
  return !q || field.label.toLowerCase().includes(q) || field.key.toLowerCase().includes(q)
}

export const InsertFieldCombobox: FC<InsertFieldComboboxProps> = ({
  fields,
  onSelect,
  isLoading,
  isError,
}) => {
  const [query, setQuery] = useState('')

  const filtered = fields.filter((field) => matches(field, query))
  const groups = GROUPS.map((group) => ({
    ...group,
    fields: filtered.filter((field) => field.group === group.key),
  })).filter((group) => group.fields.length > 0)

  const placeholder = isLoading
    ? 'Loading fields…'
    : isError
      ? "Couldn't load fields"
      : 'Insert field… type to search'

  return (
    <Combobox<TemplateField | null>
      value={null}
      onChange={(field) => {
        if (!field) return
        onSelect(field.key)
        setQuery('')
      }}
      onClose={() => setQuery('')}
      disabled={isLoading || isError}
      immediate
    >
      <ComboboxInput
        aria-label="Insert field"
        placeholder={placeholder}
        displayValue={() => query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-64 px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
      />
      <ComboboxOptions
        anchor="bottom start"
        className="z-[60] w-72 max-h-64 overflow-auto rounded-md border border-gray-200 bg-white py-1 shadow-lg [--anchor-gap:4px] empty:invisible"
      >
        {groups.length === 0 ? (
          <div className="px-3 py-2 text-sm text-gray-500">No fields match</div>
        ) : (
          groups.map((group) => (
            <Fragment key={group.key}>
              <div
                data-group-heading
                role="presentation"
                className="px-3 pt-2 pb-1 text-xs font-medium uppercase tracking-wider text-gray-400"
              >
                {group.label}
              </div>
              {group.fields.map((field) => (
                <ComboboxOption
                  key={field.key}
                  value={field}
                  className="flex cursor-pointer items-center justify-between px-3 py-1.5 text-sm text-gray-900 data-[focus]:bg-blue-50"
                >
                  <span>{field.label}</span>
                  <span className="ml-3 font-mono text-xs text-gray-400">{`{${field.key}}`}</span>
                </ComboboxOption>
              ))}
            </Fragment>
          ))
        )}
      </ComboboxOptions>
    </Combobox>
  )
}
