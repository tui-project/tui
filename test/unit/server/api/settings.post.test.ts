import { beforeEach, describe, expect, it, vi } from 'vitest'

const logger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
}

const readBody = vi.fn<() => Promise<{ mediaPaths?: unknown }>>()
const createError = vi.fn((payload: unknown) => payload)
const saveSettings = vi.fn<() => Promise<{ mediaPaths: string[] }>>()
const stat = vi.fn()

beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
})

async function loadHandler() {
    vi.doMock('h3', () => ({
        createError,
        readBody,
    }))
    vi.doMock('node:fs/promises', () => ({
        stat,
    }))
    vi.doMock('../../../../server/repositories/settings-repository', () => ({
        saveSettings,
    }))
    vi.doMock('../../../../server/utils/logger', () => ({
        logger,
    }))

    const { default: handler } = await import('../../../../server/api/settings.post')
    return handler
}

describe('POST /api/settings route handler', () => {
    it('rejects invalid request shape', async () => {
        readBody.mockResolvedValue({ mediaPaths: 'abc' })
        const handler = await loadHandler()

        await expect(handler({} as never)).rejects.toEqual({
            statusCode: 400,
            message: 'invalid_request',
        })
    })

    it('rejects when media path does not exist', async () => {
        readBody.mockResolvedValue({ mediaPaths: ['/missing'] })
        stat.mockRejectedValue(new Error('missing'))
        const handler = await loadHandler()

        await expect(handler({} as never)).rejects.toEqual({
            statusCode: 400,
            message: 'invalid_media_path',
        })
    })

    it('rejects when media paths contain invalid entries after normalization', async () => {
        readBody.mockResolvedValue({ mediaPaths: ['/ok', '   '] })
        const handler = await loadHandler()

        await expect(handler({} as never)).rejects.toEqual({
            statusCode: 400,
            message: 'invalid_request',
        })
    })

    it('deduplicates paths and saves valid settings', async () => {
        readBody.mockResolvedValue({ mediaPaths: [' /a ', '/a', '/b'] })
        stat.mockResolvedValue({})
        saveSettings.mockResolvedValue({
            mediaPaths: ['/a', '/b'],
        })
        const handler = await loadHandler()

        await expect(handler({} as never)).resolves.toEqual({
            mediaPaths: ['/a', '/b'],
        })
        expect(saveSettings).toHaveBeenCalledWith({ mediaPaths: ['/a', '/b'] })
        expect(logger.info).toHaveBeenCalledWith('Settings updated.')
    })
})
