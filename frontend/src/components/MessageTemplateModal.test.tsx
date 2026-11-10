import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MessageTemplateModal } from './MessageTemplateModal'
import { api } from '../api'

vi.mock('../api', () => ({
  api: {
    leads: {
      templateFields: vi.fn(),
      generateMessages: vi.fn(),
    },
  },
}))

const templateFields = vi.mocked(api.leads.templateFields)

const renderModal = () => {
  const onClose = vi.fn()
  const user = userEvent.setup()
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <MessageTemplateModal isOpen onClose={onClose} selectedLeadIds={[1]} selectedLeadsCount={1} />
    </QueryClientProvider>
  )
  const textarea = screen.getByLabelText('Message Template') as HTMLTextAreaElement
  const combobox = screen.getByRole('combobox', { name: /insert field/i })
  return { user, onClose, textarea, combobox }
}

describe('MessageTemplateModal - insert field', () => {
  beforeEach(() => {
    templateFields.mockReset()
    templateFields.mockResolvedValue([
      { key: 'firstName', label: 'First name', group: 'person' },
      { key: 'phoneNumber', label: 'Phone number', group: 'contact' },
      { key: 'brandNewField', label: 'Brand new field', group: 'company' },
    ])
  })

  it('lists the fields returned by the API', async () => {
    const { user, combobox } = renderModal()
    await waitFor(() => expect(combobox).toBeEnabled())

    await user.click(combobox)

    expect(screen.getByRole('option', { name: /brand new field/i })).toBeInTheDocument()
  })

  it('inserts the picked field at the caret and puts the caret after it', async () => {
    const { user, textarea, combobox } = renderModal()
    await waitFor(() => expect(combobox).toBeEnabled())

    await user.type(textarea, 'Hi , bye')
    textarea.setSelectionRange(3, 3)
    await user.type(combobox, 'pho{Enter}')

    expect(textarea).toHaveValue('Hi {phoneNumber}, bye')
    await waitFor(() => expect(textarea).toHaveFocus())
    expect(textarea.selectionStart).toBe('Hi {phoneNumber}'.length)
  })

  it('closes only the field list, not the modal, on Escape', async () => {
    const { user, onClose, combobox } = renderModal()
    await waitFor(() => expect(combobox).toBeEnabled())

    await user.click(combobox)
    await user.keyboard('{Escape}')

    expect(screen.queryAllByRole('option')).toHaveLength(0)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('still lets the user write a template when fields fail to load', async () => {
    templateFields.mockRejectedValue(new Error('network'))
    const { user, textarea, combobox } = renderModal()

    await waitFor(() => expect(combobox).toHaveAttribute('placeholder', "Couldn't load fields"))
    await user.type(textarea, 'Hello')

    expect(textarea).toHaveValue('Hello')
  })

  it('no longer shows the hardcoded chip buttons', async () => {
    renderModal()

    expect(screen.queryByRole('button', { name: '{firstName}' })).not.toBeInTheDocument()
  })
})
