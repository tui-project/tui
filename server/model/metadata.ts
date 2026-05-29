import { z } from 'zod'

export interface Metadata {
    fileName: string
    releaseGroup?: string
    mediaType?: MediaType
    title?: string
    originalTitle?: string
    year?: number
    season?: number
    episode?: number
    episodeEnd?: number
    specialName?: string
    language?: string[]
    originalLanguage?: string
    sourceType?: SourceType
    source?: Source
    service?: Service
    repack?: number
    proper?: number
    rerip?: number
    cut?: Cut
    ratio?: Ratio
    hybrid?: boolean
    hi10p?: boolean
    resolution?: Resolution
    hdr?: HDR[]
    videoCodec?: VideoCodec
    audioCodec?: AudioCodec
    audioChannels?: AudioChannels
    audioMetadata?: AudioMetadata
    tmdbId?: number
    imdbId?: string
    tvdbId?: number
    locale?: string
}

export const MEDIA_TYPES = {
    MOVIE: 'movie',
    TV: 'tv',
} as const
export type MediaType = (typeof MEDIA_TYPES)[keyof typeof MEDIA_TYPES]

export const SOURCES = {
    WEB: 'Web',
    DVD: 'DVD',
    NTSC_DVD: 'NTSC DVD',
    PAL_DVD: 'PAL DVD',
    HD_DVD: 'HDDVD',
    BLURAY_3D: '3D BluRay',
    BLURAY: 'BluRay',
    UHD_BLURAY: 'UHD BluRay',
    HDTV: 'HDTV',
    UHDTV: 'UHDTV',
} as const
export type Source = (typeof SOURCES)[keyof typeof SOURCES]

export const SOURCE_TYPES = {
    REMUX: 'REMUX',
    ENCODE: 'ENCODE',
    WEB_DL: 'WEB-DL',
    WEBRIP: 'WEBRIP',
    HDTV: 'HDTV',
} as const
export type SourceType = (typeof SOURCE_TYPES)[keyof typeof SOURCE_TYPES]

