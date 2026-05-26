import { beforeEach, describe, expect, it, vi } from 'vitest'

const rm = vi.fn()
const updateTrackerUploadRequestStatus = vi.fn()
const updateTrackerUploadRequestTorrentCreationProgress = vi.fn()
const updateTrackerItem = vi.fn()
const findGenericTorrentCacheByFilepath = vi.fn()
const saveGenericTorrentCache = vi.fn()
const getSettings = vi.fn()
const createGenericTorrent = vi.fn()
const createTrackerTorrent = vi.fn()
const analyzeMediaFileAsText = vi.fn()
const resolveMediaFilePath = vi.fn()
const trackerServiceUpload = vi.fn()
const createTrackerService = vi.fn()
const injectTorrent = vi.fn()
const logger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    trace: vi.fn(),
}

const TRACKER_UPLOAD_STATUSES = {
    PENDING: 'pending',
    TORRENT_CREATION: 'torrent_creation',
    UPLOADING: 'uploading',
    SUCCESS: 'success',
    PARTIAL_SUCCESS: 'partial_success',
    FAIL: 'fail',
}

const defaultSettings = {
    trackers: [
        { code: 'TRK1', url: 'https://tracker1.example', passKey: 'pass1' },
        { code: 'TRK2', url: 'https://tracker2.example', passKey: 'pass2' },
    ],
    torrentClients: [],
}

const defaultTrackers = [
    { code: 'TRK1', title: 'Tracker 1', titleModified: false, anonymous: false, modQueueOptIn: false },
    { code: 'TRK2', title: 'Tracker 2', titleModified: false, anonymous: false, modQueueOptIn: false },
]

const defaultMetadata = { mediaType: 'movie' as const, title: 'Movie' } as never

beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()

    updateTrackerUploadRequestStatus.mockResolvedValue(undefined)
    updateTrackerUploadRequestTorrentCreationProgress.mockResolvedValue(undefined)
    updateTrackerItem.mockResolvedValue(undefined)
    findGenericTorrentCacheByFilepath.mockResolvedValue(null)
    saveGenericTorrentCache.mockResolvedValue(undefined)
    getSettings.mockResolvedValue(defaultSettings)
    createGenericTorrent.mockResolvedValue({ genericTorrentPath: '/config/torrents/generic.torrent' })
    createTrackerTorrent
        .mockResolvedValueOnce({ trackerTorrentPath: '/config/tmp/torrents/TRK1/Movie.torrent' })
        .mockResolvedValueOnce({ trackerTorrentPath: '/config/tmp/torrents/TRK2/Movie.torrent' })
    analyzeMediaFileAsText.mockResolvedValue('mediainfo text')
    resolveMediaFilePath.mockResolvedValue('/media/Movie.mkv')
    trackerServiceUpload.mockResolvedValue('https://tracker1.example/torrents/1')
    createTrackerService.mockResolvedValue({ upload: trackerServiceUpload })
    injectTorrent.mockResolvedValue(true)
    rm.mockResolvedValue(undefined)
})

async function loadService() {
    vi.doMock('node:fs/promises', () => ({ rm }))
    vi.doMock('../../../../server/model/tracker-upload-request', () => ({ TRACKER_UPLOAD_STATUSES }))
    vi.doMock('../../../../server/repositories/generic-torrent-cache-repository', () => ({
        findGenericTorrentCacheByFilepath,
        saveGenericTorrentCache,
    }))
    vi.doMock('../../../../server/repositories/settings-repository', () => ({ getSettings }))
    vi.doMock('../../../../server/repositories/tracker-request-repository', () => ({
        updateTrackerUploadRequestStatus,
        updateTrackerUploadRequestTorrentCreationProgress,
        updateTrackerItem,
    }))
    vi.doMock('../../../../server/services/torrent', () => ({ createGenericTorrent, createTrackerTorrent }))
    vi.doMock('../../../../server/services/mediainfo', () => ({ analyzeMediaFileAsText }))
    vi.doMock('../../../../server/utils/file-system', () => ({ resolveMediaFilePath }))
    vi.doMock('../../../../server/services/tracker/tracker-factory', () => ({ createTrackerService }))
    vi.doMock('../../../../server/services/torrent-client', () => ({ injectTorrent }))
    vi.doMock('../../../../server/utils/logger', () => ({ logger }))

    return import('../../../../server/services/tracker-upload')
}

