import type { TrackerRequest } from '~~/server/model/tracker-request'

export const UPLOAD_STATUS = {
    SUCCESS: 'success',
    FAILED: 'failed',
} as const
export type UploadStatus = (typeof UPLOAD_STATUS)[keyof typeof UPLOAD_STATUS]

export const STATUS = {
    PENDING: 'pending',
    TORRENT_CREATION: 'torrent_creation',
    UPLOADING: 'uploading',
    SUCCESS: 'success',
    PARTIAL_SUCCESS: 'partial_success',
    FAIL: 'fail',
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

export interface TrackerRequestResponse extends TrackerRequest {
    groupCount?: number
}