export const SERVICES = {
    '9NOW': '9NOW',
    AE: 'AE',
    AUBC: 'AUBC',
    AMBC: 'AMBC',
    AS: 'AS',
    AJAZ: 'AJAZ',
    ALL4: 'ALL4',
    AMZN: 'AMZN',
    AMC: 'AMC',
    ATK: 'ATK',
    ANPL: 'ANPL',
    ANLB: 'ANLB',
    AOL: 'AOL',
    ATVP: 'ATVP',
    ARD: 'ARD',
    IP: 'iP',
    BNGE: 'BNGE',
    BKPL: 'BKPL',
    BCORE: 'BCORE',
    BOOM: 'BOOM',
    BRAV: 'BRAV',
    CMOR: 'CMOR',
    CMORE: 'CMORE',
    CNLP: 'CNLP',
    CN: 'CN',
    CBC: 'CBC',
    CBS: 'CBS',
    CHGD: 'CHGD',
    CMAX: 'CMAX',
    CLBI: 'CLBI',
    CNBC: 'CNBC',
    CCGC: 'CCGC',
    CC: 'CC',
    COOK: 'COOK',
    CMT: 'CMT',
    CRKL: 'CRKL',
    CRAV: 'CRAV',
    CRIT: 'CRIT',
    CR: 'CR',
    CSPN: 'CSPN',
    CTV: 'CTV',
    CUR: 'CUR',
    CW: 'CW',
    CWS: 'CWS',
    DSKI: 'DSKI',
    DCU: 'DCU',
    DHF: 'DHF',
    DEST: 'DEST',
    DDY: 'DDY',
    DTV: 'DTV',
    DISC: 'DISC',
    DSCP: 'DSCP',
    DSNY: 'DSNY',
    DSNP: 'DSNP',
    DIY: 'DIY',
    DOCC: 'DOCC',
    DPLY: 'DPLY',
    DF: 'DF',
    DRPO: 'DRPO',
    DRTV: 'DRTV',
    ETV: 'ETV',
    ETTV: 'ETTV',
    EPIX: 'EPIX',
    ESPN: 'ESPN',
    ESQ: 'ESQ',
    FAM: 'FAM',
    FJR: 'FJR',
    FOOD: 'FOOD',
    FOX: 'FOX',
    FXTL: 'FXTL',
    FPT: 'FPT',
    FTV: 'FTV',
    FREE: 'FREE',
    FUNI: 'FUNI',
    FYI: 'FYI',
    GLBL: 'GLBL',
    GLOB: 'GLOB',
    GO90: 'GO90',
    PLAY: 'PLAY',
    HLMK: 'HLMK',
    HBO: 'HBO',
    HMAX: 'HMAX',
    HGTV: 'HGTV',
    HIDI: 'HIDI',
    HIST: 'HIST',
    HTSR: 'HTSR',
    HULU: 'HULU',
    TOU: 'TOU',
    IFC: 'IFC',
    ID: 'ID',
    IT: 'iT',
    ITV: 'ITV',
    KNPY: 'KNPY',
    KAYO: 'KAYO',
    KNOW: 'KNOW',
    LIFE: 'LIFE',
    LN: 'LN',
    MAX: 'MAX',
    MBC: 'MBC',
    MTOD: 'MTOD',
    MNBC: 'MNBC',
    MUBI: 'MUBI',
    MTV: 'MTV',
    NATG: 'NATG',
    NBA: 'NBA',
    NBC: 'NBC',
    NF: 'NF',
    NFL: 'NFL',
    NFLN: 'NFLN',
    GC: 'GC',
    NICK: 'NICK',
    NRK: 'NRK',
    NOW: 'NOW',
    ODK: 'ODK',
    OXGN: 'OXGN',
    PMNT: 'PMNT',
    PMTP: 'PMTP',
    PBS: 'PBS',
    PBSK: 'PBSK',
    PCOK: 'PCOK',
    PSN: 'PSN',
    PLUZ: 'PLUZ',
    POGO: 'POGO',
    PA: 'PA',
    PUHU: 'PUHU',
    QIBI: 'QIBI',
    RKTN: 'RKTN',
    ROKU: 'ROKU',
    RSTR: 'RSTR',
    RTE: 'RTE',
    SBS: 'SBS',
    SESO: 'SESO',
    SHMI: 'SHMI',
    SHO: 'SHO',
    SHDR: 'SHDR',
    SKST: 'SKST',
    SPIK: 'SPIK',
    SNET: 'SNET',
    SPRT: 'SPRT',
    STAN: 'STAN',
    STRP: 'STRP',
    STZ: 'STZ',
    SVT: 'SVT',
    SWER: 'SWER',
    SYFY: 'SYFY',
    TBS: 'TBS',
    TEN: 'TEN',
    TFOU: 'TFOU',
    TIMV: 'TIMV',
    TLC: 'TLC',
    TRVL: 'TRVL',
    TUBI: 'TUBI',
    TV3: 'TV3',
    TV4: 'TV4',
    TVING: 'TVING',
    TVL: 'TVL',
    UFC: 'UFC',
    UKTV: 'UKTV',
    UNIV: 'UNIV',
    USAN: 'USAN',
    VLCT: 'VLCT',
    VTRN: 'VTRN',
    VH1: 'VH1',
    VIAP: 'VIAP',
    VICE: 'VICE',
    VIKI: 'VIKI',
    VMEO: 'VMEO',
    VRV: 'VRV',
    WNET: 'WNET',
    WME: 'WME',
    WWEN: 'WWEN',
    XBOX: 'XBOX',
    YHOO: 'YHOO',
    YT: 'YT',
    RED: 'RED',
    ZDF: 'ZDF',
    HS: 'HS',
    VIU: 'VIU',
    WETV: 'WETV',
    WAVVE: 'WAVVE',
    WATCHA: 'WATCHA',
    CPNG: 'CPNG',
    KBS: 'KBS',
    IMBC: 'IMBC',
    KCW: 'KCW',
} as const
export type Service = (typeof SERVICES)[keyof typeof SERVICES] | undefined

export const RESOLUTIONS = {
    '480i': '480i',
    '480p': '480p',
    '576i': '576i',
    '576p': '576p',
    '720p': '720p',
    '1080i': '1080i',
    '1080p': '1080p',
    '2160p': '2160p',
    '4320p': '4320p',
} as const
export type Resolution = (typeof RESOLUTIONS)[keyof typeof RESOLUTIONS]

export const RATIOS = {
    IMAX: 'IMAX',
    OPEN_MATTE: 'Open Matte',
    MAR: 'MAR',
} as const
export type Ratio = (typeof RATIOS)[keyof typeof RATIOS] | undefined

export const CUTS = {
    SUPER_DUPER: 'Super Duper Cut',
    DIRECTORS: "Director's Cut",
    SPECIAL_EDITION: 'Special Edition',
    EXTENDED: 'Extended',
    UNRATED: 'Unrated',
    UNCUT: 'Uncut',
} as const
export type Cut = (typeof CUTS)[keyof typeof CUTS] | undefined

