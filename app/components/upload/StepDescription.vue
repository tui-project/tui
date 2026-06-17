<script setup lang="ts">
import { useBbcodeRender } from '~/composables/useBbcodeRender'
import { usePreviewImageLoadingState } from '~/composables/usePreviewImageLoadingState'
import { useScreenshots } from '~/composables/useScreenshots'
import StepNavigationButtons from './StepNavigationButtons.vue'

const description = defineModel<string>({ default: '' })
const props = defineProps<{
    selectedPath?: Path
    isHdr?: boolean
    isTv?: boolean
}>()
const emit = defineEmits<{
    back: []
    next: []
}>()

type ToolbarAction = {
    label: string
    icon: string
    openTag: string
    closeTag: string
}

const activeTab = ref<'write' | 'preview'>('write')
const editor = ref<HTMLTextAreaElement>()
const preview = ref<HTMLDivElement>()

const { toHtml, error } = useBbcodeRender()
const { applyImageLoading } = usePreviewImageLoadingState()
const { createScreenshots, loading: isGeneratingScreenshots, error: hasScreenshotError, errorMessage: screenshotErrorMessage, clearError: clearScreenshotError } = useScreenshots()

const toolbarActions: ToolbarAction[] = [
    { label: 'Bold', icon: 'i-lucide-bold', openTag: '[b]', closeTag: '[/b]' },
    { label: 'Italic', icon: 'i-lucide-italic', openTag: '[i]', closeTag: '[/i]' },
    { label: 'Underline', icon: 'i-lucide-underline', openTag: '[u]', closeTag: '[/u]' },
    { label: 'Spoiler', icon: 'i-lucide-eye-off', openTag: '[spoiler]', closeTag: '[/spoiler]' },
    { label: 'Quote', icon: 'i-lucide-quote', openTag: '[quote]', closeTag: '[/quote]' },
    { label: 'Code', icon: 'i-lucide-code', openTag: '[code]', closeTag: '[/code]' },
]

const tuiVersion = 'beta'
const tuiProjectUrl = 'https://github.com/tui-project/tui'
const previewFooter = `[right][url=${tuiProjectUrl}]Uploaded using Tui v ${tuiVersion}[/url][/right]`

const hasDescription = computed(() => description.value.trim().length > 0)
const previewBody = computed(() => (hasDescription.value ? description.value : 'Preview your BBCode description here before uploading.'))
const previewContent = computed(() => `${previewBody.value}\n\n${previewFooter}`)
const renderedPreview = computed(() => toHtml(previewContent.value))

watch([activeTab, renderedPreview], async () => {
    await nextTick()
    applyImageLoading(preview.value, activeTab.value === 'preview', hasDescription.value)
})

function insertTag(action: ToolbarAction) {
    const textarea = editor.value

    if (!textarea) {
        description.value = `${description.value}${action.openTag}${action.closeTag}`
        return
    }

    const { selectionStart: start, selectionEnd: end } = textarea
    const selectedText = description.value.slice(start, end)

    description.value = [description.value.slice(0, start), action.openTag, selectedText, action.closeTag, description.value.slice(end)].join('')

    nextTick(() => {
        textarea.focus()

        const cursorStart = start + action.openTag.length
        const cursorEnd = cursorStart + selectedText.length
        textarea.setSelectionRange(cursorStart, cursorEnd)
    })
}

function insertText(snippet: string) {
    const textarea = editor.value

    if (!textarea) {
        description.value = `${description.value}${snippet}`
        return
    }

    const { selectionStart: start, selectionEnd: end } = textarea

    description.value = [description.value.slice(0, start), snippet, description.value.slice(end)].join('')

    nextTick(() => {
        textarea.focus()
        const cursor = start + snippet.length
        textarea.setSelectionRange(cursor, cursor)
    })
}

