import { beforeEach, describe, expect, it, vi } from 'vitest'

const apiMock = vi.fn()
const createMock = vi.fn(() => apiMock)
const handleApiResponseErrorMock = vi.fn()
const nuxtAppMock = { runWithContext: vi.fn() }

beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.stubGlobal('$fetch', { create: createMock })
    vi.stubGlobal('handleApiResponseError', handleApiResponseErrorMock)
    vi.stubGlobal('defineNuxtPlugin', (plugin: unknown) => plugin)
})

describe('API unauthorized redirect plugin', () => {
    it('provides an API client that delegates unauthorized responses', async () => {
        const { default: plugin } = await import('../../../../app/plugins/api-unauthorized-redirect')
        const result = plugin(nuxtAppMock)
        const options = createMock.mock.calls[0]![0]

        await options.onResponseError({ response: { status: 401 } })

        expect(result).toEqual({ provide: { api: apiMock } })
        expect(handleApiResponseErrorMock).toHaveBeenCalledWith(401, nuxtAppMock)
    })

    it.each([403, 500])('delegates status %s without redirecting itself', async (status) => {
        const { default: plugin } = await import('../../../../app/plugins/api-unauthorized-redirect')
        plugin(nuxtAppMock)
        const options = createMock.mock.calls[0]![0]

        await options.onResponseError({ response: { status } })

        expect(handleApiResponseErrorMock).toHaveBeenCalledWith(status, nuxtAppMock)
    })
})
