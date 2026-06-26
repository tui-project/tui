import { z } from 'zod'

function makeConst<T extends Record<string, { value: string; label: string }>>(
    input: T
): [{ readonly [K in keyof T]: T[K]['value'] }, Array<{ value: T[keyof T]['value']; label: string }>] {
    const values = Object.fromEntries(Object.entries(input).map(([k, v]) => [k, v.value]))
    const options = Object.values(input).map(({ value, label }) => ({ value, label }))
    return [values as { readonly [K in keyof T]: T[K]['value'] }, options]
}

export const [MEDIA_TYPES, MEDIA_TYPE_OPTIONS] = makeConst({
    MOVIE: { value: 'movie', label: 'Movie' },
    TV: { value: 'tv', label: 'TV' },
})
export type MediaType = (typeof MEDIA_TYPES)[keyof typeof MEDIA_TYPES]

export const [SOURCES, SOURCE_OPTIONS] = makeConst({
    WEB: { value: 'Web', label: 'Web' },
    DVD: { value: 'DVD', label: 'DVD' },
    NTSC_DVD: { value: 'NTSC DVD', label: 'NTSC DVD' },
    PAL_DVD: { value: 'PAL DVD', label: 'PAL DVD' },
    HD_DVD: { value: 'HDDVD', label: 'HDDVD' },
    BLURAY_3D: { value: '3D BluRay', label: '3D BluRay' },
    BLURAY: { value: 'BluRay', label: 'BluRay' },
    UHD_BLURAY: { value: 'UHD BluRay', label: 'UHD BluRay' },
    HDTV: { value: 'HDTV', label: 'HDTV' },
    UHDTV: { value: 'UHDTV', label: 'UHDTV' },
})
export type Source = (typeof SOURCES)[keyof typeof SOURCES]

export const [SOURCE_TYPES, SOURCE_TYPE_OPTIONS] = makeConst({
    REMUX: { value: 'REMUX', label: 'Remux' },
    ENCODE: { value: 'ENCODE', label: 'Encode' },
    WEB_DL: { value: 'WEB-DL', label: 'Web-DL' },
    WEBRIP: { value: 'WEBRIP', label: 'WebRip' },
    HDTV: { value: 'HDTV', label: 'HDTV' },
})
export type SourceType = (typeof SOURCE_TYPES)[keyof typeof SOURCE_TYPES]
export const WEB_SOURCE_TYPES = [SOURCE_TYPES.WEB_DL, SOURCE_TYPES.WEBRIP, SOURCE_TYPES.HDTV]

