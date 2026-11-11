import { LeadsCreateInput, LeadsCreateOutput } from '../types/leads/create'
import { LeadsDeleteInput, LeadsDeleteOutput } from '../types/leads/delete'
import { LeadsDeleteManyInput, LeadsDeleteManyOutput } from '../types/leads/deleteMany'
import { LeadsGenerateMessagesInput, LeadsGenerateMessagesOutput } from '../types/leads/generateMessages'
import { LeadsGetManyInput, LeadsGetManyOutput } from '../types/leads/getMany'
import { LeadsGetOneInput, LeadsGetOneOutput } from '../types/leads/getOne'
import { LeadsUpdateInput, LeadsUpdateOutput } from '../types/leads/update'
import { LeadsBulkImportInput, LeadsBulkImportOutput } from '../types/leads/bulkImport'
import { LeadsVerifyEmailsInput, LeadsVerifyEmailsOutput } from '../types/leads/verifyEmails'
import { ApiModule, endpoint } from '../utils'

/**
 * The backend checks 5 leads at a time and stops each one after 45s at most, so a small
 * selection finishes well within this. Bigger ones may time out here while the backend keeps
 * working; the user is told to refresh.
 */
export const VERIFY_EMAILS_TIMEOUT_MS = 60_000

/** Same cap as the backend (MAX_LEADS_PER_REQUEST in parseVerifyEmailsRequest.ts). */
export const MAX_VERIFY_EMAILS = 100

export const leadsApi = {
  getMany: endpoint<LeadsGetManyOutput, LeadsGetManyInput>('get', '/leads'),
  getOne: endpoint<LeadsGetOneOutput, LeadsGetOneInput>('get', ({ id }) => `/leads/${id}`),
  create: endpoint<LeadsCreateOutput, LeadsCreateInput>('post', '/leads'),
  delete: endpoint<LeadsDeleteOutput, LeadsDeleteInput>('delete', ({ id }) => `/leads/${id}`),
  deleteMany: endpoint<LeadsDeleteManyOutput, LeadsDeleteManyInput>('delete', '/leads'),
  update: endpoint<LeadsUpdateOutput, LeadsUpdateInput>('put', ({ id }) => `/leads/${id}`),
  generateMessages: endpoint<LeadsGenerateMessagesOutput, LeadsGenerateMessagesInput>(
    'post',
    '/leads/generate-messages'
  ),
  bulkImport: endpoint<LeadsBulkImportOutput, LeadsBulkImportInput>('post', '/leads/bulk'),
  verifyEmails: endpoint<LeadsVerifyEmailsOutput, LeadsVerifyEmailsInput>('post', '/leads/verify-emails', {
    timeout: VERIFY_EMAILS_TIMEOUT_MS,
  }),
} as const satisfies ApiModule
