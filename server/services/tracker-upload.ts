import { rm } from 'node:fs/promises'
import { findGenericTorrentCacheByFilepath, saveGenericTorrentCache } from '../repositories/generic-torrent-cache-repository'
import { getSettings } from '../repositories/settings-repository'
import {
    updateTrackerItem as updateStoredTrackerItem,
    updateTrackerRequestStatus as updateStoredTrackerRequestStatus,
    updateTrackerRequestTorrentCreationProgress as updateStoredTrackerRequestTorrentCreationProgress,
} from '../repositories/tracker-request-repository'
import { createGenericTorrent, createTrackerTorrent } from './torrent'
import { analyzeMediaFileAsText } from './mediainfo'
import { resolveMediaFilePath } from '../utils/file-system'
import { createTrackerService } from './tracker/tracker-factory'
import { TrackerError } from './tracker/tracker'
import { createLogger } from '../utils/logger'
import { injectTorrent } from './torrent-client'
import { publishTrackerRequest } from '../events/tracker-request'

const logger = createLogger('tracker-upload')

export async function upload(uploadRequestId: string, filepath: string, trackers: TrackerItem[], metadata: Metadata, description: string) {
    logger.debug('Tracker upload request', { id: uploadRequestId, filepath, trackers })
    logger.trace('Tracker upload request', { metadata, description })

    const trackerCodes = trackers.map((t) => t.code)
    let trackerTorrentPaths: Record<string, string> = {}

    try {
        await updateTrackerRequestStatus(uploadRequestId, STATUS.TORRENT_CREATION)

        logger.debug('Tracker upload request started generic torrent creation.', { id: uploadRequestId, filepath, trackerCodes, status: STATUS.TORRENT_CREATION })

        const cachedGenericTorrent = await findGenericTorrentCacheByFilepath(filepath)
        const genericTorrentPath = cachedGenericTorrent ? cachedGenericTorrent.genericTorrentPath : await createGenericTorrentForUploadRequest(uploadRequestId, filepath)

        if (cachedGenericTorrent) {
            logger.debug('Reusing cached generic torrent for tracker upload request.', { id: uploadRequestId, filepath, trackerCodes, genericTorrentPath })
            await updateTrackerRequestTorrentCreationProgress(uploadRequestId, 100)
        } else {
            await saveGenericTorrentCache({ filepath, genericTorrentPath })
        }

        trackerTorrentPaths = await createTrackerTorrents(genericTorrentPath, filepath, trackerCodes)

        await updateTrackerRequestStatus(uploadRequestId, STATUS.UPLOADING)
        logger.debug('Starting to upload torrent to trackers.', {
            id: uploadRequestId,
            filepath,
            trackerCodes,
            status: STATUS.UPLOADING,
            genericTorrentPath,
            trackerTorrentPaths,
        })

        const mediaFilePath = await resolveMediaFilePath(filepath)
        const mediainfoText = await analyzeMediaFileAsText(mediaFilePath)

        logger.debug('Mediainfo text ready for tracker upload.', { id: uploadRequestId, mediaFilePath })

        const failedTrackerCodes = await uploadToTrackers(uploadRequestId, trackerTorrentPaths, trackers, metadata, description, mediainfoText)

        if (failedTrackerCodes.length === 0) {
            await updateTrackerRequestStatus(uploadRequestId, STATUS.SUCCESS)
            logger.info('Torrent uploaded successfully.', { id: uploadRequestId, trackerCodes })
        } else if (failedTrackerCodes.length < trackerCodes.length) {
            await updateTrackerRequestStatus(uploadRequestId, STATUS.PARTIAL_SUCCESS, failedTrackerCodes)
            logger.warn('Torrent upload completed with failures.', { id: uploadRequestId, trackerCodes, failedTrackerCodes })
        } else {
            await updateTrackerRequestStatus(uploadRequestId, STATUS.FAIL)
            logger.error('Torrent upload failed for all trackers.', undefined, { id: uploadRequestId, trackerCodes })
        }
    } catch (error: unknown) {
        await updateTrackerRequestStatus(uploadRequestId, STATUS.FAIL)
        logger.warn('Failed to process tracker upload request.', error, { id: uploadRequestId, filepath })
    } finally {
        await removeTrackerTorrents(trackerTorrentPaths)
    }
}

async function updateTrackerRequestStatus(id: string, status: Status, failedTrackerCodes?: string[]) {
    let request: TrackerRequestResponse | null
    if (failedTrackerCodes) {
        request = await updateStoredTrackerRequestStatus(id, status, failedTrackerCodes)
    } else {
        request = await updateStoredTrackerRequestStatus(id, status)
    }

    if (request) publishTrackerRequest(request)
}

