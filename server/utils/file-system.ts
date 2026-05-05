import { sep } from 'node:path'

export interface MediaPathItem {
    path: string
    folder: boolean
}

export function sortPathItems(items: MediaPathItem[]) {
    return items.sort((left, right) => {
        const typeOrder = Number(left.folder) - Number(right.folder)
        if (typeOrder !== 0) {
            return -typeOrder
        }

        return left.path.localeCompare(right.path)
    })
}

export function isWithinAnyRoot(pathToCheck: string, allowedRoots: string[]) {
    return allowedRoots.some((rootPath) => pathToCheck === rootPath || pathToCheck.startsWith(`${rootPath}${sep}`))
}
