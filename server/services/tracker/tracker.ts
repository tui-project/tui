import type { Metadata } from '../../model/metadata'

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
            | 'threeD'
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
    title: string
}

export interface RuleViolation {
    rule: string
    message: string
}

export interface TrackerService {
    getTitle(metadata: TrackerUploadMetadata): Promise<string>
    upload(torrentPath: string, metadata: TrackerUploadMetadata, description: string, mediainfoText: string, options: TrackerUploadOptions): Promise<string>
    checkRules(metadata: TrackerUploadMetadata): RuleViolation[]
}
