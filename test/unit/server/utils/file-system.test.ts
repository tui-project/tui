import { beforeEach, describe, expect, it, vi } from 'vitest'

const readdir = vi.fn()
const realpath = vi.fn()
const stat = vi.fn()
const createError = vi.fn((payload: unknown) => payload)
const logger = {
    trace: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
}

vi.mock('node:fs/promises', () => ({
    readdir,
    realpath,
    stat,
}))

beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    realpath.mockImplementation(async (path) => path)
})

async function loadModule() {
    vi.doMock('h3', () => ({
        createError,
    }))
    vi.doMock('../../../../server/utils/logger', () => ({
        createLogger: () => logger,
    }))

    return import('../../../../server/utils/file-system')
}

function createStats(options: { file?: boolean; directory?: boolean } = {}) {
    return {
        isFile: () => Boolean(options.file),
        isDirectory: () => Boolean(options.directory),
    }
}

function createDirent(name: string, options: { file?: boolean; directory?: boolean } = {}) {
    return {
        name,
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

    it.each([
        ['/media', '/media'],
        ['/media/movie/file.mkv', '/media/movie/file.mkv'],
    ])('returns the canonical path when %s is inside a configured root', async (input, canonical) => {
        const { resolvePathWithinAnyRoot } = await loadModule()
        await expect(resolvePathWithinAnyRoot(input, ['/downloads', '/media'])).resolves.toBe(canonical)
    })

    it.each([
        ['/media/../etc/passwd', '/etc/passwd'],
        ['/media/link/passwd', '/etc/passwd'],
        ['/media-library/file.mkv', '/media-library/file.mkv'],
    ])('rejects %s when its canonical path escapes configured roots', async (input, canonical) => {
        realpath.mockImplementation(async (path: string) => (path === input ? canonical : path))
        const { resolvePathWithinAnyRoot } = await loadModule()
        await expect(resolvePathWithinAnyRoot(input, ['/media'])).resolves.toBeNull()
    })

    it('rejects missing paths and caches canonical roots until explicitly cleared', async () => {
        const { clearCanonicalRootsCache, resolvePathWithinAnyRoot } = await loadModule()
        await resolvePathWithinAnyRoot('/media/one.mkv', ['/media'])
        await resolvePathWithinAnyRoot('/media/two.mkv', ['/media'])
        expect(realpath.mock.calls.filter(([path]) => path === '/media')).toHaveLength(1)

        clearCanonicalRootsCache()
        await resolvePathWithinAnyRoot('/media/three.mkv', ['/media'])
        expect(realpath.mock.calls.filter(([path]) => path === '/media')).toHaveLength(2)

        realpath.mockRejectedValueOnce(new Error('missing'))
        await expect(resolvePathWithinAnyRoot('/missing', ['/media'])).resolves.toBeNull()
    })

    it('retries canonical root resolution after a transient failure', async () => {
        realpath.mockResolvedValueOnce('/media/movie.mkv').mockRejectedValueOnce(new Error('NAS unavailable'))
        const { resolvePathWithinAnyRoot } = await loadModule()

        await expect(resolvePathWithinAnyRoot('/media/movie.mkv', ['/media'])).resolves.toBeNull()
        await expect(resolvePathWithinAnyRoot('/media/movie.mkv', ['/media'])).resolves.toBe('/media/movie.mkv')
    })

    it('returns the input when resolveMediaFilePaths receives a file', async () => {
        stat.mockResolvedValue(createStats({ file: true }))
        const { resolveMediaFilePaths } = await loadModule()

        await expect(resolveMediaFilePaths('/media/movie.mkv')).resolves.toEqual(['/media/movie.mkv'])
        expect(logger.trace).toHaveBeenCalledWith('Resolved media file path directly from file input.', {
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
        readdir.mockResolvedValue([createDirent('episode-02.mkv', { file: true }), createDirent('extras', { directory: true }), createDirent('episode-01.mkv', { file: true })])
        const { resolveMediaFilePaths } = await loadModule()

        await expect(resolveMediaFilePaths('/media/show')).resolves.toEqual(['/media/show/episode-01.mkv', '/media/show/episode-02.mkv'])
        expect(logger.trace).toHaveBeenCalledWith('Resolved media file paths from directory.', {
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
        readdir.mockResolvedValue([createDirent('subdir', { directory: true })])
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
        readdir.mockResolvedValue([createDirent('episode-01.mkv', { file: true })])
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
