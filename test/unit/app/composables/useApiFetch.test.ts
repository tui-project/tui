import { beforeEach, describe, expect, it, vi } from 'vitest'

const createUseFetchMock = vi.fn()
const navigateToMock = vi.fn()

beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.stubGlobal('createUseFetch', createUseFetchMock)
    vi.stubGlobal('navigateTo', navigateToMock)
})

async function loadResponseErrorHandler() {
    await import('../../../../app/composables/useApiFetch')
    const createOptions = createUseFetchMock.mock.calls[0]![0] as () => {
        onResponseError: (context: { response: { status: number } }) => Promise<void>
    }

    return createOptions().onResponseError
}

describe('useApiFetch', () => {
    it('navigates to login when a response is unauthorized', async () => {
        const onResponseError = await loadResponseErrorHandler()

        await onResponseError({ response: { status: 401 } })

        expect(navigateToMock).toHaveBeenCalledWith('/login')
    })

    it.each([403, 500])('does not navigate when a response has status %s', async (status) => {
        const onResponseError = await loadResponseErrorHandler()

        await onResponseError({ response: { status } })

        expect(navigateToMock).not.toHaveBeenCalled()
    })
})