describe('tracker upload service', () => {
    describe('successful upload', () => {
        it('transitions status through torrent_creation → uploading → success', async () => {
            const { upload } = await loadService()

            await upload('req-1', '/media/Movie.mkv', defaultTrackers, defaultMetadata, 'desc')

            expect(updateTrackerUploadRequestStatus).toHaveBeenNthCalledWith(1, 'req-1', 'torrent_creation')
            expect(updateTrackerUploadRequestStatus).toHaveBeenNthCalledWith(2, 'req-1', 'uploading')
            expect(updateTrackerUploadRequestStatus).toHaveBeenNthCalledWith(3, 'req-1', 'success')
        })

        it('creates a generic torrent and saves cache entry when no cache exists', async () => {
            const { upload } = await loadService()

            await upload('req-1', '/media/Movie.mkv', defaultTrackers, defaultMetadata, 'desc')

            expect(createGenericTorrent).toHaveBeenCalledWith({
                sourcePath: '/media/Movie.mkv',
                onProgress: expect.any(Function),
            })
            expect(saveGenericTorrentCache).toHaveBeenCalledWith({
                filepath: '/media/Movie.mkv',
                genericTorrentPath: '/config/torrents/generic.torrent',
            })
        })

        it('reuses cached generic torrent and skips creation', async () => {
            findGenericTorrentCacheByFilepath.mockResolvedValue({
                filepath: '/media/Movie.mkv',
                genericTorrentPath: '/config/torrents/cached.torrent',
            })
            const { upload } = await loadService()

            await upload('req-1', '/media/Movie.mkv', defaultTrackers, defaultMetadata, 'desc')

            expect(createGenericTorrent).not.toHaveBeenCalled()
            expect(saveGenericTorrentCache).not.toHaveBeenCalled()
            expect(updateTrackerUploadRequestTorrentCreationProgress).toHaveBeenCalledWith('req-1', 100)
        })

        it('creates tracker-specific torrents with announce URLs', async () => {
            const { upload } = await loadService()

            await upload('req-1', '/media/Movie.mkv', defaultTrackers, defaultMetadata, 'desc')

            expect(createTrackerTorrent).toHaveBeenCalledWith({
                genericTorrentPath: '/config/torrents/generic.torrent',
                trackerCode: 'TRK1',
                announceUrl: 'https://tracker1.example/announce/pass1',
                sourcePath: '/media/Movie.mkv',
            })
            expect(createTrackerTorrent).toHaveBeenCalledWith({
                genericTorrentPath: '/config/torrents/generic.torrent',
                trackerCode: 'TRK2',
                announceUrl: 'https://tracker2.example/announce/pass2',
                sourcePath: '/media/Movie.mkv',
            })
        })

        it('marks each tracker item as success after upload', async () => {
            const { upload } = await loadService()

            await upload('req-1', '/media/Movie.mkv', defaultTrackers, defaultMetadata, 'desc')

            expect(updateTrackerItem).toHaveBeenCalledWith('req-1', 'TRK1', { uploadStatus: 'success' })
            expect(updateTrackerItem).toHaveBeenCalledWith('req-1', 'TRK2', { uploadStatus: 'success' })
        })

        it('injects torrent into client when one is selected', async () => {
            getSettings.mockResolvedValue({
                ...defaultSettings,
                torrentClients: [{ code: 'qb', selected: true }],
            })
            const { upload } = await loadService()

            await upload('req-1', '/media/Movie.mkv', defaultTrackers, defaultMetadata, 'desc')

            expect(injectTorrent).toHaveBeenCalledTimes(2)
            expect(updateTrackerItem).toHaveBeenCalledWith('req-1', 'TRK1', { torrentClientInjected: true })
        })

        it('logs a warning when torrent client injection fails', async () => {
            getSettings.mockResolvedValue({
                ...defaultSettings,
                torrentClients: [{ code: 'qb', selected: true }],
            })
            injectTorrent.mockResolvedValue(false)
            const { upload } = await loadService()

            await upload('req-1', '/media/Movie.mkv', defaultTrackers, defaultMetadata, 'desc')

            expect(logger.warn).toHaveBeenCalledWith('Torrent client injection failed after successful tracker upload.', expect.any(Object))
            expect(updateTrackerItem).toHaveBeenCalledWith('req-1', 'TRK1', { torrentClientInjected: false })
        })
    })

    describe('tracker torrent cleanup', () => {
        it('removes all tracker-specific torrent files after successful upload', async () => {
            const { upload } = await loadService()

            await upload('req-1', '/media/Movie.mkv', defaultTrackers, defaultMetadata, 'desc')

            expect(rm).toHaveBeenCalledWith('/config/tmp/torrents/TRK1/Movie.torrent', { force: true })
            expect(rm).toHaveBeenCalledWith('/config/tmp/torrents/TRK2/Movie.torrent', { force: true })
        })

        it('removes tracker torrent files even when upload to tracker fails', async () => {
            trackerServiceUpload.mockRejectedValue(new Error('upload failed'))
            const { upload } = await loadService()

            await upload('req-1', '/media/Movie.mkv', defaultTrackers, defaultMetadata, 'desc')

            expect(rm).toHaveBeenCalledWith('/config/tmp/torrents/TRK1/Movie.torrent', { force: true })
            expect(rm).toHaveBeenCalledWith('/config/tmp/torrents/TRK2/Movie.torrent', { force: true })
        })

        it('logs a warning when tracker torrent file removal fails', async () => {
            rm.mockRejectedValue(new Error('disk error'))
            const { upload } = await loadService()

            await upload('req-1', '/media/Movie.mkv', defaultTrackers, defaultMetadata, 'desc')

            expect(logger.warn).toHaveBeenCalledWith('Failed to remove tracker-specific torrent file.', expect.objectContaining({ torrentPath: expect.any(String) }))
        })
    })

    describe('partial and full failure', () => {
        it('sets partial_success when only some trackers fail', async () => {
            trackerServiceUpload.mockResolvedValueOnce('https://tracker1.example/torrents/1').mockRejectedValueOnce(new Error('TRK2 failed'))
            const { upload } = await loadService()

            await upload('req-1', '/media/Movie.mkv', defaultTrackers, defaultMetadata, 'desc')

            expect(updateTrackerUploadRequestStatus).toHaveBeenCalledWith('req-1', 'partial_success', ['TRK2'])
        })

        it('sets fail when all trackers fail', async () => {
            trackerServiceUpload.mockRejectedValue(new Error('all failed'))
            const { upload } = await loadService()

            await upload('req-1', '/media/Movie.mkv', defaultTrackers, defaultMetadata, 'desc')

            expect(updateTrackerUploadRequestStatus).toHaveBeenCalledWith('req-1', 'fail')
        })

        it('marks tracker item as failed and records code when torrent path is missing', async () => {
            createTrackerTorrent.mockReset()
            // TRK2 has no passKey so no tracker torrent is created for it
            getSettings.mockResolvedValue({
                trackers: [
                    { code: 'TRK1', url: 'https://tracker1.example', passKey: 'pass1' },
                    { code: 'TRK2', url: 'https://tracker2.example', passKey: '' },
                ],
                torrentClients: [],
            })
            createTrackerTorrent.mockResolvedValueOnce({ trackerTorrentPath: '/config/tmp/torrents/TRK1/Movie.torrent' })
            const { upload } = await loadService()

            await upload('req-1', '/media/Movie.mkv', defaultTrackers, defaultMetadata, 'desc')

            expect(logger.warn).toHaveBeenCalledWith('Skipping tracker upload: no torrent path found.', { trackerCode: 'TRK2' })
            expect(updateTrackerItem).toHaveBeenCalledWith('req-1', 'TRK2', { uploadStatus: 'failed' })
        })

        it('sets fail and logs error when an unexpected error occurs', async () => {
            createGenericTorrent.mockRejectedValue(new Error('disk full'))
            const { upload } = await loadService()

            await upload('req-1', '/media/Movie.mkv', defaultTrackers, defaultMetadata, 'desc')

            expect(updateTrackerUploadRequestStatus).toHaveBeenCalledWith('req-1', 'fail')
            expect(logger.error).toHaveBeenCalledWith('Failed to process tracker upload request.', expect.any(Error), { id: 'req-1', filepath: '/media/Movie.mkv' })
        })
    })

    describe('tracker-specific torrent creation', () => {
        it('skips trackers without a passKey', async () => {
            getSettings.mockResolvedValue({
                trackers: [{ code: 'TRK1', url: 'https://tracker1.example', passKey: '' }],
                torrentClients: [],
            })
            createTrackerTorrent.mockReset()
            const { upload } = await loadService()

            await upload('req-1', '/media/Movie.mkv', [defaultTrackers[0]!], defaultMetadata, 'desc')

            expect(createTrackerTorrent).not.toHaveBeenCalled()
            expect(logger.warn).toHaveBeenCalledWith('Skipping tracker-specific torrent: passKey not configured.', { trackerCode: 'TRK1' })
        })
    })
})
