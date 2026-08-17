import { beforeEach, describe, expect, it, vi } from 'vitest'

const createUseFetchMock = vi.fn()
const handleApiResponseErrorMock = vi.fn()
const nuxtAppMock = {}

beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.stubGlobal('createUseFetch', createUseFetchMock)
    vi.stubGlobal('useNuxtApp', () => nuxtAppMock)
    vi.stubGlobal('handleApiResponseError', handleApiResponseErrorMock)
})

async function loadFetchOptions() {
    await import('../../../../app/composables/useApiFetch')
    const createOptions = createUseFetchMock.mock.calls[0]![0] as () => {
        onResponseError: (context: { response: { status: number } }) => Promise<void>
    }
    return createOptions()
}

describe('useApiFetch', () => {
    it('delegates response errors to the shared handler', async () => {
        const options = await loadFetchOptions()
        await options.onResponseError({ response: { status: 401 } })

        expect(handleApiResponseErrorMock).toHaveBeenCalledWith(401, nuxtAppMock)
    })
})
