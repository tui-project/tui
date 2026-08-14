import { getSettings } from '../../repositories/settings-repository'
import type { TrackerService } from './tracker'
import { athTrackerService } from './trackers/ath'
import { ulcxTrackerService } from './trackers/ulcx'
import { createLogger } from '../../utils/logger'

const logger = createLogger('tracker')

export async function createTrackerService(code: string): Promise<TrackerService> {
    logger.trace('Creating tracker service.', { trackerCode: code })

    const settings = await getSettings()
    const trackerSettings = settings.trackers.find((t) => t.code === code)

    if (!trackerSettings?.url) {
        logger.warn('Unable to create tracker service because its URL is not configured.', { trackerCode: code })
        throw new Error(`URL not configured for tracker: ${code}`)
    } else if (!trackerSettings.apiKey) {
        logger.warn('Unable to create tracker service because its API key is not configured.', { trackerCode: code })
        throw new Error(`API key not configured for tracker: ${code}`)
    }

    const service = (() => {
        switch (trackerSettings.code) {
            case 'ULCX':
                return ulcxTrackerService(trackerSettings.url, trackerSettings.apiKey)
            case 'ATH':
                return athTrackerService(trackerSettings.url, trackerSettings.apiKey)
            default:
                logger.error('Unable to create tracker service because its code is not registered.', { trackerCode: code })
                throw new Error(`No tracker service registered for code: ${code}`)
        }
    })()

    logger.trace('Tracker service created.', { trackerCode: code })

    return service
}
