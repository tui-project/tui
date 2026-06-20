export type ImageHostProvider = 'imgbb'

export type ImageHostProviderSettings = {
    selected: boolean
    code: string
    name: string
    apiKey?: string
}

export type TrackerSettings = {
    selected: boolean
    code: string
    name: string
    apiKey?: string
    passKey?: string
}

export type TorrentClientSettings = {
    selected: boolean
    code: string
    name: string
    url: string
    apiKey: string
}

export type AppSettings = {
    mediaPaths: string[]
    tmdbApiKey: string
    imageHostProviders: ImageHostProviderSettings[]
    trackers: TrackerSettings[]
    torrentClients: TorrentClientSettings[]
    mediainfoPath: string
    ffmpegPath: string
    ffprobePath: string
    movieScreenshotCount: number
    episodePackScreenshotCount: number
    logLevel: number
}

export function useGetSettings() {
    return useFetch<AppSettings>('/api/settings')
}
