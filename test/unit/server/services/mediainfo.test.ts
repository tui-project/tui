import { beforeEach, describe, expect, it, vi } from 'vitest'

const getSettingsMock = vi.fn()
const runCommandMock = vi.fn()

describe('mediainfo service', () => {
    beforeEach(() => {
        vi.resetModules()
        vi.clearAllMocks()

        getSettingsMock.mockResolvedValue({ mediainfoPath: '/usr/bin/mediainfo' })
        runCommandMock.mockResolvedValue({ stdout: JSON.stringify({ media: { track: [] } }) })
    })

    async function loadService() {
        vi.doMock('../../../../server/repositories/settings-repository', () => ({ getSettings: getSettingsMock }))
        vi.doMock('../../../../server/utils/process', () => ({ runCommand: runCommandMock }))

        return import('../../../../server/services/mediainfo')
    }

    it('returns parsed metadata output', async () => {
        const { parseMetadataFromMediainfo } = await loadService()

        await expect(parseMetadataFromMediainfo('/tmp/movie.mkv', 'WEB-DL')).resolves.toEqual({
            resolution: undefined,
            videoCodec: undefined,
            hi10p: false,
            hdr: [],
            language: [],
            audioCodec: undefined,
            audioChannels: undefined,
            audioMetadata: undefined,
            hasTrueHDCompatibilityTrack: undefined,
            hasEnglishSubs: false,
            tmdbId: undefined,
            imdbId: '',
            tvdbId: undefined,
        })
        expect(runCommandMock).toHaveBeenCalledWith('/usr/bin/mediainfo', ['--Output=JSON', '/tmp/movie.mkv'])
    })

    it('returns text output', async () => {
        runCommandMock.mockResolvedValue({ stdout: 'General\nComplete name                            : movie.mkv' })
        const { analyzeMediaFileAsText } = await loadService()

        await expect(analyzeMediaFileAsText('/tmp/movie.mkv')).resolves.toContain('Complete name')
        expect(runCommandMock).toHaveBeenCalledWith('/usr/bin/mediainfo', ['/tmp/movie.mkv'])
    })

    it('returns empty text when text analysis fails', async () => {
        runCommandMock.mockRejectedValueOnce(new Error('text analysis failed'))
        const { analyzeMediaFileAsText } = await loadService()

        await expect(analyzeMediaFileAsText('/tmp/movie.mkv')).resolves.toBe('')
    })

    it('returns empty object and does not throw when analysis fails', async () => {
        runCommandMock.mockRejectedValueOnce(new Error('analysis failed'))
        const { parseMetadataFromMediainfo } = await loadService()

        await expect(parseMetadataFromMediainfo('/tmp/movie.mkv', 'WEB-DL')).rejects.toThrow(TypeError)
    })

    it.each([
        {
            name: 'web-dl h264 hdr10+ atmos with ids and languages',
            sourceType: 'WEB-DL' as const,
            result: {
                media: {
                    track: [
                        { '@type': 'General', extra: { IMDB: 'tt123', TMDB: 'tmdb://55', TVDB: 'tvdb-66' } },
                        { '@type': 'Video', Height: '1080', ScanType: 'Progressive', Format: 'AVC', HDR_Format: 'HDR10+', HDR_Format_Compatibility: 'HDR10' },
                        {
                            '@type': 'Audio',
                            Default: 'Yes',
                            Format: 'E-AC-3',
                            Format_Commercial_IfAny: 'Dolby Digital Plus with Atmos',
                            Channels: '6',
                            ChannelLayout: 'C L R Ls Rs LFE',
                            Language: 'en-US',
                            Title: 'Main Atmos',
                        },
                        { '@type': 'Audio', Default: 'No', Format: 'AAC', Channels: '2', ChannelLayout: 'L R', Language: 'fr-CA', Title: 'French' },
                        { '@type': 'Audio', Default: 'No', Format: 'AAC', Channels: '2', ChannelLayout: 'L R', Language: 'en-US', Title: 'Commentary Track' },
                    ],
                },
            },
            expected: {
                resolution: '1080p',
                videoCodec: 'H.264',
                hdr: ['HDR', 'HDR10+'],
                audioCodec: 'DD+',
                audioChannels: '5.1',
                audioMetadata: 'Atmos',
                language: ['en', 'fr'],
                imdbId: 'tt123',
                tmdbId: 55,
                tvdbId: 66,
            },
        },
        {
            name: 'webrip x265 with dolby vision + hlg and auro3d',
            sourceType: 'WEBRIP' as const,
            result: {
                media: {
                    track: [
                        { '@type': 'General', extra: { IMDB: 'tt124', TMDB: '12', TVDB: '13' } },
                        { '@type': 'Video', Height: '2160', ScanType: 'Progressive', Format: 'HEVC', HDR_Format: 'Dolby Vision HLG', HDR_Format_Compatibility: '' },
                        {
                            '@type': 'Audio',
                            Default: 'No',
                            Format: 'MLP FBA',
                            Format_Commercial_IfAny: 'Auro3D',
                            Channels: '8',
                            ChannelLayout: 'L R C LFE Ls Rs Lb Rb',
                            Language: 'es-ES',
                            Title: 'Main Auro3D',
                        },
                    ],
                },
            },
            expected: {
                resolution: '2160p',
                videoCodec: 'x265',
                hdr: ['DV', 'HLG'],
                audioCodec: 'TrueHD',
                audioChannels: '7.1',
                audioMetadata: 'Auro3D',
                language: ['es'],
                imdbId: 'tt124',
                tmdbId: 12,
                tvdbId: 13,
            },
        },
        {
            name: 'remux vc-1 with dts-hd ma and 6.1',
            sourceType: 'REMUX' as const,
            result: {
                media: {
                    track: [
                        { '@type': 'General', extra: { IMDB: 'tt125', TMDB: '14', TVDB: '15' } },
                        { '@type': 'Video', Height: '1080', ScanType: 'Interlaced', Format: 'VC-1' },
                        {
                            '@type': 'Audio',
                            Default: 'Yes',
                            Format: 'DTS',
                            Format_Commercial_IfAny: 'DTS-HD Master Audio',
                            Channels: '7',
                            ChannelLayout: 'C L R Ls Rs LFE Cb',
                            Language: 'de-DE',
                            Title: 'German',
                        },
                    ],
                },
            },
            expected: {
                resolution: '1080i',
                videoCodec: 'VC-1',
                hdr: [],
                audioCodec: 'DTS-HD MA',
                audioChannels: '6.1',
                audioMetadata: undefined,
                language: ['de'],
                imdbId: 'tt125',
                tmdbId: 14,
                tvdbId: 15,
            },
        },
        {
            name: 'codec/resolution/channel matrix',
            sourceType: 'REMUX' as const,
            result: {
                media: {
                    track: [
                        { '@type': 'Video', Height: '4320', ScanType: 'Progressive', Format: 'AV1', HDR_Format: 'SMPTE ST 2086', HDR_Format_Compatibility: 'HDR10' },
                        { '@type': 'Audio', Default: 'Yes', Format: 'AAC', Channels: '1', ChannelLayout: 'C', Format_Commercial_IfAny: 'Atmos', Language: 'pt-BR', Title: 'Main' },
                    ],
                },
            },
            expected: { resolution: '4320p', videoCodec: 'AV1', audioChannels: '1.0', audioCodec: 'AAC', hdr: ['HDR'], audioMetadata: 'Atmos', language: ['pt'] },
        },
        {
            name: 'remaining matrix mpeg1 + dd+',
            sourceType: 'REMUX' as const,
            result: {
                media: {
                    track: [
                        {
                            '@type': 'Video',
                            Height: '720',
                            ScanType: 'Progressive',
                            Format: 'MPEG Video',
                            Format_Version: '1',
                            HDR_Format: 'SMPTE ST 2086',
                            HDR_Format_Compatibility: 'HDR10',
                        },
                        {
                            '@type': 'Audio',
                            Default: 'Yes',
                            Format: 'EAC3',
                            Channels: '6',
                            ChannelLayout: 'L R C LFE Ls Rs',
                            Format_Commercial_IfAny: 'Atmos',
                            Language: 'pt-BR',
                            Title: 'Main',
                        },
                    ],
                },
            },
            expected: { resolution: '720p', videoCodec: 'MPEG-1', audioChannels: '5.1', audioCodec: 'DD+', hdr: ['HDR'], audioMetadata: 'Atmos', language: ['pt'] },
        },
        {
            name: 'remaining matrix avc generic + dd literal',
            sourceType: 'REMUX' as const,
            result: {
                media: {
                    track: [
                        { '@type': 'Video', Height: '1080', ScanType: 'Progressive', Format: 'AVC', HDR_Format: 'SMPTE ST 2086', HDR_Format_Compatibility: 'HDR10' },
                        {
                            '@type': 'Audio',
                            Default: 'Yes',
                            Format: 'DD',
                            Channels: '6',
                            ChannelLayout: 'L R C LFE Ls Rs',
                            Format_Commercial_IfAny: 'Atmos',
                            Language: 'pt-BR',
                            Title: 'Main',
                        },
                    ],
                },
            },
            expected: { resolution: '1080p', videoCodec: 'AVC', audioChannels: '5.1', audioCodec: 'DD', hdr: ['HDR'], audioMetadata: 'Atmos', language: ['pt'] },
        },
        {
            name: 'remaining matrix mpeg2 + ac-3 literal',
            sourceType: 'REMUX' as const,
            result: {
                media: {
                    track: [
                        {
                            '@type': 'Video',
                            Height: '576',
                            ScanType: 'Interlaced',
                            Format: 'MPEG Video',
                            Format_Version: '2',
                            HDR_Format: 'SMPTE ST 2086',
                            HDR_Format_Compatibility: 'HDR10',
                        },
                        {
                            '@type': 'Audio',
                            Default: 'Yes',
                            Format: 'AC-3',
                            Channels: '3',
                            ChannelLayout: 'L R C',
                            Format_Commercial_IfAny: 'Atmos',
                            Language: 'pt-BR',
                            Title: 'Main',
                        },
                    ],
                },
            },
            expected: { resolution: '576i', videoCodec: 'MPEG-2', audioChannels: '3.0', audioCodec: 'DD', hdr: ['HDR'], audioMetadata: 'Atmos', language: ['pt'] },
        },
        {
            name: '576 progressive resolution branch',
            sourceType: 'REMUX' as const,
            result: {
                media: {
                    track: [
                        { '@type': 'Video', Height: '576', ScanType: 'Progressive', Format: 'AVC', HDR_Format: 'SMPTE ST 2086', HDR_Format_Compatibility: 'HDR10' },
                        {
                            '@type': 'Audio',
                            Default: 'Yes',
                            Format: 'AAC',
                            Channels: '2',
                            ChannelLayout: 'L R',
                            Format_Commercial_IfAny: 'Atmos',
                            Language: 'pt-BR',
                            Title: 'Main',
                        },
                    ],
                },
            },
            expected: { resolution: '576p', videoCodec: 'AVC', audioChannels: '2.0', audioCodec: 'AAC', hdr: ['HDR'], audioMetadata: 'Atmos', language: ['pt'] },
        },
        {
            name: '480 interlaced resolution branch',
            sourceType: 'REMUX' as const,
            result: {
                media: {
                    track: [
                        { '@type': 'Video', Height: '480', ScanType: 'Interlaced', Format: 'AVC', HDR_Format: 'SMPTE ST 2086', HDR_Format_Compatibility: 'HDR10' },
                        {
                            '@type': 'Audio',
                            Default: 'Yes',
                            Format: 'AAC',
                            Channels: '2',
                            ChannelLayout: 'L R',
                            Format_Commercial_IfAny: 'Atmos',
                            Language: 'pt-BR',
                            Title: 'Main',
                        },
                    ],
                },
            },
            expected: { resolution: '480i', videoCodec: 'AVC', audioChannels: '2.0', audioCodec: 'AAC', hdr: ['HDR'], audioMetadata: 'Atmos', language: ['pt'] },
        },
        {
            name: 'remaining matrix x265 + truehd',
            sourceType: 'WEBRIP' as const,
            result: {
                media: {
                    track: [
                        { '@type': 'Video', Height: '2160', ScanType: 'Progressive', Format: 'HEVC', HDR_Format: 'SMPTE ST 2086', HDR_Format_Compatibility: 'HDR10' },
                        {
                            '@type': 'Audio',
                            Default: 'Yes',
                            Format: 'MLP FBA',
                            Channels: '8',
                            ChannelLayout: 'L R C LFE Ls Rs Lb Rb',
                            Format_Commercial_IfAny: 'Atmos',
                            Language: 'pt-BR',
                            Title: 'Main',
                        },
                    ],
                },
            },
            expected: { resolution: '2160p', videoCodec: 'x265', audioChannels: '7.1', audioCodec: 'TrueHD', hdr: ['HDR'], audioMetadata: 'Atmos', language: ['pt'] },
        },
        {
            name: 'generic hevc and dts branch',
            sourceType: 'REMUX' as const,
            result: {
                media: {
                    track: [
                        { '@type': 'Video', Height: '1080', ScanType: 'Progressive', Format: 'HEVC', HDR_Format: 'SMPTE ST 2086', HDR_Format_Compatibility: 'HDR10' },
                        {
                            '@type': 'Audio',
                            Default: 'Yes',
                            Format: 'DTS',
                            Channels: '6',
                            ChannelLayout: 'L R C LFE Ls Rs',
                            Format_Commercial_IfAny: 'Atmos',
                            Language: 'pt-BR',
                            Title: 'Main',
                        },
                    ],
                },
            },
            expected: { resolution: '1080p', videoCodec: 'HEVC', audioChannels: '5.1', audioCodec: 'DTS', hdr: ['HDR'], audioMetadata: 'Atmos', language: ['pt'] },
        },
        {
            name: 'generic vp9 and flac branch',
            sourceType: 'REMUX' as const,
            result: {
                media: {
                    track: [
                        { '@type': 'Video', Height: '2160', ScanType: 'Progressive', Format: 'VP9', HDR_Format: 'SMPTE ST 2086', HDR_Format_Compatibility: 'HDR10' },
                        {
                            '@type': 'Audio',
                            Default: 'Yes',
                            Format: 'FLAC',
                            Channels: '2',
                            ChannelLayout: 'L R',
                            Format_Commercial_IfAny: 'Atmos',
                            Language: 'pt-BR',
                            Title: 'Main',
                        },
                    ],
                },
            },
            expected: { resolution: '2160p', videoCodec: 'VP9', audioChannels: '2.0', audioCodec: 'FLAC', hdr: ['HDR'], audioMetadata: 'Atmos', language: ['pt'] },
        },
        {
            name: '480 progressive resolution branch',
            sourceType: 'REMUX' as const,
            result: {
                media: {
                    track: [
                        { '@type': 'Video', Height: '480', ScanType: 'Progressive', Format: 'AVC', HDR_Format: 'SMPTE ST 2086', HDR_Format_Compatibility: 'HDR10' },
                        {
                            '@type': 'Audio',
                            Default: 'Yes',
                            Format: 'AAC',
                            Channels: '2',
                            ChannelLayout: 'L R',
                            Format_Commercial_IfAny: 'Atmos',
                            Language: 'pt-BR',
                            Title: 'Main',
                        },
                    ],
                },
            },
            expected: { resolution: '480p', videoCodec: 'AVC', audioChannels: '2.0', audioCodec: 'AAC', hdr: ['HDR'], audioMetadata: 'Atmos', language: ['pt'] },
        },
        {
            name: '1036 progressive and 7.1 Lw/Rw layout branch',
            sourceType: 'REMUX' as const,
            result: {
                media: {
                    track: [
                        { '@type': 'Video', Height: '1036', ScanType: 'Progressive', Format: 'AVC', HDR_Format: 'SMPTE ST 2086', HDR_Format_Compatibility: 'HDR10' },
                        {
                            '@type': 'Audio',
                            Default: 'Yes',
                            Format: 'AAC',
                            Channels: '8',
                            ChannelLayout: 'C L R Ls Rs LFE Lw Rw',
                            Format_Commercial_IfAny: 'Atmos',
                            Language: 'pt-BR',
                            Title: 'Main',
                        },
                    ],
                },
            },
            expected: { resolution: '1080p', videoCodec: 'AVC', audioChannels: '7.1', audioCodec: 'AAC', hdr: ['HDR'], audioMetadata: 'Atmos', language: ['pt'] },
        },
        {
            name: '1072 progressive resolution branch',
            sourceType: 'REMUX' as const,
            result: {
                media: {
                    track: [
                        { '@type': 'Video', Height: '1072', ScanType: 'Progressive', Format: 'AVC', HDR_Format: 'SMPTE ST 2086', HDR_Format_Compatibility: 'HDR10' },
                        {
                            '@type': 'Audio',
                            Default: 'Yes',
                            Format: 'AAC',
                            Channels: '2',
                            ChannelLayout: 'L R',
                            Format_Commercial_IfAny: 'Atmos',
                            Language: 'pt-BR',
                            Title: 'Main',
                        },
                    ],
                },
            },
            expected: { resolution: '1080p', videoCodec: 'AVC', audioChannels: '2.0', audioCodec: 'AAC', hdr: ['HDR'], audioMetadata: 'Atmos', language: ['pt'] },
        },
        {
            name: '1072 interlaced resolution branch',
            sourceType: 'REMUX' as const,
            result: {
                media: {
                    track: [
                        { '@type': 'Video', Height: '1072', ScanType: 'Interlaced', Format: 'AVC', HDR_Format: 'SMPTE ST 2086', HDR_Format_Compatibility: 'HDR10' },
                        {
                            '@type': 'Audio',
                            Default: 'Yes',
                            Format: 'AAC',
                            Channels: '2',
                            ChannelLayout: 'L R',
                            Format_Commercial_IfAny: 'Atmos',
                            Language: 'pt-BR',
                            Title: 'Main',
                        },
                    ],
                },
            },
            expected: { resolution: '1080i', videoCodec: 'AVC', audioChannels: '2.0', audioCodec: 'AAC', hdr: ['HDR'], audioMetadata: 'Atmos', language: ['pt'] },
        },
        {
            name: '1036 interlaced resolution branch',
            sourceType: 'REMUX' as const,
            result: {
                media: {
                    track: [
                        { '@type': 'Video', Height: '1036', ScanType: 'Interlaced', Format: 'AVC', HDR_Format: 'SMPTE ST 2086', HDR_Format_Compatibility: 'HDR10' },
                        {
                            '@type': 'Audio',
                            Default: 'Yes',
                            Format: 'AAC',
                            Channels: '2',
                            ChannelLayout: 'L R',
                            Format_Commercial_IfAny: 'Atmos',
                            Language: 'pt-BR',
                            Title: 'Main',
                        },
                    ],
                },
            },
            expected: { resolution: '1080i', videoCodec: 'AVC', audioChannels: '2.0', audioCodec: 'AAC', hdr: ['HDR'], audioMetadata: 'Atmos', language: ['pt'] },
        },
        {
            name: '1040 progressive resolution branch',
            sourceType: 'REMUX' as const,
            result: {
                media: {
                    track: [
                        { '@type': 'Video', Height: '1040', ScanType: 'Progressive', Format: 'AVC', HDR_Format: 'SMPTE ST 2086', HDR_Format_Compatibility: 'HDR10' },
                        {
                            '@type': 'Audio',
                            Default: 'Yes',
                            Format: 'AAC',
                            Channels: '2',
                            ChannelLayout: 'L R',
                            Format_Commercial_IfAny: 'Atmos',
                            Language: 'pt-BR',
                            Title: 'Main',
                        },
                    ],
                },
            },
            expected: { resolution: '1080p', videoCodec: 'AVC', audioChannels: '2.0', audioCodec: 'AAC', hdr: ['HDR'], audioMetadata: 'Atmos', language: ['pt'] },
        },
        {
            name: '1040 interlaced resolution branch',
            sourceType: 'REMUX' as const,
            result: {
                media: {
                    track: [
                        { '@type': 'Video', Height: '1040', ScanType: 'Interlaced', Format: 'AVC', HDR_Format: 'SMPTE ST 2086', HDR_Format_Compatibility: 'HDR10' },
                        {
                            '@type': 'Audio',
                            Default: 'Yes',
                            Format: 'AAC',
                            Channels: '2',
                            ChannelLayout: 'L R',
                            Format_Commercial_IfAny: 'Atmos',
                            Language: 'pt-BR',
                            Title: 'Main',
                        },
                    ],
                },
            },
            expected: { resolution: '1080i', videoCodec: 'AVC', audioChannels: '2.0', audioCodec: 'AAC', hdr: ['HDR'], audioMetadata: 'Atmos', language: ['pt'] },
        },
        {
            name: '1080 MBAFF scan type treated as interlaced',
            sourceType: 'REMUX' as const,
            result: {
                media: {
                    track: [
                        { '@type': 'Video', Height: '1080', ScanType: 'MBAFF', Format: 'AVC', HDR_Format: 'SMPTE ST 2086', HDR_Format_Compatibility: 'HDR10' },
                        {
                            '@type': 'Audio',
                            Default: 'Yes',
                            Format: 'AAC',
                            Channels: '2',
                            ChannelLayout: 'L R',
                            Format_Commercial_IfAny: 'Atmos',
                            Language: 'pt-BR',
                            Title: 'Main',
                        },
                    ],
                },
            },
            expected: { resolution: '1080i', videoCodec: 'AVC', audioChannels: '2.0', audioCodec: 'AAC', hdr: ['HDR'], audioMetadata: 'Atmos', language: ['pt'] },
        },
        {
            name: 'final codec and hdr edge branches',
            sourceType: 'WEBRIP' as const,
            result: {
                media: {
                    track: [
                        { '@type': 'Video', Height: '1080', ScanType: 'Progressive', Format: 'AVC', HDR_Format: '', HDR_Format_Compatibility: '' },
                        {
                            '@type': 'Audio',
                            Default: 'Yes',
                            Format: 'AAC',
                            Channels: '2',
                            ChannelLayout: 'L R',
                            Format_Commercial_IfAny: 'Atmos',
                            Language: 'en-US',
                            Title: 'Main',
                        },
                    ],
                },
            },
            expected: { videoCodec: 'x264' },
        },
        {
            name: 'web-dl hevc maps to h265',
            sourceType: 'WEB-DL' as const,
            result: {
                media: {
                    track: [
                        { '@type': 'Video', Height: '1080', ScanType: 'Progressive', Format: 'HEVC', HDR_Format: '', HDR_Format_Compatibility: '' },
                        {
                            '@type': 'Audio',
                            Default: 'Yes',
                            Format: 'AAC',
                            Channels: '2',
                            ChannelLayout: 'L R',
                            Format_Commercial_IfAny: 'Atmos',
                            Language: 'en-US',
                            Title: 'Main',
                        },
                    ],
                },
            },
            expected: { videoCodec: 'H.265' },
        },
        {
            name: 'hdr compatibility adds hdr10+',
            sourceType: 'WEB-DL' as const,
            result: {
                media: {
                    track: [
                        { '@type': 'Video', Height: '1080', ScanType: 'Progressive', Format: 'AVC', HDR_Format: 'Unknown HDR', HDR_Format_Compatibility: 'HDR10+' },
                        {
                            '@type': 'Audio',
                            Default: 'Yes',
                            Format: 'AAC',
                            Channels: '2',
                            ChannelLayout: 'L R',
                            Format_Commercial_IfAny: 'Atmos',
                            Language: 'en-US',
                            Title: 'Main',
                        },
                    ],
                },
            },
            expected: { hdr: ['HDR', 'HDR10+'] },
        },
        {
            name: 'unknown hdr yields empty hdr array',
            sourceType: 'WEB-DL' as const,
            result: {
                media: {
                    track: [
                        { '@type': 'Video', Height: '1080', ScanType: 'Progressive', Format: 'AVC', HDR_Format: 'GammaTone', HDR_Format_Compatibility: 'CompatX' },
                        {
                            '@type': 'Audio',
                            Default: 'Yes',
                            Format: 'AAC',
                            Channels: '2',
                            ChannelLayout: 'L R',
                            Format_Commercial_IfAny: 'Atmos',
                            Language: 'en-US',
                            Title: 'Main',
                        },
                    ],
                },
            },
            expected: { hdr: [] },
        },
        {
            name: 'language without dash and non-numeric ids',
            sourceType: 'WEB-DL' as const,
            result: {
                media: {
                    track: [
                        { '@type': 'General', extra: { IMDB: 'tt999', TMDB: 'abc', TVDB: 'xyz' } },
                        { '@type': 'Audio', Default: 'Yes', Format: 'AAC', Channels: '2', ChannelLayout: 'L R', Language: 'JA', Title: 'Main' },
                    ],
                },
            },
            expected: { language: ['ja'], tmdbId: undefined, tvdbId: undefined, imdbId: 'tt999' },
        },
        {
            name: 'commentary skip and empty language normalization',
            sourceType: 'WEB-DL' as const,
            result: {
                media: {
                    track: [
                        { '@type': 'Audio', Default: 'No', Format: 'AAC', Channels: '2', ChannelLayout: 'L R', Language: 'en-US', Title: 'Commentary by Director' },
                        { '@type': 'Audio', Default: 'Yes', Format: 'AAC', Channels: '2', ChannelLayout: 'L R', Language: '   ', Title: 'Main' },
                        { '@type': 'Audio', Default: 'No', Format: 'AAC', Channels: '2', ChannelLayout: 'L R', Language: 'FR', Title: 'Secondary' },
                    ],
                },
            },
            expected: { language: ['fr'] },
        },
        {
            name: 'nil-string sanitization and nested non-object traversal',
            sourceType: 'WEB-DL' as const,
            result: {
                media: {
                    track: [
                        { '@type': 'General', extra: '<nil>' },
                        { '@type': 'Video', Height: '1080', ScanType: 'Progressive', Format: 'AVC', HDR_Format: '<nil>', HDR_Format_Compatibility: '<nil>' },
                        {
                            '@type': 'Audio',
                            Default: '<nil>',
                            Format: 'AAC',
                            Channels: '2',
                            ChannelLayout: 'L R',
                            Language: '<nil>',
                            Title: '<nil>',
                            Format_Commercial_IfAny: '<nil>',
                        },
                    ],
                },
            },
            expected: {
                resolution: '1080p',
                videoCodec: 'H.264',
                hdr: [],
                audioCodec: 'AAC',
                audioChannels: '2.0',
                audioMetadata: undefined,
                language: [],
                imdbId: '',
                tmdbId: undefined,
                tvdbId: undefined,
            },
        },
        {
            name: 'plain dolby digital plus does not imply atmos metadata',
            sourceType: 'WEB-DL' as const,
            result: {
                media: {
                    track: [
                        { '@type': 'Video', Height: '1080', ScanType: 'Progressive', Format: 'AVC', HDR_Format: '', HDR_Format_Compatibility: '' },
                        {
                            '@type': 'Audio',
                            Default: 'Yes',
                            Format: 'E-AC-3',
                            Channels: '6',
                            ChannelLayout: 'L R C LFE Ls Rs',
                            Language: 'en-US',
                            Title: 'Main',
                            Format_Commercial_IfAny: 'Dolby Digital Plus',
                        },
                    ],
                },
            },
            expected: {
                resolution: '1080p',
                videoCodec: 'H.264',
                hdr: [],
                audioCodec: 'DD+',
                audioChannels: '5.1',
                audioMetadata: undefined,
                language: ['en'],
            },
        },
        {
            name: 'hi10p true when AVC with High 10 profile',
            sourceType: 'WEB-DL' as const,
            result: {
                media: {
                    track: [
                        { '@type': 'Video', Height: '1080', ScanType: 'Progressive', Format: 'AVC', Format_Profile: 'High 10@L4.1', HDR_Format: '', HDR_Format_Compatibility: '' },
                        { '@type': 'Audio', Default: 'Yes', Format: 'AAC', Channels: '2', ChannelLayout: 'L R', Language: 'en-US', Title: 'Main' },
                    ],
                },
            },
            expected: { hi10p: true, videoCodec: 'H.264' },
        },
        {
            name: 'hi10p false when AVC without High 10 profile',
            sourceType: 'WEB-DL' as const,
            result: {
                media: {
                    track: [
                        { '@type': 'Video', Height: '1080', ScanType: 'Progressive', Format: 'AVC', Format_Profile: 'High@L4.1', HDR_Format: '', HDR_Format_Compatibility: '' },
                        { '@type': 'Audio', Default: 'Yes', Format: 'AAC', Channels: '2', ChannelLayout: 'L R', Language: 'en-US', Title: 'Main' },
                    ],
                },
            },
            expected: { hi10p: false, videoCodec: 'H.264' },
        },
        {
            name: 'parses decimal FrameRate value',
            sourceType: 'WEB-DL' as const,
            result: {
                media: {
                    track: [
                        { '@type': 'Video', Height: '1080', ScanType: 'Progressive', Format: 'AVC', FrameRate: '23.976', HDR_Format: '', HDR_Format_Compatibility: '' },
                        { '@type': 'Audio', Default: 'Yes', Format: 'AAC', Channels: '2', ChannelLayout: 'L R', Language: 'en-US', Title: 'Main' },
                    ],
                },
            },
            expected: { resolution: '1080p' },
        },
        {
            name: 'parses integer prefix from TMDB and TVDB ids and ignores decimal part',
            sourceType: 'WEB-DL' as const,
            result: {
                media: {
                    track: [
                        { '@type': 'General', extra: { IMDB: 'tt123', TMDB: 'tmdb://55.9', TVDB: 'tvdb-66.9' } },
                        { '@type': 'Audio', Default: 'Yes', Format: 'AAC', Channels: '2', ChannelLayout: 'L R', Language: 'en-US', Title: 'Main' },
                    ],
                },
            },
            expected: { tmdbId: 55, tvdbId: 66 },
        },
        {
            name: 'hi10p false when non-AVC codec with High 10 profile',
            sourceType: 'WEB-DL' as const,
            result: {
                media: {
                    track: [
                        { '@type': 'Video', Height: '1080', ScanType: 'Progressive', Format: 'HEVC', Format_Profile: 'High 10@L4.1', HDR_Format: '', HDR_Format_Compatibility: '' },
                        { '@type': 'Audio', Default: 'Yes', Format: 'AAC', Channels: '2', ChannelLayout: 'L R', Language: 'en-US', Title: 'Main' },
                    ],
                },
            },
            expected: { hi10p: false },
        },
        {
            name: 'parses NTSC video standard',
            sourceType: 'REMUX' as const,
            result: {
                media: {
                    track: [
                        {
                            '@type': 'Video',
                            Height: '480',
                            ScanType: 'Interlaced',
                            Format: 'MPEG Video',
                            Format_Version: '2',
                            Standard: 'NTSC',
                            HDR_Format: '',
                            HDR_Format_Compatibility: '',
                        },
                        { '@type': 'Audio', Default: 'Yes', Format: 'AAC', Channels: '2', ChannelLayout: 'L R', Language: 'en-US', Title: 'Main' },
                    ],
                },
            },
            expected: { videoStandard: 'NTSC' },
        },
        {
            name: 'parses PAL video standard',
            sourceType: 'REMUX' as const,
            result: {
                media: {
                    track: [
                        {
                            '@type': 'Video',
                            Height: '576',
                            ScanType: 'Interlaced',
                            Format: 'MPEG Video',
                            Format_Version: '2',
                            Standard: 'PAL',
                            HDR_Format: '',
                            HDR_Format_Compatibility: '',
                        },
                        { '@type': 'Audio', Default: 'Yes', Format: 'AAC', Channels: '2', ChannelLayout: 'L R', Language: 'en-US', Title: 'Main' },
                    ],
                },
            },
            expected: { videoStandard: 'PAL' },
        },
        {
            name: 'returns undefined frameRate when value has no digits',
            sourceType: 'WEB-DL' as const,
            result: {
                media: {
                    track: [
                        { '@type': 'Video', Height: '1080', ScanType: 'Progressive', Format: 'AVC', FrameRate: 'N/A', HDR_Format: '', HDR_Format_Compatibility: '' },
                        { '@type': 'Audio', Default: 'Yes', Format: 'AAC', Channels: '2', ChannelLayout: 'L R', Language: 'en-US', Title: 'Main' },
                    ],
                },
            },
            expected: { frameRate: undefined },
        },
        {
            name: 'hasEnglishSubs true when Text track has language en',
            sourceType: 'WEB-DL' as const,
            result: {
                media: {
                    track: [
                        { '@type': 'Audio', Default: 'Yes', Format: 'AAC', Channels: '2', ChannelLayout: 'L R', Language: 'en-US', Title: 'Main' },
                        { '@type': 'Text', Language: 'en' },
                    ],
                },
            },
            expected: { hasEnglishSubs: true },
        },
        {
            name: 'hasEnglishSubs true when Text track has language en-US',
            sourceType: 'WEB-DL' as const,
            result: {
                media: {
                    track: [
                        { '@type': 'Audio', Default: 'Yes', Format: 'AAC', Channels: '2', ChannelLayout: 'L R', Language: 'ja', Title: 'Main' },
                        { '@type': 'Text', Language: 'en-US' },
                        { '@type': 'Text', Language: 'fr' },
                    ],
                },
            },
            expected: { hasEnglishSubs: true },
        },
        {
            name: 'hasEnglishSubs false when no Text tracks exist',
            sourceType: 'WEB-DL' as const,
            result: {
                media: {
                    track: [{ '@type': 'Audio', Default: 'Yes', Format: 'AAC', Channels: '2', ChannelLayout: 'L R', Language: 'en-US', Title: 'Main' }],
                },
            },
            expected: { hasEnglishSubs: false },
        },
        {
            name: 'hasEnglishSubs false when Text tracks exist but none are English',
            sourceType: 'WEB-DL' as const,
            result: {
                media: {
                    track: [
                        { '@type': 'Audio', Default: 'Yes', Format: 'AAC', Channels: '2', ChannelLayout: 'L R', Language: 'ja', Title: 'Main' },
                        { '@type': 'Text', Language: 'fr' },
                        { '@type': 'Text', Language: 'de' },
                    ],
                },
            },
            expected: { hasEnglishSubs: false },
        },
    ])('parses mediainfo metadata across branches: $name', async ({ sourceType, result, expected }) => {
        const { parseMetadataFromMediainfo } = await loadService()
        runCommandMock.mockResolvedValueOnce({ stdout: JSON.stringify(result) })

        const parsed = await parseMetadataFromMediainfo('/tmp/movie.mkv', sourceType)
        expect(parsed).toMatchObject(expected)
    })

    it('sets hasTrueHDCompatibilityTrack to true when TrueHD has an AC-3 track', async () => {
        const { parseMetadataFromMediainfo } = await loadService()
        runCommandMock.mockResolvedValueOnce({
            stdout: JSON.stringify({
                media: {
                    track: [
                        { '@type': 'Audio', Default: 'Yes', Format: 'MLP FBA', Channels: '8', ChannelLayout: 'L R C LFE Ls Rs Lb Rb', Language: 'en' },
                        { '@type': 'Audio', Default: 'No', Format: 'AC-3', Channels: '6', ChannelLayout: 'L R C LFE Ls Rs', Language: 'en' },
                    ],
                },
            }),
        })
        const parsed = await parseMetadataFromMediainfo('/tmp/movie.mkv', 'REMUX')
        expect(parsed.hasTrueHDCompatibilityTrack).toBe(true)
    })

    it('sets hasTrueHDCompatibilityTrack to true when TrueHD has an E-AC-3 track', async () => {
        const { parseMetadataFromMediainfo } = await loadService()
        runCommandMock.mockResolvedValueOnce({
            stdout: JSON.stringify({
                media: {
                    track: [
                        { '@type': 'Audio', Default: 'Yes', Format: 'MLP FBA', Channels: '8', ChannelLayout: 'L R C LFE Ls Rs Lb Rb', Language: 'en' },
                        { '@type': 'Audio', Default: 'No', Format: 'E-AC-3', Channels: '6', ChannelLayout: 'L R C LFE Ls Rs', Language: 'en' },
                    ],
                },
            }),
        })
        const parsed = await parseMetadataFromMediainfo('/tmp/movie.mkv', 'REMUX')
        expect(parsed.hasTrueHDCompatibilityTrack).toBe(true)
    })

    it('sets hasTrueHDCompatibilityTrack to false when TrueHD has no compatibility track', async () => {
        const { parseMetadataFromMediainfo } = await loadService()
        runCommandMock.mockResolvedValueOnce({
            stdout: JSON.stringify({
                media: {
                    track: [{ '@type': 'Audio', Default: 'Yes', Format: 'MLP FBA', Channels: '8', ChannelLayout: 'L R C LFE Ls Rs Lb Rb', Language: 'en' }],
                },
            }),
        })
        const parsed = await parseMetadataFromMediainfo('/tmp/movie.mkv', 'REMUX')
        expect(parsed.hasTrueHDCompatibilityTrack).toBe(false)
    })

    it('sets hasTrueHDCompatibilityTrack to false when only AC-3 track is a commentary', async () => {
        const { parseMetadataFromMediainfo } = await loadService()
        runCommandMock.mockResolvedValueOnce({
            stdout: JSON.stringify({
                media: {
                    track: [
                        { '@type': 'Audio', Default: 'Yes', Format: 'MLP FBA', Channels: '8', ChannelLayout: 'L R C LFE Ls Rs Lb Rb', Language: 'en' },
                        { '@type': 'Audio', Default: 'No', Format: 'AC-3', Channels: '2', ChannelLayout: 'L R', Language: 'en', Title: 'Commentary Track' },
                    ],
                },
            }),
        })
        const parsed = await parseMetadataFromMediainfo('/tmp/movie.mkv', 'REMUX')
        expect(parsed.hasTrueHDCompatibilityTrack).toBe(false)
    })

    it('leaves hasTrueHDCompatibilityTrack undefined when primary codec is not TrueHD', async () => {
        const { parseMetadataFromMediainfo } = await loadService()
        runCommandMock.mockResolvedValueOnce({
            stdout: JSON.stringify({
                media: {
                    track: [
                        {
                            '@type': 'Audio',
                            Default: 'Yes',
                            Format: 'DTS',
                            Format_Commercial_IfAny: 'DTS-HD Master Audio',
                            Channels: '6',
                            ChannelLayout: 'L R C LFE Ls Rs',
                            Language: 'en',
                        },
                    ],
                },
            }),
        })
        const parsed = await parseMetadataFromMediainfo('/tmp/movie.mkv', 'REMUX')
        expect(parsed.hasTrueHDCompatibilityTrack).toBeUndefined()
    })
})
