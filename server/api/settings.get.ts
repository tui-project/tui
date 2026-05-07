import { getSettings } from '../repositories/settings-repository'
import { toSettingsResponse } from './settings-response'
import { logger } from '../utils/logger'

export default defineEventHandler(async () => {
    logger.trace('Settings fetch request received.')

    const settings = await getSettings()
    return toSettingsResponse(settings)
})
