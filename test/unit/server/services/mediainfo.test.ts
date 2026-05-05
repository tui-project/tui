import type { Stats } from 'node:fs'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const fileHandle = {
    stat: vi.fn<() => Promise<Pick<Stats, 'size'>>>(),
    read: vi.fn<(buffer: Buffer, offset: number, length: number, position: number) => Promise<{ bytesRead: number }>>(),
    close: vi.fn<() => Promise<void>>(),
}

const openMock = vi.fn()
const analyzeDataMock = vi.fn()
const mediaInfoFactoryMock = vi.fn()

describe('mediainfo service', () => {
    beforeEach(() => {
        vi.resetModules()
        vi.clearAllMocks()

        fileHandle.stat.mockResolvedValue({ size: 8 })
        fileHandle.read.mockImplementation(async (buffer) => {
            const source = Buffer.from('metadata')
            const bytesRead = Math.min(buffer.length, source.length)
            buffer.set(source.subarray(0, bytesRead))
            return { bytesRead }
        })
        fileHandle.close.mockResolvedValue()

        openMock.mockResolvedValue(fileHandle)
        analyzeDataMock.mockResolvedValue({ media: { track: [] } })
        mediaInfoFactoryMock.mockResolvedValue({ analyzeData: analyzeDataMock })
    })

    async function loadService() {
        vi.doMock('node:fs/promises', () => ({ open: openMock }))
        vi.doMock('mediainfo.js', () => ({ default: mediaInfoFactoryMock }))

        return import('../../../../server/services/mediainfo')
    }

    it('returns parsed metadata output', async () => {
        const { parseMetadataFromMediainfo } = await loadService()

        await expect(parseMetadataFromMediainfo('/tmp/movie.mkv', 'WEB-DL')).resolves.toEqual({
            resolution: undefined,
            videoCodec: undefined,
            hdr: [],
            language: [],
            audioCodec: undefined,
            audioChannels: undefined,
            audioMetadata: undefined,
            tmdbId: undefined,
            imdbId: '',
            tvdbId: undefined,
        })
        expect(mediaInfoFactoryMock).toHaveBeenCalledWith({ format: 'object' })
        expect(openMock).toHaveBeenCalledWith('/tmp/movie.mkv', 'r')
        expect(fileHandle.close).toHaveBeenCalledTimes(1)
    })

    it('returns text output', async () => {
        analyzeDataMock.mockResolvedValue('General\nComplete name                            : movie.mkv')
        const { analyzeMediaFileAsText } = await loadService()

        await expect(analyzeMediaFileAsText('/tmp/movie.mkv')).resolves.toContain('Complete name')
        expect(mediaInfoFactoryMock).toHaveBeenCalledWith({ format: 'text' })
        expect(fileHandle.close).toHaveBeenCalledTimes(1)
    })

    it('returns empty text when text analysis fails', async () => {
        analyzeDataMock.mockRejectedValueOnce(new Error('text analysis failed'))
        const { analyzeMediaFileAsText } = await loadService()

        await expect(analyzeMediaFileAsText('/tmp/movie.mkv')).resolves.toBe('')
        expect(fileHandle.close).toHaveBeenCalledTimes(1)
    })

    it('reads chunks via analyzeData callback', async () => {
        analyzeDataMock.mockImplementation(async (getSize: () => number, readChunk: (size: number, offset: number) => Promise<Uint8Array>) => {
            expect(getSize()).toBe(8)
            const chunk = await readChunk(4, 2)
            expect(chunk).toBeInstanceOf(Uint8Array)
            expect(chunk.byteLength).toBe(4)
            return { media: { track: [{ '@type': 'General' }] } }
        })

        const { parseMetadataFromMediainfo } = await loadService()

        await expect(parseMetadataFromMediainfo('/tmp/movie.mkv', 'WEB-DL')).resolves.toMatchObject({
            hdr: [],
            language: [],
            imdbId: '',
        })
        expect(fileHandle.read).toHaveBeenCalledWith(expect.any(Buffer), 0, 4, 2)
    })

    it('throws when mediainfo result shape is missing after analysis failure', async () => {
        analyzeDataMock.mockRejectedValue(new Error('analysis failed'))
        const { parseMetadataFromMediainfo } = await loadService()

        await expect(parseMetadataFromMediainfo('/tmp/movie.mkv', 'WEB-DL')).rejects.toThrow(TypeError)
        expect(fileHandle.close).toHaveBeenCalledTimes(1)
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
    ])('parses mediainfo metadata across branches: $name', async ({ sourceType, result, expected }) => {
        const { parseMetadataFromMediainfo } = await loadService()
        analyzeDataMock.mockResolvedValueOnce(result)

        const parsed = await parseMetadataFromMediainfo('/tmp/movie.mkv', sourceType)
        expect(parsed).toMatchObject(expected)
    })
})