async function removeTrackerTorrents(trackerTorrentPaths: Record<string, string>) {
    await Promise.all(
        Object.values(trackerTorrentPaths).map(async (torrentPath) => {
            try {
                await rm(torrentPath, { force: true })
            } catch {
                logger.warn('Failed to remove tracker-specific torrent file.', { torrentPath })
            }
        })
    )
}

async function createGenericTorrentForUploadRequest(uploadRequestId: string, filepath: string) {
    const { genericTorrentPath } = await createGenericTorrent({
        sourcePath: filepath,
        onProgress: async (progressPercent) => await updateTrackerRequestTorrentCreationProgress(uploadRequestId, progressPercent),
    })
    return genericTorrentPath
}

async function updateTrackerRequestTorrentCreationProgress(id: string, torrentCreationProgress: number) {
    const request = await updateStoredTrackerRequestTorrentCreationProgress(id, torrentCreationProgress)
    if (request) publishTrackerRequest(request)
}

async function uploadToTrackers(
    uploadRequestId: string,
    trackerTorrentPaths: Record<string, string>,
    trackers: TrackerItem[],
    metadata: Metadata,
    description: string,
    mediainfoText: string
) {
    const failedTrackerCodes: string[] = []
    const settings = await getSettings()
    const selectedTorrentClient = settings.torrentClients.find((c) => c.selected)

    for (const tracker of trackers) {
        const torrentPath = trackerTorrentPaths[tracker.code]
        if (!torrentPath) {
            logger.warn('Skipping tracker upload: no torrent path found.', { trackerCode: tracker.code })

            failedTrackerCodes.push(tracker.code)
            await updateTrackerItem(uploadRequestId, tracker.code, { uploadStatus: 'failed' })

            continue
        }

        try {
            const trackerService = await createTrackerService(tracker.code)
            const torrentDownloadUrl = await trackerService.upload(torrentPath, metadata, description, mediainfoText, tracker.title, {
                anonymous: tracker.anonymous,
                modQueueOptIn: tracker.modQueueOptIn,
            })
            await updateTrackerItem(uploadRequestId, tracker.code, { uploadStatus: 'success' })

            logger.debug('Successfully uploaded to tracker.', { trackerTitle: tracker.title, trackerCode: tracker.code, torrentDownloadUrl })

            if (selectedTorrentClient) {
                const injected = await injectTorrent(torrentDownloadUrl, selectedTorrentClient)
                await updateTrackerItem(uploadRequestId, tracker.code, { torrentClientInjected: injected })

                if (!injected) {
                    logger.warn('Torrent client injection failed after successful tracker upload.', { trackerCode: tracker.code, clientCode: selectedTorrentClient.code })
                }
            }
        } catch (error: unknown) {
            const context =
                error instanceof TrackerError ? { trackerCode: tracker.code, statusCode: error.statusCode, responseData: error.responseData } : { trackerCode: tracker.code }
            logger.warn('Failed to upload to tracker.', error, context)

            failedTrackerCodes.push(tracker.code)
            await updateTrackerItem(uploadRequestId, tracker.code, { uploadStatus: 'failed', ...(error instanceof TrackerError && { uploadError: error.reason }) })
        }
    }

    return failedTrackerCodes
}

async function updateTrackerItem(id: string, code: string, update: Partial<Pick<TrackerItem, 'uploadStatus' | 'uploadError' | 'torrentClientInjected'>>) {
    const request = await updateStoredTrackerItem(id, code, update)
    if (request) publishTrackerRequest(request)
}

async function createTrackerTorrents(genericTorrentPath: string, filepath: string, trackerCodes: string[]): Promise<Record<string, string>> {
    logger.debug('Creating tracker specific torrent', { genericTorrentPath, filepath, trackerCodes })

    const settings = await getSettings()
    const trackersByCode = Object.fromEntries(settings.trackers.map((t) => [t.code, t]))
    const results: Record<string, string> = {}

    for (const code of trackerCodes) {
        const tracker = trackersByCode[code]
        if (!tracker?.passKey) {
            logger.warn('Skipping tracker-specific torrent: passKey not configured.', { trackerCode: code })
            continue
        }

        const announceUrl = `${tracker.url}/announce/${tracker.passKey}`
        const { trackerTorrentPath } = await createTrackerTorrent({ genericTorrentPath, trackerCode: code, announceUrl, sourcePath: filepath })
        results[code] = trackerTorrentPath

        logger.trace('Tracker specific torrent created', { trackerCode: code })
    }

    return results
}
