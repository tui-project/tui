import { getSettings } from '../repositories/settings-repository'
import { logger } from '../utils/logger'

export default defineEventHandler(async () => {
    logger.trace('Settings fetch request received.')

    const settings = await getSettings()
    const { id: _id, ...settingsWithoutId } = settings

    return settingsWithoutId
})
