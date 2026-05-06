import { beforeEach, describe, expect, it, vi } from 'vitest'

const readdir = vi.fn()
const stat = vi.fn()
const createError = vi.fn((payload: unknown) => payload)
const logger = {
    trace: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
}

vi.mock('node:fs/promises', () => ({
    readdir,
    stat,
}))

beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
})

async function loadModule() {
    vi.doMock('h3', () => ({
        createError,
    }))
    vi.doMock('../../../../server/utils/logger', () => ({
        logger,
    }))

    return import('../../../../server/utils/file-system')
}

function createStats(options: { file?: boolean; directory?: boolean } = {}) {
    return {
        isFile: () => Boolean(options.file),
        isDirectory: () => Boolean(options.directory),
    }
}

describe('file-system utils', () => {
    it('sorts folders before files and then alphabetically', async () => {
        const { sortPathItems } = await loadModule()

        expect(
            sortPathItems([
                { path: '/z-file.mkv', folder: false },
                { path: '/b-folder', folder: true },
                { path: '/a-file.mkv', folder: false },
                { path: '/a-folder', folder: true },
            ])
        ).toEqual([
            { path: '/a-folder', folder: true },
            { path: '/b-folder', folder: true },
            { path: '/a-file.mkv', folder: false },
            { path: '/z-file.mkv', folder: false },
        ])
    })

    it('checks whether a path is inside any configured root', async () => {
        const { isWithinAnyRoot } = await loadModule()

        expect(isWithinAnyRoot('/media', ['/downloads', '/media'])).toBe(true)
        expect(isWithinAnyRoot('/media/movie/file.mkv', ['/downloads', '/media'])).toBe(true)
        expect(isWithinAnyRoot('/media-library/file.mkv', ['/media'])).toBe(false)
        expect(isWithinAnyRoot('/downloads/file.mkv', ['/media'])).toBe(false)
    })

    it('returns the input when resolveMediaFilePaths receives a file', async () => {
        stat.mockResolvedValue(createStats({ file: true }))
        const { resolveMediaFilePaths } = await loadModule()

        await expect(resolveMediaFilePaths('/media/movie.mkv')).resolves.toEqual(['/media/movie.mkv'])
        expect(logger.debug).toHaveBeenCalledWith('Resolved media file path directly from file input.', {
            inputPath: '/media/movie.mkv',
        })
    })

    it('returns sorted file paths from a directory and ignores nested folders', async () => {
        stat.mockImplementation(async (inputPath: string) => {
            if (inputPath === '/media/show') {
                return createStats({ directory: true })
            }
            if (inputPath === '/media/show/episode-01.mkv') {
                return createStats({ file: true })
            }
            if (inputPath === '/media/show/episode-02.mkv') {
                return createStats({ file: true })
            }

            return createStats({ directory: true })
        })
        readdir.mockResolvedValue(['episode-02.mkv', 'extras', 'episode-01.mkv'])
        const { resolveMediaFilePaths } = await loadModule()

        await expect(resolveMediaFilePaths('/media/show')).resolves.toEqual(['/media/show/episode-01.mkv', '/media/show/episode-02.mkv'])
        expect(logger.debug).toHaveBeenCalledWith('Resolved media file paths from directory.', {
            inputPath: '/media/show',
            fileCount: 2,
        })
    })

    it('rejects directories that do not contain files', async () => {
        stat.mockImplementation(async (inputPath: string) => {
            if (inputPath === '/media/empty') {
                return createStats({ directory: true })
            }

            return createStats({ directory: true })
        })
        readdir.mockResolvedValue(['subdir'])
        const { resolveMediaFilePaths } = await loadModule()

        await expect(resolveMediaFilePaths('/media/empty')).rejects.toEqual({
            statusCode: 400,
            message: 'no_media_file_found',
        })
        expect(logger.warn).toHaveBeenCalledWith('Rejected media file resolution because no files were found in directory.', {
            path: '/media/empty',
        })
    })

    it('rejects paths that are neither files nor directories', async () => {
        stat.mockResolvedValue(createStats())
        const { resolveMediaFilePaths } = await loadModule()

        await expect(resolveMediaFilePaths('/media/bad-path')).rejects.toEqual({
            statusCode: 400,
            message: 'invalid_path',
        })
        expect(logger.warn).toHaveBeenCalledWith('Rejected media file resolution because path is not a file or directory.', {
            path: '/media/bad-path',
        })
    })

    it('returns the first resolved media file path', async () => {
        stat.mockImplementation(async (inputPath: string) => {
            if (inputPath === '/media/show') {
                return createStats({ directory: true })
            }
            if (inputPath === '/media/show/episode-01.mkv') {
                return createStats({ file: true })
            }

            return createStats({ directory: true })
        })
        readdir.mockResolvedValue(['episode-01.mkv'])
        const { resolveMediaFilePath } = await loadModule()

        await expect(resolveMediaFilePath('/media/show')).resolves.toBe('/media/show/episode-01.mkv')
        expect(logger.debug).toHaveBeenCalledWith('Resolved media file path.', {
            inputPath: '/media/show',
            mediaFilePath: '/media/show/episode-01.mkv',
        })
    })

    it('rejects when resolveMediaFilePath cannot find any files', async () => {
        stat.mockImplementation(async (inputPath: string) => {
            if (inputPath === '/media/empty') {
                return createStats({ directory: true })
            }

            return createStats({ directory: true })
        })
        readdir.mockResolvedValue([])
        const { resolveMediaFilePath } = await loadModule()

        await expect(resolveMediaFilePath('/media/empty')).rejects.toEqual({
            statusCode: 400,
            message: 'no_media_file_found',
        })
    })
})
