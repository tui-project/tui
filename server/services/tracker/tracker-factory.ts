import { getSettings } from '../../repositories/settings-repository'
import type { TrackerService } from './tracker'
import { athTrackerService } from './trackers/ath'
import { ulcxTrackerService } from './trackers/ulcx'

export async function createTrackerService(code: string): Promise<TrackerService> {
    const settings = await getSettings()
    const tracker = settings.trackers.find((t) => t.code === code)

    if (!tracker?.url) throw new Error(`URL not configured for tracker: ${code}`)
    if (!tracker?.apiKey) throw new Error(`API key not configured for tracker: ${code}`)

    switch (tracker.code) {
        case 'ULCX':
            return ulcxTrackerService(tracker.url, tracker.apiKey)
        case 'ATH':
            return athTrackerService(tracker.url, tracker.apiKey)
        default:
            throw new Error(`No tracker service registered for code: ${code}`)
    }
}
