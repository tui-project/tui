import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createUlcxTrackerService } from '../../../../../server/services/tracker/trackers/ulcx'
import { MEDIA_TYPES, RATIOS, RESOLUTIONS, SOURCE_TYPES, SOURCES } from '../../../../../server/model/metadata'
import type { TrackerUploadMetadata } from '../../../../../server/services/tracker/tracker'

vi.mock('../../../../../server/utils/logger', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

const fetchMock = vi.fn()
vi.stubGlobal('$fetch', fetchMock)

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
    rerip: false,
    threeD: false,
    hybrid: false,
    hi10p: false,
    resolution: RESOLUTIONS['1080p'],
    videoCodec: 'H.264',
    audioCodec: 'DTS-HD MA',
    audioChannels: '5.1',
    tmdbId: 1,
    imdbId: 'tt1234567',
}

const tvBaseMetadata: TrackerUploadMetadata = {
    ...baseMetadata,
    mediaType: MEDIA_TYPES.TV,
    tvdbId: 12345,
    season: 1,
}

describe('createUlcxTrackerService — getTitle', () => {
    const service = createUlcxTrackerService('https://upload.cx', 'apikey')

    beforeEach(() => {
        fetchMock.mockReset()
    })

    it('builds a basic movie title', async () => {
        expect(await service.getTitle(baseMetadata)).toBe('Movie 2024 1080p BluRay DTS-HD MA 5.1 H.264-GROUP')
    })

    it('includes TV season and episode when present', async () => {
        fetchMock.mockResolvedValue({ title: 'Show' })
        const title = await service.getTitle({ ...tvBaseMetadata, episode: 3 })
        expect(title).toContain('S01E03')
    })

    it('includes season only when episode is absent', async () => {
        fetchMock.mockResolvedValue({ title: 'Show' })
        const title = await service.getTitle(tvBaseMetadata)
        expect(title).toContain('S01')
        expect(title).not.toMatch(/S\d+E/)
    })

    it('appends special name after S00E## for TVDb specials', async () => {
        fetchMock.mockResolvedValue({ title: 'Top Gear' })
        const title = await service.getTitle({ ...tvBaseMetadata, season: 0, episode: 12, specialName: 'Polar Challenge' })
        expect(title).toContain('S00E12 Polar Challenge')
    })

    it('appends special name after S##E00 for non-TVDb specials', async () => {
        fetchMock.mockResolvedValue({ title: 'Top Gear' })
        const title = await service.getTitle({ ...tvBaseMetadata, season: 27, episode: 0, specialName: 'Nepal Special' })
        expect(title).toContain('S27E00 Nepal Special')
    })

    it('does not append special name for regular episodes even if specialName is set', async () => {
        fetchMock.mockResolvedValue({ title: 'Show' })
        const title = await service.getTitle({ ...tvBaseMetadata, season: 1, episode: 3, specialName: 'Some Name' })
        expect(title).toContain('S01E03')
        expect(title).not.toContain('Some Name')
    })

    it('formats multi-episode special range as S00E03-08 with special name', async () => {
        fetchMock.mockResolvedValue({ title: 'The Good Place' })
        const title = await service.getTitle({ ...tvBaseMetadata, season: 0, episode: 3, episodeEnd: 8, specialName: 'The Selection' })
        expect(title).toContain('S00E03-08 The Selection')
    })

    it('formats multi-episode range for regular seasons without appending special name', async () => {
        fetchMock.mockResolvedValue({ title: 'Show' })
        const title = await service.getTitle({ ...tvBaseMetadata, season: 1, episode: 1, episodeEnd: 3, specialName: 'Some Name' })
        expect(title).toContain('S01E01-03')
        expect(title).not.toContain('Some Name')
    })

    it('includes PROPER and REPACK flags', async () => {
        const title = await service.getTitle({ ...baseMetadata, proper: 1, repack: 1 })
        expect(title).toContain('PROPER')
        expect(title).toContain('REPACK')
    })

    it('includes REPACK2 and PROPER2 for second repack/proper', async () => {
        const title = await service.getTitle({ ...baseMetadata, repack: 2, proper: 2 })
        expect(title).toContain('REPACK2')
        expect(title).toContain('PROPER2')
    })

    it('includes Hybrid flag', async () => {
        const title = await service.getTitle({ ...baseMetadata, hybrid: true })
        expect(title).toContain('Hybrid')
    })

    it('omits Hybrid flag for WEB_DL source type', async () => {
        const title = await service.getTitle({ ...baseMetadata, hybrid: true, sourceType: SOURCE_TYPES.WEB_DL, source: SOURCES.WEB, service: 'NF' })
        expect(title).not.toContain('Hybrid')
    })

    it('uses streaming service name for WEB source', async () => {
        const title = await service.getTitle({ ...baseMetadata, source: SOURCES.WEB, service: 'AMZN' })
        expect(title).toContain('AMZN')
    })

    it('omits service for non-WEB source', async () => {
        const title = await service.getTitle({ ...baseMetadata, source: SOURCES.BLURAY })
        expect(title).not.toContain('AMZN')
    })

    it('handles WEB source with no service gracefully', async () => {
        const title = await service.getTitle({ ...baseMetadata, source: SOURCES.WEB, service: undefined })
        expect(title).toBeDefined()
    })

    it('includes audioMetadata for REMUX sourceType', async () => {
        const title = await service.getTitle({ ...baseMetadata, sourceType: SOURCE_TYPES.REMUX, audioMetadata: 'Atmos' })
        expect(title).toContain('Atmos')
    })

    it('includes HDR tags', async () => {
        const title = await service.getTitle({ ...baseMetadata, hdr: ['HDR10', 'DV'] })
        expect(title).toContain('HDR10')
        expect(title).toContain('DV')
    })

    it('includes cut when present', async () => {
        const title = await service.getTitle({ ...baseMetadata, cut: "Director's Cut" })
        expect(title).toContain("Director's Cut")
    })

    it('includes audioMetadata when present', async () => {
        const title = await service.getTitle({ ...baseMetadata, audioMetadata: 'Atmos' })
        expect(title).toContain('Atmos')
    })

    it('uses NOGROUP when releaseGroup is absent', async () => {
        const title = await service.getTitle({ ...baseMetadata, releaseGroup: undefined })
        expect(title).not.toContain('-GROUP')
        expect(title).toMatch(/-NOGROUP$/)
    })

    it('includes AKA original title when it differs from title', async () => {
        const title = await service.getTitle({ ...baseMetadata, title: 'Movie', originalTitle: 'Le Film' })
        expect(title).toContain('AKA Le Film')
    })

    it('omits AKA when originalTitle matches title', async () => {
        const title = await service.getTitle({ ...baseMetadata, title: 'Movie', originalTitle: 'Movie' })
        expect(title).not.toContain('AKA')
    })

    it('returns UHD BluRay for 2160p BluRay source', async () => {
        const title = await service.getTitle({ ...baseMetadata, source: SOURCES.BLURAY, resolution: RESOLUTIONS['2160p'] })
        expect(title).toContain('UHD BluRay')
    })

    it('returns BluRay for non-2160p BluRay source', async () => {
        const title = await service.getTitle({ ...baseMetadata, source: SOURCES.BLURAY, resolution: RESOLUTIONS['1080p'] })
        expect(title).toContain('BluRay')
        expect(title).not.toContain('UHD')
    })

    it('returns DVD for DVD source and omits resolution', async () => {
        const title = await service.getTitle({ ...baseMetadata, source: SOURCES.DVD })
        expect(title).toContain('DVD')
        expect(title).not.toContain(baseMetadata.resolution)
    })

    it('returns empty string for unknown source', async () => {
        const title = await service.getTitle({ ...baseMetadata, source: 'UNKNOWN' as never })
        expect(title).not.toContain('BluRay')
        expect(title).not.toContain('DVD')
    })

    it('includes REMUX type string for REMUX sourceType', async () => {
        const title = await service.getTitle({ ...baseMetadata, sourceType: SOURCE_TYPES.REMUX })
        expect(title).toContain('REMUX')
    })

    it('includes WEB-DL type string for WEB_DL sourceType', async () => {
        const title = await service.getTitle({ ...baseMetadata, sourceType: SOURCE_TYPES.WEB_DL, source: SOURCES.WEB, service: 'NF' })
        expect(title).toContain('WEB-DL')
    })

    it('includes WEBRip type string for WEBRIP sourceType', async () => {
        const title = await service.getTitle({ ...baseMetadata, sourceType: SOURCE_TYPES.WEBRIP, source: SOURCES.WEB, service: 'AMZN' })
        expect(title).toContain('WEBRip')
    })

    it('places HDR before videoCodec for REMUX sourceType', async () => {
        const title = await service.getTitle({ ...baseMetadata, sourceType: SOURCE_TYPES.REMUX, hdr: ['HDR10'] })
        const hdrIndex = title.indexOf('HDR10')
        const codecIndex = title.indexOf(baseMetadata.videoCodec)
        expect(hdrIndex).toBeGreaterThan(-1)
        expect(codecIndex).toBeGreaterThan(-1)
        expect(hdrIndex).toBeLessThan(codecIndex)
    })

    it('places HDR after audioChannels for encode sourceType', async () => {
        const title = await service.getTitle({ ...baseMetadata, sourceType: SOURCE_TYPES.ENCODE, hdr: ['HDR10'] })
        const channelsIndex = title.indexOf(baseMetadata.audioChannels)
        const hdrIndex = title.indexOf('HDR10')
        expect(channelsIndex).toBeGreaterThan(-1)
        expect(hdrIndex).toBeGreaterThan(-1)
        expect(channelsIndex).toBeLessThan(hdrIndex)
    })

    it('omits year for TV when SkyHook title has no year qualifier', async () => {
        fetchMock.mockResolvedValue({ title: 'Top Gear' })
        const title = await service.getTitle({ ...tvBaseMetadata, title: 'Top Gear' })
        expect(title).not.toContain(String(tvBaseMetadata.year))
    })

    it('includes year for TV when SkyHook title has a year qualifier', async () => {
        fetchMock.mockResolvedValue({ title: 'Top Gear (1978)' })
        const title = await service.getTitle({ ...tvBaseMetadata, title: 'Top Gear' })
        expect(title).toContain(String(tvBaseMetadata.year))
    })

    it('omits year for TV when SkyHook request fails', async () => {
        fetchMock.mockRejectedValue(new Error('network error'))
        const title = await service.getTitle({ ...tvBaseMetadata, title: 'Top Gear' })
        expect(title).not.toContain(String(tvBaseMetadata.year))
    })

    it('omits year for TV when tvdbId is absent', async () => {
        const title = await service.getTitle({ ...tvBaseMetadata, tvdbId: undefined })
        expect(title).not.toContain(String(tvBaseMetadata.year))
        expect(fetchMock).not.toHaveBeenCalled()
    })

    it('includes year only for movie media type', async () => {
        const title = await service.getTitle({ ...baseMetadata, mediaType: MEDIA_TYPES.MOVIE })
        expect(title).toContain(String(baseMetadata.year))
    })

    it('includes RERip flag', async () => {
        const title = await service.getTitle({ ...baseMetadata, rerip: true })
        expect(title).toContain('RERip')
    })

    it('omits RERip when false', async () => {
        const title = await service.getTitle({ ...baseMetadata, rerip: false })
        expect(title).not.toContain('RERip')
    })

    it('includes IMAX ratio', async () => {
        const title = await service.getTitle({ ...baseMetadata, ratio: RATIOS.IMAX })
        expect(title).toContain('IMAX')
    })

    it('includes Open Matte ratio', async () => {
        const title = await service.getTitle({ ...baseMetadata, ratio: RATIOS.OPEN_MATTE })
        expect(title).toContain('Open Matte')
    })

    it('includes MAR ratio', async () => {
        const title = await service.getTitle({ ...baseMetadata, ratio: RATIOS.MAR })
        expect(title).toContain('MAR')
    })

    it('omits ratio when absent', async () => {
        const title = await service.getTitle({ ...baseMetadata, ratio: undefined })
        expect(title).not.toContain('IMAX')
        expect(title).not.toContain('Open Matte')
        expect(title).not.toContain('MAR')
    })

    it('includes 3D flag', async () => {
        const title = await service.getTitle({ ...baseMetadata, threeD: true })
        expect(title).toContain('3D')
    })

    it('omits 3D when false', async () => {
        const title = await service.getTitle({ ...baseMetadata, threeD: false })
        expect(title).not.toContain('3D')
    })

    it('includes Hi10P after audioChannels for non-remux sourceType', async () => {
        const title = await service.getTitle({ ...baseMetadata, hi10p: true })
        const channelsIndex = title.indexOf(baseMetadata.audioChannels)
        const hi10pIndex = title.indexOf('Hi10P')
        expect(hi10pIndex).toBeGreaterThan(-1)
        expect(channelsIndex).toBeLessThan(hi10pIndex)
    })

    it('includes Hi10P before videoCodec for REMUX sourceType', async () => {
        const title = await service.getTitle({ ...baseMetadata, sourceType: SOURCE_TYPES.REMUX, hi10p: true })
        const hi10pIndex = title.indexOf('Hi10P')
        const codecIndex = title.indexOf(baseMetadata.videoCodec)
        expect(hi10pIndex).toBeGreaterThan(-1)
        expect(hi10pIndex).toBeLessThan(codecIndex)
    })

    it('omits Hi10P when false', async () => {
        const title = await service.getTitle({ ...baseMetadata, hi10p: false })
        expect(title).not.toContain('Hi10P')
    })

    describe('buildDubString', () => {
        it('includes Dual-Audio when two languages and one is the original', async () => {
            const title = await service.getTitle({ ...baseMetadata, language: ['en', 'fr'], originalLanguage: 'fr' })
            expect(title).toContain('Dual-Audio')
        })

        it('includes Dubbed when single English language and original is not English', async () => {
            const title = await service.getTitle({ ...baseMetadata, language: ['en'], originalLanguage: 'fr' })
            expect(title).toContain('Dubbed')
        })

        it('omits dub string when single language matches original', async () => {
            const title = await service.getTitle({ ...baseMetadata, language: ['en'], originalLanguage: 'en' })
            expect(title).not.toContain('Dual-Audio')
            expect(title).not.toContain('Dubbed')
        })

        it('omits dub string when languages array is empty', async () => {
            const title = await service.getTitle({ ...baseMetadata, language: [] })
            expect(title).not.toContain('Dual-Audio')
            expect(title).not.toContain('Dubbed')
        })

        it('omits dub string when more than two languages are present', async () => {
            const title = await service.getTitle({ ...baseMetadata, language: ['en', 'fr', 'de'], originalLanguage: 'fr' })
            expect(title).not.toContain('Dual-Audio')
            expect(title).not.toContain('Dubbed')
        })

        it('omits dub string when two languages but neither is the original', async () => {
            const title = await service.getTitle({ ...baseMetadata, language: ['en', 'fr'], originalLanguage: 'de' })
            expect(title).not.toContain('Dual-Audio')
            expect(title).not.toContain('Dubbed')
        })
    })

    it('includes locale when present', async () => {
        const title = await service.getTitle({ ...baseMetadata, locale: 'KR' })
        expect(title).toContain('KR')
    })
})

