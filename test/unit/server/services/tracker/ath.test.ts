import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createAthTrackerService } from '../../../../../server/services/tracker/trackers/ath'
import { AUDIO_CHANNELS, AUDIO_CODECS, CUTS, HDR_TYPES, MEDIA_TYPES, RATIOS, RESOLUTIONS, SOURCE_TYPES, SOURCES, VIDEO_CODECS } from '../../../../../server/model/metadata'
import { getLanguageDisplayName } from '../../../../../server/repositories/language-repository'
import type { TrackerUploadMetadata } from '../../../../../server/services/tracker/tracker'

vi.mock('../../../../../server/utils/logger', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

vi.mock('../../../../../server/repositories/language-repository', () => ({
    getLanguageDisplayName: vi.fn().mockResolvedValue(null),
}))

vi.mock('node:fs/promises', () => ({
    readFile: vi.fn().mockResolvedValue(Buffer.from('fake-torrent')),
}))

const fetchMock = vi.fn().mockResolvedValue({ data: 'http://aither.cc/torrents/1' })
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
    repack: 0,
    proper: 0,
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

describe('createAthTrackerService — checkRules', () => {
    const service = createAthTrackerService('https://aither.cc', 'apikey')

    it('returns no violations for a clean release', () => {
        expect(service.checkRules(baseMetadata)).toEqual([])
    })

    it('returns no violations when releaseGroup is absent', () => {
        const { releaseGroup: _, ...meta } = baseMetadata
        expect(service.checkRules(meta as TrackerUploadMetadata)).toEqual([])
    })

    it('bans a group that is banned for ALL source types regardless of sourceType', () => {
        const violations = service.checkRules({ ...baseMetadata, releaseGroup: 'YIFY', sourceType: SOURCE_TYPES.REMUX })
        expect(violations).toHaveLength(1)
        expect(violations[0].rule).toBe('banned_release_group')
        expect(violations[0].message).toContain('YIFY')
        expect(violations[0].message).not.toContain('for REMUX')
    })

    it('bans a group with case-insensitive group name matching', () => {
        const violations = service.checkRules({ ...baseMetadata, releaseGroup: 'yify' })
        expect(violations).toHaveLength(1)
        expect(violations[0].rule).toBe('banned_release_group')
    })

    it('bans a source-type-specific group when sourceType matches', () => {
        // EVO is banned for ENCODE only
        const violations = service.checkRules({ ...baseMetadata, releaseGroup: 'EVO', sourceType: SOURCE_TYPES.ENCODE })
        expect(violations).toHaveLength(1)
        expect(violations[0].rule).toBe('banned_release_group')
        expect(violations[0].message).toContain('EVO')
        expect(violations[0].message).toContain(SOURCE_TYPES.ENCODE)
    })

    it('allows a source-type-specific group when sourceType does not match', () => {
        // EVO is banned for ENCODE only — should be allowed for REMUX
        const violations = service.checkRules({ ...baseMetadata, releaseGroup: 'EVO', sourceType: SOURCE_TYPES.REMUX })
        expect(violations).toEqual([])
    })

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

    it('allows English-only audio for an English original', () => {
        expect(service.checkRules({ ...baseMetadata, language: ['en'], originalLanguage: 'en' })).toEqual([])
    })

    it('allows original-language-only audio for a non-English original', () => {
        expect(service.checkRules({ ...baseMetadata, language: ['ja'], originalLanguage: 'ja', hasEnglishSubs: true })).toEqual([])
    })

    it('allows original + English audio for a non-English original', () => {
        expect(service.checkRules({ ...baseMetadata, language: ['ja', 'en'], originalLanguage: 'ja' })).toEqual([])
    })

    it('allows English-only audio when original language is non-English (dubbed release)', () => {
        const violations = service.checkRules({ ...baseMetadata, language: ['en'], originalLanguage: 'ja' })
        expect(violations.some((v) => v.rule === 'missing_english')).toBe(false)
    })

    it('flags when no audio track matches original language or English', () => {
        const violations = service.checkRules({ ...baseMetadata, language: ['fr'], originalLanguage: 'ja', hasEnglishSubs: true })
        expect(violations.some((v) => v.rule === 'missing_required_audio')).toBe(true)
    })

    it('does not flag missing_required_audio when original language track is present', () => {
        const violations = service.checkRules({ ...baseMetadata, language: ['ja'], originalLanguage: 'ja', hasEnglishSubs: true })
        expect(violations.some((v) => v.rule === 'missing_required_audio')).toBe(false)
    })

    it('does not flag missing_required_audio when English dub is present', () => {
        const violations = service.checkRules({ ...baseMetadata, language: ['en'], originalLanguage: 'ja' })
        expect(violations.some((v) => v.rule === 'missing_required_audio')).toBe(false)
    })

    it('flags non-English release with no English dub and no English subs', () => {
        const violations = service.checkRules({ ...baseMetadata, language: ['ja'], originalLanguage: 'ja', hasEnglishSubs: false })
        expect(violations).toHaveLength(1)
        expect(violations[0].rule).toBe('missing_english')
    })

    it('does not flag non-English release when English dub is included', () => {
        const violations = service.checkRules({ ...baseMetadata, language: ['ja', 'en'], originalLanguage: 'ja', hasEnglishSubs: false })
        expect(violations).toEqual([])
    })

    it('does not flag non-English release when English subs are present', () => {
        const violations = service.checkRules({ ...baseMetadata, language: ['ja'], originalLanguage: 'ja', hasEnglishSubs: true })
        expect(violations).toEqual([])
    })

    it('does not flag missing_english when English audio is present', () => {
        const violations = service.checkRules({ ...baseMetadata, language: ['en'], originalLanguage: 'fr' })
        expect(violations.some((v) => v.rule === 'missing_english')).toBe(false)
    })

    it('flags non-English release when hasEnglishSubs is undefined (no subs assumed)', () => {
        const violations = service.checkRules({ ...baseMetadata, language: ['fr'], originalLanguage: 'fr', hasEnglishSubs: undefined })
        expect(violations).toHaveLength(1)
        expect(violations[0].rule).toBe('missing_english')
    })

    it('does not flag English-original releases', () => {
        const violations = service.checkRules({ ...baseMetadata, language: ['en'], originalLanguage: 'en', hasEnglishSubs: false })
        expect(violations).toEqual([])
    })

    it('flags foreign content missing the original language audio track', () => {
        const violations = service.checkRules({ ...baseMetadata, language: ['en'], originalLanguage: 'ja' })
        expect(violations.some((v) => v.rule === 'missing_original_language_audio')).toBe(true)
    })

    it('does not flag missing_original_language_audio when original language track is present', () => {
        const violations = service.checkRules({ ...baseMetadata, language: ['ja', 'en'], originalLanguage: 'ja' })
        expect(violations.some((v) => v.rule === 'missing_original_language_audio')).toBe(false)
    })

    it('does not flag missing_original_language_audio for English-original content', () => {
        const violations = service.checkRules({ ...baseMetadata, language: ['en'], originalLanguage: 'en' })
        expect(violations.some((v) => v.rule === 'missing_original_language_audio')).toBe(false)
    })

    it('bans Weasley[HONE] for WEB-DL', () => {
        const violations = service.checkRules({ ...baseMetadata, releaseGroup: 'Weasley[HONE]', sourceType: SOURCE_TYPES.WEB_DL })
        expect(violations).toHaveLength(1)
        expect(violations[0].rule).toBe('banned_release_group')
    })

    it('bans Weasley[HONE] for WEBRip', () => {
        const violations = service.checkRules({ ...baseMetadata, releaseGroup: 'Weasley[HONE]', sourceType: SOURCE_TYPES.WEBRIP })
        expect(violations).toHaveLength(1)
    })

    it('allows Weasley[HONE] for ENCODE', () => {
        const violations = service.checkRules({ ...baseMetadata, releaseGroup: 'Weasley[HONE]', sourceType: SOURCE_TYPES.ENCODE })
        expect(violations).toEqual([])
    })

    it('bans HDT for REMUX only', () => {
        const remuxViolations = service.checkRules({ ...baseMetadata, releaseGroup: 'HDT', sourceType: SOURCE_TYPES.REMUX })
        expect(remuxViolations).toHaveLength(1)
        const encodeViolations = service.checkRules({ ...baseMetadata, releaseGroup: 'HDT', sourceType: SOURCE_TYPES.ENCODE })
        expect(encodeViolations).toEqual([])
    })

    it('bans edge2020 for REMUX and ENCODE', () => {
        const remuxViolations = service.checkRules({ ...baseMetadata, releaseGroup: 'edge2020', sourceType: SOURCE_TYPES.REMUX })
        expect(remuxViolations).toHaveLength(1)
        const encodeViolations = service.checkRules({ ...baseMetadata, releaseGroup: 'edge2020', sourceType: SOURCE_TYPES.ENCODE })
        expect(encodeViolations).toHaveLength(1)
        const webdlViolations = service.checkRules({ ...baseMetadata, releaseGroup: 'edge2020', sourceType: SOURCE_TYPES.WEB_DL })
        expect(webdlViolations).toEqual([])
    })
})

describe('createAthTrackerService — getTitle', () => {
    const service = createAthTrackerService('https://aither.cc', 'apikey')

    beforeEach(() => {
        fetchMock.mockReset()
        fetchMock.mockResolvedValue({ data: 'http://aither.cc/torrents/1' })
        vi.mocked(getLanguageDisplayName).mockResolvedValue(null)
    })

    it('builds a basic encode movie title', async () => {
        // Avengers: Infinity War 2018 1080p BluRay DD+ 7.1 x265-NAN0
        const title = await service.getTitle({
            ...baseMetadata,
            title: 'Avengers: Infinity War',
            originalTitle: 'Avengers: Infinity War',
            year: 2018,
            resolution: RESOLUTIONS['1080p'],
            source: SOURCES.BLURAY,
            audioCodec: AUDIO_CODECS.DD_PLUS,
            audioChannels: AUDIO_CHANNELS['7.1'],
            videoCodec: VIDEO_CODECS.X265,
            releaseGroup: 'NAN0',
        })
        expect(title).toBe('Avengers: Infinity War 2018 1080p BluRay DD+ 7.1 x265-NAN0')
    })

    it('includes year for movies', async () => {
        const title = await service.getTitle(baseMetadata)
        expect(title).toContain(String(baseMetadata.year))
    })

    it('includes AKA when originalTitle differs', async () => {
        const title = await service.getTitle({ ...baseMetadata, title: 'Dragon Ball Super: Super Hero', originalTitle: 'Doragon bôru sûpâ: Sûpâ hîrô' })
        expect(title).toContain('AKA Doragon bôru sûpâ: Sûpâ hîrô')
    })

    it('omits AKA when originalTitle matches title', async () => {
        const title = await service.getTitle({ ...baseMetadata, title: 'Movie', originalTitle: 'Movie' })
        expect(title).not.toContain('AKA')
    })

    it.each([
        ['repack', 'REPACK'],
        ['proper', 'PROPER'],
        ['rerip', 'RERIP'],
    ] as const)('includes %s flag before resolution', async (field, flag) => {
        const title = await service.getTitle({ ...baseMetadata, [field]: 1 })
        const flagIndex = title.indexOf(flag)
        const resIndex = title.indexOf(baseMetadata.resolution)
        expect(flagIndex).toBeGreaterThan(-1)
        expect(flagIndex).toBeLessThan(resIndex)
    })

    it.each([
        ['repack', 'REPACK'],
        ['proper', 'PROPER'],
        ['rerip', 'RERIP'],
    ] as const)('includes %s2 for second %s', async (field, flag) => {
        const title = await service.getTitle({ ...baseMetadata, [field]: 2 })
        expect(title).toContain(`${flag}2`)
    })

    it.each([
        ['repack', 'REPACK'],
        ['proper', 'PROPER'],
        ['rerip', 'RERIP'],
    ] as const)('omits %s flag when 0', async (field, flag) => {
        const title = await service.getTitle({ ...baseMetadata, [field]: 0 })
        expect(title).not.toContain(flag)
    })

    it.each([
        [CUTS.DIRECTORS, "Director's Cut"],
        [CUTS.EXTENDED, 'Extended'],
        [CUTS.UNRATED, 'Unrated'],
        [CUTS.SPECIAL_EDITION, 'Special Edition'],
    ])('includes cut "%s" before resolution', async (cut, expected) => {
        const title = await service.getTitle({ ...baseMetadata, cut })
        const cutIndex = title.indexOf(expected)
        const resIndex = title.indexOf(baseMetadata.resolution)
        expect(cutIndex).toBeGreaterThan(-1)
        expect(cutIndex).toBeLessThan(resIndex)
    })

    it('omits cut when absent', async () => {
        const title = await service.getTitle({ ...baseMetadata, cut: undefined })
        expect(title).not.toContain("Director's Cut")
        expect(title).not.toContain('Extended')
    })

    it.each([
        [RATIOS.IMAX, 'IMAX'],
        [RATIOS.OPEN_MATTE, 'Open Matte'],
        [RATIOS.MAR, 'MAR'],
    ])('includes ratio "%s" before resolution', async (ratio, expected) => {
        const title = await service.getTitle({ ...baseMetadata, ratio })
        const ratioIndex = title.indexOf(expected)
        const resIndex = title.indexOf(baseMetadata.resolution)
        expect(ratioIndex).toBeGreaterThan(-1)
        expect(ratioIndex).toBeLessThan(resIndex)
    })

    it('omits ratio when absent', async () => {
        const title = await service.getTitle({ ...baseMetadata, ratio: undefined })
        expect(title).not.toContain('IMAX')
        expect(title).not.toContain('Open Matte')
    })

    it.each([
        [SOURCE_TYPES.ENCODE, SOURCES.BLURAY, undefined, VIDEO_CODECS.X264],
        [SOURCE_TYPES.WEBRIP, SOURCES.WEB, 'NF', VIDEO_CODECS.X264],
        [SOURCE_TYPES.WEB_DL, SOURCES.WEB, 'NF', VIDEO_CODECS.H264],
        [SOURCE_TYPES.REMUX, SOURCES.BLURAY, undefined, VIDEO_CODECS.AVC],
    ] as const)('includes Hybrid before resolution for %s', async (sourceType, source, service_, videoCodec) => {
        const title = await service.getTitle({ ...baseMetadata, hybrid: true, sourceType, source, service: service_, videoCodec })
        const hybridIndex = title.indexOf('Hybrid')
        const resIndex = title.indexOf(baseMetadata.resolution)
        expect(hybridIndex).toBeGreaterThan(-1)
        expect(hybridIndex).toBeLessThan(resIndex)
    })

    it('includes resolution before source', async () => {
        const title = await service.getTitle(baseMetadata)
        const resIndex = title.indexOf(baseMetadata.resolution)
        const sourceIndex = title.indexOf('BluRay')
        expect(resIndex).toBeGreaterThan(-1)
        expect(sourceIndex).toBeGreaterThan(-1)
        expect(resIndex).toBeLessThan(sourceIndex)
    })

    it.each([
        [SOURCE_TYPES.WEBRIP, SOURCES.WEB, 'NF', VIDEO_CODECS.X264, 'WEBRip'],
        [SOURCE_TYPES.WEB_DL, SOURCES.WEB, 'NF', VIDEO_CODECS.H265, 'WEB-DL'],
        [SOURCE_TYPES.REMUX, SOURCES.BLURAY, undefined, VIDEO_CODECS.AVC, 'REMUX'],
    ] as const)('includes source type string "%s"', async (sourceType, source, service_, videoCodec, expected) => {
        const title = await service.getTitle({ ...baseMetadata, sourceType, source, service: service_, videoCodec })
        expect(title).toContain(expected)
    })

    it.each([
        [SOURCES.BLURAY, 'BluRay'],
        [SOURCES.UHD_BLURAY, 'UHD BluRay'],
    ])('includes source string "%s" in title', async (source, expected) => {
        const title = await service.getTitle({ ...baseMetadata, source, sourceType: SOURCE_TYPES.REMUX, videoCodec: VIDEO_CODECS.AVC })
        expect(title).toContain(expected)
    })

    it('includes service name before WEB-DL type', async () => {
        // Leave the World Behind 2023 1080p NF WEB-DL DD+ 5.1 Atmos DV HDR H.265-Kitsune
        const title = await service.getTitle({ ...baseMetadata, source: SOURCES.WEB, service: 'NF', sourceType: SOURCE_TYPES.WEB_DL, videoCodec: VIDEO_CODECS.H265 })
        const serviceIndex = title.indexOf('NF')
        const typeIndex = title.indexOf('WEB-DL')
        expect(serviceIndex).toBeGreaterThan(-1)
        expect(serviceIndex).toBeLessThan(typeIndex)
    })

    it('includes locale before year', async () => {
        // The Office US 2005 1080p ...
        const title = await service.getTitle({
            ...baseMetadata,
            locale: 'US',
            sourceType: SOURCE_TYPES.WEB_DL,
            source: SOURCES.WEB,
            service: 'AMZN',
            videoCodec: VIDEO_CODECS.H264,
        })
        const localeIndex = title.indexOf('US')
        const yearIndex = title.indexOf(String(baseMetadata.year))
        expect(localeIndex).toBeGreaterThan(-1)
        expect(localeIndex).toBeLessThan(yearIndex)
    })

    it('includes locale for remux', async () => {
        const title = await service.getTitle({ ...baseMetadata, locale: 'JAPANESE', sourceType: SOURCE_TYPES.REMUX, videoCodec: VIDEO_CODECS.AVC })
        expect(title).toContain('JAPANESE')
    })

    describe('language component', () => {
        it('includes language in ALL CAPS before resolution when no English audio', async () => {
            // Kuroko's Basketball AKA Kuroko no Basket 2017 JAPANESE 1080p BluRay DD+ 5.1 x264-Kitsune
            vi.mocked(getLanguageDisplayName).mockResolvedValue('Japanese')
            const title = await service.getTitle({ ...baseMetadata, language: ['ja'], originalLanguage: 'ja' })
            const langIndex = title.indexOf('JAPANESE')
            const resIndex = title.indexOf(baseMetadata.resolution)
            expect(langIndex).toBeGreaterThan(-1)
            expect(langIndex).toBeLessThan(resIndex)
        })

        it('includes language after REPACK and before resolution', async () => {
            // Kika 2025 REPACK FRENCH 1080p AMZN WEB-DL DD+ 5.1 H.264-Phallus
            vi.mocked(getLanguageDisplayName).mockResolvedValue('French')
            const title = await service.getTitle({ ...baseMetadata, language: ['fr'], originalLanguage: 'fr', repack: 1 })
            const repackIndex = title.indexOf('REPACK')
            const langIndex = title.indexOf('FRENCH')
            const resIndex = title.indexOf(baseMetadata.resolution)
            expect(repackIndex).toBeLessThan(langIndex)
            expect(langIndex).toBeLessThan(resIndex)
        })

        it('omits language component when English audio is present', async () => {
            vi.mocked(getLanguageDisplayName).mockResolvedValue('French')
            const title = await service.getTitle({ ...baseMetadata, language: ['en'], originalLanguage: 'en' })
            expect(title).not.toContain('FRENCH')
        })

        it('omits language component for Dual-Audio (handled after codec)', async () => {
            vi.mocked(getLanguageDisplayName).mockResolvedValue('Japanese')
            const title = await service.getTitle({ ...baseMetadata, language: ['ja', 'en'], originalLanguage: 'ja' })
            expect(title).not.toContain('JAPANESE')
            expect(title).toContain('Dual-Audio')
        })

        it('omits language component for Dubbed (handled after codec)', async () => {
            vi.mocked(getLanguageDisplayName).mockResolvedValue('French')
            const title = await service.getTitle({ ...baseMetadata, language: ['en'], originalLanguage: 'fr' })
            expect(title).not.toContain('FRENCH')
            expect(title).toContain('Dubbed')
        })

        it('omits language component when language list is empty', async () => {
            const title = await service.getTitle({ ...baseMetadata, language: [], originalLanguage: '' })
            expect(title).not.toMatch(/[A-Z]{4,}\s+\d+[ip]/)
        })

        it('omits language component when display name lookup returns null', async () => {
            vi.mocked(getLanguageDisplayName).mockResolvedValue(null)
            const title = await service.getTitle({ ...baseMetadata, language: ['xx'], originalLanguage: 'xx' })
            expect(title).not.toMatch(/[A-Z]{3,}\s+\d+[ip]/)
        })

        it.each([
            ['fr', 'French', 'FRENCH'],
            ['da', 'Danish', 'DANISH'],
            ['ko', 'Korean', 'KOREAN'],
        ])('uppercases "%s" display name to "%s"', async (code, displayName, expected) => {
            vi.mocked(getLanguageDisplayName).mockResolvedValue(displayName)
            const title = await service.getTitle({ ...baseMetadata, language: [code], originalLanguage: code })
            expect(title).toContain(expected)
        })
    })

    it('includes Dual-Audio dub string after source type for non-remux', async () => {
        // Dragon Ball Super... 2022 REPACK 1080p AMZN WEB-DL Dual-Audio DD+ 5.1 H.264-Kitsune
        const title = await service.getTitle({
            ...baseMetadata,
            language: ['ja', 'en'],
            originalLanguage: 'ja',
            sourceType: SOURCE_TYPES.WEB_DL,
            source: SOURCES.WEB,
            service: 'AMZN',
            videoCodec: VIDEO_CODECS.H264,
        })
        expect(title).toContain('Dual-Audio')
        const typeIndex = title.indexOf('WEB-DL')
        const dubIndex = title.indexOf('Dual-Audio')
        expect(dubIndex).toBeGreaterThan(typeIndex)
    })

    it('includes Dual-Audio dub string after VideoCodec for remux', async () => {
        // Princess Mononoke 1997 1080p BluRay REMUX AVC Dual-Audio DTS-HD MA 5.1-NAN0
        const title = await service.getTitle({ ...baseMetadata, language: ['ja', 'en'], originalLanguage: 'ja', sourceType: SOURCE_TYPES.REMUX, videoCodec: VIDEO_CODECS.AVC })
        expect(title).toContain('Dual-Audio')
        const codecIndex = title.indexOf(VIDEO_CODECS.AVC)
        const dubIndex = title.indexOf('Dual-Audio')
        expect(dubIndex).toBeGreaterThan(codecIndex)
    })

    it('includes HDR tags after audio metadata for non-remux', async () => {
        // Leave the World Behind 2023 1080p NF WEB-DL DD+ 5.1 Atmos DV HDR H.265-Kitsune
        const title = await service.getTitle({
            ...baseMetadata,
            source: SOURCES.WEB,
            service: 'NF',
            sourceType: SOURCE_TYPES.WEB_DL,
            videoCodec: VIDEO_CODECS.H265,
            audioMetadata: 'Atmos',
            hdr: [HDR_TYPES.DV, HDR_TYPES.HDR10],
        })
        const atmosIndex = title.indexOf('Atmos')
        const hdrIndex = title.indexOf('DV')
        const codecIndex = title.indexOf(VIDEO_CODECS.H265)
        expect(atmosIndex).toBeLessThan(hdrIndex)
        expect(hdrIndex).toBeLessThan(codecIndex)
    })

    it('places HDR before VideoCodec for remux', async () => {
        // X-Men: Days of Future Past 2014 2160p UHD BluRay REMUX HDR HEVC DTS-HD MA 7.1-FraMeSToR
        const title = await service.getTitle({ ...baseMetadata, sourceType: SOURCE_TYPES.REMUX, videoCodec: VIDEO_CODECS.HEVC, hdr: [HDR_TYPES.HDR10] })
        const hdrIndex = title.indexOf('HDR')
        const codecIndex = title.indexOf(VIDEO_CODECS.HEVC)
        expect(hdrIndex).toBeGreaterThan(-1)
        expect(hdrIndex).toBeLessThan(codecIndex)
    })

    it('places VideoCodec after HDR and before audio for remux', async () => {
        // Edge of Tomorrow 2014 1080p BluRay REMUX AVC TrueHD 7.1 Atmos-ARTiCUN0
        const title = await service.getTitle({
            ...baseMetadata,
            sourceType: SOURCE_TYPES.REMUX,
            videoCodec: VIDEO_CODECS.AVC,
            audioCodec: AUDIO_CODECS.TRUEHD,
            audioChannels: AUDIO_CHANNELS['7.1'],
            audioMetadata: 'Atmos',
        })
        const codecIndex = title.indexOf(VIDEO_CODECS.AVC)
        const audioIndex = title.indexOf(AUDIO_CODECS.TRUEHD)
        const atmosIndex = title.indexOf('Atmos')
        expect(codecIndex).toBeLessThan(audioIndex)
        expect(audioIndex).toBeLessThan(atmosIndex)
    })

    it('places VideoCodec at end (before tag) for non-remux', async () => {
        // Avengers: Infinity War 2018 1080p BluRay DD+ 7.1 x265-NAN0
        const title = await service.getTitle({ ...baseMetadata, videoCodec: VIDEO_CODECS.X265, releaseGroup: 'NAN0' })
        expect(title).toMatch(/x265-NAN0$/)
    })

    it('appends tag with hyphen', async () => {
        const title = await service.getTitle({ ...baseMetadata, releaseGroup: 'Muffin' })
        expect(title).toMatch(/-Muffin$/)
    })

    it('omits tag entirely when releaseGroup is absent', async () => {
        // Guide says: "For uploads with no tag, it's not necessary to add 'NOGROUP'"
        const title = await service.getTitle({ ...baseMetadata, releaseGroup: undefined })
        expect(title).not.toContain('-NOGROUP')
        expect(title).not.toMatch(/-$/)
    })

    it('includes audioMetadata (Atmos) in title', async () => {
        const title = await service.getTitle({ ...baseMetadata, audioMetadata: 'Atmos' })
        expect(title).toContain('Atmos')
    })

    it('includes TV season without year when TVDB title has no year qualifier', async () => {
        fetchMock.mockResolvedValueOnce({ title: 'Wednesday' })
        const title = await service.getTitle({ ...tvBaseMetadata, title: 'Wednesday' })
        expect(title).toContain('S01')
        expect(title).not.toContain(String(tvBaseMetadata.year))
    })

    it('includes TV year when TVDB title has a year qualifier', async () => {
        fetchMock.mockResolvedValueOnce({ title: 'Invincible (2021)' })
        const title = await service.getTitle({ ...tvBaseMetadata, title: 'Invincible' })
        expect(title).toContain(String(tvBaseMetadata.year))
    })

    it('omits TV year when TVDB fetch fails', async () => {
        fetchMock.mockRejectedValueOnce(new Error('network error'))
        const title = await service.getTitle({ ...tvBaseMetadata, title: 'Show' })
        expect(title).not.toContain(String(tvBaseMetadata.year))
    })

    it('omits TV year when tvdbId is absent', async () => {
        const title = await service.getTitle({ ...tvBaseMetadata, tvdbId: undefined })
        expect(title).not.toContain(String(tvBaseMetadata.year))
    })

    it('includes season and episode', async () => {
        fetchMock.mockResolvedValueOnce({ title: 'Invincible (2021)' })
        const title = await service.getTitle({ ...tvBaseMetadata, episode: 8 })
        expect(title).toContain('S01E08')
    })

    it('includes season only when episode is absent', async () => {
        fetchMock.mockResolvedValueOnce({ title: 'Show' })
        const title = await service.getTitle(tvBaseMetadata)
        expect(title).toContain('S01')
        expect(title).not.toMatch(/S\d+E/)
    })
})

describe('createAthTrackerService — upload extra fields', () => {
    const service = createAthTrackerService('https://aither.cc', 'apikey')
    const uploadOpts = { anonymous: false, modQueueOptIn: false, title: 'Movie 2024' }

    async function getFormData(metadata: TrackerUploadMetadata): Promise<FormData> {
        fetchMock.mockClear()
        fetchMock.mockResolvedValue({ data: 'http://aither.cc/torrents/1' })
        await service.upload('/fake.torrent', metadata, 'desc', 'mediainfo', uploadOpts)
        return fetchMock.mock.calls[0][1].body as FormData
    }

    it.each([
        [HDR_TYPES.DV, 'dv', '1'],
        [HDR_TYPES.HDR10, 'hdr', '1'],
        [HDR_TYPES.HDR10_PLUS, 'hdr10p', '1'],
    ] as const)('sets %s flag to 1 when HDR type is present', async (hdrType, field, expected) => {
        const body = await getFormData({ ...baseMetadata, hdr: [hdrType] })
        expect(body.get(field)).toBe(expected)
    })

    it('sets all HDR flags to 0 when hdr is absent', async () => {
        const body = await getFormData({ ...baseMetadata, hdr: [] })
        expect(body.get('dv')).toBe('0')
        expect(body.get('hdr')).toBe('0')
        expect(body.get('hdr10p')).toBe('0')
    })

    it.each([
        [RESOLUTIONS['480i'], '1'],
        [RESOLUTIONS['480p'], '1'],
        [RESOLUTIONS['576i'], '1'],
        [RESOLUTIONS['576p'], '1'],
        [RESOLUTIONS['720p'], '0'],
        [RESOLUTIONS['1080p'], '0'],
        [RESOLUTIONS['2160p'], '0'],
    ])('sets sd=%s for resolution %s', async (resolution, expected) => {
        const body = await getFormData({ ...baseMetadata, resolution })
        expect(body.get('sd')).toBe(expected)
    })
})
