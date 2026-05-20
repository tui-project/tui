import { TRACKER_UPLOAD_STATUSES, type TrackerItem } from '../model/tracker-upload-request'
import { findGenericTorrentCacheByFilepath, saveGenericTorrentCache } from '../repositories/generic-torrent-cache-repository'
import { getSettings } from '../repositories/settings-repository'
import { updateTrackerUploadRequestStatus, updateTrackerUploadRequestTorrentCreationProgress, updateTrackerItem } from '../repositories/tracker-request-repository'
import { createGenericTorrent, createTrackerTorrent } from './torrent'
import { analyzeMediaFileAsText } from './mediainfo'
import { resolveMediaFilePath } from '../utils/file-system'
import { createTrackerService } from './tracker/tracker-factory'
import type { TrackerUploadMetadata } from './tracker/tracker'
import { logger } from '../utils/logger'
import { injectTorrent } from './torrent-client'

export async function upload(uploadRequestId: string, filepath: string, trackers: TrackerItem[], metadata: TrackerUploadMetadata, description: string) {
    const trackerCodes = trackers.map((t) => t.code)

    try {
        await updateTrackerUploadRequestStatus(uploadRequestId, TRACKER_UPLOAD_STATUSES.TORRENT_CREATION)
        logger.info('Tracker upload request started generic torrent creation.', { id: uploadRequestId, filepath, trackerCodes, status: TRACKER_UPLOAD_STATUSES.TORRENT_CREATION })

        const cachedGenericTorrent = await findGenericTorrentCacheByFilepath(filepath)
        const genericTorrentPath = cachedGenericTorrent ? cachedGenericTorrent.genericTorrentPath : await createGenericTorrentForUploadRequest(uploadRequestId, filepath)

        if (cachedGenericTorrent) {
            logger.debug('Reusing cached generic torrent for tracker upload request.', { id: uploadRequestId, filepath, trackerCodes, genericTorrentPath })
            await updateTrackerUploadRequestTorrentCreationProgress(uploadRequestId, 100)
        } else {
            await saveGenericTorrentCache({ filepath, genericTorrentPath })
        }

        const trackerTorrentPaths = await createTrackerTorrents(genericTorrentPath, filepath, trackerCodes)

        await updateTrackerUploadRequestStatus(uploadRequestId, TRACKER_UPLOAD_STATUSES.UPLOADING)
        logger.info('Tracker upload request uploading to trackers.', {
            id: uploadRequestId,
            filepath,
            trackerCodes,
            status: TRACKER_UPLOAD_STATUSES.UPLOADING,
            genericTorrentPath,
            trackerTorrentPaths,
        })

        const mediaFilePath = await resolveMediaFilePath(filepath)
        const mediainfoText = await analyzeMediaFileAsText(mediaFilePath)
        logger.debug('Mediainfo text ready for tracker upload.', { id: uploadRequestId, mediaFilePath })

        const failedTrackerCodes = await uploadToTrackers(uploadRequestId, trackerTorrentPaths, trackers, metadata, description, mediainfoText)

        if (failedTrackerCodes.length === 0) {
            await updateTrackerUploadRequestStatus(uploadRequestId, TRACKER_UPLOAD_STATUSES.SUCCESS)
            logger.info('Tracker upload request completed successfully.', { id: uploadRequestId, trackerCodes })
        } else if (failedTrackerCodes.length < trackerCodes.length) {
            await updateTrackerUploadRequestStatus(uploadRequestId, TRACKER_UPLOAD_STATUSES.PARTIAL_SUCCESS, failedTrackerCodes)
            logger.warn('Tracker upload request completed with partial success.', { id: uploadRequestId, failedTrackerCodes })
        } else {
            await updateTrackerUploadRequestStatus(uploadRequestId, TRACKER_UPLOAD_STATUSES.FAIL)
            logger.error('Tracker upload request failed for all trackers.', undefined, { id: uploadRequestId, trackerCodes })
        }
    } catch (error: unknown) {
        await updateTrackerUploadRequestStatus(uploadRequestId, TRACKER_UPLOAD_STATUSES.FAIL)
        logger.error('Failed to process tracker upload request.', error, { id: uploadRequestId, filepath })
    }
}

async function createGenericTorrentForUploadRequest(uploadRequestId: string, filepath: string) {
    const { genericTorrentPath } = await createGenericTorrent({
        sourcePath: filepath,
        onProgress: async (progressPercent) => await updateTrackerUploadRequestTorrentCreationProgress(uploadRequestId, progressPercent),
    })
    return genericTorrentPath
}

async function uploadToTrackers(
    uploadRequestId: string,
    trackerTorrentPaths: Record<string, string>,
    trackers: TrackerItem[],
    metadata: TrackerUploadMetadata,
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
            const torrentDownloadUrl = await trackerService.upload(torrentPath, metadata, description, mediainfoText, {
                title: tracker.title,
                anonymous: tracker.anonymous,
                modQueueOptIn: tracker.modQueueOptIn,
            })
            await updateTrackerItem(uploadRequestId, tracker.code, { uploadStatus: 'success' })
            logger.info('Successfully uploaded to tracker.', { trackerCode: tracker.code, torrentDownloadUrl })

            if (selectedTorrentClient) {
                const injected = await injectTorrent(torrentDownloadUrl, selectedTorrentClient)
                await updateTrackerItem(uploadRequestId, tracker.code, { torrentClientInjected: injected })
                if (!injected) {
                    logger.warn('Torrent client injection failed after successful tracker upload.', { trackerCode: tracker.code, clientCode: selectedTorrentClient.code })
                }
            }
        } catch (error: unknown) {
            logger.error('Failed to upload to tracker.', error, { trackerCode: tracker.code })
            failedTrackerCodes.push(tracker.code)
            await updateTrackerItem(uploadRequestId, tracker.code, { uploadStatus: 'failed' })
        }
    }

    return failedTrackerCodes
}

async function createTrackerTorrents(genericTorrentPath: string, filepath: string, trackerCodes: string[]): Promise<Record<string, string>> {
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
    }

    return results
}
