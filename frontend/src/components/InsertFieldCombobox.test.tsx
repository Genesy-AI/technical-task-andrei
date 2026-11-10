import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { InsertFieldCombobox } from './InsertFieldCombobox'
import { TemplateField } from '../api/types/leads/templateFields'

const fields: TemplateField[] = [
  { key: 'firstName', label: 'First name', group: 'person' },
  { key: 'companyName', label: 'Company', group: 'company' },
  { key: 'yearsAtCompany', label: 'Years at company', group: 'company' },
  { key: 'phoneNumber', label: 'Phone number', group: 'contact' },
  { key: 'linkedinUrl', label: 'LinkedIn URL', group: 'contact' },
]

const setup = (props: Partial<Parameters<typeof InsertFieldCombobox>[0]> = {}) => {
  const onSelect = vi.fn()
  const user = userEvent.setup()
  render(<InsertFieldCombobox fields={fields} onSelect={onSelect} {...props} />)
  const input = screen.getByRole('combobox', { name: /insert field/i })
  return { user, onSelect, input }
}

const optionNames = () => screen.queryAllByRole('option').map((option) => option.textContent)

describe('InsertFieldCombobox', () => {
  it('shows all fields grouped under headings when focused', async () => {
    const { user, input } = setup()
    await user.click(input)

    expect(screen.getAllByRole('option')).toHaveLength(5)
    expect(screen.getByText('Person')).toBeInTheDocument()
    expect(screen.getByText('Company', { selector: '[data-group-heading]' })).toBeInTheDocument()
    expect(screen.getByText('Contact')).toBeInTheDocument()
  })

  it('shows the placeholder token next to each label', async () => {
    const { user, input } = setup()
    await user.click(input)

    expect(screen.getByRole('option', { name: /phone number/i })).toHaveTextContent('{phoneNumber}')
  })

  it('filters by label as you type', async () => {
    const { user, input } = setup()
    await user.type(input, 'pho')

    expect(optionNames()).toEqual([expect.stringContaining('Phone number')])
  })

  it('filters by key too, ignoring case', async () => {
    const { user, input } = setup()
    await user.type(input, 'LINKEDINURL')

    expect(optionNames()).toEqual([expect.stringContaining('LinkedIn URL')])
  })

  it('hides group headings that have no matches', async () => {
    const { user, input } = setup()
    await user.type(input, 'pho')

    expect(screen.queryByText('Person')).not.toBeInTheDocument()
    expect(screen.getByText('Contact')).toBeInTheDocument()
  })

  it('shows an empty state when nothing matches', async () => {
    const { user, input } = setup()
    await user.type(input, 'zzz')

    expect(screen.queryAllByRole('option')).toHaveLength(0)
    expect(screen.getByText('No fields match')).toBeInTheDocument()
  })

  it('selects the first match with Enter and clears the search', async () => {
    const { user, input, onSelect } = setup()
    await user.type(input, 'pho{Enter}')

    expect(onSelect).toHaveBeenCalledWith('phoneNumber')
    expect(input).toHaveValue('')
  })

  it('selects with arrow keys', async () => {
    const { user, input, onSelect } = setup()
    await user.type(input, 'comp')
    await user.keyboard('{ArrowDown}{Enter}')

    expect(onSelect).toHaveBeenCalledWith('yearsAtCompany')
  })

  it('selects on click', async () => {
    const { user, input, onSelect } = setup()
    await user.click(input)
    await user.click(screen.getByRole('option', { name: /linkedin url/i }))

    expect(onSelect).toHaveBeenCalledWith('linkedinUrl')
  })

  it('closes the list with Escape', async () => {
    const { user, input } = setup()
    await user.click(input)
    expect(screen.getAllByRole('option').length).toBeGreaterThan(0)

    await user.keyboard('{Escape}')

    expect(screen.queryAllByRole('option')).toHaveLength(0)
  })

  it('is disabled with a loading hint while fields load', () => {
    const { input } = setup({ fields: [], isLoading: true })

    expect(input).toBeDisabled()
    expect(input).toHaveAttribute('placeholder', 'Loading fields…')
  })

  it('is disabled with an error hint when fields fail to load', () => {
    const { input } = setup({ fields: [], isError: true })

    expect(input).toBeDisabled()
    expect(input).toHaveAttribute('placeholder', "Couldn't load fields")
  })
})
