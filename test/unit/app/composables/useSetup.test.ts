import { describe, expect, it, vi, beforeEach } from 'vitest'

describe('useSetup composable', () => {
    beforeEach(() => {
        vi.resetModules()
        vi.unstubAllGlobals()
    })

    it('submits setup and clears error on success', async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            id: 'user-1',
            username: 'admin',
        })
        vi.stubGlobal('$fetch', fetchMock)

        const { useSetup } = await import('../../../../app/composables/useSetup')
        const { initialize, loading, errorMessage } = useSetup()

        const result = await initialize('admin', 'Admin@123')

        expect(fetchMock).toHaveBeenCalledWith('/api/setup', {
            method: 'POST',
            body: {
                username: 'admin',
                password: 'Admin@123',
            },
        })
        expect(result).toEqual({ id: 'user-1', username: 'admin' })
        expect(errorMessage.value).toBe('')
        expect(loading.value).toBe(false)
    })

    it('captures setup error message from the API response payload', async () => {
        const fetchMock = vi.fn().mockRejectedValue({
            data: {
                message: 'setup_completed',
            },
        })
        vi.stubGlobal('$fetch', fetchMock)

        const { useSetup } = await import('../../../../app/composables/useSetup')
        const { initialize, loading, errorMessage } = useSetup()

        const result = await initialize('admin', 'Admin@123')

        expect(result).toBeNull()
        expect(errorMessage.value).toBe('setup_completed')
        expect(loading.value).toBe(false)
    })

    it('ignores fetch error summary when the API payload has no message', async () => {
        const fetchMock = vi.fn().mockRejectedValue({
            message: '[POST] "/api/setup": 409 Server Error',
        })
        vi.stubGlobal('$fetch', fetchMock)

        const { useSetup } = await import('../../../../app/composables/useSetup')
        const { initialize, loading, errorMessage } = useSetup()

        const result = await initialize('admin', 'Admin@123')

        expect(result).toBeNull()
        expect(errorMessage.value).toBe('')
        expect(loading.value).toBe(false)
    })

    it('uses empty error message when fetch rejects with a non-object value', async () => {
        const fetchMock = vi.fn().mockRejectedValue('setup_failed')
        vi.stubGlobal('$fetch', fetchMock)

        const { useSetup } = await import('../../../../app/composables/useSetup')
        const { initialize, loading, errorMessage } = useSetup()

        const result = await initialize('admin', 'Admin@123')

        expect(result).toBeNull()
        expect(errorMessage.value).toBe('')
        expect(loading.value).toBe(false)
    })

    it('prevents duplicate submit while request is in flight', async () => {
        let resolveFetch: ((value: { id: string; username: string }) => void) | undefined
        const fetchMock = vi.fn().mockImplementation(
            () =>
                new Promise((resolve) => {
                    resolveFetch = resolve
                })
        )
        vi.stubGlobal('$fetch', fetchMock)

        const { useSetup } = await import('../../../../app/composables/useSetup')
        const { initialize, loading } = useSetup()

        const firstRequest = initialize('admin', 'Admin@123')
        const secondResult = await initialize('admin', 'Admin@123')

        expect(loading.value).toBe(true)
        expect(secondResult).toBeNull()
        expect(fetchMock).toHaveBeenCalledTimes(1)

        resolveFetch?.({ id: 'user-1', username: 'admin' })
        await firstRequest

        expect(loading.value).toBe(false)
    })
})
