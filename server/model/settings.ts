export interface Settings {
    id: 'app-settings'
    mediaPaths: string[]
    tmdbApiKey: string
    imageHostProviders: ImageHostProviderSettings[]
    trackers: TrackerSettings[]
    ffmpegPath: string
    ffprobePath: string
    movieScreenshotCount: number
    tvEpisodeScreenshotCount: number
}

export interface ImageHostProviderSettings {
    selected: boolean
    code: string
    name: string
    url: string
    apiKey?: string
}

export interface TrackerSettings {
    selected: boolean
    code: string
    name: string
    url: string
    apiKey?: string
    passKey?: string
}
