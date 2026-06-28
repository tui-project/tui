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

    function videoTrack(overrides: Record<string, unknown> = {}) {
        return { '@type': 'Video', Height: '1080', ScanType: 'Progressive', Format: 'AVC', HDR_Format: '', HDR_Format_Compatibility: '', ...overrides }
    }

    function audioTrack(overrides: Record<string, unknown> = {}) {
        return { '@type': 'Audio', Default: 'Yes', Format: 'AAC', Channels: '2', ChannelLayout: 'L R', Language: 'en', Title: 'Main', ...overrides }
    }

    function textTrack(language: string) {
        return { '@type': 'Text', Language: language }
    }

    function generalTrack(extra?: unknown) {
        return { '@type': 'General', ...(extra !== undefined ? { extra } : {}) }
    }

    function mockTracks(...tracks: unknown[]) {
        runCommandMock.mockResolvedValueOnce({ stdout: JSON.stringify({ media: { track: tracks } }) })
    }

    describe('analyzeMediaFileAsText', () => {
        it('returns text from mediainfo', async () => {
            runCommandMock.mockResolvedValue({ stdout: 'General\nComplete name                            : movie.mkv' })
            const { analyzeMediaFileAsText } = await loadService()

            await expect(analyzeMediaFileAsText('/tmp/movie.mkv')).resolves.toContain('Complete name')
            expect(runCommandMock).toHaveBeenCalledWith('/usr/bin/mediainfo', ['/tmp/movie.mkv'])
        })

        it('returns empty string when the command fails', async () => {
            runCommandMock.mockRejectedValueOnce(new Error('text analysis failed'))
            const { analyzeMediaFileAsText } = await loadService()

            await expect(analyzeMediaFileAsText('/tmp/movie.mkv')).resolves.toBe('')
        })
    })

    describe('parseMetadataFromMediainfo', () => {
        it('falls back to the first audio track when none is marked Default', async () => {
            mockTracks(
                videoTrack(),
                audioTrack({ Default: 'No', Format: 'DTS', Channels: '6', ChannelLayout: 'L R C LFE Ls Rs', Title: 'First' }),
                audioTrack({ Default: 'No', Format: 'AAC', Channels: '2', ChannelLayout: 'L R', Title: 'Second' })
            )
            const { parseMetadataFromMediainfo } = await loadService()

            const result = await parseMetadataFromMediainfo('/tmp/movie.mkv', 'REMUX')
            expect(result.audioCodec).toBe('DTS')
        })

        it('calls mediainfo with --Output=JSON flag', async () => {
            mockTracks(videoTrack(), audioTrack())
            const { parseMetadataFromMediainfo } = await loadService()

            await parseMetadataFromMediainfo('/tmp/movie.mkv', 'WEB-DL')
            expect(runCommandMock).toHaveBeenCalledWith('/usr/bin/mediainfo', ['--Output=JSON', '/tmp/movie.mkv'])
        })

        it('throws TypeError when the mediainfo command fails', async () => {
            runCommandMock.mockRejectedValueOnce(new Error('analysis failed'))
            const { parseMetadataFromMediainfo } = await loadService()

            await expect(parseMetadataFromMediainfo('/tmp/movie.mkv', 'WEB-DL')).rejects.toThrow(TypeError)
        })

        describe('resolution', () => {
            it.each([
                { height: '4320', scanType: 'Progressive', expected: '4320p' },
                { height: '2160', scanType: 'Progressive', expected: '2160p' },
                { height: '2074', scanType: 'Progressive', expected: '2160p' },
                { height: '1744', scanType: 'Progressive', expected: '2160p' },
                { height: '1080', scanType: 'Progressive', expected: '1080p' },
                { height: '1080', scanType: 'Interlaced', expected: '1080i' },
                { height: '1080', scanType: 'MBAFF', expected: '1080i' },
                { height: '1072', scanType: 'Progressive', expected: '1080p' },
                { height: '1072', scanType: 'Interlaced', expected: '1080i' },
                { height: '1040', scanType: 'Progressive', expected: '1080p' },
                { height: '1040', scanType: 'Interlaced', expected: '1080i' },
                { height: '1036', scanType: 'Progressive', expected: '1080p' },
                { height: '1036', scanType: 'Interlaced', expected: '1080i' },
                { height: '720', scanType: 'Progressive', expected: '720p' },
                { height: '576', scanType: 'Progressive', expected: '576p' },
                { height: '576', scanType: 'Interlaced', expected: '576i' },
                { height: '480', scanType: 'Progressive', expected: '480p' },
                { height: '480', scanType: 'Interlaced', expected: '480i' },
            ])('$height $scanType → $expected', async ({ height, scanType, expected }) => {
                mockTracks(videoTrack({ Height: height, ScanType: scanType }), audioTrack())
                const { parseMetadataFromMediainfo } = await loadService()

                const result = await parseMetadataFromMediainfo('/tmp/movie.mkv', 'REMUX')
                expect(result.resolution).toBe(expected)
            })

            it('returns undefined when height is absent', async () => {
                mockTracks(videoTrack({ Height: '' }), audioTrack())
                const { parseMetadataFromMediainfo } = await loadService()

                const result = await parseMetadataFromMediainfo('/tmp/movie.mkv', 'REMUX')
                expect(result.resolution).toBeUndefined()
            })

            it('returns undefined when height exceeds all known buckets', async () => {
                mockTracks(videoTrack({ Height: '99999' }), audioTrack())
                const { parseMetadataFromMediainfo } = await loadService()

                const result = await parseMetadataFromMediainfo('/tmp/movie.mkv', 'REMUX')
                expect(result.resolution).toBeUndefined()
            })
        })

        describe('frameRate', () => {
            it('parses a decimal FrameRate value', async () => {
                mockTracks(videoTrack({ FrameRate: '23.976' }), audioTrack())
                const { parseMetadataFromMediainfo } = await loadService()

                const result = await parseMetadataFromMediainfo('/tmp/movie.mkv', 'WEB-DL')
                expect(result.frameRate).toBe(23.976)
            })

            it('returns undefined when FrameRate contains no digits', async () => {
                mockTracks(videoTrack({ FrameRate: 'N/A' }), audioTrack())
                const { parseMetadataFromMediainfo } = await loadService()

                const result = await parseMetadataFromMediainfo('/tmp/movie.mkv', 'WEB-DL')
                expect(result.frameRate).toBeUndefined()
            })
        })

        describe('videoCodec', () => {
            it.each([
                { format: 'AVC', sourceType: 'WEB-DL' as const, expected: 'H.264' },
                { format: 'AVC', sourceType: 'WEBRIP' as const, expected: 'x264' },
                { format: 'AVC', sourceType: 'REMUX' as const, expected: 'AVC' },
                { format: 'HEVC', sourceType: 'WEB-DL' as const, expected: 'H.265' },
                { format: 'HEVC', sourceType: 'WEBRIP' as const, expected: 'x265' },
                { format: 'HEVC', sourceType: 'REMUX' as const, expected: 'HEVC' },
                { format: 'VC-1', sourceType: 'REMUX' as const, expected: 'VC-1' },
                { format: 'VP9', sourceType: 'REMUX' as const, expected: 'VP9' },
                { format: 'AV1', sourceType: 'REMUX' as const, expected: 'AV1' },
            ])('$format ($sourceType) → $expected', async ({ format, sourceType, expected }) => {
                mockTracks(videoTrack({ Format: format }), audioTrack())
                const { parseMetadataFromMediainfo } = await loadService()

                const result = await parseMetadataFromMediainfo('/tmp/movie.mkv', sourceType)
                expect(result.videoCodec).toBe(expected)
            })

            it.each([
                { version: '1', expected: 'MPEG-1' },
                { version: '2', expected: 'MPEG-2' },
            ])('MPEG Video version $version → $expected', async ({ version, expected }) => {
                mockTracks(videoTrack({ Format: 'MPEG Video', Format_Version: version }), audioTrack())
                const { parseMetadataFromMediainfo } = await loadService()

                const result = await parseMetadataFromMediainfo('/tmp/movie.mkv', 'REMUX')
                expect(result.videoCodec).toBe(expected)
            })
        })

        describe('videoStandard', () => {
            it.each([
                { standard: 'NTSC', expected: 'NTSC' },
                { standard: 'PAL', expected: 'PAL' },
            ])('Standard "$standard" → $expected', async ({ standard, expected }) => {
                mockTracks(videoTrack({ Standard: standard }), audioTrack())
                const { parseMetadataFromMediainfo } = await loadService()

                const result = await parseMetadataFromMediainfo('/tmp/movie.mkv', 'REMUX')
                expect(result.videoStandard).toBe(expected)
            })

            it('returns undefined when Standard is absent', async () => {
                mockTracks(videoTrack(), audioTrack())
                const { parseMetadataFromMediainfo } = await loadService()

                const result = await parseMetadataFromMediainfo('/tmp/movie.mkv', 'REMUX')
                expect(result.videoStandard).toBeUndefined()
            })
        })

        describe('hi10p', () => {
            it.each([
                { format: 'AVC', profile: 'High 10@L4.1', expected: true },
                { format: 'AVC', profile: 'High@L4.1', expected: false },
                { format: 'AVC', profile: '', expected: false },
                { format: 'HEVC', profile: 'High 10@L4.1', expected: false },
            ])('$format profile="$profile" → $expected', async ({ format, profile, expected }) => {
                mockTracks(videoTrack({ Format: format, Format_Profile: profile }), audioTrack())
                const { parseMetadataFromMediainfo } = await loadService()

                const result = await parseMetadataFromMediainfo('/tmp/movie.mkv', 'WEB-DL')
                expect(result.hi10p).toBe(expected)
            })
        })

        describe('hdr', () => {
            it.each([
                { hdrFormat: 'Dolby Vision', compat: '', expected: ['DV'] },
                { hdrFormat: 'Dolby Vision HLG', compat: '', expected: ['DV', 'HLG'] },
                { hdrFormat: 'HDR10+', compat: '', expected: ['HDR10+'] },
                { hdrFormat: 'HDR', compat: '', expected: ['HDR'] },
                { hdrFormat: 'SMPTE ST 2086', compat: 'HDR10', expected: ['HDR'] },
                { hdrFormat: 'SMPTE ST 2086', compat: 'HDR10+', expected: ['HDR10+'] },
                { hdrFormat: 'Unknown HDR', compat: 'HDR10+', expected: ['HDR', 'HDR10+'] },
                { hdrFormat: 'GammaTone', compat: 'CompatX', expected: [] },
                { hdrFormat: '', compat: '', expected: [] },
                { hdrFormat: '<nil>', compat: '<nil>', expected: [] },
            ])('$hdrFormat / "$compat" → $expected', async ({ hdrFormat, compat, expected }) => {
                mockTracks(videoTrack({ HDR_Format: hdrFormat, HDR_Format_Compatibility: compat }), audioTrack())
                const { parseMetadataFromMediainfo } = await loadService()

                const result = await parseMetadataFromMediainfo('/tmp/movie.mkv', 'WEB-DL')
                expect(result.hdr).toEqual(expected)
            })
        })

        describe('audioCodec', () => {
            it.each([
                { format: 'E-AC-3', commercial: '', expected: 'DD+' },
                { format: 'EAC3', commercial: '', expected: 'DD+' },
                { format: 'DDP', commercial: '', expected: 'DD+' },
                { format: 'AC-3', commercial: '', expected: 'DD' },
                { format: 'AC3', commercial: '', expected: 'DD' },
                { format: 'DD', commercial: '', expected: 'DD' },
                { format: 'AAC', commercial: '', expected: 'AAC' },
                { format: 'DTS', commercial: 'DTS-HD Master Audio', expected: 'DTS-HD MA' },
                { format: 'DTS', commercial: 'DTS-HD MA + DTS:X', expected: 'DTS:X' },
                { format: 'DTS', commercial: '', expected: 'DTS' },
                { format: 'FLAC', commercial: '', expected: 'FLAC' },
                { format: 'MLP FBA', commercial: '', expected: 'TrueHD' },
                { format: 'MLP FBA', commercial: 'Auro3D', expected: 'TrueHD' },
                { format: 'UNKNOWN', commercial: '', expected: undefined },
            ])('$format ($commercial || generic) → $expected', async ({ format, commercial, expected }) => {
                mockTracks(videoTrack(), audioTrack({ Format: format, Format_Commercial_IfAny: commercial }))
                const { parseMetadataFromMediainfo } = await loadService()

                const result = await parseMetadataFromMediainfo('/tmp/movie.mkv', 'REMUX')
                expect(result.audioCodec).toBe(expected)
            })
        })

        describe('audioChannels', () => {
            it.each([
                { channels: '1', layout: 'C', expected: '1.0' },
                { channels: '2', layout: 'L R', expected: '2.0' },
                { channels: '3', layout: 'L R C', expected: '3.0' },
                { channels: '6', layout: 'C L R Ls Rs LFE', expected: '5.1' },
                { channels: '6', layout: 'L R C LFE Ls Rs', expected: '5.1' },
                { channels: '7', layout: 'C L R Ls Rs LFE Cb', expected: '6.1' },
                { channels: '8', layout: 'C L R Ls Rs Lb Rb LFE', expected: '7.1' },
                { channels: '8', layout: 'L R C LFE Ls Rs Lb Rb', expected: '7.1' },
                { channels: '8', layout: 'C L R Ls Rs LFE Lw Rw', expected: '7.1' },
                { channels: '8', layout: 'C L R LFE Lb Rb Lss Rss Objects', expected: '7.1' },
                { channels: '9', layout: 'Unknown', expected: undefined },
            ])('$channels ch / "$layout" → $expected', async ({ channels, layout, expected }) => {
                mockTracks(videoTrack(), audioTrack({ Channels: channels, ChannelLayout: layout }))
                const { parseMetadataFromMediainfo } = await loadService()

                const result = await parseMetadataFromMediainfo('/tmp/movie.mkv', 'REMUX')
                expect(result.audioChannels).toBe(expected)
            })
        })

        describe('audioMetadata', () => {
            it.each([
                { commercial: 'Dolby Digital Plus with Atmos', title: 'Main', expected: 'Atmos' },
                { commercial: 'DTS-HD Master Audio', title: 'Main Atmos', expected: 'Atmos' },
                { commercial: 'Auro3D', title: 'Main', expected: 'Auro3D' },
                { commercial: 'DTS-HD Master Audio', title: 'Main Auro3D', expected: 'Auro3D' },
                { commercial: 'Dolby Digital Plus', title: 'Main', expected: undefined },
                { commercial: '', title: 'Main', expected: undefined },
                { commercial: 'DTS-HD Master Audio', title: 'Main', expected: undefined },
            ])('commercial="$commercial" title="$title" → $expected', async ({ commercial, title, expected }) => {
                mockTracks(videoTrack(), audioTrack({ Format_Commercial_IfAny: commercial, Title: title }))
                const { parseMetadataFromMediainfo } = await loadService()

                const result = await parseMetadataFromMediainfo('/tmp/movie.mkv', 'REMUX')
                expect(result.audioMetadata).toBe(expected)
            })
        })

        describe('language', () => {
            it('strips region suffix from language code', async () => {
                mockTracks(videoTrack(), audioTrack({ Language: 'en-US' }))
                const { parseMetadataFromMediainfo } = await loadService()

                const result = await parseMetadataFromMediainfo('/tmp/movie.mkv', 'WEB-DL')
                expect(result.language).toEqual(['en'])
            })

            it('lowercases a bare uppercase language code', async () => {
                mockTracks(videoTrack(), audioTrack({ Language: 'JA' }))
                const { parseMetadataFromMediainfo } = await loadService()

                const result = await parseMetadataFromMediainfo('/tmp/movie.mkv', 'WEB-DL')
                expect(result.language).toEqual(['ja'])
            })

            it('deduplicates and sorts multiple languages', async () => {
                mockTracks(
                    videoTrack(),
                    audioTrack({ Default: 'Yes', Language: 'fr-CA', Title: 'French' }),
                    audioTrack({ Default: 'No', Language: 'en-US', Title: 'English' }),
                    audioTrack({ Default: 'No', Language: 'fr-FR', Title: 'French 2' })
                )
                const { parseMetadataFromMediainfo } = await loadService()

                const result = await parseMetadataFromMediainfo('/tmp/movie.mkv', 'WEB-DL')
                expect(result.language).toEqual(['en', 'fr'])
            })

            it('excludes commentary tracks', async () => {
                mockTracks(
                    videoTrack(),
                    audioTrack({ Default: 'Yes', Language: 'en-US', Title: 'Main' }),
                    audioTrack({ Default: 'No', Language: 'en-US', Title: 'Commentary by Director' })
                )
                const { parseMetadataFromMediainfo } = await loadService()

                const result = await parseMetadataFromMediainfo('/tmp/movie.mkv', 'WEB-DL')
                expect(result.language).toEqual(['en'])
            })

            it('excludes tracks with blank or whitespace-only language', async () => {
                mockTracks(videoTrack(), audioTrack({ Default: 'Yes', Language: '   ', Title: 'Main' }), audioTrack({ Default: 'No', Language: 'FR', Title: 'French' }))
                const { parseMetadataFromMediainfo } = await loadService()

                const result = await parseMetadataFromMediainfo('/tmp/movie.mkv', 'WEB-DL')
                expect(result.language).toEqual(['fr'])
            })

            it('treats "<nil>" language as absent', async () => {
                mockTracks(videoTrack(), audioTrack({ Language: '<nil>' }))
                const { parseMetadataFromMediainfo } = await loadService()

                const result = await parseMetadataFromMediainfo('/tmp/movie.mkv', 'WEB-DL')
                expect(result.language).toEqual([])
            })
        })

        describe('hasTrueHDCompatibilityTrack', () => {
            it.each([{ compatFormat: 'AC-3' }, { compatFormat: 'E-AC-3' }])('is true when TrueHD is paired with a $compatFormat track', async ({ compatFormat }) => {
                mockTracks(audioTrack({ Format: 'MLP FBA', Channels: '8', ChannelLayout: 'L R C LFE Ls Rs Lb Rb', Title: 'Main' }), {
                    '@type': 'Audio',
                    Default: 'No',
                    Format: compatFormat,
                    Channels: '6',
                    ChannelLayout: 'L R C LFE Ls Rs',
                    Language: 'en',
                    Title: 'Compat',
                })
                const { parseMetadataFromMediainfo } = await loadService()

                const result = await parseMetadataFromMediainfo('/tmp/movie.mkv', 'REMUX')
                expect(result.hasTrueHDCompatibilityTrack).toBe(true)
            })

            it('is false when TrueHD has no companion track', async () => {
                mockTracks(audioTrack({ Format: 'MLP FBA', Channels: '8', ChannelLayout: 'L R C LFE Ls Rs Lb Rb' }))
                const { parseMetadataFromMediainfo } = await loadService()

                const result = await parseMetadataFromMediainfo('/tmp/movie.mkv', 'REMUX')
                expect(result.hasTrueHDCompatibilityTrack).toBe(false)
            })

            it('is false when the only AC-3 track is a commentary', async () => {
                mockTracks(audioTrack({ Format: 'MLP FBA', Channels: '8', ChannelLayout: 'L R C LFE Ls Rs Lb Rb', Title: 'Main' }), {
                    '@type': 'Audio',
                    Default: 'No',
                    Format: 'AC-3',
                    Channels: '2',
                    ChannelLayout: 'L R',
                    Language: 'en',
                    Title: 'Commentary Track',
                })
                const { parseMetadataFromMediainfo } = await loadService()

                const result = await parseMetadataFromMediainfo('/tmp/movie.mkv', 'REMUX')
                expect(result.hasTrueHDCompatibilityTrack).toBe(false)
            })

            it('is undefined when the primary codec is not TrueHD', async () => {
                mockTracks(audioTrack({ Format: 'DTS', Format_Commercial_IfAny: 'DTS-HD Master Audio', Channels: '6', ChannelLayout: 'L R C LFE Ls Rs' }))
                const { parseMetadataFromMediainfo } = await loadService()

                const result = await parseMetadataFromMediainfo('/tmp/movie.mkv', 'REMUX')
                expect(result.hasTrueHDCompatibilityTrack).toBeUndefined()
            })
        })

        describe('hasEnglishSubs', () => {
            it.each([{ language: 'en' }, { language: 'en-US' }, { language: 'en-GB' }])('is true for Text track language "$language"', async ({ language }) => {
                mockTracks(audioTrack(), textTrack(language))
                const { parseMetadataFromMediainfo } = await loadService()

                const result = await parseMetadataFromMediainfo('/tmp/movie.mkv', 'WEB-DL')
                expect(result.hasEnglishSubs).toBe(true)
            })

            it('is false when no Text tracks exist', async () => {
                mockTracks(audioTrack())
                const { parseMetadataFromMediainfo } = await loadService()

                const result = await parseMetadataFromMediainfo('/tmp/movie.mkv', 'WEB-DL')
                expect(result.hasEnglishSubs).toBe(false)
            })

            it('is false when Text tracks exist but none are English', async () => {
                mockTracks(audioTrack(), textTrack('fr'), textTrack('de'))
                const { parseMetadataFromMediainfo } = await loadService()

                const result = await parseMetadataFromMediainfo('/tmp/movie.mkv', 'WEB-DL')
                expect(result.hasEnglishSubs).toBe(false)
            })
        })

        describe('ids from General track', () => {
            it.each([
                {
                    description: 'parses IMDB, tmdb:// prefix, and tvdb- prefix',
                    extra: { IMDB: 'tt123', TMDB: 'tmdb://55', TVDB: 'tvdb-66' },
                    expected: { imdbId: 'tt123', tmdbId: 55, tvdbId: 66 },
                },
                {
                    description: 'truncates decimal part of TMDB and TVDB ids',
                    extra: { IMDB: 'tt123', TMDB: 'tmdb://55.9', TVDB: 'tvdb-66.9' },
                    expected: { tmdbId: 55, tvdbId: 66 },
                },
                {
                    description: 'returns undefined for non-numeric TMDB and TVDB',
                    extra: { IMDB: 'tt999', TMDB: 'abc', TVDB: 'xyz' },
                    expected: { imdbId: 'tt999', tmdbId: undefined, tvdbId: undefined },
                },
            ])('$description', async ({ extra, expected }) => {
                mockTracks(generalTrack(extra), audioTrack())
                const { parseMetadataFromMediainfo } = await loadService()

                const result = await parseMetadataFromMediainfo('/tmp/movie.mkv', 'WEB-DL')
                expect(result).toMatchObject(expected)
            })

            it('returns empty imdbId when no General track is present', async () => {
                mockTracks(audioTrack())
                const { parseMetadataFromMediainfo } = await loadService()

                const result = await parseMetadataFromMediainfo('/tmp/movie.mkv', 'WEB-DL')
                expect(result.imdbId).toBe('')
            })

            it('handles a non-object extra field on the General track', async () => {
                mockTracks(generalTrack('<nil>'), audioTrack())
                const { parseMetadataFromMediainfo } = await loadService()

                const result = await parseMetadataFromMediainfo('/tmp/movie.mkv', 'WEB-DL')
                expect(result.imdbId).toBe('')
                expect(result.tmdbId).toBeUndefined()
                expect(result.tvdbId).toBeUndefined()
            })
        })
    })
})
