import { describe, expect, it, vi } from 'vitest'

vi.mock('node:fs/promises', () => ({ readFile: vi.fn().mockResolvedValue(Buffer.from('data')) }))
vi.mock('../../../../../server/utils/logger', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

describe('simple UNIT3D tracker wrappers', () => {
    it.each([
        ['ATH', '../../../../../server/services/tracker/trackers/ath', 'createAthTrackerService'],
        ['HUNO', '../../../../../server/services/tracker/trackers/huno', 'createHunoTrackerService'],
        ['LST', '../../../../../server/services/tracker/trackers/lst', 'createLstTrackerService'],
        ['RFX', '../../../../../server/services/tracker/trackers/rfx', 'createRfxTrackerService'],
        ['SP', '../../../../../server/services/tracker/trackers/sp', 'createSpTrackerService'],
        ['ULCX', '../../../../../server/services/tracker/trackers/ulcx', 'createUlcxTrackerService'],
    ] as const)('%s returns a valid TrackerService', async (_code, modulePath, factoryFn) => {
        const mod = await import(modulePath)
        const service = (mod as Record<string, (url: string, apiKey: string) => unknown>)[factoryFn]('https://tracker.example.com', 'apikey')
        expect(typeof (service as { getTitle: unknown }).getTitle).toBe('function')
        expect(typeof (service as { upload: unknown }).upload).toBe('function')
    })
})
