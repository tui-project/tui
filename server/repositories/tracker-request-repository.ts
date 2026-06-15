import { trackerUploadRequestCollection } from '../utils/db'

export async function saveTrackerRequest(request: TrackerRequest) {
    return await trackerUploadRequestCollection.insertAsync(request)
}

export async function getTrackerRequest(id: string) {
    return await trackerUploadRequestCollection.findOneAsync({ id })
}

export async function getTrackerRequests(page: number, size: number) {
    return trackerUploadRequestCollection
        .findAsync({})
        .sort({ createdAt: -1 })
        .skip((page - 1) * size)
        .limit(size)
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
