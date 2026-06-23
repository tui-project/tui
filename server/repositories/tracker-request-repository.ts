import { createHash } from 'node:crypto'
import type { TrackerRequest } from '../model/tracker-request'
import { trackerUploadRequestCollection } from '../utils/db'

export async function saveTrackerRequest(request: Omit<TrackerRequest, 'groupId' | 'createdAt' | 'updatedAt'>) {
    return await trackerUploadRequestCollection.insertAsync({ ...request, groupId: deriveGroupId(request.filepath) })
}

function deriveGroupId(filepath: string): string {
    const normalized = filepath.trim().replace(/\/+$/, '')
    return createHash('sha256').update(normalized).digest('hex')
}

export async function getTrackerRequest(id: string) {
    return await trackerUploadRequestCollection.findOneAsync({ id })
}

export async function getTrackerRequests(page: number, size: number, withGroupCount = false): Promise<{ items: TrackerRequestResponse[]; total: number }> {
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
    return trackerUploadRequestCollection.findAsync({ groupId }).sort({ createdAt: -1 })
}

export async function updateTrackerRequestStatus(id: string, status: Status, failedTrackerCodes?: string[]) {
    const update: Partial<TrackerRequest> = { status }

    if (status === 'partial_success') {
        update.failedTrackerCodes = failedTrackerCodes ?? []
    } else {
        update.failedTrackerCodes = undefined
    }

    await trackerUploadRequestCollection.updateAsync({ id }, { $set: update }, {})
}

export async function updateTrackerRequestTorrentCreationProgress(id: string, torrentCreationProgress: number) {
    await trackerUploadRequestCollection.updateAsync({ id }, { $set: { torrentCreationProgress } }, {})
}

export async function updateTrackerItem(
    id: string,
    code: string,
    update: Partial<Pick<TrackerRequest['trackers'][number], 'uploadStatus' | 'uploadError' | 'torrentClientInjected'>>
) {
    const request = await trackerUploadRequestCollection.findOneAsync({ id })
    if (!request) return

    const trackers = request.trackers.map((t) => (t.code === code ? { ...t, ...update } : t))
    await trackerUploadRequestCollection.updateAsync({ id }, { $set: { trackers } }, {})
}

export async function resetTrackerRequest(id: string) {
    await trackerUploadRequestCollection.updateAsync({ id }, { $set: { status: 'pending', torrentCreationProgress: 0 }, $unset: { failedTrackerCodes: true } }, {})
    return await trackerUploadRequestCollection.findOneAsync({ id })
}

async function countTrackerRequestsByGroup(groupId: string) {
    return trackerUploadRequestCollection.countAsync({ groupId })
}

export async function backfillTrackerRequestGroupIds() {
    const missing = await trackerUploadRequestCollection.findAsync({ groupId: { $exists: false } })
    if (!missing.length) return

    await Promise.all(missing.map((request) => trackerUploadRequestCollection.updateAsync({ id: request.id }, { $set: { groupId: deriveGroupId(request.filepath) } }, {})))
}
