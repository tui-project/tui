import type { TrackerService } from '../tracker'
import { createUnit3dService } from '../unit3d-tracker'

export function createHunoTrackerService(url: string, apiKey: string): TrackerService {
    return createUnit3dService(url, apiKey)
}