export const [SERVICES, SERVICE_OPTIONS] = makeConst({
    '35MM': { value: '35MM', label: '35mm.online' },
    '9NOW': { value: '9NOW', label: '9Now' },
    A3P: { value: 'A3P', label: 'Atresplayer' },
    ACORN: { value: 'ACORN', label: 'Acorn TV' },
    ADN: { value: 'ADN', label: 'Anime Digital Network' },
    AE: { value: 'AE', label: 'A&E' },
    AJAZ: { value: 'AJAZ', label: 'Al Jazeera English' },
    ALL4: { value: 'ALL4', label: 'All4 (Channel 4)' },
    AMBC: { value: 'AMBC', label: 'ABC (US)' },
    AMC: { value: 'AMC', label: 'AMC' },
    AMCP: { value: 'AMCP', label: 'AMC+' },
    AMZN: { value: 'AMZN', label: 'Amazon Prime Video' },
    ANGL: { value: 'ANGL', label: 'Angel' },
    ANLB: { value: 'ANLB', label: 'AnimeLab' },
    ANPL: { value: 'ANPL', label: 'Animal Planet' },
    AOL: { value: 'AOL', label: 'AOL' },
    APPS: { value: 'APPS', label: 'Disney+ (MENA/SEA)' },
    ARD: { value: 'ARD', label: 'ARD' },
    ARTE: { value: 'ARTE', label: 'Arte' },
    AS: { value: 'AS', label: 'Adult Swim' },
    ATK: { value: 'ATK', label: "America's Test Kitchen" },
    ATV: { value: 'ATV', label: 'Apple TV' },
    ATVP: { value: 'ATVP', label: 'Apple TV+' },
    AUBC: { value: 'AUBC', label: 'ABC (AU) iView' },
    BB: { value: 'BB', label: 'BritBox' },
    BCORE: { value: 'BCORE', label: 'BRAVIA CORE' },
    BK: { value: 'BK', label: 'Bentkey' },
    BKPL: { value: 'BKPL', label: 'Blackpills' },
    BNGE: { value: 'BNGE', label: 'Binge' },
    BOOM: { value: 'BOOM', label: 'Boomerang' },
    BRAV: { value: 'BRAV', label: 'BravoTV' },
    CBC: { value: 'CBC', label: 'CBC' },
    CBS: { value: 'CBS', label: 'CBS' },
    CC: { value: 'CC', label: 'Comedy Central' },
    CCGC: { value: 'CCGC', label: 'Comedians in Cars Getting Coffee' },
    CHGD: { value: 'CHGD', label: 'CHRGD' },
    CLBI: { value: 'CLBI', label: 'Club illico' },
    CM: { value: 'CM', label: 'CineMember' },
    CMAX: { value: 'CMAX', label: 'Cinemax' },
    CMOR: { value: 'CMOR', label: 'C More' },
    CMORE: { value: 'CMORE', label: 'C More+' },
    CMT: { value: 'CMT', label: 'Country Music Television' },
    CN: { value: 'CN', label: 'Cartoon Network' },
    CNB: { value: 'CNB', label: 'Cinobo' },
    CNBC: { value: 'CNBC', label: 'CNBC' },
    CNLP: { value: 'CNLP', label: 'Canal+' },
    COOK: { value: 'COOK', label: 'Cooking Channel' },
    CORE: { value: 'CORE', label: 'Sony Pictures Core' },
    CPNG: { value: 'CPNG', label: 'Coupang Play' },
    CR: { value: 'CR', label: 'Crunchyroll' },
    CRAV: { value: 'CRAV', label: 'Crave' },
    CRIT: { value: 'CRIT', label: 'Criterion Channel' },
    CRKI: { value: 'CRKI', label: 'Chorki' },
    CRKL: { value: 'CRKL', label: 'Crackle' },
    CRZN: { value: 'CRZN', label: 'Curzon' },
    CSPN: { value: 'CSPN', label: 'CSpan' },
    CTV: { value: 'CTV', label: 'CTV' },
    CUR: { value: 'CUR', label: 'CuriosityStream' },
    CW: { value: 'CW', label: 'The CW' },
    CWS: { value: 'CWS', label: 'CWSeed' },
    DAZN: { value: 'DAZN', label: 'DAZN' },
    DCU: { value: 'DCU', label: 'DC Universe' },
    DDY: { value: 'DDY', label: 'Digiturk Dilediğin Yerde' },
    DEST: { value: 'DEST', label: 'Destination America' },
    DF: { value: 'DF', label: 'DramaFever' },
    DHF: { value: 'DHF', label: 'Deadhouse Films' },
    DISC: { value: 'DISC', label: 'Discovery Channel' },
    DIY: { value: 'DIY', label: 'DIY Network' },
    DLWP: { value: 'DLWP', label: 'DailyWire+' },
    DOCC: { value: 'DOCC', label: 'Doc Club' },
    DOCPLAY: { value: 'DOCPLAY', label: 'DocPlay' },
    DPLY: { value: 'DPLY', label: 'DPlay' },
    DRPO: { value: 'DRPO', label: 'Dropout' },
    DRTV: { value: 'DRTV', label: 'DRTV' },
    DSCP: { value: 'DSCP', label: 'Discovery+' },
    DSKI: { value: 'DSKI', label: 'Daisuki' },
    DSNP: { value: 'DSNP', label: 'Disney+' },
    DSNY: { value: 'DSNY', label: 'Disney' },
    DTV: { value: 'DTV', label: 'DirecTV Now' },
    EPIX: { value: 'EPIX', label: 'EPIX' },
    ESPN: { value: 'ESPN', label: 'ESPN' },
    ESQ: { value: 'ESQ', label: 'Esquire' },
    ETTV: { value: 'ETTV', label: 'El Trece' },
    ETV: { value: 'ETV', label: 'E!' },
    EYE: { value: 'EYE', label: 'Eye Film Player' },
    FAM: { value: 'FAM', label: 'Family' },
    FBW: { value: 'FBW', label: 'Facebook Watch' },
    FJR: { value: 'FJR', label: 'Family Jr' },
    FLMN: { value: 'FLMN', label: 'Filmin' },
    FMIO: { value: 'FMIO', label: 'Filmio' },
    FNDG: { value: 'FNDG', label: 'Fandango at Home' },
    FOOD: { value: 'FOOD', label: 'Food Network' },
    FOX: { value: 'FOX', label: 'Fox' },
    FPT: { value: 'FPT', label: 'FPT Play' },
    FREE: { value: 'FREE', label: 'Freeform' },
    FSTV: { value: 'FSTV', label: 'Fawsome TV' },
    FTV: { value: 'FTV', label: 'France.tv' },
    FUBO: { value: 'FUBO', label: 'FuboTV' },
    FUNI: { value: 'FUNI', label: 'Funimation' },
    FXTL: { value: 'FXTL', label: 'Foxtel Now' },
    FYI: { value: 'FYI', label: 'FYI Network' },
    GAGA: { value: 'GAGA', label: 'GagaOOLala' },
    GC: { value: 'GC', label: 'NHL GameCenter' },
    GLBL: { value: 'GLBL', label: 'Global' },
    GLOB: { value: 'GLOB', label: 'GloboSat Play' },
    GO90: { value: 'GO90', label: 'go90' },
    HBO: { value: 'HBO', label: 'HBO' },
    HGM: { value: 'HGM', label: 'Hungama OTT' },
    HGTV: { value: 'HGTV', label: 'HGTV' },
    HIDI: { value: 'HIDI', label: 'HIDIVE' },
    HIST: { value: 'HIST', label: 'History Channel' },
    HLMK: { value: 'HLMK', label: 'Hallmark' },
    HMAX: { value: 'HMAX', label: 'HBO Max' },
    HPLAY: { value: 'HPLAY', label: 'Hungama Play' },
    HS: { value: 'HS', label: 'Hotstar' },
    HTSR: { value: 'HTSR', label: 'Hotstar' },
    HULU: { value: 'HULU', label: 'Hulu' },
    ID: { value: 'ID', label: 'Investigation Discovery' },
    IFC: { value: 'IFC', label: 'IFC' },
    IMBC: { value: 'IMBC', label: 'iMBC' },
    INFP: { value: 'INFP', label: 'Infinity+' },
    IP: { value: 'iP', label: 'BBC iPlayer' },
    IQIYI: { value: 'iQIYI', label: 'iQIYI' },
    IT: { value: 'iT', label: 'iTunes' },
    ITV: { value: 'ITV', label: 'ITV' },
    IVI: { value: 'IVI', label: 'Ivi.ru' },
    JC: { value: 'JC', label: 'JioCinema' },
    JHS: { value: 'JHS', label: 'JioHotstar' },
    JUAN: { value: 'JUAN', label: 'JuanFlix' },
    KAYO: { value: 'KAYO', label: 'Kayo Sports' },
    KBS: { value: 'KBS', label: 'KBS' },
    KCW: { value: 'KCW', label: 'Kocowa+' },
    KF: { value: 'KF', label: 'KlikFilm' },
    KNOW: { value: 'KNOW', label: 'Knowledge Network' },
    KNPY: { value: 'KNPY', label: 'Kanopy' },
    KPN: { value: 'KPN', label: 'KPN' },
    KS: { value: 'KS', label: 'Kaleidescape' },
    LBXD: { value: 'LBXD', label: 'Letterboxd' },
    LETV: { value: 'LeTV', label: 'Le.com' },
    LGP: { value: 'LGP', label: 'Lionsgate Play' },
    LIFE: { value: 'LIFE', label: 'Lifetime' },
    LN: { value: 'LN', label: 'Loving Nature' },
    MA: { value: 'MA', label: 'Movies Anywhere' },
    MAX: { value: 'MAX', label: 'Max' },
    MBC: { value: 'MBC', label: 'MBC' },
    MMAX: { value: 'MMAX', label: 'manoramaMAX' },
    MNBC: { value: 'MNBC', label: 'MSNBC' },
    MS: { value: 'MS', label: 'Microsoft Store' },
    MTOD: { value: 'MTOD', label: 'Motor Trend OnDemand' },
    MTV: { value: 'MTV', label: 'MTV' },
    MUBI: { value: 'MUBI', label: 'Mubi' },
    MX: { value: 'MX', label: 'MONOMAX' },
    MY5: { value: 'MY5', label: 'Channel 5' },
    NATG: { value: 'NATG', label: 'National Geographic' },
    NBA: { value: 'NBA', label: 'NBA League Pass' },
    NBC: { value: 'NBC', label: 'NBC' },
    NBLA: { value: 'NBLA', label: 'Nebula' },
    NF: { value: 'NF', label: 'Netflix' },
    NFB: { value: 'NFB', label: 'National Film Board of Canada' },
    NFL: { value: 'NFL', label: 'NFL Network' },
    NFLN: { value: 'NFLN', label: 'NFL Now' },
    NICK: { value: 'NICK', label: 'Nickelodeon' },
    NOW: { value: 'NOW', label: 'Now (Sky)' },
    NPO: { value: 'NPO', label: 'NPO Start' },
    NRK: { value: 'NRK', label: 'Norsk Rikskringkasting' },
    ODK: { value: 'ODK', label: 'OnDemandKorea' },
    OFTV: { value: 'OFTV', label: 'OnlyFans TV' },
    OPTO: { value: 'OPTO', label: 'OPTO' },
    OSN: { value: 'OSN', label: 'OSN+' },
    OXGN: { value: 'OXGN', label: 'Oxygen' },
    PA: { value: 'PA', label: 'Project Alpha' },
    PBS: { value: 'PBS', label: 'PBS' },
    PBSK: { value: 'PBSK', label: 'PBS Kids' },
    PCOK: { value: 'PCOK', label: 'Peacock' },
    PLAY: { value: 'PLAY', label: 'Google Play' },
    PLUZ: { value: 'PLUZ', label: 'Pluzz' },
    PLYR: { value: 'PLYR', label: 'Player' },
    PMNT: { value: 'PMNT', label: 'Paramount Network' },
    PMTP: { value: 'PMTP', label: 'Paramount+' },
    POGO: { value: 'POGO', label: 'PokerGo' },
    PSN: { value: 'PSN', label: 'Playstation Network' },
    PUHU: { value: 'PUHU', label: 'puhutv' },
    QIBI: { value: 'QIBI', label: 'Quibi' },
    RED: { value: 'RED', label: 'YouTube Premium' },
    RKTN: { value: 'RKTN', label: 'Rakuten TV' },
    ROKU: { value: 'ROKU', label: 'The Roku Channel' },
    RSTR: { value: 'RSTR', label: 'Rooster Teeth' },
    RTE: { value: 'RTE', label: 'RTÉ' },
    SAINA: { value: 'SAINA', label: 'Saina Play' },
    SBS: { value: 'SBS', label: 'SBS (AU)' },
    SESO: { value: 'SESO', label: 'Seeso' },
    SF: { value: 'SF', label: 'SF Anytime' },
    SHAHID: { value: 'SHAHID', label: 'Shahid' },
    SHDR: { value: 'SHDR', label: 'Shudder' },
    SHMI: { value: 'SHMI', label: 'Shomi' },
    SHO: { value: 'SHO', label: 'Showtime' },
    SKSH: { value: 'SKSH', label: 'Sky Show (UK)' },
    SKSP: { value: 'SKSP', label: 'Sky Sport (UK)' },
    SKST: { value: 'SKST', label: 'SkyShowtime' },
    SKSTR: { value: 'SKSTR', label: 'Sky Store (UK)' },
    SLIV: { value: 'SLIV', label: 'SonyLiv' },
    SLNG: { value: 'SLNG', label: 'Sling TV' },
    SMAX: { value: 'SMAX', label: 'Showmax' },
    SNET: { value: 'SNET', label: 'Sportsnet' },
    SNXT: { value: 'SNXT', label: 'Sun NXT' },
    SPIK: { value: 'SPIK', label: 'Spike' },
    SPRT: { value: 'SPRT', label: 'Sprout' },
    SS: { value: 'SS', label: 'Simply South' },
    STAN: { value: 'STAN', label: 'Stan' },
    STMZ: { value: 'STMZ', label: 'Streamz' },
    STRP: { value: 'STRP', label: 'Star+' },
    STZ: { value: 'STZ', label: 'Starz' },
    SVT: { value: 'SVT', label: 'Sveriges Television' },
    SWEET: { value: 'SWEET', label: 'SWEET.TV' },
    SWER: { value: 'SWER', label: 'SwearNet' },
    SYFY: { value: 'SYFY', label: 'SyFy' },
    TBS: { value: 'TBS', label: 'TBS' },
    TEN: { value: 'TEN', label: 'TenPlay' },
    TFOU: { value: 'TFOU', label: 'TFOU' },
    TIMV: { value: 'TIMV', label: 'TIMvision' },
    TK: { value: 'TK', label: 'Tentkotta' },
    TLC: { value: 'TLC', label: 'TLC' },
    TOU: { value: 'TOU', label: 'Ici TOU.TV' },
    TRVL: { value: 'TRVL', label: 'Travel Channel' },
    TUBI: { value: 'TUBI', label: 'TubiTV' },
    TV3: { value: 'TV3', label: 'TV3 (IE)' },
    TV4: { value: 'TV4', label: 'TV4 (SE)' },
    TVING: { value: 'TVING', label: 'TVING' },
    TVL: { value: 'TVL', label: 'TVLand' },
    TVNZ: { value: 'TVNZ', label: 'TVNZ' },
    UFC: { value: 'UFC', label: 'UFC' },
    UKTV: { value: 'UKTV', label: 'UKTV' },
    UNIV: { value: 'UNIV', label: 'Univision' },
    UNXT: { value: 'UNXT', label: 'U-NEXT' },
    USAN: { value: 'USAN', label: 'USA Network' },
    VDO: { value: 'VDO', label: 'Vidio' },
    VH1: { value: 'VH1', label: 'VH1' },
    VIAP: { value: 'VIAP', label: 'Viaplay' },
    VICE: { value: 'VICE', label: 'Viceland' },
    VIKI: { value: 'VIKI', label: 'Viki' },
    VIU: { value: 'VIU', label: 'Viu' },
    VLCT: { value: 'VLCT', label: 'Velocity' },
    VLD: { value: 'VLD', label: 'Videoland' },
    VMEO: { value: 'VMEO', label: 'Vimeo' },
    VRV: { value: 'VRV', label: 'VRV' },
    VTRN: { value: 'VTRN', label: 'VET Tv' },
    VUDU: { value: 'VUDU', label: 'Vudu' },
    VVMX: { value: 'VVMX', label: 'Vivamax' },
    WAVVE: { value: 'WAVVE', label: 'Wavve' },
    WETV: { value: 'WETV', label: 'WeTV' },
    WME: { value: 'WME', label: 'WatchMe' },
    WNET: { value: 'WNET', label: 'W Network' },
    WOWP: { value: 'WOWP', label: 'WOW Presents Plus' },
    WTCH: { value: 'WTCH', label: 'Watcha' },
    WWEN: { value: 'WWEN', label: 'WWE Network' },
    XBOX: { value: 'XBOX', label: 'Xbox Video' },
    XUMO: { value: 'XUMO', label: 'Xumo Play' },
    YHOO: { value: 'YHOO', label: 'Yahoo' },
    YOUKU: { value: 'YOUKU', label: 'YoukuTV' },
    YT: { value: 'YT', label: 'YouTube Movies' },
    ZDF: { value: 'ZDF', label: 'ZDF' },
    ZEE5: { value: 'ZEE5', label: 'ZEE5' },
})
export type Service = (typeof SERVICES)[keyof typeof SERVICES] | undefined

