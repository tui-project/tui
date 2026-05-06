const previewImageLoadingClassList = ['animate-pulse', 'rounded-md', 'bg-elevated', 'h-28', 'max-w-[500px]', 'opacity-0']

export function usePreviewImageLoadingState() {
    function applyImageLoading(previewElement: HTMLDivElement | undefined, isPreviewTab: boolean, hasDescription: boolean) {
        if (!previewElement || !isPreviewTab || !hasDescription) {
            return
        }

        const images = Array.from(previewElement.querySelectorAll('img'))

        for (const image of images) {
            if (image.complete) {
                image.classList.remove(...previewImageLoadingClassList)
                delete image.dataset.skeletonBound
                continue
            }

            image.classList.add(...previewImageLoadingClassList)
            if (image.dataset.skeletonBound === '1') {
                continue
            }

            image.dataset.skeletonBound = '1'
            const clearLoadingState = () => {
                image.classList.remove(...previewImageLoadingClassList)
                delete image.dataset.skeletonBound
            }

            image.addEventListener('load', clearLoadingState, { once: true })
            image.addEventListener('error', clearLoadingState, { once: true })
        }
    }

    return {
        applyImageLoading,
    }
}
