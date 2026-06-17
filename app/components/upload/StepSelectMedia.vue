<script setup lang="ts">
import StepNavigationButtons from './StepNavigationButtons.vue'

const emit = defineEmits<{
    next: []
}>()
const selection = defineModel<Path | undefined>({
    default: undefined,
})

const parent = ref(selection.value?.folder ? selection.value.value.trim().replace(/\/+$/, '') : getParentDirectory(selection.value?.value))
const searchTerm = ref('')
const showError = ref(false)
const menuOpen = ref(false)

const { pending: loading, data: pathData, error, refresh } = useGetPaths(parent)

const menuItems = computed(() => pathData.value ?? [])
const shouldVirtualize = computed(() => menuItems.value.length > 50)

watch(error, (err) => {
    if (err && parent.value) {
        parent.value = ''
    }
})

watch(loading, (loading) => {
    if (!loading && selection.value) {
        menuOpen.value = true
    } else {
        menuOpen.value = false
    }
})

function onSelect(value: Path | null) {
    showError.value = false

    if (!value) {
        selection.value = undefined
        parent.value = ''
        return
    }

    selection.value = value

    if (value.folder) {
        parent.value = value.value
    }
}

function onSearchTermUpdate(value: string) {
    const trimmedValue = value.trim()
    if (!trimmedValue || trimmedValue === selection.value?.value) return

    const browseParent = getBrowseParent(trimmedValue)
    if (browseParent !== parent.value) {
        parent.value = browseParent
    }
}

function getBrowseParent(value: string) {
    if (value.endsWith('/')) {
        return getParentDirectory(value)
    }

    const lastSlashIndex = value.lastIndexOf('/')
    if (lastSlashIndex < 0) {
        return ''
    }

    return getParentDirectory(value.slice(0, lastSlashIndex + 1))
}

function getParentDirectory(value?: string) {
    const trimmed = value?.trim()
    if (!trimmed) {
        return ''
    }

    if (trimmed.endsWith('/')) {
        return trimmed.replace(/\/+$/, '')
    }

    const lastSlashIndex = trimmed.lastIndexOf('/')
    if (lastSlashIndex <= 0) {
        return trimmed
    }

    return trimmed.slice(0, lastSlashIndex).replace(/\/+$/, '')
}

function onNextButtonClick() {
    if (!selection.value?.value) {
        showError.value = true
        return
    }

    emit('next')
}
</script>

<template>
    <UCard>
        <template #header>
            <div>
                <h2 class="text-lg font-medium">Select media source</h2>
                <p class="text-sm text-muted">Pick a file or folder.</p>
            </div>
        </template>

        <div class="space-y-4">
            <div class="space-y-2">
                <label for="upload-source-path" class="text-sm font-medium"> Source Path <span class="text-error">*</span> </label>

                <UInputMenu
                    id="upload-source-path"
                    v-model="selection"
                    v-model:open="menuOpen"
                    v-model:search-term="searchTerm"
                    :virtualize="shouldVirtualize"
                    clear
                    :items="menuItems"
                    size="xl"
                    class="w-full"
                    icon="i-lucide-search"
                    placeholder="Type source path"
                    :loading="loading"
                    open-on-focus
                    open-on-click
                    @update:model-value="onSelect"
                    @update:search-term="onSearchTermUpdate"
                />
            </div>

            <UAlert v-if="error" color="error" variant="soft">
                <template #title>
                    <span class="flex items-center gap-2">
                        Failed to load paths. <UButton color="error" variant="ghost" size="xs" icon="i-lucide-refresh-cw" @click="() => refresh()">Retry</UButton>
                    </span>
                </template>
            </UAlert>
            <UAlert v-if="selection?.value" color="neutral" variant="soft" :title="selection.folder ? 'Selected folder' : 'Selected file'" :description="selection.value" />
            <UAlert v-if="showError" color="error" variant="soft" title="Select a file or folder before continuing to the next step." />

            <StepNavigationButtons :back="{ disabled: true }" @next="onNextButtonClick" />
        </div>
    </UCard>
</template>