export const HDR_TYPES = {
    DV: 'DV',
    HDR10_PLUS: 'HDR10+',
    HDR10: 'HDR',
    HLG: 'HLG',
} as const
export type HDR = (typeof HDR_TYPES)[keyof typeof HDR_TYPES]

export const VIDEO_CODECS = {
    MPEG_1: 'MPEG-1',
    MPEG_2: 'MPEG-2',
    VC_1: 'VC-1',
    AVC: 'AVC',
    H264: 'H.264',
    HEVC: 'HEVC',
    H265: 'H.265',
    X264: 'x264',
    X265: 'x265',
    VP9: 'VP9',
    AV1: 'AV1',
} as const
export type VideoCodec = (typeof VIDEO_CODECS)[keyof typeof VIDEO_CODECS]

export const VIDEO_STANDARDS = {
    NTSC: 'NTSC',
    PAL: 'PAL',
} as const
export type VideoStandard = (typeof VIDEO_STANDARDS)[keyof typeof VIDEO_STANDARDS]

export const AUDIO_CODECS = {
    DD_PLUS: 'DD+',
    DD: 'DD',
    AAC: 'AAC',
    DTS: 'DTS',
    DTS_HD_MA: 'DTS-HD MA',
    FLAC: 'FLAC',
    TRUEHD: 'TrueHD',
} as const
export type AudioCodec = (typeof AUDIO_CODECS)[keyof typeof AUDIO_CODECS]

export const AUDIO_CHANNELS = {
    '1.0': '1.0',
    '2.0': '2.0',
    '3.0': '3.0',
    '5.1': '5.1',
    '6.1': '6.1',
    '7.1': '7.1',
} as const
export type AudioChannels = (typeof AUDIO_CHANNELS)[keyof typeof AUDIO_CHANNELS]

export const AUDIO_METADATA_TYPES = {
    ATMOS: 'Atmos',
    AURO3D: 'Auro3D',
} as const
export type AudioMetadata = (typeof AUDIO_METADATA_TYPES)[keyof typeof AUDIO_METADATA_TYPES] | undefined

export const MetadataSchema = z
    .object({
        title: z.string().trim().min(1),
        originalTitle: z.string().trim().min(1).optional(),
        releaseGroup: z.string().trim().min(1).optional(),
        mediaType: z.enum(MEDIA_TYPES),
        year: z
            .number()
            .int()
            .refine((value) => /^\d{4}$/.test(String(value)), 'Invalid year format'),
        season: z.number().int().optional(),
        episode: z.number().int().optional(),
        episodeEnd: z.number().int().optional(),
        specialName: z.string().trim().min(1).optional(),
        language: z.array(z.string().trim().min(1)),
        originalLanguage: z.string().trim().min(1),
        source: z.enum(SOURCES),
        sourceType: z.enum(SOURCE_TYPES),
        service: z.enum(SERVICES).optional(),
        repack: z.number().int().min(0),
        proper: z.number().int().min(0),
        rerip: z.number().int().min(0),
        cut: z.enum(CUTS).optional(),
        ratio: z.enum(RATIOS).optional(),
        hybrid: z.boolean(),
        hi10p: z.boolean(),
        resolution: z.enum(RESOLUTIONS),
        hdr: z.array(z.enum(HDR_TYPES)).optional(),
        videoCodec: z.enum(VIDEO_CODECS),
        audioCodec: z.enum(AUDIO_CODECS),
        audioChannels: z.enum(AUDIO_CHANNELS),
        audioMetadata: z.enum(AUDIO_METADATA_TYPES).optional(),
        tmdbId: z.number().int(),
        imdbId: z.string().trim().min(1),
        tvdbId: z.number().int().optional(),
        locale: z.string().trim().min(1).optional(),
    })
    .superRefine((metadata, ctx) => {
        if (metadata.mediaType === MEDIA_TYPES.TV && metadata.season == null) {
            ctx.addIssue({ code: 'custom', path: ['season'], message: 'Season is required for TV media' })
        }
        if (metadata.mediaType === MEDIA_TYPES.TV && metadata.tvdbId == null) {
            ctx.addIssue({ code: 'custom', path: ['tvdbId'], message: 'TVDB ID is required for TV media' })
        }
        if (metadata.source === SOURCES.WEB && metadata.service == null) {
            ctx.addIssue({ code: 'custom', path: ['service'], message: 'Service is required for Web sources' })
        }
    })
