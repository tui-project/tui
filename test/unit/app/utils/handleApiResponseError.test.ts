import { beforeEach, describe, expect, it, vi } from 'vitest'

const navigateToMock = vi.fn()
const runWithContextMock = vi.fn((callback: () => unknown) => callback())
const nuxtAppMock = { runWithContext: runWithContextMock } as ReturnType<typeof useNuxtApp>

beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('navigateTo', navigateToMock)
})

describe('handleApiResponseError', () => {
    it('navigates to login for an unauthorized response', async () => {
        const { handleApiResponseError } = await import('../../../../app/utils/handleApiResponseError')

        await handleApiResponseError(401, nuxtAppMock)

        expect(runWithContextMock).toHaveBeenCalledOnce()
        expect(navigateToMock).toHaveBeenCalledWith('/login')
    })

    it.each([403, 500])('does not navigate for status %s', async (status) => {
        const { handleApiResponseError } = await import('../../../../app/utils/handleApiResponseError')

        await handleApiResponseError(status, nuxtAppMock)

        expect(runWithContextMock).not.toHaveBeenCalled()
        expect(navigateToMock).not.toHaveBeenCalled()
    })
})
