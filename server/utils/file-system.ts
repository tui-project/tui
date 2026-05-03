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
