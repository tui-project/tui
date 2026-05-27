import { beforeEach, describe, expect, it, vi } from 'vitest'

const push = vi.fn()
const fetchCreate = vi.fn(() => 'created-fetch')

beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.stubGlobal('defineNuxtPlugin', (fn: () => void) => fn)
    vi.stubGlobal('useRouter', () => ({ push }))
    vi.stubGlobal('$fetch', { create: fetchCreate })
})

async function loadPlugin() {
    const { default: plugin } = await import('../../../../app/plugins/auth')
    ;(plugin as () => void)()
    const { onResponseError } = fetchCreate.mock.calls[0]![0] as {
        onResponseError: (ctx: { response: { status: number } }) => void
    }
    return onResponseError
}

describe('auth plugin', () => {
    it('replaces globalThis.$fetch on init', async () => {
        await loadPlugin()
        expect(fetchCreate).toHaveBeenCalledOnce()
        expect(globalThis.$fetch).toBe('created-fetch')
    })

    it('navigates to /login on 401', async () => {
        const onResponseError = await loadPlugin()
        onResponseError({ response: { status: 401 } })
        expect(push).toHaveBeenCalledWith('/login')
    })

    it('does nothing for non-401 responses', async () => {
        const onResponseError = await loadPlugin()
        onResponseError({ response: { status: 403 } })
        onResponseError({ response: { status: 500 } })
        expect(push).not.toHaveBeenCalled()
    })
})
