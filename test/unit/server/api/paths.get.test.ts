import { beforeEach, describe, expect, it, vi } from 'vitest'

const logger = {
    debug: vi.fn(),
    trace: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
}

const getQuery = vi.fn<() => { parent?: string }>()
const createError = vi.fn<(payload: { statusCode: number; message: string }) => { statusCode: number; message: string }>()
const realpath = vi.fn<(target: string) => Promise<string>>()
const stat = vi.fn<(target: string) => Promise<{ isDirectory: () => boolean }>>()
const getSettings = vi.fn<() => Promise<{ id: string; mediaPaths: string[] }>>()
const listChildren = vi.fn<() => Promise<Array<{ path: string; folder: boolean }>>>()

beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
    createError.mockImplementation((payload) => payload)
    getSettings.mockResolvedValue({ id: 'app-settings', mediaPaths: ['/media'] })
    realpath.mockImplementation(async (target) => target)
})

async function loadHandler() {
    vi.doMock('h3', () => ({
        getQuery,
        createError,
    }))
    vi.doMock('node:fs/promises', () => ({
        realpath,
        stat,
    }))
    vi.doMock('../../../../server/repositories/settings-repository', () => ({ getSettings }))
    vi.doMock('../../../../server/services/directory-browse', () => ({
        listChildren,
    }))
    vi.doMock('../../../../server/utils/logger', () => ({ logger }))

    const { default: handler } = await import('../../../../server/api/paths.get')
    return handler
}

describe('GET /api/paths route handler', () => {
    it('returns media roots when parent is missing', async () => {
        getQuery.mockReturnValue({})
        stat.mockResolvedValue({ isDirectory: () => true })
        const handler = await loadHandler()

        await expect(handler({} as never)).resolves.toEqual([{ path: '/media', folder: true }])
        expect(stat).toHaveBeenCalledWith('/media')
    })

    it('sorts root entries with folders first and alphabetically within type', async () => {
        getQuery.mockReturnValue({})
        getSettings.mockResolvedValue({ id: 'app-settings', mediaPaths: ['/b-file.mkv', '/a-folder', '/a-file.mkv', '/b-folder'] })
        stat.mockImplementation(async (target) => ({
            isDirectory: () => target.endsWith('folder'),
        }))
        const handler = await loadHandler()

        await expect(handler({} as never)).resolves.toEqual([
            { path: '/a-folder', folder: true },
            { path: '/b-folder', folder: true },
            { path: '/a-file.mkv', folder: false },
            { path: '/b-file.mkv', folder: false },
        ])
    })

    it('returns children for allowed parent', async () => {
        getQuery.mockReturnValue({ parent: '/media' })
        realpath.mockImplementation(async (target) => target)
        listChildren.mockResolvedValue([{ path: '/media/file.mkv', folder: false }])
        const handler = await loadHandler()

        await expect(handler({} as never)).resolves.toEqual([{ path: '/media/file.mkv', folder: false }])
        expect(listChildren).toHaveBeenCalledWith('/media')
    })

    it('returns invalid_parent_path when parent is outside configured roots', async () => {
        getQuery.mockReturnValue({ parent: '/etc' })
        realpath.mockImplementation(async (target) => target)
        const handler = await loadHandler()

        await expect(handler({} as never)).rejects.toEqual({
            statusCode: 400,
            message: 'invalid_parent_path',
        })
    })
})