describe('createUlcxTrackerService — checkRules', () => {
    const service = createUlcxTrackerService('https://upload.cx', 'apikey')

    it('returns a violation for a banned release group', () => {
        const violations = service.checkRules({ ...baseMetadata, releaseGroup: 'YIFY' })
        expect(violations).toHaveLength(1)
        expect(violations[0]!.rule).toBe('banned_release_group')
        expect(violations[0]!.message).toContain('YIFY')
    })

    it('returns a violation for every banned group', () => {
        const bannedGroups = [
            '4K4U',
            'Alcaide_Kira',
            'AROMA',
            'd3g',
            'EDGE2020',
            'EMBER',
            'FGT',
            'FnP',
            'FRDS',
            'Grym',
            'HDT',
            'Hi10',
            'iAHD',
            'INFINITY',
            'ION10',
            'iVy',
            'Judas',
            'LAMA',
            'MeGusta',
            'NAHOM',
            'Niblets',
            'nikt0',
            'NuBz',
            'OFT',
            'PHOCiS',
            'QxR',
            'R&H',
            'Ralphy',
            'RARBG',
            'seedpool',
            'Sicario',
            'SM737',
            'SPDVD',
            'SPx',
            'SWTYBLZ',
            'TAoE',
            'TGx',
            'Tigole',
            'TSP',
            'TSPxL',
            'VXT',
            'Vyndros',
            'Will1869',
            'x0r',
            'YIFY',
        ]
        for (const group of bannedGroups) {
            const violations = service.checkRules({ ...baseMetadata, releaseGroup: group })
            expect(violations, `expected violation for group: ${group}`).toHaveLength(1)
            expect(violations[0]!.rule).toBe('banned_release_group')
        }
    })

    it('matches banned groups case-insensitively', () => {
        expect(service.checkRules({ ...baseMetadata, releaseGroup: 'yify' })).toHaveLength(1)
        expect(service.checkRules({ ...baseMetadata, releaseGroup: 'Yify' })).toHaveLength(1)
        expect(service.checkRules({ ...baseMetadata, releaseGroup: 'YIFY' })).toHaveLength(1)
    })

    it('returns no violations for an allowed release group', () => {
        const violations = service.checkRules({ ...baseMetadata, releaseGroup: 'BHDStudio' })
        expect(violations).toHaveLength(0)
    })

    it('returns no violations when releaseGroup is absent', () => {
        const violations = service.checkRules({ ...baseMetadata, releaseGroup: undefined })
        expect(violations).toHaveLength(0)
    })
})
