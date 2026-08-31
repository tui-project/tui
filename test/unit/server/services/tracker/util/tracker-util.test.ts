import { describe, expect, it } from 'vitest'
import { ENCODE_SIZE_TIERS, getEncodeSizeTier, getVideoCodecFamily, hasAdditionalMainAudioLanguage } from '../../../../../../server/services/tracker/util/tracker-util'

describe('hasAdditionalMainAudioLanguage', () => {
    const metadata = {
        language: ['en'],
        originalLanguage: 'en',
    } as Metadata

    it.each([
        [['en', 'de'], undefined, true],
        [['mul'], ['en'], false],
    ] as const)('checks main languages %j with resolved mixed languages %j', (language, mixedAudioLanguages, expected) => {
        expect(hasAdditionalMainAudioLanguage({ ...metadata, language: [...language], mixedAudioLanguages: mixedAudioLanguages ? [...mixedAudioLanguages] : undefined })).toBe(expected)
    })
})

describe('getVideoCodecFamily', () => {
    it.each([
        [VIDEO_CODECS.AVC, 'avc'],
        [VIDEO_CODECS.H264, 'avc'],
        [VIDEO_CODECS.X264, 'avc'],
        [VIDEO_CODECS.HEVC, 'hevc'],
        [VIDEO_CODECS.H265, 'hevc'],
        [VIDEO_CODECS.X265, 'hevc'],
        [VIDEO_CODECS.AV1, 'av1'],
        [VIDEO_CODECS.VP9, 'vp9'],
        [VIDEO_CODECS.MPEG_2, 'mpeg2'],
        [VIDEO_CODECS.VC_1, 'other'],
        [undefined, 'other'],
    ] as const)('maps %s to %s', (codec, family) => {
        expect(getVideoCodecFamily(codec)).toBe(family)
    })
})

describe('getEncodeSizeTier', () => {
    it.each([
        [RESOLUTIONS['1080p'], 12_000_000, ENCODE_SIZE_TIERS.COMPACT],
        [RESOLUTIONS['1080p'], 12_100_000, ENCODE_SIZE_TIERS.TRANSPARENT],
        [RESOLUTIONS['2160p'], 18_000_000, ENCODE_SIZE_TIERS.COMPACT],
        [RESOLUTIONS['2160p'], 18_100_000, ENCODE_SIZE_TIERS.TRANSPARENT],
        [RESOLUTIONS['4320p'], 18_000_000, ENCODE_SIZE_TIERS.COMPACT],
    ] as const)('classifies %s at %s bps as %s', (resolution, bitrate, tier) => {
        expect(getEncodeSizeTier(resolution, bitrate)).toBe(tier)
    })
})
