export interface TrackerRequest {
    id: string
    filepath: string
    groupId: string
    metadata: Metadata
    description: string
    status: Status
    trackers: TrackerItem[]
    torrentCreationProgress?: number
    failedTrackerCodes?: string[]
    createdAt?: Date
    updatedAt?: Date
}
