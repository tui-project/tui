export const UPLOAD_STATUS = {
    success: 'success',
    failed: 'failed',
} as const
export type UploadStatus = (typeof UPLOAD_STATUS)[keyof typeof UPLOAD_STATUS]

export const STATUS = {
    pending: 'pending',
    torrentCreation: 'torrent_creation',
    uploading: 'uploading',
    success: 'success',
    partialSuccess: 'partial_success',
    fail: 'fail',
} as const
export type Status = (typeof STATUS)[keyof typeof STATUS]

export interface TrackerItem {
    code: string
    title: string
    titleModified: boolean
    anonymous: boolean
    modQueueOptIn: boolean
    uploadStatus?: UploadStatus
    uploadError?: string
    torrentClientInjected?: boolean
}

export interface TrackerRequest {
    id: string
    filepath: string
    status: Status
    trackers: TrackerItem[]
    torrentCreationProgress?: number
    failedTrackerCodes?: string[]
    createdAt?: Date | string
    updatedAt?: Date | string
}