export const [RESOLUTIONS, RESOLUTION_OPTIONS] = makeConst({
    '480i': { value: '480i', label: '480i' },
    '480p': { value: '480p', label: '480p' },
    '576i': { value: '576i', label: '576i' },
    '576p': { value: '576p', label: '576p' },
    '720p': { value: '720p', label: '720p' },
    '1080i': { value: '1080i', label: '1080i' },
    '1080p': { value: '1080p', label: '1080p' },
    '2160p': { value: '2160p', label: '2160p' },
    '4320p': { value: '4320p', label: '4320p' },
})
export type Resolution = (typeof RESOLUTIONS)[keyof typeof RESOLUTIONS]
export const SD_RESOLUTIONS = [RESOLUTIONS['480i'], RESOLUTIONS['480p'], RESOLUTIONS['576i'], RESOLUTIONS['576p']]

export const [RATIOS, RATIO_OPTIONS] = makeConst({
    IMAX: { value: 'IMAX', label: 'IMAX' },
    OPEN_MATTE: { value: 'Open Matte', label: 'Open Matte' },
    MAR: { value: 'MAR', label: 'MAR' },
})
export type Ratio = (typeof RATIOS)[keyof typeof RATIOS] | undefined

export const [CUTS, CUT_OPTIONS] = makeConst({
    SUPER_DUPER: { value: 'Super Duper Cut', label: 'Super Duper Cut' },
    DIRECTORS: { value: "Director's Cut", label: "Director's Cut" },
    SPECIAL_EDITION: { value: 'Special Edition', label: 'Special Edition' },
    EXTENDED: { value: 'Extended', label: 'Extended' },
    UNRATED: { value: 'Unrated', label: 'Unrated' },
    UNCUT: { value: 'Uncut', label: 'Uncut' },
})
export type Cut = (typeof CUTS)[keyof typeof CUTS] | undefined

