import { defineNitroPlugin } from 'nitropack/runtime'
import { getSettings } from '../repositories/settings-repository'
import { setLogLevel } from '../utils/logger'

export default defineNitroPlugin(async () => {
    const settings = await getSettings()
    setLogLevel(settings.logLevel)
})
