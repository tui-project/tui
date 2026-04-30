import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('useLogout composable', () => {
    beforeEach(() => {
        vi.resetModules()
        vi.unstubAllGlobals()
    })

    it('submits logout and clears error on success', async () => {
        const fetchMock = vi.fn().mockResolvedValue(undefined)
        vi.stubGlobal('$fetch', fetchMock)

        const { useLogout } = await import('../../../../app/composables/useLogout')
        const { logout, loading, errorMessage } = useLogout()

        const result = await logout()

        expect(fetchMock).toHaveBeenCalledWith('/api/logout', {
            method: 'POST',
        })
        expect(result).toBe(true)
        expect(errorMessage.value).toBe('')
        expect(loading.value).toBe(false)
    })

    it('captures logout error message from API payload', async () => {
        const fetchMock = vi.fn().mockRejectedValue({
            data: {
                message: 'logout_failed',
            },
        })
        vi.stubGlobal('$fetch', fetchMock)

        const { useLogout } = await import('../../../../app/composables/useLogout')
        const { logout, loading, errorMessage } = useLogout()

        const result = await logout()

        expect(result).toBe(false)
        expect(errorMessage.value).toBe('logout_failed')
        expect(loading.value).toBe(false)
    })

    it('prevents duplicate submit while request is in flight', async () => {
        let resolveFetch: ((value: undefined) => void) | undefined
        const fetchMock = vi.fn().mockImplementation(
            () =>
                new Promise((resolve) => {
                    resolveFetch = resolve
                })
        )
        vi.stubGlobal('$fetch', fetchMock)

        const { useLogout } = await import('../../../../app/composables/useLogout')
        const { logout, loading } = useLogout()

        const firstRequest = logout()
        const secondResult = await logout()

        expect(loading.value).toBe(true)
        expect(secondResult).toBe(false)
        expect(fetchMock).toHaveBeenCalledTimes(1)

        resolveFetch?.(undefined)
        await firstRequest

        expect(loading.value).toBe(false)
    })
})
