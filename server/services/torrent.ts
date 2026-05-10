import { randomUUID } from 'node:crypto'
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'
import createTorrent from 'create-torrent'
import parseTorrent, { toTorrentFile } from 'parse-torrent'
import { logger } from '../utils/logger'

interface CreateGenericTorrentOptions {
    sourcePath: string
    onProgress?: (progressPercent: number) => Promise<void> | void
}

interface GenericTorrentResult {
    genericTorrentPath: string
}

interface CreateTrackerTorrentOptions {
    genericTorrentPath: string
    trackerCode: string
    announceUrl: string
    sourcePath: string
}

interface TrackerTorrentResult {
    trackerTorrentPath: string
}

interface ParsedTorrentFileDetails {
    pieceLength?: number
    files?: unknown[]
    announce?: string[]
}

const torrentsDirectory = join(process.cwd(), 'config', 'torrents')
const tempDirectory = join(process.cwd(), 'config', 'tmp', 'torrents')

export async function createGenericTorrent(options: CreateGenericTorrentOptions): Promise<GenericTorrentResult> {
    const torrentId = randomUUID()
    const genericTorrentPath = join(torrentsDirectory, `${torrentId}.torrent`)
    const pieceLength = await calculatePieceLength(options.sourcePath)
    let lastProgressPercent = -1

    logger.info('Starting generic torrent creation.', {
        sourcePath: options.sourcePath,
        genericTorrentPath,
        pieceLength,
    })

    await mkdir(torrentsDirectory, { recursive: true })

    const torrentBuffer = await new Promise<Buffer>((resolve, reject) => {
        createTorrent(
            options.sourcePath,
            {
                announceList: [],
                pieceLength,
                createdBy: 'tui',
                onProgress: (hashedBytes: number, totalBytes: number) => {
                    const progressPercent = toProgressPercent(hashedBytes, totalBytes)
                    if (progressPercent === lastProgressPercent) {
                        return
                    }

                    lastProgressPercent = progressPercent
                    logger.debug('Generic torrent creation progress updated.', {
                        sourcePath: options.sourcePath,
                        genericTorrentPath,
                        progressPercent,
                        hashedBytes,
                        totalBytes,
                    })

                    void options.onProgress?.(progressPercent)
                },
            },
            (error: Error | null, torrent: Uint8Array) => {
                if (error) {
                    reject(error)
                    return
                }

                resolve(Buffer.from(torrent))
            }
        )
    })

    await writeFile(genericTorrentPath, torrentBuffer)

    const parsedTorrent = await parseTorrent(await readFile(genericTorrentPath))
    const parsedTorrentDetails = parsedTorrent as ParsedTorrentFileDetails
    const fileCount = Array.isArray(parsedTorrentDetails.files) ? parsedTorrentDetails.files.length : undefined

    logger.info('Generic torrent created successfully.', {
        sourcePath: options.sourcePath,
        genericTorrentPath,
        pieceLength: parsedTorrentDetails.pieceLength,
        infoHash: parsedTorrent.infoHash,
        fileCount,
    })

    if (lastProgressPercent < 100) {
        await options.onProgress?.(100)
    }

    return { genericTorrentPath }
}

async function calculatePieceLength(filePath: string) {
    const totalSize = await calculatePathSize(filePath)
    const MiB = 1024 * 1024
    const GiB = MiB * 1024

    if (totalSize < 1 * GiB) return 1 * MiB
    if (totalSize < 4 * GiB) return 2 * MiB
    if (totalSize < 12 * GiB) return 4 * MiB
    if (totalSize < 20 * GiB) return 8 * MiB

    return 16 * MiB
}

async function calculatePathSize(path: string): Promise<number> {
    const pathStats = await stat(path)

    if (pathStats.isFile()) {
        return pathStats.size
    }

    const children = await readdir(path)
    const sizes = await Promise.all(children.map((child) => calculatePathSize(join(path, child))))

    return sizes.reduce((total, size) => total + size, 0)
}

function toProgressPercent(hashedBytes: number, totalBytes: number) {
    if (totalBytes <= 0) {
        return 0
    }

    return Math.min(100, Math.floor((hashedBytes / totalBytes) * 100))
}

export async function createTrackerTorrent(options: CreateTrackerTorrentOptions): Promise<TrackerTorrentResult> {
    const sourceStat = await stat(options.sourcePath)
    const base = basename(options.sourcePath)
    const sourceName = sourceStat.isFile() ? basename(base, extname(base)) : base
    const trackerTempDirectory = join(tempDirectory, options.trackerCode)
    const trackerTorrentPath = join(trackerTempDirectory, `${sourceName}.torrent`)

    logger.info('Creating tracker-specific torrent.', {
        genericTorrentPath: options.genericTorrentPath,
        trackerTorrentPath,
        trackerCode: options.trackerCode,
    })

    await mkdir(trackerTempDirectory, { recursive: true })

    const genericBuffer = await readFile(options.genericTorrentPath)
    const parsed = (await Promise.resolve(parseTorrent(genericBuffer))) as ParsedTorrentFileDetails
    parsed.announce = [options.announceUrl]

    const trackerBuffer = Buffer.from(toTorrentFile(parsed as Parameters<typeof toTorrentFile>[0]))
    await writeFile(trackerTorrentPath, trackerBuffer)

    logger.info('Tracker-specific torrent created successfully.', {
        trackerTorrentPath,
        trackerCode: options.trackerCode,
    })

    return { trackerTorrentPath }
}