export const [HDR_TYPES, HDR_OPTIONS] = makeConst({
    DV: { value: 'DV', label: 'DV' },
    HDR10_PLUS: { value: 'HDR10+', label: 'HDR10+' },
    HDR10: { value: 'HDR', label: 'HDR' },
    HLG: { value: 'HLG', label: 'HLG' },
})
export type HDR = (typeof HDR_TYPES)[keyof typeof HDR_TYPES]

export const [VIDEO_CODECS, VIDEO_CODEC_OPTIONS] = makeConst({
    MPEG_1: { value: 'MPEG-1', label: 'MPEG-1' },
    MPEG_2: { value: 'MPEG-2', label: 'MPEG-2' },
    VC_1: { value: 'VC-1', label: 'VC-1' },
    AVC: { value: 'AVC', label: 'AVC' },
    H264: { value: 'H.264', label: 'H.264' },
    HEVC: { value: 'HEVC', label: 'HEVC' },
    H265: { value: 'H.265', label: 'H.265' },
    X264: { value: 'x264', label: 'x264' },
    X265: { value: 'x265', label: 'x265' },
    VP9: { value: 'VP9', label: 'VP9' },
    AV1: { value: 'AV1', label: 'AV1' },
})
export type VideoCodec = (typeof VIDEO_CODECS)[keyof typeof VIDEO_CODECS]

