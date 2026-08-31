import { describe, expect, it } from 'vitest'
import { isLosslessAudio, isMonoOrStereo, isMultichannel } from '../../../../shared/types/audio'

describe('audio utilities', () => {
    it.each([
        [AUDIO_CHANNELS['1.0'], false],
        [AUDIO_CHANNELS['2.0'], false],
        [AUDIO_CHANNELS['5.1'], true],
    ] as const)('identifies whether %s is multichannel', (channels, expected) => {
        expect(isMultichannel(channels)).toBe(expected)
    })

    it.each([
        [AUDIO_CHANNELS['1.0'], true],
        [AUDIO_CHANNELS['2.0'], true],
        [AUDIO_CHANNELS['2.1'], false],
    ] as const)('identifies whether %s is mono or stereo', (channels, expected) => {
        expect(isMonoOrStereo(channels)).toBe(expected)
    })

    it.each([
        [AUDIO_CODECS.FLAC, true],
        [AUDIO_CODECS.TRUEHD, true],
        [AUDIO_CODECS.DTS_HD_MA, true],
        [AUDIO_CODECS.DTS_X, true],
        [AUDIO_CODECS.DD_PLUS, false],
    ] as const)('identifies whether %s is lossless', (codec, expected) => {
        expect(isLosslessAudio(codec)).toBe(expected)
    })
})
