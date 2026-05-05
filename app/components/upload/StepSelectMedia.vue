<script setup lang="ts">
import type { Path } from './upload.types'
import StepNavigationButtons from './StepNavigationButtons.vue'

const emit = defineEmits<{
    next: []
}>()
const selection = defineModel<Path | undefined>({
    default: undefined,
})

const { getPaths, loading, error } = usePath()

const menuItems = ref<Path[]>([])
const searchTerm = ref('')
const showError = ref(false)
const menuOpen = ref(false)
const shouldVirtualize = computed(() => menuItems.value.length > 50)

onMounted(() => {
    const parent = selection.value?.folder ? selection.value.value.trim().replace(/\/+$/, '') : getParentDirectory(selection.value?.value)
    void loadPaths(parent)
})

watch(
    () => selection.value?.value,
    () => (showError.value = false)
)

function toMenuItems(paths: PathResponse[]) {
    return paths.map((path) => ({
        label: path.path,
        value: path.path,
        icon: path.folder ? 'i-lucide-folder' : 'i-lucide-file',
        folder: path.folder,
    }))
}

async function onSelect(value: Path | null) {
    if (!value) {
        selection.value = undefined
        await loadPaths()
        return
    }

    selection.value = value

    if (value.folder) {
        await loadPaths(value.value)
        menuOpen.value = true
    }
}

async function loadPaths(parent = '') {
    const paths = await getPaths(parent)

    if (paths) {
        menuItems.value = toMenuItems(paths)
    }

    if (error.value) {
        if (parent && error) {
            const paths = await getPaths()
            menuItems.value = toMenuItems(paths)
        }
    }
}

async function onSearchTermUpdate(value: string) {
    const trimmedValue = value.trim()
    if (!trimmedValue) {
        return
    }

    searchTerm.value = trimmedValue
    const parent = getBrowseParent(trimmedValue)

    await loadPaths(parent)
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

            <UAlert v-if="error" color="error" variant="soft" title="Failed to load paths. Please try again." />
            <UAlert v-if="selection?.value" color="neutral" variant="soft" :title="selection.folder ? 'Selected folder' : 'Selected file'" :description="selection.value" />
            <UAlert v-if="showError" color="error" variant="soft" title="Select a file or folder before continuing to the next step." />

            <StepNavigationButtons :back="{ disabled: true }" @next="onNextButtonClick" />
        </div>
    </UCard>
</template>