async function addScreenshots() {
    if (!props.selectedPath?.value || isGeneratingScreenshots.value) {
        return
    }

    clearScreenshotError()

    const response = await createScreenshots(props.selectedPath.value, props.isHdr ?? false, props.isTv ?? false)
    if (!response) {
        return
    }

    const orderedScreenshots = [...response.screenshots].sort((left, right) => left.order - right.order)

    const block = orderedScreenshots.map((screenshot) => `[url=${screenshot.url}][img=500]${screenshot.thumbnailUrl}[/img][/url]`).join(' ')

    const needsLeadingNewLine = description.value.length > 0 && !description.value.endsWith('\n')
    const prefix = `${needsLeadingNewLine ? '\n' : ''}[center]\n[font=Courier New][size=26]Screenshots[/size][/font]\n`
    const suffix = '\n[/center]\n'
    const hdrDisclaimer = props.isHdr ? '\n[i]Screenshots were tone mapped from HDR to SDR for reference.[/i]' : ''

    insertText(`${prefix}${block}${hdrDisclaimer}${suffix}`)
}
</script>

<template>
    <UCard>
        <template #header>
            <div class="space-y-2">
                <h2 class="text-lg font-medium">Description</h2>
                <p class="text-sm text-muted">Add the release notes and BBCode details you want included with this upload.</p>
            </div>
        </template>

        <div class="overflow-hidden rounded-xl border border-default bg-elevated/20 shadow-xs">
            <div class="flex items-center justify-between gap-3 border-b border-default px-4 pt-3">
                <div class="flex items-center gap-2">
                    <UButton label="Write" color="neutral" :variant="activeTab === 'write' ? 'solid' : 'ghost'" @click="activeTab = 'write'" />
                    <UButton label="Preview" color="neutral" :variant="activeTab === 'preview' ? 'solid' : 'ghost'" @click="activeTab = 'preview'" />
                </div>

                <span class="text-xs text-muted"> BBCode formatting supported </span>
            </div>

            <div v-if="activeTab === 'write'" class="border-b border-default px-4 py-3">
                <div class="flex items-start justify-between gap-3">
                    <div class="flex flex-wrap gap-2">
                        <UButton
                            v-for="action in toolbarActions"
                            :key="action.label"
                            color="neutral"
                            variant="ghost"
                            size="sm"
                            :icon="action.icon"
                            :aria-label="action.label"
                            :disabled="isGeneratingScreenshots"
                            @click="insertTag(action)"
                        />
                    </div>
                    <UButton
                        label="Add screenshots"
                        color="neutral"
                        variant="ghost"
                        size="sm"
                        icon="i-lucide-images"
                        class="shrink-0"
                        :disabled="!props.selectedPath?.value"
                        :loading="isGeneratingScreenshots"
                        @click="addScreenshots"
                    />
                </div>
            </div>

            <div class="p-4">
                <UAlert v-if="hasScreenshotError" color="error" variant="soft" :title="screenshotErrorMessage" class="mb-2" />
                <UAlert v-if="error" color="error" variant="soft" :title="error" class="mb-2" />
                <template v-if="activeTab === 'write'">
                    <label for="upload-description" class="sr-only"> Description </label>
                    <textarea
                        id="upload-description"
                        ref="editor"
                        v-model="description"
                        :disabled="isGeneratingScreenshots"
                        class="min-h-72 w-full resize-y rounded-lg border border-default bg-default px-4 py-3 text-sm text-highlighted outline-none transition focus:border-inverted"
                        placeholder="Description"
                    />
                </template>
                <div v-else class="min-h-72 whitespace-pre-wrap rounded-lg border border-dashed border-default bg-default px-4 py-3 text-sm text-toned">
                    <!-- eslint-disable vue/no-v-html -->
                    <div ref="preview" class="overflow-auto" v-html="renderedPreview" />
                    <!-- eslint-enable vue/no-v-html -->
                </div>
            </div>
        </div>

        <StepNavigationButtons :back="{ disabled: isGeneratingScreenshots }" :next="{ disabled: isGeneratingScreenshots }" @back="emit('back')" @next="emit('next')" />
    </UCard>
</template>
