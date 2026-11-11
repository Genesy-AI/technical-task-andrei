import { proxyActivities } from '@temporalio/workflow'
import type * as activities from './activities'

// A single email check (DNS/SMTP probe or provider call) should finish well within 10s.
// Retry transient failures a few times with backoff, then give up so the caller always
// gets an outcome. Worst case per lead: 3 × 10s + 1s + 2s backoff ≈ 33s.
const { verifyEmail } = proxyActivities<typeof activities>({
  startToCloseTimeout: '10 seconds',
  retry: {
    initialInterval: '1 second',
    backoffCoefficient: 2,
    maximumInterval: '5 seconds',
    maximumAttempts: 3,
  },
})

export async function verifyEmailWorkflow(email: string): Promise<boolean> {
  return await verifyEmail(email)
}