export const VIDEO_STANDARDS = {
    NTSC: 'NTSC',
    PAL: 'PAL',
} as const
export type VideoStandard = (typeof VIDEO_STANDARDS)[keyof typeof VIDEO_STANDARDS]

export const [AUDIO_CODECS, AUDIO_CODEC_OPTIONS] = makeConst({
    AAC: { value: 'AAC', label: 'AAC' },
    OPUS: { value: 'Opus', label: 'Opus' },
    DD: { value: 'DD', label: 'DD' },
    DD_PLUS: { value: 'DD+', label: 'DD+' },
    TRUEHD: { value: 'TrueHD', label: 'TrueHD' },
    DTS: { value: 'DTS', label: 'DTS' },
    DTS_HD_MA: { value: 'DTS-HD MA', label: 'DTS-HD MA' },
    DTS_X: { value: 'DTS:X', label: 'DTS:X' },
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
})
export type AudioChannels = (typeof AUDIO_CHANNELS)[keyof typeof AUDIO_CHANNELS]

export const [AUDIO_METADATA_TYPES, AUDIO_METADATA_OPTIONS] = makeConst({
    ATMOS: { value: 'Atmos', label: 'Atmos' },
    AURO3D: { value: 'Auro3D', label: 'Auro3D' },
})
export type AudioMetadata = (typeof AUDIO_METADATA_TYPES)[keyof typeof AUDIO_METADATA_TYPES] | undefined

