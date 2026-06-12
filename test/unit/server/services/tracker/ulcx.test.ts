import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ulcxTrackerService } from '../../../../../server/services/tracker/trackers/ulcx'
import { AUDIO_CODECS, AUDIO_CHANNELS, MEDIA_TYPES, RATIOS, RESOLUTIONS, SOURCE_TYPES, SOURCES, VIDEO_CODECS } from '../../../../../server/model/metadata'
import type { TrackerUploadMetadata } from '../../../../../server/services/tracker/tracker'
import { parseMetadataFromName } from '../../../../../server/services/media-name-parser'

vi.mock('../../../../../server/utils/logger', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

vi.mock('../../../../../server/services/media-name-parser', () => ({
    parseMetadataFromName: vi.fn(() => ({ season: undefined, episode: undefined, repack: 0, proper: 0, hdr: [], videoCodec: undefined })),
}))

vi.mock('node:fs/promises', () => ({
    readFile: vi.fn().mockResolvedValue(Buffer.from('fake-torrent')),
}))

const fetchMock = vi.fn()
vi.stubGlobal('$fetch', fetchMock)

const baseMetadata: TrackerUploadMetadata = {
    title: 'Movie',
    originalTitle: 'Movie',
    releaseGroup: 'GROUP',
    mediaType: MEDIA_TYPES.MOVIE,
    year: 2024,
    language: ['en'],
    originalLanguage: 'en',
    sourceType: SOURCE_TYPES.ENCODE,
    source: SOURCES.BLURAY,
    repack: false,
    proper: false,
    rerip: 0,
    hybrid: false,
    hi10p: false,
    resolution: RESOLUTIONS['1080p'],
    videoCodec: VIDEO_CODECS.X264,
    audioCodec: AUDIO_CODECS.DTS_HD_MA,
    audioChannels: AUDIO_CHANNELS['5.1'],
    tmdbId: 1,
    imdbId: 'tt1234567',
}

const tvBaseMetadata: TrackerUploadMetadata = {
    ...baseMetadata,
    mediaType: MEDIA_TYPES.TV,
    tvdbId: 12345,
    season: 1,
}

describe('ulcxTrackerService — getTitle', () => {
    const service = ulcxTrackerService('https://upload.cx', 'apikey')

    beforeEach(() => {
        fetchMock.mockReset()
    })

    it('builds a basic movie title', async () => {
        expect(await service.getTitle(baseMetadata)).toBe('Movie 2024 1080p BluRay DTS-HD MA 5.1 x264-GROUP')
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

    it('returns UHD BluRay for UHD BluRay source', async () => {
        const title = await service.getTitle({ ...baseMetadata, source: SOURCES.UHD_BLURAY })
        expect(title).toContain('UHD BluRay')
    })

    it('returns BluRay for BluRay source', async () => {
        const title = await service.getTitle({ ...baseMetadata, source: SOURCES.BLURAY })
        expect(title).toContain('BluRay')
        expect(title).not.toContain('UHD')
    })

    it('returns 3D BluRay for BLURAY_3D source', async () => {
        const title = await service.getTitle({ ...baseMetadata, source: SOURCES.BLURAY_3D })
        expect(title).toContain('3D BluRay')
    })

    it('returns DVD for DVD source and omits resolution', async () => {
        const title = await service.getTitle({ ...baseMetadata, source: SOURCES.DVD })
        expect(title).toContain('DVD')
        expect(title).not.toContain(baseMetadata.resolution)
    })

    it('returns NTSC DVD for NTSC_DVD source and omits resolution', async () => {
        const title = await service.getTitle({ ...baseMetadata, source: SOURCES.NTSC_DVD })
        expect(title).toContain('NTSC DVD')
        expect(title).not.toContain(baseMetadata.resolution)
    })

    it('returns PAL DVD for PAL_DVD source and omits resolution', async () => {
        const title = await service.getTitle({ ...baseMetadata, source: SOURCES.PAL_DVD })
        expect(title).toContain('PAL DVD')
        expect(title).not.toContain(baseMetadata.resolution)
    })

    it('returns HDDVD for HD_DVD source and omits resolution', async () => {
        const title = await service.getTitle({ ...baseMetadata, source: SOURCES.HD_DVD })
        expect(title).toContain('HDDVD')
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

    it('includes RERIP flag', async () => {
        const title = await service.getTitle({ ...baseMetadata, rerip: 1 })
        expect(title).toContain('RERIP')
        expect(title).not.toContain('RERIP2')
    })

    it('includes RERIP2 for second rerip', async () => {
        const title = await service.getTitle({ ...baseMetadata, rerip: 2 })
        expect(title).toContain('RERIP2')
    })

    it('omits RERIP when 0', async () => {
        const title = await service.getTitle({ ...baseMetadata, rerip: 0 })
        expect(title).not.toContain('RERIP')
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

    it('returns HDTV for HDTV source', async () => {
        const title = await service.getTitle({ ...baseMetadata, source: SOURCES.HDTV, sourceType: SOURCE_TYPES.HDTV, videoCodec: VIDEO_CODECS.H264 })
        expect(title).toContain('HDTV')
        expect(title).not.toContain('UHDTV')
    })

    it('returns UHDTV for UHDTV source', async () => {
        const title = await service.getTitle({ ...baseMetadata, source: SOURCES.UHDTV, sourceType: SOURCE_TYPES.HDTV, videoCodec: VIDEO_CODECS.H265 })
        expect(title).toContain('UHDTV')
    })

    it('omits video codec for DVD sources', async () => {
        const title = await service.getTitle({ ...baseMetadata, source: SOURCES.NTSC_DVD })
        expect(title).not.toContain(baseMetadata.videoCodec)
    })

    it('includes dub string for DVD sources', async () => {
        const title = await service.getTitle({ ...baseMetadata, source: SOURCES.NTSC_DVD, language: ['en', 'fr'], originalLanguage: 'fr' })
        expect(title).toContain('Dual-Audio')
    })

    it('omits video codec but includes dub for DVD sources in remux branch', async () => {
        const title = await service.getTitle({ ...baseMetadata, source: SOURCES.NTSC_DVD, sourceType: SOURCE_TYPES.REMUX, language: ['en', 'fr'], originalLanguage: 'fr' })
        expect(title).not.toContain(baseMetadata.videoCodec)
        expect(title).toContain('Dual-Audio')
    })
})

describe('ulcxTrackerService — checkRules', () => {
    const service = ulcxTrackerService('https://upload.cx', 'apikey')

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

    it('returns a violation for DVD source', () => {
        const violations = service.checkRules({ ...baseMetadata, source: SOURCES.DVD })
        expect(violations).toHaveLength(1)
        expect(violations[0]!.rule).toBe('invalid_source')
        expect(violations[0]!.message).toContain('DVD')
    })

    it('returns no violation for NTSC DVD source', () => {
        const violations = service.checkRules({ ...baseMetadata, source: SOURCES.NTSC_DVD })
        expect(violations).toHaveLength(0)
    })

    it('returns no violation for PAL DVD source', () => {
        const violations = service.checkRules({ ...baseMetadata, source: SOURCES.PAL_DVD })
        expect(violations).toHaveLength(0)
    })

    it('returns no violation for HDDVD source', () => {
        const violations = service.checkRules({ ...baseMetadata, source: SOURCES.HD_DVD })
        expect(violations).toHaveLength(0)
    })

    describe('video codec rule', () => {
        it('returns no violation for valid encode codec (x264)', () => {
            expect(service.checkRules({ ...baseMetadata, sourceType: SOURCE_TYPES.ENCODE, videoCodec: VIDEO_CODECS.X264 })).toHaveLength(0)
        })

        it('returns no violation for valid encode codec (x265)', () => {
            expect(service.checkRules({ ...baseMetadata, sourceType: SOURCE_TYPES.ENCODE, videoCodec: VIDEO_CODECS.X265 })).toHaveLength(0)
        })

        it('returns a violation for invalid encode codec (H.264)', () => {
            const violations = service.checkRules({ ...baseMetadata, sourceType: SOURCE_TYPES.ENCODE, videoCodec: VIDEO_CODECS.H264 })
            expect(violations).toHaveLength(1)
            expect(violations[0]!.rule).toBe('invalid_video_codec')
            expect(violations[0]!.message).toContain(VIDEO_CODECS.H264)
        })

        it('returns no violation for valid remux codec (AVC)', () => {
            expect(service.checkRules({ ...baseMetadata, sourceType: SOURCE_TYPES.REMUX, videoCodec: VIDEO_CODECS.AVC })).toHaveLength(0)
        })

        it('returns no violation for valid remux codec (HEVC)', () => {
            expect(service.checkRules({ ...baseMetadata, sourceType: SOURCE_TYPES.REMUX, videoCodec: VIDEO_CODECS.HEVC })).toHaveLength(0)
        })

        it('returns no violation for valid remux codec (MPEG-2)', () => {
            expect(service.checkRules({ ...baseMetadata, sourceType: SOURCE_TYPES.REMUX, videoCodec: VIDEO_CODECS.MPEG_2 })).toHaveLength(0)
        })

        it('returns no violation for valid remux codec (VC-1)', () => {
            expect(service.checkRules({ ...baseMetadata, sourceType: SOURCE_TYPES.REMUX, videoCodec: VIDEO_CODECS.VC_1 })).toHaveLength(0)
        })

        it('returns a violation for invalid remux codec (x264)', () => {
            const violations = service.checkRules({ ...baseMetadata, sourceType: SOURCE_TYPES.REMUX, videoCodec: VIDEO_CODECS.X264 })
            expect(violations).toHaveLength(1)
            expect(violations[0]!.rule).toBe('invalid_video_codec')
        })

        it('returns no violation for valid WEB-DL codec (H.264)', () => {
            expect(service.checkRules({ ...baseMetadata, sourceType: SOURCE_TYPES.WEB_DL, source: SOURCES.WEB, service: 'NF', videoCodec: VIDEO_CODECS.H264 })).toHaveLength(0)
        })

        it('returns no violation for valid WEB-DL codec (H.265)', () => {
            expect(service.checkRules({ ...baseMetadata, sourceType: SOURCE_TYPES.WEB_DL, source: SOURCES.WEB, service: 'NF', videoCodec: VIDEO_CODECS.H265 })).toHaveLength(0)
        })

        it('returns no violation for valid WEB-DL codec (VP9)', () => {
            expect(service.checkRules({ ...baseMetadata, sourceType: SOURCE_TYPES.WEB_DL, source: SOURCES.WEB, service: 'NF', videoCodec: VIDEO_CODECS.VP9 })).toHaveLength(0)
        })

        it('returns a violation for invalid WEB-DL codec (x265)', () => {
            const violations = service.checkRules({ ...baseMetadata, sourceType: SOURCE_TYPES.WEB_DL, source: SOURCES.WEB, service: 'NF', videoCodec: VIDEO_CODECS.X265 })
            expect(violations).toHaveLength(1)
            expect(violations[0]!.rule).toBe('invalid_video_codec')
        })

        it('returns no violation for valid WEBRip codec (x265)', () => {
            expect(service.checkRules({ ...baseMetadata, sourceType: SOURCE_TYPES.WEBRIP, source: SOURCES.WEB, service: 'NF', videoCodec: VIDEO_CODECS.X265 })).toHaveLength(0)
        })

        it('returns a violation for invalid WEBRip codec (H.264)', () => {
            const violations = service.checkRules({ ...baseMetadata, sourceType: SOURCE_TYPES.WEBRIP, source: SOURCES.WEB, service: 'NF', videoCodec: VIDEO_CODECS.H264 })
            expect(violations).toHaveLength(1)
            expect(violations[0]!.rule).toBe('invalid_video_codec')
        })

        it('returns no violation for valid untouched HDTV codec (H.264)', () => {
            expect(service.checkRules({ ...baseMetadata, source: SOURCES.HDTV, sourceType: SOURCE_TYPES.HDTV, videoCodec: VIDEO_CODECS.H264 })).toHaveLength(0)
        })

        it('returns a violation for invalid untouched HDTV codec (x264)', () => {
            const violations = service.checkRules({ ...baseMetadata, source: SOURCES.HDTV, sourceType: SOURCE_TYPES.HDTV, videoCodec: VIDEO_CODECS.X264 })
            expect(violations).toHaveLength(1)
            expect(violations[0]!.rule).toBe('invalid_video_codec')
        })

        it('skips codec check for DVD sources', () => {
            expect(service.checkRules({ ...baseMetadata, source: SOURCES.NTSC_DVD, videoCodec: VIDEO_CODECS.X264 })).toHaveLength(0)
            expect(service.checkRules({ ...baseMetadata, source: SOURCES.PAL_DVD, videoCodec: VIDEO_CODECS.AVC })).toHaveLength(0)
            expect(service.checkRules({ ...baseMetadata, source: SOURCES.HD_DVD, videoCodec: VIDEO_CODECS.H264 })).toHaveLength(0)
        })
    })

    describe('resolution rule (encodes only)', () => {
        it('returns no violation for 720p encode', () => {
            expect(service.checkRules({ ...baseMetadata, sourceType: SOURCE_TYPES.ENCODE, resolution: RESOLUTIONS['720p'] })).toHaveLength(0)
        })

        it('returns no violation for 1080p encode', () => {
            expect(service.checkRules({ ...baseMetadata, sourceType: SOURCE_TYPES.ENCODE, resolution: RESOLUTIONS['1080p'] })).toHaveLength(0)
        })

        it('returns no violation for 2160p encode', () => {
            expect(service.checkRules({ ...baseMetadata, sourceType: SOURCE_TYPES.ENCODE, resolution: RESOLUTIONS['2160p'] })).toHaveLength(0)
        })

        it('returns a violation for 480p encode', () => {
            const violations = service.checkRules({ ...baseMetadata, sourceType: SOURCE_TYPES.ENCODE, resolution: RESOLUTIONS['480p'] })
            expect(violations.some((v) => v.rule === 'resolution_too_low')).toBe(true)
        })

        it('returns a violation for 576p encode', () => {
            const violations = service.checkRules({ ...baseMetadata, sourceType: SOURCE_TYPES.ENCODE, resolution: RESOLUTIONS['576p'] })
            expect(violations.some((v) => v.rule === 'resolution_too_low')).toBe(true)
        })

        it('returns a violation for 480i encode', () => {
            const violations = service.checkRules({ ...baseMetadata, sourceType: SOURCE_TYPES.ENCODE, resolution: RESOLUTIONS['480i'] })
            expect(violations.some((v) => v.rule === 'resolution_too_low')).toBe(true)
        })

        it('does not apply the resolution rule to remux', () => {
            const violations = service.checkRules({ ...baseMetadata, sourceType: SOURCE_TYPES.REMUX, videoCodec: VIDEO_CODECS.AVC, resolution: RESOLUTIONS['480p'] })
            expect(violations.every((v) => v.rule !== 'resolution_too_low')).toBe(true)
        })

        it('does not apply the resolution rule to WEB-DL', () => {
            const violations = service.checkRules({
                ...baseMetadata,
                sourceType: SOURCE_TYPES.WEB_DL,
                source: SOURCES.WEB,
                service: 'NF',
                videoCodec: VIDEO_CODECS.H264,
                resolution: RESOLUTIONS['480p'],
            })
            expect(violations.every((v) => v.rule !== 'resolution_too_low')).toBe(true)
        })
    })

    describe('foreign content rules', () => {
        const foreignBase: TrackerUploadMetadata = { ...baseMetadata, originalLanguage: 'fr', language: ['fr'] }

        it('returns no violation for English content with English audio', () => {
            expect(service.checkRules({ ...baseMetadata, originalLanguage: 'en', language: ['en'] })).toHaveLength(0)
        })

        it('returns a violation for foreign content with no English audio and no English subs', () => {
            const violations = service.checkRules({ ...foreignBase, hasEnglishSubs: false })
            expect(violations.some((v) => v.rule === 'missing_english')).toBe(true)
        })

        it('returns no missing_english violation for foreign content with English subs', () => {
            const violations = service.checkRules({ ...foreignBase, hasEnglishSubs: true })
            expect(violations.every((v) => v.rule !== 'missing_english')).toBe(true)
        })

        it('returns no missing_english violation for foreign content with English audio dub', () => {
            const violations = service.checkRules({ ...foreignBase, language: ['fr', 'en'], hasEnglishSubs: false })
            expect(violations.every((v) => v.rule !== 'missing_english')).toBe(true)
        })

        it('returns a missing_original_language_audio violation when foreign content lacks original language audio', () => {
            const violations = service.checkRules({ ...foreignBase, language: ['en'], hasEnglishSubs: true })
            expect(violations.some((v) => v.rule === 'missing_original_language_audio')).toBe(true)
        })

        it('returns no missing_original_language_audio violation when foreign content includes original language audio', () => {
            const violations = service.checkRules({ ...foreignBase, language: ['fr', 'en'], hasEnglishSubs: false })
            expect(violations.every((v) => v.rule !== 'missing_original_language_audio')).toBe(true)
        })

        it('does not flag missing_original_language_audio for English content', () => {
            const violations = service.checkRules({ ...baseMetadata, originalLanguage: 'en', language: ['en'] })
            expect(violations.every((v) => v.rule !== 'missing_original_language_audio')).toBe(true)
        })
    })

    describe('required audio track rule', () => {
        it('returns no violation when English audio is present', () => {
            expect(service.checkRules({ ...baseMetadata, language: ['en'], originalLanguage: 'en' })).toHaveLength(0)
        })

        it('returns no violation when original language audio is present for foreign content', () => {
            const violations = service.checkRules({ ...baseMetadata, language: ['fr'], originalLanguage: 'fr' })
            expect(violations.every((v) => v.rule !== 'missing_required_audio')).toBe(true)
        })

        it('returns a violation when audio has neither English nor original language', () => {
            const violations = service.checkRules({ ...baseMetadata, language: ['de'], originalLanguage: 'fr', hasEnglishSubs: true })
            expect(violations.some((v) => v.rule === 'missing_required_audio')).toBe(true)
        })

        it('returns no violation when both English and original language audio are present', () => {
            const violations = service.checkRules({ ...baseMetadata, language: ['fr', 'en'], originalLanguage: 'fr' })
            expect(violations.every((v) => v.rule !== 'missing_required_audio')).toBe(true)
        })
    })

    describe('TrueHD compatibility track rule', () => {
        it('flags TrueHD without a compatibility track', () => {
            const violations = service.checkRules({ ...baseMetadata, audioCodec: AUDIO_CODECS.TRUEHD, hasTrueHDCompatibilityTrack: false })
            expect(violations).toHaveLength(1)
            expect(violations[0].rule).toBe('truehd_missing_compatibility_track')
        })

        it('allows TrueHD when a compatibility track is present', () => {
            const violations = service.checkRules({ ...baseMetadata, audioCodec: AUDIO_CODECS.TRUEHD, hasTrueHDCompatibilityTrack: true })
            expect(violations).toEqual([])
        })

        it('does not flag non-TrueHD codecs for missing compatibility track', () => {
            const violations = service.checkRules({ ...baseMetadata, audioCodec: AUDIO_CODECS.DTS_HD_MA, hasTrueHDCompatibilityTrack: undefined })
            expect(violations).toEqual([])
        })
    })
})

describe('ulcxTrackerService — upload', () => {
    it('delegates to unit3d upload with url, apiKey, title, and options', async () => {
        fetchMock.mockResolvedValue({ data: 'https://upload.cx/torrent/download/1' })
        const service = ulcxTrackerService('https://upload.cx', 'apikey')

        const result = await service.upload('/fake.torrent', baseMetadata, 'desc', 'mediainfo', 'Movie 2024', { anonymous: false, modQueueOptIn: false })

        expect(result).toBe('https://upload.cx/torrent/download/1')
        expect(fetchMock).toHaveBeenCalledWith('https://upload.cx/api/torrents/upload', expect.objectContaining({ method: 'POST' }))
    })
})

function makeUlcxCandidate(overrides: Partial<{ name: string; details_link: string; resolution_id: number; type_id: number }> = {}) {
    return {
        attributes: {
            name: 'Movie.2024.1080p.BluRay.x264-GROUP',
            details_link: 'https://upload.cx/torrents/1',
            resolution_id: 3,
            type_id: 3,
            ...overrides,
        },
    }
}

describe('ulcxTrackerService — findDuplicates', () => {
    const service = ulcxTrackerService('https://upload.cx', 'apikey')

    beforeEach(() => {
        fetchMock.mockResolvedValue({ data: [makeUlcxCandidate()] })
    })

    it('returns matching entry as non-trumpable duplicate', async () => {
        const result = await service.findDuplicates(baseMetadata)
        expect(result).toEqual([{ name: 'Movie.2024.1080p.BluRay.x264-GROUP', url: 'https://upload.cx/torrents/1', trumpable: false }])
    })

    it('filters out entries where HDR status differs', async () => {
        vi.mocked(parseMetadataFromName).mockReturnValue({ season: undefined, episode: undefined, repack: 0, proper: 0, hdr: ['HDR'], videoCodec: undefined } as never)
        expect(await service.findDuplicates({ ...baseMetadata, hdr: undefined })).toHaveLength(0)
    })

    it('keeps HDR entry when upload also has HDR', async () => {
        vi.mocked(parseMetadataFromName).mockReturnValue({ season: undefined, episode: undefined, repack: 0, proper: 0, hdr: ['HDR'], videoCodec: undefined } as never)
        expect(await service.findDuplicates({ ...baseMetadata, hdr: ['HDR'] })).toHaveLength(1)
    })

    it('filters out TV entries where season does not match', async () => {
        vi.mocked(parseMetadataFromName).mockReturnValue({ season: 2, episode: 1, repack: 0, proper: 0, hdr: [], videoCodec: undefined } as never)
        expect(await service.findDuplicates({ ...baseMetadata, mediaType: MEDIA_TYPES.TV, season: 1, episode: 1 })).toHaveLength(0)
    })

    it('keeps TV entry when season and episode match', async () => {
        vi.mocked(parseMetadataFromName).mockReturnValue({ season: 1, episode: 1, repack: 0, proper: 0, hdr: [], videoCodec: undefined } as never)
        expect(await service.findDuplicates({ ...baseMetadata, mediaType: MEDIA_TYPES.TV, season: 1, episode: 1 })).toHaveLength(1)
    })

    it('returns empty array when fetch fails', async () => {
        fetchMock.mockRejectedValue(new Error('network error'))
        expect(await service.findDuplicates(baseMetadata)).toEqual([])
    })
})
