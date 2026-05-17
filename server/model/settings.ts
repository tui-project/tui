export interface Settings {
    id: 'app-settings'
    mediaPaths: string[]
    tmdbApiKey: string
    imageHostProviders: ImageHostProviderSettings[]
    trackers: TrackerSettings[]
    mediainfoPath: string
    ffmpegPath: string
    ffprobePath: string
    movieScreenshotCount: number
    episodePackScreenshotCount: number
    logLevel: number
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
