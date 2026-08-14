import { getSettings } from '../repositories/settings-repository'
import { toSettingsResponse } from './settings-response'
import { createLogger } from '../utils/logger'

const logger = createLogger('API')

export default defineEventHandler(async () => {
    logger.trace('Get settings request received.')

    const settings = await getSettings()
    return toSettingsResponse(settings)
})
