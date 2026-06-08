import type { Metadata } from '../../model/metadata'

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

export type TrackerUploadMetadata = Omit<Metadata, 'fileName'> &
    Required<
        Pick<
            Metadata,
            | 'title'
            | 'mediaType'
            | 'year'
            | 'language'
            | 'originalLanguage'
            | 'source'
            | 'sourceType'
            | 'repack'
            | 'proper'
            | 'rerip'
            | 'hybrid'
            | 'hi10p'
            | 'resolution'
            | 'videoCodec'
            | 'audioCodec'
            | 'audioChannels'
            | 'tmdbId'
            | 'imdbId'
        >
    >

export interface TrackerUploadOptions {
    anonymous: boolean
    modQueueOptIn: boolean
}

export interface RuleViolation {
    rule: string
    message: string
}

export interface TrackerService {
    getTitle(metadata: TrackerUploadMetadata): Promise<string>
    upload(torrentPath: string, metadata: TrackerUploadMetadata, description: string, mediainfoText: string, title: string, options: TrackerUploadOptions): Promise<string>
    checkRules(metadata: TrackerUploadMetadata): RuleViolation[]
}
