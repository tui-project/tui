import { beforeEach, describe, expect, it, vi } from 'vitest'

const mkdir = vi.fn()
const readdir = vi.fn()
const readFile = vi.fn()
const stat = vi.fn()
const writeFile = vi.fn()
const createTorrent = vi.fn()
const parseTorrent = vi.fn()
const logger = {
    debug: vi.fn(),
    info: vi.fn(),
}

vi.mock('node:fs/promises', () => ({
    mkdir,
    readdir,
    readFile,
    stat,
    writeFile,
}))

vi.mock('create-torrent', () => ({
    default: createTorrent,
}))

vi.mock('parse-torrent', () => ({
    default: parseTorrent,
}))

vi.mock('../../../../server/utils/logger', () => ({
    logger,
}))

describe('torrent service', () => {
    beforeEach(() => {
        vi.resetModules()
        vi.clearAllMocks()
    })

    it('creates a tracker-free torrent and reports progress', async () => {
        const torrentBuffer = Buffer.from('torrent-data')
        stat.mockImplementation(async (path: string) => ({
            isFile: () => path.endsWith('.mkv'),
            size: path.endsWith('.mkv') ? 800 * 1024 * 1024 : 0,
        }))
        mkdir.mockResolvedValue(undefined)
        writeFile.mockResolvedValue(undefined)
        readFile.mockResolvedValue(torrentBuffer)
        parseTorrent.mockResolvedValue({
            pieceLength: 1024 * 1024,
            infoHash: 'abc123',
            files: [{ path: 'Movie.2024.1080p.mkv' }],
        })
        createTorrent.mockImplementation(
            (
                _sourcePath: string,
                options: { onProgress: (hashedBytes: number, totalBytes: number) => void; announceList: string[][]; pieceLength: number },
                callback: (error: Error | null, torrent: Buffer) => void
            ) => {
                expect(options.announceList).toEqual([])
                expect(options.pieceLength).toBe(1024 * 1024)
                options.onProgress(256, 1024)
                options.onProgress(257, 1024)
                options.onProgress(1024, 1024)
                callback(null, torrentBuffer)
            }
        )

        const { createGenericTorrent } = await import('../../../../server/services/torrent')
        const onProgress = vi.fn()

        const result = await createGenericTorrent({
            sourcePath: '/media/Movie.2024.1080p.mkv',
            onProgress,
        })

        expect(result.genericTorrentPath).toMatch(/config\/torrents\/.+\.torrent$/)
        expect(onProgress).toHaveBeenNthCalledWith(1, 25)
        expect(onProgress).toHaveBeenNthCalledWith(2, 100)
        expect(writeFile).toHaveBeenCalledWith(expect.stringMatching(/config\/torrents\/.+\.torrent$/), torrentBuffer)
        expect(parseTorrent).toHaveBeenCalledWith(torrentBuffer)
    })

    it('uses the provided piece size thresholds for large folders', async () => {
        stat.mockImplementation(async (path: string) => ({
            isFile: () => path.includes('.mkv') || path.includes('.srt'),
            size: path.endsWith('part1.mkv') ? 9 * 1024 * 1024 * 1024 : path.endsWith('part2.mkv') ? 5 * 1024 * 1024 * 1024 : 1024,
        }))
        readdir.mockImplementation(async (path: string) => {
            if (path === '/media/Folder') return ['part1.mkv', 'part2.mkv', 'subs']
            if (path === '/media/Folder/subs') return ['movie.srt']
            return []
        })
        mkdir.mockResolvedValue(undefined)
        writeFile.mockResolvedValue(undefined)
        readFile.mockResolvedValue(Buffer.from('torrent-data'))
        parseTorrent.mockResolvedValue({
            pieceLength: 8 * 1024 * 1024,
            infoHash: 'hash',
            files: [{ path: 'Folder/part1.mkv' }],
        })
        createTorrent.mockImplementation((_sourcePath: string, options: { pieceLength: number }, callback: (error: Error | null, torrent: Buffer) => void) => {
            expect(options.pieceLength).toBe(8 * 1024 * 1024)
            callback(null, Buffer.from('torrent-data'))
        })

        const { createGenericTorrent } = await import('../../../../server/services/torrent')

        await createGenericTorrent({
            sourcePath: '/media/Folder',
        })
    })

    it('uses the intermediate piece size thresholds', async () => {
        const sizesAndExpectedPieceLengths = [
            { size: 2 * 1024 * 1024 * 1024, pieceLength: 2 * 1024 * 1024 },
            { size: 8 * 1024 * 1024 * 1024, pieceLength: 4 * 1024 * 1024 },
        ]

        for (const { size, pieceLength } of sizesAndExpectedPieceLengths) {
            stat.mockResolvedValue({
                isFile: () => true,
                size,
            })
            mkdir.mockResolvedValue(undefined)
            writeFile.mockResolvedValue(undefined)
            readFile.mockResolvedValue(Buffer.from('torrent-data'))
            parseTorrent.mockResolvedValue({
                pieceLength,
                infoHash: `hash-${pieceLength}`,
                files: [{ path: 'movie.mkv' }],
            })
            createTorrent.mockImplementationOnce(
                (_sourcePath: string, options: { pieceLength: number }, callback: (error: Error | null, torrent: Buffer) => void) => {
                    expect(options.pieceLength).toBe(pieceLength)
                    callback(null, Buffer.from('torrent-data'))
                }
            )

            const { createGenericTorrent } = await import('../../../../server/services/torrent')

            await createGenericTorrent({
                sourcePath: '/media/movie.mkv',
            })
        }
    })

    it('reports completion when hashing progress never reaches 100 percent', async () => {
        stat.mockResolvedValue({
            isFile: () => true,
            size: 2 * 1024 * 1024,
        })
        mkdir.mockResolvedValue(undefined)
        writeFile.mockResolvedValue(undefined)
        readFile.mockResolvedValue(Buffer.from('torrent-data'))
        parseTorrent.mockResolvedValue({
            pieceLength: 1024 * 1024,
            infoHash: 'hash',
        })
        createTorrent.mockImplementation(
            (_sourcePath: string, options: { onProgress: (hashedBytes: number, totalBytes: number) => void }, callback: (error: Error | null, torrent: Buffer) => void) => {
                options.onProgress(0, 0)
                callback(null, Buffer.from('torrent-data'))
            }
        )

        const { createGenericTorrent } = await import('../../../../server/services/torrent')
        const onProgress = vi.fn()

        await createGenericTorrent({
            sourcePath: '/media/movie.mkv',
            onProgress,
        })

        expect(onProgress).toHaveBeenNthCalledWith(1, 0)
        expect(onProgress).toHaveBeenNthCalledWith(2, 100)
    })

    it('uses the largest piece size for very large sources', async () => {
        stat.mockResolvedValue({
            isFile: () => true,
            size: 25 * 1024 * 1024 * 1024,
        })
        mkdir.mockResolvedValue(undefined)
        writeFile.mockResolvedValue(undefined)
        readFile.mockResolvedValue(Buffer.from('torrent-data'))
        parseTorrent.mockResolvedValue({
            pieceLength: 16 * 1024 * 1024,
            infoHash: 'hash',
            files: undefined,
        })
        createTorrent.mockImplementation((_sourcePath: string, options: { pieceLength: number }, callback: (error: Error | null, torrent: Buffer) => void) => {
            expect(options.pieceLength).toBe(16 * 1024 * 1024)
            callback(null, Buffer.from('torrent-data'))
        })

        const { createGenericTorrent } = await import('../../../../server/services/torrent')

        await createGenericTorrent({
            sourcePath: '/media/huge.mkv',
        })
    })

    it('rejects when create-torrent returns an error', async () => {
        stat.mockResolvedValue({
            isFile: () => true,
            size: 800 * 1024 * 1024,
        })
        mkdir.mockResolvedValue(undefined)
        createTorrent.mockImplementation((_sourcePath: string, _options: object, callback: (error: Error | null, torrent: Buffer) => void) => {
            callback(new Error('torrent failed'), Buffer.alloc(0))
        })

        const { createGenericTorrent } = await import('../../../../server/services/torrent')

        await expect(
            createGenericTorrent({
                sourcePath: '/media/movie.mkv',
            })
        ).rejects.toThrow('torrent failed')
        expect(writeFile).not.toHaveBeenCalled()
    })
})
