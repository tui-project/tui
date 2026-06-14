import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ulcxTrackerService } from '../../../../../server/services/tracker/trackers/ulcx'
import { AUDIO_CODECS, AUDIO_CHANNELS, HDR_TYPES, MEDIA_TYPES, RATIOS, RESOLUTIONS, SOURCE_TYPES, SOURCES, VIDEO_CODECS } from '../../../../../server/model/metadata'
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
        it.each([
            [SOURCE_TYPES.ENCODE, VIDEO_CODECS.X264, {}],
            [SOURCE_TYPES.ENCODE, VIDEO_CODECS.X265, {}],
            [SOURCE_TYPES.REMUX, VIDEO_CODECS.AVC, {}],
            [SOURCE_TYPES.REMUX, VIDEO_CODECS.HEVC, {}],
            [SOURCE_TYPES.REMUX, VIDEO_CODECS.MPEG_2, {}],
            [SOURCE_TYPES.REMUX, VIDEO_CODECS.VC_1, {}],
            [SOURCE_TYPES.WEB_DL, VIDEO_CODECS.H264, { source: SOURCES.WEB, service: 'NF' }],
            [SOURCE_TYPES.WEB_DL, VIDEO_CODECS.H265, { source: SOURCES.WEB, service: 'NF' }],
            [SOURCE_TYPES.WEB_DL, VIDEO_CODECS.VP9, { source: SOURCES.WEB, service: 'NF' }],
            [SOURCE_TYPES.WEBRIP, VIDEO_CODECS.X265, { source: SOURCES.WEB, service: 'NF' }],
            [SOURCE_TYPES.HDTV, VIDEO_CODECS.H264, { source: SOURCES.HDTV }],
        ] as const)('returns no violation for valid %s codec (%s)', (sourceType, videoCodec, extra) => {
            expect(service.checkRules({ ...baseMetadata, sourceType, videoCodec, ...extra })).toHaveLength(0)
        })

        it.each([
            [SOURCE_TYPES.ENCODE, VIDEO_CODECS.H264, {}],
            [SOURCE_TYPES.REMUX, VIDEO_CODECS.X264, {}],
            [SOURCE_TYPES.WEB_DL, VIDEO_CODECS.X265, { source: SOURCES.WEB, service: 'NF' }],
            [SOURCE_TYPES.WEBRIP, VIDEO_CODECS.H264, { source: SOURCES.WEB, service: 'NF' }],
            [SOURCE_TYPES.HDTV, VIDEO_CODECS.X264, { source: SOURCES.HDTV }],
        ] as const)('returns invalid_video_codec violation for %s with codec %s', (sourceType, videoCodec, extra) => {
            const violations = service.checkRules({ ...baseMetadata, sourceType, videoCodec, ...extra })
            expect(violations).toHaveLength(1)
            expect(violations[0]!.rule).toBe('invalid_video_codec')
        })

        it.each([
            [SOURCES.NTSC_DVD, VIDEO_CODECS.X264],
            [SOURCES.PAL_DVD, VIDEO_CODECS.AVC],
            [SOURCES.HD_DVD, VIDEO_CODECS.H264],
        ] as const)('skips codec check for %s source', (source, videoCodec) => {
            expect(service.checkRules({ ...baseMetadata, source, videoCodec })).toHaveLength(0)
        })
    })

    describe('resolution rule (encodes only)', () => {
        it.each([[RESOLUTIONS['720p']], [RESOLUTIONS['1080p']], [RESOLUTIONS['2160p']]] as const)('returns no violation for %s encode', (resolution) => {
            expect(service.checkRules({ ...baseMetadata, sourceType: SOURCE_TYPES.ENCODE, resolution })).toHaveLength(0)
        })

        it.each([[RESOLUTIONS['480p']], [RESOLUTIONS['576p']], [RESOLUTIONS['480i']]] as const)('returns resolution_too_low violation for %s encode', (resolution) => {
            const violations = service.checkRules({ ...baseMetadata, sourceType: SOURCE_TYPES.ENCODE, resolution })
            expect(violations.some((v) => v.rule === 'resolution_too_low')).toBe(true)
        })

        it.each([
            [SOURCE_TYPES.REMUX, { videoCodec: VIDEO_CODECS.AVC }],
            [SOURCE_TYPES.WEB_DL, { source: SOURCES.WEB, service: 'NF', videoCodec: VIDEO_CODECS.H264 }],
        ] as const)('does not apply the resolution rule to %s', (sourceType, extra) => {
            const violations = service.checkRules({ ...baseMetadata, sourceType, resolution: RESOLUTIONS['480p'], ...extra })
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

    function mockParsed(overrides: Record<string, unknown> = {}) {
        vi.mocked(parseMetadataFromName).mockReturnValue({
            season: undefined,
            episode: undefined,
            repack: 0,
            proper: 0,
            rerip: 0,
            hdr: [],
            videoCodec: 'x264',
            hybrid: false,
            service: undefined,
            cut: undefined,
            ratio: undefined,
            ...overrides,
        } as never)
    }

    beforeEach(() => {
        fetchMock.mockResolvedValue({ data: [makeUlcxCandidate()] })
        mockParsed()
    })

    // ── Basic duplicate detection ──────────────────────────────────────────────

    it('returns a non-trumpable dupe when the slot matches', async () => {
        const result = await service.findDuplicates(baseMetadata)
        expect(result).toEqual([{ name: 'Movie.2024.1080p.BluRay.x264-GROUP', url: 'https://upload.cx/torrents/1', trumpable: false }])
    })

    it('returns empty array when fetch fails', async () => {
        fetchMock.mockRejectedValue(new Error('network error'))
        expect(await service.findDuplicates(baseMetadata)).toEqual([])
    })

    // ── HDR slot separation ────────────────────────────────────────────────────

    it('filters out entries where HDR tier differs (upload SDR, existing HDR)', async () => {
        mockParsed({ hdr: [HDR_TYPES.HDR10] })
        expect(await service.findDuplicates({ ...baseMetadata, hdr: undefined })).toHaveLength(0)
    })

    it('filters out entries where HDR tier differs (upload HDR, existing SDR)', async () => {
        mockParsed({ hdr: [] })
        expect(await service.findDuplicates({ ...baseMetadata, hdr: [HDR_TYPES.HDR10] })).toHaveLength(0)
    })

    it('keeps HDR entry when upload is also HDR', async () => {
        mockParsed({ hdr: [HDR_TYPES.HDR10] })
        expect(await service.findDuplicates({ ...baseMetadata, hdr: [HDR_TYPES.HDR10] })).toHaveLength(1)
    })

    it('keeps DV entry separate from HDR entry (different slots)', async () => {
        mockParsed({ hdr: [HDR_TYPES.DV] })
        expect(await service.findDuplicates({ ...baseMetadata, hdr: [HDR_TYPES.HDR10] })).toHaveLength(0)
    })

    it('keeps HDR10+ entry separate from HDR entry (different slots)', async () => {
        mockParsed({ hdr: [HDR_TYPES.HDR10_PLUS] })
        expect(await service.findDuplicates({ ...baseMetadata, hdr: [HDR_TYPES.HDR10] })).toHaveLength(0)
    })

    it('marks DV/HDR upload as trumping existing HDR (shared HDR slot)', async () => {
        mockParsed({ hdr: [HDR_TYPES.HDR10] })
        const result = await service.findDuplicates({ ...baseMetadata, hdr: [HDR_TYPES.HDR10, HDR_TYPES.DV] })
        expect(result).toHaveLength(1)
        expect(result[0]).toMatchObject({ trumpable: true })
    })

    it('marks DV/HDR10+ upload as trumping existing HDR10+ (shared HDR10PLUS slot)', async () => {
        mockParsed({ hdr: [HDR_TYPES.HDR10_PLUS] })
        const result = await service.findDuplicates({ ...baseMetadata, hdr: [HDR_TYPES.HDR10_PLUS, HDR_TYPES.DV] })
        expect(result).toHaveLength(1)
        expect(result[0]).toMatchObject({ trumpable: true })
    })

    // ── Encode codec slot separation ───────────────────────────────────────────

    it('does not dupe an x264 encode against an x265 encode (different slots)', async () => {
        mockParsed({ videoCodec: 'x265' })
        expect(await service.findDuplicates({ ...baseMetadata, sourceType: SOURCE_TYPES.ENCODE, videoCodec: VIDEO_CODECS.X264 })).toHaveLength(0)
    })

    it('does not dupe an x265 encode against an x264 encode (different slots)', async () => {
        mockParsed({ videoCodec: 'x264' })
        expect(await service.findDuplicates({ ...baseMetadata, sourceType: SOURCE_TYPES.ENCODE, videoCodec: VIDEO_CODECS.X265 })).toHaveLength(0)
    })

    it('dupes an x264 encode against another x264 encode', async () => {
        mockParsed({ videoCodec: 'x264' })
        expect(await service.findDuplicates({ ...baseMetadata, sourceType: SOURCE_TYPES.ENCODE, videoCodec: VIDEO_CODECS.X264 })).toHaveLength(1)
    })

    it('does not dupe encodes with different cuts', async () => {
        mockParsed({ videoCodec: 'x264', cut: "Director's Cut" })
        const result = await service.findDuplicates({ ...baseMetadata, sourceType: SOURCE_TYPES.ENCODE, videoCodec: VIDEO_CODECS.X264, cut: undefined })
        expect(result).toHaveLength(0)
    })

    it('does not dupe encodes with different ratios', async () => {
        mockParsed({ videoCodec: 'x264', ratio: 'IMAX' })
        const result = await service.findDuplicates({ ...baseMetadata, sourceType: SOURCE_TYPES.ENCODE, videoCodec: VIDEO_CODECS.X264, ratio: undefined })
        expect(result).toHaveLength(0)
    })

    it('does not dupe WEB releases with different cuts', async () => {
        mockParsed({ videoCodec: 'H.264', service: 'NF', cut: "Director's Cut" })
        fetchMock.mockResolvedValue({ data: [makeUlcxCandidate({ name: 'Movie.2024.1080p.NF.WEB-DL.x264-GROUP', type_id: 4 })] })
        const result = await service.findDuplicates({
            ...baseMetadata,
            sourceType: SOURCE_TYPES.WEB_DL,
            source: SOURCES.WEB,
            service: 'NF',
            videoCodec: VIDEO_CODECS.H264,
            cut: undefined,
        })
        expect(result).toHaveLength(0)
    })

    it('does not dupe WEB releases with different ratios', async () => {
        mockParsed({ videoCodec: 'H.264', service: 'NF', ratio: 'IMAX' })
        fetchMock.mockResolvedValue({ data: [makeUlcxCandidate({ name: 'Movie.2024.1080p.NF.WEB-DL.x264-GROUP', type_id: 4 })] })
        const result = await service.findDuplicates({
            ...baseMetadata,
            sourceType: SOURCE_TYPES.WEB_DL,
            source: SOURCES.WEB,
            service: 'NF',
            videoCodec: VIDEO_CODECS.H264,
            ratio: undefined,
        })
        expect(result).toHaveLength(0)
    })

    // ── Remux slots (cut/ratio differentiate; HDR tier differentiates) ────────

    it('dupes a remux against another remux with the same cut/ratio and HDR tier', async () => {
        mockParsed({ videoCodec: 'AVC', hdr: [], cut: undefined, ratio: undefined })
        fetchMock.mockResolvedValue({ data: [makeUlcxCandidate({ type_id: 2 })] })
        const result = await service.findDuplicates({ ...baseMetadata, sourceType: SOURCE_TYPES.REMUX, videoCodec: VIDEO_CODECS.AVC, hdr: [] })
        expect(result).toHaveLength(1)
    })

    it('dupes a remux regardless of video codec when cut/ratio and HDR tier match', async () => {
        mockParsed({ videoCodec: 'HEVC', hdr: [], cut: undefined, ratio: undefined })
        fetchMock.mockResolvedValue({ data: [makeUlcxCandidate({ type_id: 2 })] })
        const result = await service.findDuplicates({ ...baseMetadata, sourceType: SOURCE_TYPES.REMUX, videoCodec: VIDEO_CODECS.AVC, hdr: [] })
        expect(result).toHaveLength(1)
    })

    it("does not dupe remuxes with different cuts (Director's Cut vs no cut)", async () => {
        mockParsed({ videoCodec: 'AVC', hdr: [], cut: "Director's Cut", ratio: undefined })
        fetchMock.mockResolvedValue({ data: [makeUlcxCandidate({ type_id: 2 })] })
        const result = await service.findDuplicates({ ...baseMetadata, sourceType: SOURCE_TYPES.REMUX, videoCodec: VIDEO_CODECS.AVC, hdr: [], cut: undefined })
        expect(result).toHaveLength(0)
    })

    it('does not dupe remuxes with different ratios', async () => {
        mockParsed({ videoCodec: 'AVC', hdr: [], cut: undefined, ratio: '4:3' })
        fetchMock.mockResolvedValue({ data: [makeUlcxCandidate({ type_id: 2 })] })
        const result = await service.findDuplicates({ ...baseMetadata, sourceType: SOURCE_TYPES.REMUX, videoCodec: VIDEO_CODECS.AVC, hdr: [], ratio: undefined })
        expect(result).toHaveLength(0)
    })

    it('does not dupe remuxes with different HDR tiers (SDR vs HDR)', async () => {
        mockParsed({ videoCodec: 'AVC', hdr: [HDR_TYPES.HDR10], cut: undefined, ratio: undefined })
        fetchMock.mockResolvedValue({ data: [makeUlcxCandidate({ type_id: 2 })] })
        const result = await service.findDuplicates({ ...baseMetadata, sourceType: SOURCE_TYPES.REMUX, videoCodec: VIDEO_CODECS.AVC, hdr: [] })
        expect(result).toHaveLength(0)
    })

    it('marks a DV/HDR remux as trumping an existing HDR remux (shared HDR slot)', async () => {
        mockParsed({ videoCodec: 'HEVC', hdr: [HDR_TYPES.HDR10], cut: undefined, ratio: undefined })
        fetchMock.mockResolvedValue({ data: [makeUlcxCandidate({ type_id: 2 })] })
        const result = await service.findDuplicates({ ...baseMetadata, sourceType: SOURCE_TYPES.REMUX, videoCodec: VIDEO_CODECS.HEVC, hdr: [HDR_TYPES.HDR10, HDR_TYPES.DV] })
        expect(result).toHaveLength(1)
        expect(result[0]).toMatchObject({ trumpable: true })
    })

    it('marks a disc DV remux as trumping an existing hybrid DV remux', async () => {
        mockParsed({ videoCodec: 'HEVC', hdr: ['DV'], hybrid: true, cut: undefined, ratio: undefined })
        fetchMock.mockResolvedValue({ data: [makeUlcxCandidate({ type_id: 2 })] })
        const result = await service.findDuplicates({ ...baseMetadata, sourceType: SOURCE_TYPES.REMUX, videoCodec: VIDEO_CODECS.HEVC, hdr: ['DV'], hybrid: false })
        expect(result).toHaveLength(1)
        expect(result[0]).toMatchObject({ trumpable: true })
    })

    it('does not mark a hybrid DV remux as trumping an existing disc DV remux', async () => {
        mockParsed({ videoCodec: 'HEVC', hdr: ['DV'], hybrid: false, cut: undefined, ratio: undefined })
        fetchMock.mockResolvedValue({ data: [makeUlcxCandidate({ type_id: 2 })] })
        const result = await service.findDuplicates({ ...baseMetadata, sourceType: SOURCE_TYPES.REMUX, videoCodec: VIDEO_CODECS.HEVC, hdr: ['DV'], hybrid: true })
        expect(result).toHaveLength(1)
        expect(result[0]).toMatchObject({ trumpable: false })
    })

    // ── WEB provider slots ─────────────────────────────────────────────────────

    it('does not dupe WEB-DL from AMZN against WEB-DL from NF (different providers)', async () => {
        // existing is NF, upload is AMZN
        fetchMock.mockResolvedValue({ data: [makeUlcxCandidate({ name: 'Movie.2024.1080p.NF.WEB-DL.x264-GROUP', type_id: 4 })] })
        mockParsed({ videoCodec: 'H.264', service: 'NF' })
        const result = await service.findDuplicates({
            ...baseMetadata,
            sourceType: SOURCE_TYPES.WEB_DL,
            source: SOURCES.WEB,
            service: 'AMZN',
            videoCodec: VIDEO_CODECS.H264,
        })
        expect(result).toHaveLength(0)
    })

    it('dupes WEB-DL from AMZN against WEB-DL from AMZN (same provider)', async () => {
        fetchMock.mockResolvedValue({ data: [makeUlcxCandidate({ name: 'Movie.2024.1080p.AMZN.WEB-DL.x264-GROUP', type_id: 4 })] })
        mockParsed({ videoCodec: 'H.264', service: 'AMZN' })
        const result = await service.findDuplicates({
            ...baseMetadata,
            sourceType: SOURCE_TYPES.WEB_DL,
            source: SOURCES.WEB,
            service: 'AMZN',
            videoCodec: VIDEO_CODECS.H264,
        })
        expect(result).toHaveLength(1)
    })

    it('dupes WEB-DL against WEBRip from the same provider (shared slot, WEB-DL trumps)', async () => {
        fetchMock.mockResolvedValue({ data: [makeUlcxCandidate({ name: 'Movie.2024.1080p.AMZN.WEBRip.x264-GROUP', type_id: 5 })] })
        mockParsed({ videoCodec: 'x264', service: 'AMZN' })
        const result = await service.findDuplicates({
            ...baseMetadata,
            sourceType: SOURCE_TYPES.WEB_DL,
            source: SOURCES.WEB,
            service: 'AMZN',
            videoCodec: VIDEO_CODECS.H264,
        })
        expect(result).toHaveLength(1)
        expect(result[0]).toMatchObject({ trumpable: true })
    })

    it('does not mark WEBRip as trumping a same-provider WEB-DL', async () => {
        fetchMock.mockResolvedValue({ data: [makeUlcxCandidate({ name: 'Movie.2024.1080p.AMZN.WEB-DL.x264-GROUP', type_id: 4 })] })
        mockParsed({ videoCodec: 'x264', service: 'AMZN' })
        const result = await service.findDuplicates({
            ...baseMetadata,
            sourceType: SOURCE_TYPES.WEBRIP,
            source: SOURCES.WEB,
            service: 'AMZN',
            videoCodec: VIDEO_CODECS.X264,
        })
        expect(result).toHaveLength(1)
        expect(result[0]).toMatchObject({ trumpable: false })
    })

    it('does not dupe WEBRip from AMZN against WEBRip from NF (different providers)', async () => {
        fetchMock.mockResolvedValue({ data: [makeUlcxCandidate({ name: 'Movie.2024.1080p.NF.WEBRip.x264-GROUP', type_id: 5 })] })
        mockParsed({ videoCodec: 'x264', service: 'NF' })
        const result = await service.findDuplicates({
            ...baseMetadata,
            sourceType: SOURCE_TYPES.WEBRIP,
            source: SOURCES.WEB,
            service: 'AMZN',
            videoCodec: VIDEO_CODECS.X264,
        })
        expect(result).toHaveLength(0)
    })

    // ── API query parameters ───────────────────────────────────────────────────

    it('queries all web family types for a WEB-DL upload', async () => {
        fetchMock.mockReset()
        fetchMock.mockResolvedValue({ data: [] })
        await service.findDuplicates({ ...baseMetadata, sourceType: SOURCE_TYPES.WEB_DL, source: SOURCES.WEB, service: 'NF', videoCodec: VIDEO_CODECS.H264 })
        const url: string = fetchMock.mock.calls[0][0]
        expect(url).toContain('types[]=4') // WEB-DL
        expect(url).toContain('types[]=5') // WEBRip
        expect(url).toContain('types[]=6') // HDTV
    })

    it('queries only encode type for an encode upload', async () => {
        fetchMock.mockReset()
        fetchMock.mockResolvedValue({ data: [] })
        await service.findDuplicates({ ...baseMetadata, sourceType: SOURCE_TYPES.ENCODE })
        const url: string = fetchMock.mock.calls[0][0]
        expect(url).toContain('types[]=3') // ENCODE
        expect(url).not.toContain('types[]=4') // not WEB-DL
        expect(url).not.toContain('types[]=2') // not REMUX
    })

    it('passes seasonNumber and episodeNumber for TV episodes', async () => {
        fetchMock.mockReset()
        fetchMock.mockResolvedValue({ data: [] })
        await service.findDuplicates({ ...baseMetadata, mediaType: MEDIA_TYPES.TV, season: 2, episode: 5 })
        const url: string = fetchMock.mock.calls[0][0]
        expect(url).toContain('seasonNumber=2')
        expect(url).toContain('episodeNumber=5')
    })

    it('passes episodeNumber=0 for TV season packs', async () => {
        fetchMock.mockReset()
        fetchMock.mockResolvedValue({ data: [] })
        await service.findDuplicates({ ...baseMetadata, mediaType: MEDIA_TYPES.TV, season: 1, episode: undefined })
        const url: string = fetchMock.mock.calls[0][0]
        expect(url).toContain('seasonNumber=1')
        expect(url).toContain('episodeNumber=0')
    })

    it('does not pass season/episode for movies', async () => {
        fetchMock.mockReset()
        fetchMock.mockResolvedValue({ data: [] })
        await service.findDuplicates({ ...baseMetadata, mediaType: MEDIA_TYPES.MOVIE })
        const url: string = fetchMock.mock.calls[0][0]
        expect(url).not.toContain('seasonNumber')
        expect(url).not.toContain('episodeNumber')
    })

    // ── Trump rules ────────────────────────────────────────────────────────────

    it.each([
        ['REPACK1 upload vs non-repack existing', { repack: 1, proper: 0, rerip: 0 }, { repack: 0, proper: 0, rerip: 0 }],
        ['PROPER1 upload vs non-proper existing', { repack: 0, proper: 1, rerip: 0 }, { repack: 0, proper: 0, rerip: 0 }],
        ['RERIP1 upload vs non-rerip existing', { repack: 0, proper: 0, rerip: 1 }, { repack: 0, proper: 0, rerip: 0 }],
        ['REPACK2 upload vs REPACK1 existing', { repack: 2, proper: 0, rerip: 0 }, { repack: 1, proper: 0, rerip: 0 }],
    ] as const)('marks as trumpable: %s', async (_, upload, existing) => {
        mockParsed({ ...existing, hdr: [], videoCodec: 'x264' })
        const result = await service.findDuplicates({ ...baseMetadata, ...upload })
        expect(result[0]).toMatchObject({ trumpable: true })
    })

    it.each([
        ['non-repack upload vs REPACK1 existing', { repack: 0, proper: 0, rerip: 0 }, { repack: 1, proper: 0, rerip: 0 }],
        ['REPACK1 upload vs REPACK1 existing', { repack: 1, proper: 0, rerip: 0 }, { repack: 1, proper: 0, rerip: 0 }],
        ['REPACK1 upload vs REPACK2 existing', { repack: 1, proper: 0, rerip: 0 }, { repack: 2, proper: 0, rerip: 0 }],
    ] as const)('does not mark as trumpable: %s', async (_, upload, existing) => {
        mockParsed({ ...existing, hdr: [], videoCodec: 'x264' })
        const result = await service.findDuplicates({ ...baseMetadata, ...upload })
        expect(result[0]).toMatchObject({ trumpable: false })
    })

    it('marks an existing Dubbed release as trumpable when the upload carries the original audio', async () => {
        mockParsed({ hdr: [], videoCodec: 'x264' })
        fetchMock.mockResolvedValue({ data: [makeUlcxCandidate({ name: 'Movie 2024 1080p BluRay Dubbed x264-GROUP' })] })
        const result = await service.findDuplicates({ ...baseMetadata, language: ['ja', 'en'], originalLanguage: 'ja' })
        expect(result).toHaveLength(1)
        expect(result[0]).toMatchObject({ trumpable: true })
    })

    it('does not mark as trumpable when upload is also dubbed-only', async () => {
        mockParsed({ hdr: [], videoCodec: 'x264' })
        fetchMock.mockResolvedValue({ data: [makeUlcxCandidate({ name: 'Movie 2024 1080p BluRay Dubbed x264-GROUP' })] })
        const result = await service.findDuplicates({ ...baseMetadata, language: ['en'], originalLanguage: 'ja' })
        expect(result).toHaveLength(1)
        expect(result[0]).toMatchObject({ trumpable: false })
    })

    it('marks a NOGROUP existing release as trumpable by a named-group upload', async () => {
        mockParsed({ hdr: [], videoCodec: 'x264' })
        fetchMock.mockResolvedValue({ data: [makeUlcxCandidate({ name: 'Movie 2024 1080p BluRay x264-NOGROUP' })] })
        const result = await service.findDuplicates({ ...baseMetadata, releaseGroup: 'BHDStudio' })
        expect(result).toHaveLength(1)
        expect(result[0]).toMatchObject({ trumpable: true })
    })

    it('does not mark as trumpable when upload is also NOGROUP', async () => {
        mockParsed({ hdr: [], videoCodec: 'x264' })
        fetchMock.mockResolvedValue({ data: [makeUlcxCandidate({ name: 'Movie 2024 1080p BluRay x264-NOGROUP' })] })
        const result = await service.findDuplicates({ ...baseMetadata, releaseGroup: undefined })
        expect(result).toHaveLength(1)
        expect(result[0]).toMatchObject({ trumpable: false })
    })
})
