import { describe, expect, it, vi } from 'vitest'
import { createFnpTrackerService } from '../../../../../server/services/tracker/trackers/fnp'
import { MEDIA_TYPES, SOURCE_TYPES, SOURCES } from '../../../../../server/model/metadata'
import type { TrackerUploadMetadata } from '../../../../../server/services/tracker/tracker'

vi.mock('node:fs/promises', () => ({ readFile: vi.fn().mockResolvedValue(Buffer.from('data')) }))
vi.mock('../../../../../server/utils/logger', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

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
    resolution: '1080p',
    videoCodec: 'H.264',
    audioCodec: 'DTS-HD MA',
    audioChannels: '5.1',
    tmdbId: 1,
    imdbId: 'tt1234567',
}

describe('createFnpTrackerService — buildTitle', () => {
    const service = createFnpTrackerService('https://fnp.example.com', 'apikey')

    it('builds a standard encode title', () => {
        const title = service.getTitle(baseMetadata)
        expect(title).toBe('Movie 2024 1080p BluRay DTS-HD MA 5.1 H.264-GROUP')
    })

    it('includes REMUX and puts video codec before audio for remux', () => {
        const title = service.getTitle({ ...baseMetadata, sourceType: SOURCE_TYPES.REMUX })
        expect(title).toContain('REMUX')
        expect(title.indexOf('H.264')).toBeLessThan(title.indexOf('DTS-HD MA'))
    })

    it('uses WEB-DL type string for WEB_DL source type', () => {
        const title = service.getTitle({ ...baseMetadata, sourceType: SOURCE_TYPES.WEB_DL, source: SOURCES.WEB, service: 'AMZN' })
        expect(title).toContain('WEB-DL')
    })

    it('uses WEBRip type string for WEBRIP source type', () => {
        const title = service.getTitle({ ...baseMetadata, sourceType: SOURCE_TYPES.WEBRIP, source: SOURCES.WEB, service: 'AMZN' })
        expect(title).toContain('WEBRip')
    })

    it('omits type string for ENCODE and HDTV', () => {
        const encodeTitle = service.getTitle({ ...baseMetadata, sourceType: SOURCE_TYPES.ENCODE })
        const hdtvTitle = service.getTitle({ ...baseMetadata, sourceType: SOURCE_TYPES.HDTV })
        expect(encodeTitle).not.toContain('ENCODE')
        expect(hdtvTitle).not.toContain('HDTV')
    })

    it('uses UHD BluRay for 2160p BluRay', () => {
        const title = service.getTitle({ ...baseMetadata, source: SOURCES.BLURAY, resolution: '2160p' })
        expect(title).toContain('UHD BluRay')
    })

    it('uses BluRay for non-2160p BluRay', () => {
        const title = service.getTitle({ ...baseMetadata, source: SOURCES.BLURAY, resolution: '1080p' })
        expect(title).toContain('BluRay')
        expect(title).not.toContain('UHD BluRay')
    })

    it('uses DVD for DVD source', () => {
        const title = service.getTitle({ ...baseMetadata, source: SOURCES.DVD })
        expect(title).toContain('DVD')
    })

    it('returns empty source string for unknown source', () => {
        const title = service.getTitle({ ...baseMetadata, source: 'Unknown' as never })
        const parts = title.split(' ')
        expect(parts).not.toContain('Unknown')
    })

    it('includes AKA original title when different from title', () => {
        const title = service.getTitle({ ...baseMetadata, originalTitle: 'Película' })
        expect(title).toContain('AKA Película')
    })

    it('omits AKA when original title matches title', () => {
        const title = service.getTitle(baseMetadata)
        expect(title).not.toContain('AKA')
    })

    it('includes TV season and episode', () => {
        const title = service.getTitle({ ...baseMetadata, mediaType: MEDIA_TYPES.TV, season: 1, episode: 2 })
        expect(title).toContain('S01E02')
    })

    it('includes season only when episode is absent', () => {
        const title = service.getTitle({ ...baseMetadata, mediaType: MEDIA_TYPES.TV, season: 3 })
        expect(title).toContain('S03')
        expect(title).not.toMatch(/S\d+E/)
    })

    it('includes Hybrid flag', () => {
        const title = service.getTitle({ ...baseMetadata, hybrid: true })
        expect(title).toContain('Hybrid')
    })

    it('includes REPACK and PROPER flags', () => {
        const title = service.getTitle({ ...baseMetadata, repack: true, proper: true })
        expect(title).toContain('REPACK')
        expect(title).toContain('PROPER')
    })

    it('includes HDR tags for remux', () => {
        const title = service.getTitle({ ...baseMetadata, sourceType: SOURCE_TYPES.REMUX, hdr: ['HDR10', 'DV'] })
        expect(title).toContain('HDR10 DV')
    })

    it('includes HDR tags for encode (non-remux path)', () => {
        const title = service.getTitle({ ...baseMetadata, sourceType: SOURCE_TYPES.ENCODE, hdr: ['HDR10', 'DV'] })
        expect(title).toContain('HDR10 DV')
    })

    it('includes audioMetadata when present (encode path)', () => {
        const title = service.getTitle({ ...baseMetadata, audioMetadata: 'Atmos' })
        expect(title).toContain('Atmos')
    })

    it('includes audioMetadata when present (remux path)', () => {
        const title = service.getTitle({ ...baseMetadata, sourceType: SOURCE_TYPES.REMUX, audioMetadata: 'Atmos' })
        expect(title).toContain('Atmos')
    })

    it('uses NOGROUP when releaseGroup is absent', () => {
        const title = service.getTitle({ ...baseMetadata, releaseGroup: undefined })
        expect(title).toMatch(/-NOGROUP$/)
    })

    it('uses streaming service for WEB source', () => {
        const title = service.getTitle({ ...baseMetadata, source: SOURCES.WEB, service: 'DSNP', sourceType: SOURCE_TYPES.WEB_DL })
        expect(title).toContain('DSNP')
    })

    it('returns empty string for WEB source without service', () => {
        const title = service.getTitle({ ...baseMetadata, source: SOURCES.WEB, service: undefined, sourceType: SOURCE_TYPES.WEB_DL })
        expect(title).not.toContain('undefined')
    })

    it('includes cut when present', () => {
        const title = service.getTitle({ ...baseMetadata, cut: "Director's Cut" })
        expect(title).toContain("Director's Cut")
    })
})