export const [LANGUAGES, LANGUAGE_OPTIONS] = makeConst({
    AR: { value: 'ar', label: 'Arabic' },
    DA: { value: 'da', label: 'Danish' },
    DE: { value: 'de', label: 'German' },
    EN: { value: 'en', label: 'English' },
    ES: { value: 'es', label: 'Spanish' },
    FI: { value: 'fi', label: 'Finnish' },
    FR: { value: 'fr', label: 'French' },
    HI: { value: 'hi', label: 'Hindi' },
    IT: { value: 'it', label: 'Italian' },
    JA: { value: 'ja', label: 'Japanese' },
    KO: { value: 'ko', label: 'Korean' },
    NL: { value: 'nl', label: 'Dutch' },
    NO: { value: 'no', label: 'Norwegian' },
    PL: { value: 'pl', label: 'Polish' },
    PT: { value: 'pt', label: 'Portuguese' },
    RU: { value: 'ru', label: 'Russian' },
    SV: { value: 'sv', label: 'Swedish' },
    TA: { value: 'ta', label: 'Tamil' },
    TH: { value: 'th', label: 'Thai' },
    TR: { value: 'tr', label: 'Turkish' },
    ZH: { value: 'zh', label: 'Chinese' },
})

export type PartialMetadata = {
    releaseGroup?: string
    mediaType?: MediaType
    title?: string
    originalTitle?: string
    year?: number
    season?: number
    episode?: number
    episodeEnd?: number
    specialName?: string
    language: string[]
    originalLanguage?: string
    sourceType?: SourceType
    source?: Source
    service?: Service
    repack: number
    proper: number
    rerip: number
    cut?: Cut
    ratio?: Ratio
    hybrid?: boolean
    hi10p?: boolean
    resolution?: Resolution
    hdr: HDR[]
    videoCodec?: VideoCodec
    audioCodec?: AudioCodec
    audioChannels?: AudioChannels
    audioMetadata?: AudioMetadata
    hasTrueHDCompatibilityTrack?: boolean
    hasEnglishSubs?: boolean
    tmdbId?: number
    imdbId?: string
    tvdbId?: number
    locale?: string
    originCountry?: string
}

