import { createHash } from 'node:crypto'
import type { TrackerRequest } from '../model/tracker-request'
import { trackerUploadRequestCollection } from '../utils/db'
import { createLogger } from '../utils/logger'

const logger = createLogger('repository:tracker-request')

export async function saveTrackerRequest(request: Omit<TrackerRequest, 'groupId' | 'createdAt' | 'updatedAt'>) {
    logger.trace('Saving tracker request.', { requestId: request.id })
    return await trackerUploadRequestCollection.insertAsync({ ...request, groupId: deriveGroupId(request.filepath) })
}

function deriveGroupId(filepath: string): string {
    const normalized = filepath.trim().replace(/\/+$/, '')
    return createHash('sha256').update(normalized).digest('hex')
}

export async function getTrackerRequest(id: string) {
    logger.trace('Finding tracker request.', { requestId: id })
    return await trackerUploadRequestCollection.findOneAsync({ id })
}

export async function getTrackerRequests(page: number, size: number, withGroupCount = false): Promise<{ items: TrackerRequestResponse[]; total: number }> {
    logger.trace('Finding tracker requests.', { page, size, withGroupCount })

    const [items, total] = await Promise.all([
        trackerUploadRequestCollection
            .findAsync({})
            .sort({ createdAt: -1 })
            .skip((page - 1) * size)
            .limit(size),
        trackerUploadRequestCollection.countAsync({}),
    ])
    if (!withGroupCount) {
        return {
            items,
            total,
        }
    }

    return {
        items: await Promise.all(items.map(async (item) => ({ ...item, groupCount: await countTrackerRequestsByGroup(item.groupId) }))),
        total,
    }
}

export async function getTrackerRequestsByGroup(groupId: string) {
    logger.trace('Finding tracker requests by group.', { groupId })
    return trackerUploadRequestCollection.findAsync({ groupId }).sort({ createdAt: -1 })
}

export async function updateTrackerRequestStatus(id: string, status: Status, failedTrackerCodes?: string[]) {
    logger.trace('Updating tracker request status.', { requestId: id, status })

    const update: Partial<TrackerRequest> = { status }
    if (status === 'partial_success') {
        update.failedTrackerCodes = failedTrackerCodes ?? []
    } else {
        update.failedTrackerCodes = undefined
    }
    const { affectedDocuments } = await trackerUploadRequestCollection.updateAsync({ id }, { $set: update }, { returnUpdatedDocs: true })

    return affectedDocuments
}

export async function updateTrackerRequestTorrentCreationProgress(id: string, torrentCreationProgress: number) {
    logger.trace('Updating tracker request torrent creation progress.', { requestId: id, torrentCreationProgress })

    const { affectedDocuments } = await trackerUploadRequestCollection.updateAsync({ id }, { $set: { torrentCreationProgress } }, { returnUpdatedDocs: true })

    return affectedDocuments
}

export async function updateTrackerItem(
    id: string,
    code: string,
    update: Partial<Pick<TrackerRequest['trackers'][number], 'uploadStatus' | 'uploadError' | 'torrentClientInjected'>>
) {
    logger.trace('Updating tracker request item.', { requestId: id, trackerCode: code })

    const request = await trackerUploadRequestCollection.findOneAsync({ id })
    if (!request) return

    const trackers = request.trackers.map((t) => (t.code === code ? { ...t, ...update } : t))
    const { affectedDocuments } = await trackerUploadRequestCollection.updateAsync({ id }, { $set: { trackers } }, { returnUpdatedDocs: true })

    return affectedDocuments
}

export async function resetTrackerRequest(id: string) {
    logger.trace('Resetting tracker request.', { requestId: id })

    await trackerUploadRequestCollection.updateAsync({ id }, { $set: { status: 'pending', torrentCreationProgress: 0 }, $unset: { failedTrackerCodes: true } }, {})
    return await trackerUploadRequestCollection.findOneAsync({ id })
}

async function countTrackerRequestsByGroup(groupId: string) {
    logger.trace('Counting tracker requests by group.', { groupId })
    return trackerUploadRequestCollection.countAsync({ groupId })
}
