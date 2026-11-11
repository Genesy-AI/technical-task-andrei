import { rateLimit } from 'express-rate-limit'

/** Requests per client per minute. With 100 leads per request this is plenty for real use. */
export const ENRICH_PHONE_REQUESTS_PER_MINUTE = 10

export const ENRICH_PHONE_RATE_LIMIT_MESSAGE = 'Too many phone lookups. Please wait a minute and try again.'

/**
 * Per-client limit on POST /leads/enrich-phone, so a script cannot burn provider credits.
 * Keyed by IP because there are no users yet; switch to the user id once auth exists.
 * In-memory: fine for one API process, needs a shared store (e.g. Redis) when scaled out.
 */
export const enrichPhoneRateLimit = rateLimit({
  windowMs: 60_000,
  limit: ENRICH_PHONE_REQUESTS_PER_MINUTE,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: ENRICH_PHONE_RATE_LIMIT_MESSAGE },
})
