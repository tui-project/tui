import type { TrackerUploadRequest, TrackerUploadStatus } from '../model/tracker-upload-request'
import { trackerUploadRequestCollection } from '../utils/db'

export async function saveTrackerUploadRequest(request: TrackerUploadRequest) {
    return await trackerUploadRequestCollection.insertAsync(request)
}

export async function findTrackerUploadRequestById(id: string) {
    return await trackerUploadRequestCollection.findOneAsync({ id })
}

export async function findAllTrackerUploadRequests(limit?: number) {
    const query = trackerUploadRequestCollection.findAsync({}).sort({ createdAt: -1 })
    return limit !== undefined ? query.limit(limit) : query
}

export async function updateTrackerUploadRequestStatus(id: string, status: TrackerUploadStatus, failedTrackerCodes?: string[]) {
    const update: Partial<TrackerUploadRequest> = { status }

    if (status === 'partial_success') {
        update.failedTrackerCodes = failedTrackerCodes ?? []
    } else {
        update.failedTrackerCodes = undefined
    }

    await trackerUploadRequestCollection.updateAsync({ id }, { $set: update }, {})
}

export async function updateTrackerUploadRequestTorrentCreationProgress(id: string, torrentCreationProgress: number) {
    await trackerUploadRequestCollection.updateAsync({ id }, { $set: { torrentCreationProgress } }, {})
}

export async function resetTrackerUploadRequest(id: string) {
    await trackerUploadRequestCollection.updateAsync({ id }, { $set: { status: 'pending', torrentCreationProgress: 0 }, $unset: { failedTrackerCodes: true } }, {})
    return await trackerUploadRequestCollection.findOneAsync({ id })
}
