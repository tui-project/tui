// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest'

describe('usePreviewImageLoadingState composable', () => {
    it('does nothing when preview state is incomplete', async () => {
        const { usePreviewImageLoadingState } = await import('../../../../app/composables/usePreviewImageLoadingState')
        const { applyImageLoading } = usePreviewImageLoadingState()
        const preview = document.createElement('div')

        expect(() => applyImageLoading(undefined, true, true)).not.toThrow()
        applyImageLoading(preview as HTMLDivElement, false, true)
        applyImageLoading(preview as HTMLDivElement, true, false)

        expect(preview.querySelectorAll('img')).toHaveLength(0)
    })

    it('clears skeleton classes immediately for already loaded images', async () => {
        const { usePreviewImageLoadingState } = await import('../../../../app/composables/usePreviewImageLoadingState')
        const { applyImageLoading } = usePreviewImageLoadingState()
        const preview = document.createElement('div')
        const image = document.createElement('img')

        image.classList.add('animate-pulse', 'rounded-md', 'bg-elevated', 'h-28', 'max-w-[500px]', 'opacity-0')
        Object.defineProperty(image, 'complete', { configurable: true, get: () => true })
        preview.append(image)

        applyImageLoading(preview as HTMLDivElement, true, true)

        expect(image.classList.contains('animate-pulse')).toBe(false)
        expect(image.dataset.skeletonBound).toBeUndefined()
    })

    it('adds and clears skeleton classes for async image loading without binding twice', async () => {
        const { usePreviewImageLoadingState } = await import('../../../../app/composables/usePreviewImageLoadingState')
        const { applyImageLoading } = usePreviewImageLoadingState()
        const preview = document.createElement('div')
        const image = document.createElement('img')

        Object.defineProperty(image, 'complete', { configurable: true, get: () => false })
        preview.append(image)

        applyImageLoading(preview as HTMLDivElement, true, true)
        expect(image.classList.contains('animate-pulse')).toBe(true)
        expect(image.dataset.skeletonBound).toBe('1')

        applyImageLoading(preview as HTMLDivElement, true, true)
        image.dispatchEvent(new Event('error'))

        expect(image.classList.contains('animate-pulse')).toBe(false)
        expect(image.dataset.skeletonBound).toBeUndefined()
    })
})
