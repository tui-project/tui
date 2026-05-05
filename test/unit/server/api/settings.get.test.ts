import { beforeEach, describe, expect, it, vi } from 'vitest'

const logger = {
    trace: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
}

const getSettings = vi.fn<() => Promise<{ id: string; mediaPaths: string[]; tmdbApiKey: string }>>()

beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
})

async function loadHandler() {
    vi.doMock('../../../../server/repositories/settings-repository', () => ({
        getSettings,
    }))
    vi.doMock('../../../../server/utils/logger', () => ({
        logger,
    }))

    const { default: handler } = await import('../../../../server/api/settings.get')
    return handler
}

describe('GET /api/settings route handler', () => {
    it('returns empty list when settings are missing', async () => {
        getSettings.mockResolvedValue({ id: 'app-settings', mediaPaths: [], tmdbApiKey: '' })
        const handler = await loadHandler()

        await expect(handler({} as never)).resolves.toEqual({
            mediaPaths: [],
            tmdbApiKey: '',
        })
    })

    it('returns stored media paths', async () => {
        getSettings.mockResolvedValue({ id: 'app-settings', mediaPaths: ['/a', '/b'], tmdbApiKey: 'abc' })
        const handler = await loadHandler()

        await expect(handler({} as never)).resolves.toEqual({
            mediaPaths: ['/a', '/b'],
            tmdbApiKey: 'abc',
        })
    })
})
