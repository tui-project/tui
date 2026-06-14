import { HDR_TYPES, SOURCE_TYPES } from '../../../model/metadata'

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
}

export type TorrentRule<T extends TorrentContext = TorrentContext> = (upload: T, existing: T) => boolean

// x264 and x265 encodes are separate slots
export function getCodecFamily(codec: string | null | undefined): 'x264' | 'x265' | 'other' {
    switch (codec?.toLowerCase()) {
        case 'x264':
            return 'x264'
        case 'x265':
            return 'x265'
        default:
            return 'other'
    }
}
