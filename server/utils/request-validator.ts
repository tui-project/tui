import { createError, getQuery, readBody } from 'h3'
import type { H3Event } from 'h3'
import type { ZodIssue, ZodType } from 'zod'

interface RequestValidatorOptions {
    errorMessage?: string
    onInvalid?: (issues: ZodIssue[]) => void
}

export async function parseValidatedBody<T>(event: H3Event, schema: ZodType<T>, options: RequestValidatorOptions = {}) {
    const body = await readBody(event)
    const result = schema.safeParse(body)

    if (!result.success) {
        options.onInvalid?.(result.error.issues)

        throw createError({
            statusCode: 400,
            message: options.errorMessage ?? 'invalid_request',
        })
    }

    return result.data
}

export function parseValidatedQuery<T>(event: H3Event, schema: ZodType<T>, options: RequestValidatorOptions = {}) {
    const query = getQuery(event)
    const result = schema.safeParse(query)

    if (!result.success) {
        options.onInvalid?.(result.error.issues)

        throw createError({
            statusCode: 400,
            message: options.errorMessage ?? 'invalid_request',
        })
    }

    return result.data
}
