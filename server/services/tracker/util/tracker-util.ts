// Within a web slot, higher rank trumps lower — HDTV < WEBRip < WEB-DL
export const WEB_SOURCE_RANK: Partial<Record<string, number>> = {
    [SOURCE_TYPES.HDTV]: 1,
    [SOURCE_TYPES.WEBRIP]: 2,
    [SOURCE_TYPES.WEB_DL]: 3,
}

export type HdrTier = 'SDR' | 'HDR' | 'DV' | 'HDR10PLUS' | 'DV_HDR' | 'DV_HDR10PLUS'

// DV/HDR occupies the HDR slot and DV/HDR10+ occupies the HDR10+ slot (where they trump the non-DV release)
export const SLOT_TIERS: Record<HdrTier, string> = {
    SDR: 'SDR',
    HDR: 'HDR',
    DV: 'DV',
    HDR10PLUS: 'HDR10PLUS',
    DV_HDR: 'HDR',
    DV_HDR10PLUS: 'HDR10PLUS',
}

// DV/HDR trumps HDR; DV/HDR10+ trumps HDR10+
export const HDR_TIER_TRUMPS: Partial<Record<HdrTier, HdrTier>> = {
    DV_HDR: 'HDR',
    DV_HDR10PLUS: 'HDR10PLUS',
}

export function getHdrTier(hdr: string[]): HdrTier {
    const hasDv = hdr.includes(HDR_TYPES.DV)
    const hasHdr10Plus = hdr.includes(HDR_TYPES.HDR10_PLUS)
    const hasHdr = hdr.includes(HDR_TYPES.HDR10) || hasHdr10Plus

    if (hasDv && hasHdr10Plus) return 'DV_HDR10PLUS'
    if (hasDv && hasHdr) return 'DV_HDR'
    if (hasDv) return 'DV'
    if (hasHdr10Plus) return 'HDR10PLUS'
    if (hasHdr) return 'HDR'
    return 'SDR'
}

export type TorrentContext = {
    slot: string
    hdrTier: HdrTier
    sourceRank: number
    revision: number
    hasOriginalAudio: boolean
    hybrid: boolean
    isBannedReleaseGroup: boolean
}

export type TorrentRule<T extends TorrentContext = TorrentContext> = (upload: T, existing: T) => boolean

export const ENCODE_SIZE_TIERS = {
    COMPACT: 'Compact',
    TRANSPARENT: 'Transparent',
} as const

export type EncodeSizeTier = (typeof ENCODE_SIZE_TIERS)[keyof typeof ENCODE_SIZE_TIERS]

export function hasAdditionalMainAudioLanguage(metadata: Metadata): boolean {
    const resolvedMixedLanguages = metadata.mixedAudioLanguages ?? []
    const audioLanguages = [...metadata.language.filter((language) => language !== 'mul' || !resolvedMixedLanguages.length), ...resolvedMixedLanguages]
    const allowedLanguages = [hasEnglishAudio(metadata) ? 'en' : undefined, hasOriginalAudio(metadata) ? metadata.originalLanguage : undefined].filter(
        (language): language is string => language !== undefined
    )

    return audioLanguages.some((language) => !allowedLanguages.some((allowedLanguage) => languagesMatch(language, allowedLanguage)))
}

export function getVideoCodecFamily(codec: string | null | undefined): 'avc' | 'hevc' | 'av1' | 'vp9' | 'mpeg2' | 'other' {
    switch (codec?.toLowerCase()) {
        case 'avc':
        case 'h.264':
        case 'x264':
            return 'avc'
        case 'hevc':
        case 'h.265':
        case 'x265':
            return 'hevc'
        case 'av1':
            return 'av1'
        case 'vp9':
            return 'vp9'
        case 'mpeg-2':
            return 'mpeg2'
        default:
            return 'other'
    }
}

export function getEncodeSizeTier(resolution: Resolution, videoBitrate: number): EncodeSizeTier {
    const compactLimit = resolution === RESOLUTIONS['2160p'] || resolution === RESOLUTIONS['4320p'] ? 18_000_000 : 12_000_000
    return videoBitrate <= compactLimit ? ENCODE_SIZE_TIERS.COMPACT : ENCODE_SIZE_TIERS.TRANSPARENT
}