export const MetadataSchema = z
    .object({
        title: z.string().trim().min(1, 'Title is required'),
        originalTitle: z.string().trim().min(1).optional(),
        releaseGroup: z.string().trim().min(1).optional(),
        mediaType: z.enum(MEDIA_TYPES, { error: 'Media type is required' }),
        year: z
            .number()
            .int()
            .refine((value) => /^\d{4}$/.test(String(value)), 'Invalid year format'),
        season: z.number().int().optional(),
        episode: z.number().int().optional(),
        episodeEnd: z.number().int().optional(),
        specialName: z.string().trim().min(1).optional(),
        language: z.array(z.string().trim().min(1)).min(1, 'Language is required'),
        originalLanguage: z.string().trim().min(1, 'Original language is required'),
        source: z.enum(SOURCES, { error: 'Source is required' }),
        sourceType: z.enum(SOURCE_TYPES, { error: 'Type is required' }),
        service: z.enum(SERVICES).optional(),
        repack: z.number().int().min(0),
        proper: z.number().int().min(0),
        rerip: z.number().int().min(0),
        cut: z.enum(CUTS).optional(),
        ratio: z.enum(RATIOS).optional(),
        hybrid: z.boolean(),
        hi10p: z.boolean(),
        resolution: z.enum(RESOLUTIONS, { error: 'Resolution is required' }),
        hdr: z.array(z.enum(HDR_TYPES)),
        videoCodec: z.enum(VIDEO_CODECS, { error: 'Video codec is required' }),
        audioCodec: z.enum(AUDIO_CODECS, { error: 'Audio codec is required' }),
        audioChannels: z.enum(AUDIO_CHANNELS, { error: 'Audio channels are required' }),
        audioMetadata: z.enum(AUDIO_METADATA_TYPES).optional(),
        hasTrueHDCompatibilityTrack: z.boolean().optional(),
        hasEnglishSubs: z.boolean(),
        tmdbId: z.number().int().min(1, 'TMDb ID is required'),
        imdbId: z.string().trim().min(1, 'IMDb ID is required'),
        tvdbId: z.number().int().optional(),
        locale: z.string().trim().min(1).optional(),
    })
    .superRefine((metadata, ctx) => {
        if (metadata.mediaType === MEDIA_TYPES.TV) {
            if (metadata.season == null) {
                ctx.addIssue({ code: 'custom', path: ['season'], message: 'Season is required' })
            }
            if (metadata.tvdbId == null) {
                ctx.addIssue({ code: 'custom', path: ['tvdbId'], message: 'TVDB ID is required' })
            }
            if (metadata.episodeEnd !== undefined) {
                if (metadata.episode === undefined) {
                    ctx.addIssue({ code: 'custom', path: ['episode'], message: 'First episode is required for a range' })
                } else if (metadata.episodeEnd <= metadata.episode) {
                    ctx.addIssue({ code: 'custom', path: ['episodeEnd'], message: 'Must be greater than the first episode' })
                }
            }
        }
        if (metadata.source === SOURCES.WEB && metadata.service == null) {
            ctx.addIssue({ code: 'custom', path: ['service'], message: 'Service is required for Web sources' })
        }
    })

export type Metadata = z.infer<typeof MetadataSchema>

export function isDvd(metadata: Metadata): boolean {
    return metadata.source === SOURCES.DVD || metadata.source === SOURCES.NTSC_DVD || metadata.source === SOURCES.PAL_DVD || metadata.source === SOURCES.HD_DVD
}

export function isRemux(metadata: Metadata): boolean {
    return metadata.sourceType === SOURCE_TYPES.REMUX
}

export function isHdtv(metadata: Metadata): boolean {
    return metadata.sourceType === SOURCE_TYPES.HDTV
}

export function isEncode(metadata: Metadata): boolean {
    return metadata.sourceType === SOURCE_TYPES.ENCODE
}

export function isForeignContent(metadata: Metadata): boolean {
    return metadata.originalLanguage !== 'en'
}

export function hasEnglishAudio(metadata: Metadata): boolean {
    return metadata.language.includes('en')
}

export function isWebSource(sourceType: SourceType) {
    return (WEB_SOURCE_TYPES as string[]).includes(sourceType)
}

export function isSDResolution(resolution: Resolution) {
    return (SD_RESOLUTIONS as string[]).includes(resolution)
}
