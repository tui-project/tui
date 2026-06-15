export const TRACKER_UPLOAD_STATUSES = {
    PENDING: 'pending',
    TORRENT_CREATION: 'torrent_creation',
    UPLOADING: 'uploading',
    SUCCESS: 'success',
    PARTIAL_SUCCESS: 'partial_success',
    FAIL: 'fail',
} as const

export type TrackerUploadStatus = (typeof TRACKER_UPLOAD_STATUSES)[keyof typeof TRACKER_UPLOAD_STATUSES]

export interface TrackerItem {
    code: string
    title: string
    titleModified: boolean
    anonymous: boolean
    modQueueOptIn: boolean
    uploadStatus?: 'success' | 'failed'
    uploadError?: string
    torrentClientInjected?: boolean
}

export interface TrackerUploadRequest {
    id: string
    filepath: string
    metadata: Omit<Metadata, 'fileName'>
    description: string
    trackers: TrackerItem[]
    status: TrackerUploadStatus
    torrentCreationProgress?: number
    failedTrackerCodes?: string[]
    createdAt?: Date
    updatedAt?: Date
}
