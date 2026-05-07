import type { Settings } from '../model/settings'

export type SettingsDto = Omit<Settings, 'id' | 'imageHostProviders' | 'trackers'> & {
    imageHostProviders: Array<Omit<Settings['imageHostProviders'][number], 'url'>>
    trackers: Array<Omit<Settings['trackers'][number], 'url'>>
}

export function toSettingsResponse(settings: Settings): SettingsDto {
    return {
        mediaPaths: settings.mediaPaths,
        tmdbApiKey: settings.tmdbApiKey,
        imageHostProviders: settings.imageHostProviders.map(({ url: _url, ...provider }) => provider),
        trackers: settings.trackers.map(({ url: _url, ...tracker }) => tracker),
        ffmpegPath: settings.ffmpegPath,
        ffprobePath: settings.ffprobePath,
        movieScreenshotCount: settings.movieScreenshotCount,
        tvEpisodeScreenshotCount: settings.tvEpisodeScreenshotCount,
    }
}
