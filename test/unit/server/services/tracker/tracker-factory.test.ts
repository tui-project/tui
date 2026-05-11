import { beforeEach, describe, expect, it, vi } from 'vitest'

const getSettings = vi.fn()

vi.mock('../../../../../server/repositories/settings-repository', () => ({ getSettings }))
vi.mock('../../../../../server/services/tracker/trackers/fnp', () => ({ createFnpTrackerService: vi.fn(() => ({ getTitle: vi.fn(), upload: vi.fn() })) }))
vi.mock('../../../../../server/services/tracker/trackers/ulcx', () => ({ createUlcxTrackerService: vi.fn(() => ({ getTitle: vi.fn(), upload: vi.fn() })) }))
vi.mock('../../../../../server/services/tracker/trackers/rfx', () => ({ createRfxTrackerService: vi.fn(() => ({ getTitle: vi.fn(), upload: vi.fn() })) }))
vi.mock('../../../../../server/services/tracker/trackers/huno', () => ({ createHunoTrackerService: vi.fn(() => ({ getTitle: vi.fn(), upload: vi.fn() })) }))
vi.mock('../../../../../server/services/tracker/trackers/sp', () => ({ createSpTrackerService: vi.fn(() => ({ getTitle: vi.fn(), upload: vi.fn() })) }))
vi.mock('../../../../../server/services/tracker/trackers/lst', () => ({ createLstTrackerService: vi.fn(() => ({ getTitle: vi.fn(), upload: vi.fn() })) }))
vi.mock('../../../../../server/services/tracker/trackers/ath', () => ({ createAthTrackerService: vi.fn(() => ({ getTitle: vi.fn(), upload: vi.fn() })) }))

const TRACKER_CODES = ['FNP', 'ULCX', 'RFX', 'HUNO', 'SP', 'LST', 'ATH']

beforeEach(() => {
    getSettings.mockResolvedValue({
        trackers: TRACKER_CODES.map((code) => ({ code, url: `https://${code.toLowerCase()}.example.com`, apiKey: 'key123' })),
    })
})

describe('createTrackerService', () => {
    it.each(TRACKER_CODES)('returns a tracker service for %s', async (code) => {
        const { createTrackerService } = await import('../../../../../server/services/tracker/tracker-factory')
        const service = await createTrackerService(code)
        expect(service).toBeDefined()
        expect(typeof service.getTitle).toBe('function')
        expect(typeof service.upload).toBe('function')
    })

    it('throws when URL is not configured', async () => {
        getSettings.mockResolvedValue({
            trackers: [{ code: 'FNP', url: '', apiKey: 'key123' }],
        })
        const { createTrackerService } = await import('../../../../../server/services/tracker/tracker-factory')
        await expect(createTrackerService('FNP')).rejects.toThrow('URL not configured for tracker: FNP')
    })

    it('throws when API key is not configured', async () => {
        getSettings.mockResolvedValue({
            trackers: [{ code: 'FNP', url: 'https://fnp.example.com', apiKey: '' }],
        })
        const { createTrackerService } = await import('../../../../../server/services/tracker/tracker-factory')
        await expect(createTrackerService('FNP')).rejects.toThrow('API key not configured for tracker: FNP')
    })

    it('throws when tracker code is not registered', async () => {
        getSettings.mockResolvedValue({
            trackers: [{ code: 'UNKNOWN', url: 'https://unknown.example.com', apiKey: 'key' }],
        })
        const { createTrackerService } = await import('../../../../../server/services/tracker/tracker-factory')
        await expect(createTrackerService('UNKNOWN')).rejects.toThrow('No tracker service registered for code: UNKNOWN')
    })

    it('throws when tracker is not found in settings', async () => {
        getSettings.mockResolvedValue({ trackers: [] })
        const { createTrackerService } = await import('../../../../../server/services/tracker/tracker-factory')
        await expect(createTrackerService('FNP')).rejects.toThrow('URL not configured for tracker: FNP')
    })
})
