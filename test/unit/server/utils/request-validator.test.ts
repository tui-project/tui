import { beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

const readBody = vi.fn()
const getQuery = vi.fn()
const createError = vi.fn((payload: unknown) => payload)

beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
})

async function loadValidator() {
    vi.doMock('h3', () => ({
        createError,
        getQuery,
        readBody,
    }))

    return import('../../../../server/utils/request-validator')
}

describe('request validator utils', () => {
    describe('parseValidatedBody', () => {
        it('returns parsed body data when schema validation succeeds', async () => {
            readBody.mockResolvedValue({ name: 'Alice' })
            const { parseValidatedBody } = await loadValidator()

            await expect(parseValidatedBody({} as never, z.object({ name: z.string() }))).resolves.toEqual({
                name: 'Alice',
            })
            expect(readBody).toHaveBeenCalledWith({})
        })

        it('throws invalid_request and passes issues to onInvalid when body validation fails', async () => {
            readBody.mockResolvedValue({ name: 123 })
            const onInvalid = vi.fn()
            const { parseValidatedBody } = await loadValidator()

            await expect(parseValidatedBody({} as never, z.object({ name: z.string() }), { onInvalid })).rejects.toEqual({
                statusCode: 400,
                message: 'invalid_request',
            })

            expect(onInvalid).toHaveBeenCalledTimes(1)
            expect(onInvalid.mock.calls[0]?.[0]).toEqual([
                expect.objectContaining({
                    path: ['name'],
                }),
            ])
            expect(createError).toHaveBeenCalledWith({
                statusCode: 400,
                message: 'invalid_request',
            })
        })

        it('uses the custom body error message when provided', async () => {
            readBody.mockResolvedValue({ name: 123 })
            const { parseValidatedBody } = await loadValidator()

            await expect(
                parseValidatedBody({} as never, z.object({ name: z.string() }), {
                    errorMessage: 'invalid_settings_request',
                })
            ).rejects.toEqual({
                statusCode: 400,
                message: 'invalid_settings_request',
            })
        })
    })

    describe('parseValidatedQuery', () => {
        it('returns parsed query data when schema validation succeeds', async () => {
            getQuery.mockReturnValue({ page: '2' })
            const { parseValidatedQuery } = await loadValidator()

            expect(
                parseValidatedQuery(
                    {} as never,
                    z.object({
                        page: z.coerce.number().int().positive(),
                    })
                )
            ).toEqual({
                page: 2,
            })
            expect(getQuery).toHaveBeenCalledWith({})
        })

        it('throws the custom error and passes issues to onInvalid when query validation fails', async () => {
            getQuery.mockReturnValue({ page: 'abc' })
            const onInvalid = vi.fn()
            const { parseValidatedQuery } = await loadValidator()

            try {
                parseValidatedQuery(
                    {} as never,
                    z.object({
                        page: z.coerce.number().int().positive(),
                    }),
                    {
                        errorMessage: 'invalid_query',
                        onInvalid,
                    }
                )
                throw new Error('Expected parseValidatedQuery to throw')
            } catch (error) {
                expect(error).toEqual({
                    statusCode: 400,
                    message: 'invalid_query',
                })
            }

            expect(onInvalid).toHaveBeenCalledTimes(1)
            expect(onInvalid.mock.calls[0]?.[0]).toEqual([
                expect.objectContaining({
                    path: ['page'],
                }),
            ])
            expect(createError).toHaveBeenCalledWith({
                statusCode: 400,
                message: 'invalid_query',
            })
        })

        it('uses invalid_request for query validation failures without custom options', async () => {
            getQuery.mockReturnValue({ page: 'abc' })
            const { parseValidatedQuery } = await loadValidator()

            expect(() =>
                parseValidatedQuery(
                    {} as never,
                    z.object({
                        page: z.coerce.number().int().positive(),
                    })
                )
            ).toThrowErrorMatchingInlineSnapshot(`
              {
                "message": "invalid_request",
                "statusCode": 400,
              }
            `)
        })
    })
})
