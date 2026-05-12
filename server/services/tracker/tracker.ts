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
    title: string
}

export interface TrackerService {
    getTitle(metadata: TrackerUploadMetadata): Promise<string>
    upload(torrentPath: string, metadata: TrackerUploadMetadata, description: string, mediainfoText: string, options: TrackerUploadOptions): Promise<void>
}
