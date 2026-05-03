import type { MediaPathItem } from '../utils/file-system'

export interface DirectoryCache {
    path: string
    signature: string
    items: MediaPathItem[]
}
