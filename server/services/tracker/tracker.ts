export class TrackerError extends Error {
    constructor(
        public readonly reason: string,
        public readonly statusCode: number | undefined,
        public readonly responseData: unknown
    ) {
        super('Tracker upload failed')
        this.name = 'TrackerError'
    }
}

export interface TrackerUploadOptions {
    anonymous: boolean
    modQueueOptIn: boolean
}

export interface RuleViolation {
    rule: string
    message: string
}

export interface DuplicateEntry {
    name: string
    url?: string
    trumpable: boolean
}

export interface TrackerService {
    getTitle(metadata: Metadata): Promise<string>
    upload(torrentPath: string, metadata: Metadata, description: string, mediainfoText: string, title: string, options: TrackerUploadOptions): Promise<string>
    checkRules(metadata: Metadata): RuleViolation[]
    findDuplicates(metadata: Metadata): Promise<DuplicateEntry[]>
}
