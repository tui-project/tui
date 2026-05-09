import type { Metadata } from './metadata'

export const TRACKER_UPLOAD_STATUSES = {
    PENDING: 'pending',
    TORRENT_CREATION: 'torrent_creation',
    UPLOADING: 'uploading',
    SUCCESS: 'success',
    PARTIAL_SUCCESS: 'partial_success',
    FAIL: 'fail',
} as const

export type TrackerUploadStatus = (typeof TRACKER_UPLOAD_STATUSES)[keyof typeof TRACKER_UPLOAD_STATUSES]

export interface TrackerUploadRequest {
    id: string
    filepath: string
    metadata: Omit<Metadata, 'fileName'>
    description: string
    trackerCodes: string[]
    status: TrackerUploadStatus
    torrentCreationProgress?: number
    failedTrackerCodes?: string[]
}
