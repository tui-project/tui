import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('useLogin composable', () => {
    beforeEach(() => {
        vi.resetModules()
        vi.unstubAllGlobals()
    })

    it('submits login and clears error on success', async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            sessionId: 'session-1',
            userId: 'user-1',
            expiresAt: '2030-01-01T01:00:00.000Z',
        })
        vi.stubGlobal('$fetch', fetchMock)

        const { useLogin } = await import('../../../../app/composables/useLogin')
        const { login, loading, errorMessage } = useLogin()

        const result = await login('admin', 'Admin@123')

        expect(fetchMock).toHaveBeenCalledWith('/api/login', {
            method: 'POST',
            body: {
                username: 'admin',
                password: 'Admin@123',
            },
        })
        expect(result).toEqual({
            sessionId: 'session-1',
            userId: 'user-1',
            expiresAt: '2030-01-01T01:00:00.000Z',
        })
        expect(errorMessage.value).toBe('')
        expect(loading.value).toBe(false)
    })

    it('captures login error message from API payload', async () => {
        const fetchMock = vi.fn().mockRejectedValue({
            data: {
                message: 'invalid_credentials',
            },
        })
        vi.stubGlobal('$fetch', fetchMock)

        const { useLogin } = await import('../../../../app/composables/useLogin')
        const { login, loading, errorMessage } = useLogin()

        const result = await login('admin', 'Wrong@123')

        expect(result).toBeNull()
        expect(errorMessage.value).toBe('invalid_credentials')
        expect(loading.value).toBe(false)
    })

    it('uses empty error message when API payload has no message', async () => {
        const fetchMock = vi.fn().mockRejectedValue({
            message: '[POST] "/api/login": 401 Server Error',
        })
        vi.stubGlobal('$fetch', fetchMock)

        const { useLogin } = await import('../../../../app/composables/useLogin')
        const { login, loading, errorMessage } = useLogin()

        const result = await login('admin', 'Wrong@123')

        expect(result).toBeNull()
        expect(errorMessage.value).toBe('')
        expect(loading.value).toBe(false)
    })

    it('prevents duplicate submit while request is in flight', async () => {
        let resolveFetch: ((value: { sessionId: string; userId: string; expiresAt: string }) => void) | undefined
        const fetchMock = vi.fn().mockImplementation(
            () =>
                new Promise((resolve) => {
                    resolveFetch = resolve
                })
        )
        vi.stubGlobal('$fetch', fetchMock)

        const { useLogin } = await import('../../../../app/composables/useLogin')
        const { login, loading } = useLogin()

        const firstRequest = login('admin', 'Admin@123')
        const secondResult = await login('admin', 'Admin@123')

        expect(loading.value).toBe(true)
        expect(secondResult).toBeNull()
        expect(fetchMock).toHaveBeenCalledTimes(1)

        resolveFetch?.({
            sessionId: 'session-1',
            userId: 'user-1',
            expiresAt: '2030-01-01T01:00:00.000Z',
        })
        await firstRequest

        expect(loading.value).toBe(false)
    })
})
