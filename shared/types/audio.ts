import { makeConst } from '../utils/make-const'

export const [AUDIO_CODECS, AUDIO_CODEC_OPTIONS] = makeConst({
    AAC: { value: 'AAC', label: 'AAC' },
    OPUS: { value: 'Opus', label: 'Opus' },
    DD: { value: 'DD', label: 'DD' },
    DD_PLUS: { value: 'DD+', label: 'DD+' },
    TRUEHD: { value: 'TrueHD', label: 'TrueHD' },
    DTS: { value: 'DTS', label: 'DTS' },
    DTS_HD_MA: { value: 'DTS-HD MA', label: 'DTS-HD MA' },
    DTS_HD_HRA: { value: 'DTS-HD HRA', label: 'DTS-HD HRA' },
    DTS_X: { value: 'DTS:X', label: 'DTS:X' },
    LPCM: { value: 'LPCM', label: 'LPCM' },
    FLAC: { value: 'FLAC', label: 'FLAC' },
})
export type AudioCodec = (typeof AUDIO_CODECS)[keyof typeof AUDIO_CODECS]

export const [AUDIO_CHANNELS, AUDIO_CHANNEL_OPTIONS] = makeConst({
    '1.0': { value: '1.0', label: '1.0' },
    '2.0': { value: '2.0', label: '2.0' },
    '2.1': { value: '2.1', label: '2.1' },
    '3.0': { value: '3.0', label: '3.0' },
    '3.1': { value: '3.1', label: '3.1' },
    '4.0': { value: '4.0', label: '4.0' },
    '4.1': { value: '4.1', label: '4.1' },
    '5.0': { value: '5.0', label: '5.0' },
    '5.1': { value: '5.1', label: '5.1' },
    '6.1': { value: '6.1', label: '6.1' },
    '7.1': { value: '7.1', label: '7.1' },
    '5.1.2': { value: '5.1.2', label: '5.1.2' },
    '5.1.4': { value: '5.1.4', label: '5.1.4' },
    '7.1.2': { value: '7.1.2', label: '7.1.2' },
    '7.1.4': { value: '7.1.4', label: '7.1.4' },
})
export type AudioChannels = (typeof AUDIO_CHANNELS)[keyof typeof AUDIO_CHANNELS]

export const [AUDIO_METADATA_TYPES, AUDIO_METADATA_OPTIONS] = makeConst({
    ATMOS: { value: 'Atmos', label: 'Atmos' },
    AURO3D: { value: 'Auro3D', label: 'Auro3D' },
})
export type AudioMetadata = (typeof AUDIO_METADATA_TYPES)[keyof typeof AUDIO_METADATA_TYPES] | undefined

export function isMultichannel(channels: AudioChannels): boolean {
    return Number.parseInt(channels, 10) >= 3
}

export function isMonoOrStereo(channels: AudioChannels): boolean {
    return channels === AUDIO_CHANNELS['1.0'] || channels === AUDIO_CHANNELS['2.0']
}

export function isLosslessAudio(codec: AudioCodec): boolean {
    return codec === AUDIO_CODECS.FLAC || codec === AUDIO_CODECS.TRUEHD || codec === AUDIO_CODECS.DTS_HD_MA || codec === AUDIO_CODECS.DTS_X
}
