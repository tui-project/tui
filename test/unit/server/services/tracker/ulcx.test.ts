import { describe, expect, it } from 'vitest'
import { createUlcxTrackerService } from '../../../../../server/services/tracker/trackers/ulcx'
import { MEDIA_TYPES, RESOLUTIONS, SOURCE_TYPES, SOURCES } from '../../../../../server/model/metadata'
import type { TrackerUploadMetadata } from '../../../../../server/services/tracker/tracker'

const baseMetadata: TrackerUploadMetadata = {
    title: 'Movie',
    originalTitle: 'Movie',
    releaseGroup: 'GROUP',
    mediaType: MEDIA_TYPES.MOVIE,
    year: 2024,
    language: ['English'],
    originalLanguage: 'English',
    sourceType: SOURCE_TYPES.ENCODE,
    source: SOURCES.BLURAY,
    repack: false,
    proper: false,
    hybrid: false,
    resolution: RESOLUTIONS['1080p'],
    videoCodec: 'H.264',
    audioCodec: 'DTS-HD MA',
    audioChannels: '5.1',
    tmdbId: 1,
    imdbId: 'tt1234567',
}

describe('createUlcxTrackerService — getTitle', () => {
    const service = createUlcxTrackerService('https://upload.cx', 'apikey')

    it('builds a basic movie title', () => {
        expect(service.getTitle(baseMetadata)).toBe('Movie 2024 BluRay DTS-HD MA 5.1 H.264-GROUP')
    })

    it('includes TV season and episode when present', () => {
        const title = service.getTitle({ ...baseMetadata, mediaType: MEDIA_TYPES.TV, season: 1, episode: 3 })
        expect(title).toContain('S01E03')
    })

    it('includes season only when episode is absent', () => {
        const title = service.getTitle({ ...baseMetadata, mediaType: MEDIA_TYPES.TV, season: 2 })
        expect(title).toContain('S02')
        expect(title).not.toMatch(/S\d+E/)
    })

    it('includes PROPER and REPACK flags', () => {
        const title = service.getTitle({ ...baseMetadata, proper: true, repack: true })
        expect(title).toContain('PROPER')
        expect(title).toContain('REPACK')
    })

    it('includes Hybrid flag', () => {
        const title = service.getTitle({ ...baseMetadata, hybrid: true })
        expect(title).toContain('Hybrid')
    })

    it('omits Hybrid flag for WEB_DL source type', () => {
        const title = service.getTitle({ ...baseMetadata, hybrid: true, sourceType: SOURCE_TYPES.WEB_DL, source: SOURCES.WEB, service: 'NF' })
        expect(title).not.toContain('Hybrid')
    })

    it('uses streaming service name for WEB source', () => {
        const title = service.getTitle({ ...baseMetadata, source: SOURCES.WEB, service: 'AMZN' })
        expect(title).toContain('AMZN')
    })

    it('omits service for non-WEB source', () => {
        const title = service.getTitle({ ...baseMetadata, source: SOURCES.BLURAY })
        expect(title).not.toContain('AMZN')
    })

    it('handles WEB source with no service gracefully', () => {
        const title = service.getTitle({ ...baseMetadata, source: SOURCES.WEB, service: undefined })
        expect(title).toBeDefined()
    })

    it('includes audioMetadata for REMUX sourceType', () => {
        const title = service.getTitle({ ...baseMetadata, sourceType: SOURCE_TYPES.REMUX, audioMetadata: 'Atmos' })
        expect(title).toContain('Atmos')
    })

    it('includes HDR tags', () => {
        const title = service.getTitle({ ...baseMetadata, hdr: ['HDR10', 'DV'] })
        expect(title).toContain('HDR10')
        expect(title).toContain('DV')
    })

    it('includes cut when present', () => {
        const title = service.getTitle({ ...baseMetadata, cut: "Director's Cut" })
        expect(title).toContain("Director's Cut")
    })

    it('includes audioMetadata when present', () => {
        const title = service.getTitle({ ...baseMetadata, audioMetadata: 'Atmos' })
        expect(title).toContain('Atmos')
    })

    it('uses NOGROUP when releaseGroup is absent', () => {
        const title = service.getTitle({ ...baseMetadata, releaseGroup: undefined })
        expect(title).not.toContain('-GROUP')
        expect(title).toMatch(/-NOGROUP$/)
    })

    it('includes AKA original title when it differs from title', () => {
        const title = service.getTitle({ ...baseMetadata, title: 'Movie', originalTitle: 'Le Film' })
        expect(title).toContain('AKA Le Film')
    })

    it('omits AKA when originalTitle matches title', () => {
        const title = service.getTitle({ ...baseMetadata, title: 'Movie', originalTitle: 'Movie' })
        expect(title).not.toContain('AKA')
    })

    it('returns UHD BluRay for 2160p BluRay source', () => {
        const title = service.getTitle({ ...baseMetadata, source: SOURCES.BLURAY, resolution: RESOLUTIONS['2160p'] })
        expect(title).toContain('UHD BluRay')
    })

    it('returns BluRay for non-2160p BluRay source', () => {
        const title = service.getTitle({ ...baseMetadata, source: SOURCES.BLURAY, resolution: RESOLUTIONS['1080p'] })
        expect(title).toContain('BluRay')
        expect(title).not.toContain('UHD')
    })

    it('returns DVD for DVD source and includes resolution before source', () => {
        const title = service.getTitle({ ...baseMetadata, source: SOURCES.DVD })
        expect(title).toContain('DVD')
        expect(title).toContain(baseMetadata.resolution)
    })

    it('returns empty string for unknown source', () => {
        const title = service.getTitle({ ...baseMetadata, source: 'UNKNOWN' as never })
        expect(title).not.toContain('BluRay')
        expect(title).not.toContain('DVD')
    })

    it('includes REMUX type string for REMUX sourceType', () => {
        const title = service.getTitle({ ...baseMetadata, sourceType: SOURCE_TYPES.REMUX })
        expect(title).toContain('REMUX')
    })

    it('includes WEB-DL type string for WEB_DL sourceType', () => {
        const title = service.getTitle({ ...baseMetadata, sourceType: SOURCE_TYPES.WEB_DL, source: SOURCES.WEB, service: 'NF' })
        expect(title).toContain('WEB-DL')
    })

    it('includes WEBRip type string for WEBRIP sourceType', () => {
        const title = service.getTitle({ ...baseMetadata, sourceType: SOURCE_TYPES.WEBRIP, source: SOURCES.WEB, service: 'AMZN' })
        expect(title).toContain('WEBRip')
    })

    it('places HDR before videoCodec for REMUX sourceType', () => {
        const title = service.getTitle({ ...baseMetadata, sourceType: SOURCE_TYPES.REMUX, hdr: ['HDR10'] })
        const hdrIndex = title.indexOf('HDR10')
        const codecIndex = title.indexOf(baseMetadata.videoCodec)
        expect(hdrIndex).toBeGreaterThan(-1)
        expect(codecIndex).toBeGreaterThan(-1)
        expect(hdrIndex).toBeLessThan(codecIndex)
    })

    it('places HDR after audioChannels for encode sourceType', () => {
        const title = service.getTitle({ ...baseMetadata, sourceType: SOURCE_TYPES.ENCODE, hdr: ['HDR10'] })
        const channelsIndex = title.indexOf(baseMetadata.audioChannels)
        const hdrIndex = title.indexOf('HDR10')
        expect(channelsIndex).toBeGreaterThan(-1)
        expect(hdrIndex).toBeGreaterThan(-1)
        expect(channelsIndex).toBeLessThan(hdrIndex)
    })

    it('does not include year for TV media type', () => {
        const title = service.getTitle({ ...baseMetadata, mediaType: MEDIA_TYPES.TV, season: 1 })
        expect(title).not.toContain(String(baseMetadata.year))
    })

    it('includes year only for movie media type', () => {
        const title = service.getTitle({ ...baseMetadata, mediaType: MEDIA_TYPES.MOVIE })
        expect(title).toContain(String(baseMetadata.year))
    })
})
