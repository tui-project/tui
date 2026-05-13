export type MediaType = 'movie' | 'tv' | ''

export type Metadata = {
    fileName: string
    releaseGroup: string
    mediaType: MediaType
    title: string
    originalTitle: string
    year: number | null
    season: number | null
    episode: number | null
    language: string[]
    originalLanguage: string
    sourceType: string
    source: string
    service: string
    repack: number
    proper: number
    rerip: boolean
    threeD: boolean
    cut: string
    ratio: string
    hybrid: boolean
    hi10p: boolean
    resolution: string
    hdr: string[]
    videoCodec: string
    audioCodec: string
    audioChannels: string
    audioMetadata: string
    tmdbId: number | null
    imdbId: string
    tvdbId: number | null
}

export type Path = {
    label: string
    value: string
    icon: string
    folder: boolean
}
