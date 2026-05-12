import { getSettings } from '../../repositories/settings-repository'
import type { TrackerService } from './tracker'
import { createAthTrackerService } from './trackers/ath'
import { createHunoTrackerService } from './trackers/huno'
import { createLstTrackerService } from './trackers/lst'
import { createRfxTrackerService } from './trackers/rfx'
import { createSpTrackerService } from './trackers/sp'
import { createUlcxTrackerService } from './trackers/ulcx'

export async function createTrackerService(code: string): Promise<TrackerService> {
    const settings = await getSettings()
    const tracker = settings.trackers.find((t) => t.code === code)

    if (!tracker?.url) throw new Error(`URL not configured for tracker: ${code}`)
    if (!tracker?.apiKey) throw new Error(`API key not configured for tracker: ${code}`)

    switch (code) {
        case 'ULCX':
            return createUlcxTrackerService(tracker.url, tracker.apiKey)
        case 'RFX':
            return createRfxTrackerService(tracker.url, tracker.apiKey)
        case 'HUNO':
            return createHunoTrackerService(tracker.url, tracker.apiKey)
        case 'SP':
            return createSpTrackerService(tracker.url, tracker.apiKey)
        case 'LST':
            return createLstTrackerService(tracker.url, tracker.apiKey)
        case 'ATH':
            return createAthTrackerService(tracker.url, tracker.apiKey)
        default:
            throw new Error(`No tracker service registered for code: ${code}`)
    }
}
