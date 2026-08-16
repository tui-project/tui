<script setup lang="ts">
const CONTEXT_PREVIEW_LINES = 8
const CONTEXT_PREVIEW_LENGTH = 500

const search = ref('')
const selectedType = ref('all')
const selectedScope = ref('all')
const logViewport = ref<HTMLElement>()
const expandedContextIds = ref(new Set<number>())
const selectedEntry = ref<LogEntry>()
const logDetailsOpen = ref(false)
const copyStatus = ref<'idle' | 'copied' | 'failed'>('idle')
const { logs, connected, error, clear } = useStreamLogs()

const typeOptions = [{ label: 'All types', value: 'all' }, ...LOG_TYPE_OPTIONS]
const scopeOptions = computed(() => [
    { label: 'All scopes', value: 'all' },
    ...[...new Set(logs.value.map((entry) => entry.scope).filter((scope): scope is string => Boolean(scope)))].sort().map((scope) => ({ label: scope, value: scope })),
])
const filteredLogs = computed(() => {
    const term = search.value.trim().toLocaleLowerCase()

    return logs.value.filter((entry) => {
        const matchesType = selectedType.value === 'all' || entry.type === selectedType.value
        const matchesScope = selectedScope.value === 'all' || entry.scope === selectedScope.value
        const searchable = `${entry.msg} ${entry.scope ?? ''} ${entry.context ? JSON.stringify(entry.context) : ''}`.toLocaleLowerCase()

        return matchesType && matchesScope && matchesSearch(entry, searchable, term)
    })
})

watch(
    () => filteredLogs.value.length,
    async () => {
        await nextTick()
        scrollToLatestLog()
    },
    { immediate: true }
)

onMounted(async () => {
    await nextTick()
    scrollToLatestLog()
})

function scrollToLatestLog() {
    if (logViewport.value) {
        logViewport.value.scrollTop = logViewport.value.scrollHeight
    }
}

function matchesSearch(entry: LogEntry, searchable: string, searchTerm: string) {
    if (!searchTerm) {
        return true
    }

    const terms = searchTerm.split(/\s+/)

    return terms.every((term) => {
        const separatorIndex = term.indexOf('=')
        if (separatorIndex <= 0) {
            return searchable.includes(term)
        }

        const key = term.slice(0, separatorIndex)
        const expectedValue = term.slice(separatorIndex + 1)

        return getValuesAtPath(entry.context, key.split('.')).some((value) => String(value).toLocaleLowerCase().includes(expectedValue))
    })
}

function getValuesAtPath(value: unknown, path: string[]): unknown[] {
    if (Array.isArray(value)) {
        return value.flatMap((item) => getValuesAtPath(item, path))
    }

    if (!value || typeof value !== 'object') {
        return []
    }

    const [key, ...remainingPath] = path
    const matchingKey = key && Object.keys(value).find((candidate) => candidate.toLocaleLowerCase() === key)
    if (!matchingKey) {
        return []
    }

    const child = (value as Record<string, unknown>)[matchingKey]

    return remainingPath.length ? getValuesAtPath(child, remainingPath) : [child]
}

function formatTime(time: string) {
    return new Date(time).toLocaleTimeString()
}

function formatContext(context: unknown) {
    return JSON.stringify(context, null, 2)
}

function isLargeContext(context: unknown) {
    const formatted = formatContext(context)

    return formatted.length > CONTEXT_PREVIEW_LENGTH || formatted.split('\n').length > CONTEXT_PREVIEW_LINES
}

function getVisibleContext(entry: LogEntry) {
    const formatted = formatContext(entry.context)
    if (!isLargeContext(entry.context) || expandedContextIds.value.has(entry.id)) {
        return formatted
    }

    const linePreview = formatted.split('\n').slice(0, CONTEXT_PREVIEW_LINES).join('\n')

    return `${linePreview.slice(0, CONTEXT_PREVIEW_LENGTH).trimEnd()}…`
}

function toggleContext(entryId: number) {
    const nextExpandedIds = new Set(expandedContextIds.value)
    if (nextExpandedIds.has(entryId)) {
        nextExpandedIds.delete(entryId)
    } else {
        nextExpandedIds.add(entryId)
    }
    expandedContextIds.value = nextExpandedIds
}

function openLogDetails(entry: LogEntry) {
    selectedEntry.value = entry
    copyStatus.value = 'idle'
    logDetailsOpen.value = true
}

async function copyLogDetails() {
    try {
        await navigator.clipboard.writeText(JSON.stringify(selectedEntry.value!, null, 2))
        copyStatus.value = 'copied'
    } catch {
        copyStatus.value = 'failed'
    }
}

function getTypeColor(type: string) {
    switch (type) {
        case 'fatal':
        case 'error':
            return 'error'
        case 'warn':
            return 'warning'
        case 'info':
            return 'info'
        case 'debug':
            return 'neutral'
        default:
            return 'primary'
    }
}
</script>

<template>
    <PageContainer>
        <PageHeader title="Live logs" description="Watch and filter the latest 1,000 application log entries by text, type, or scope." />

        <UCard variant="subtle">
            <div class="flex flex-wrap items-end gap-3">
                <UFormField label="Search" class="min-w-64 flex-1">
                    <UInput v-model="search" icon="i-lucide-search" placeholder="Text or key=value, e.g. trackerCode=ATH" class="w-full">
                        <template v-if="search" #trailing>
                            <UButton color="neutral" variant="link" size="sm" icon="i-lucide-x" aria-label="Clear search" @click="search = ''" />
                        </template>
                    </UInput>
                    <template #hint>Use dots for nested JSON keys. Multiple terms are combined with AND.</template>
                </UFormField>
                <UFormField label="Type">
                    <USelect v-model="selectedType" :items="typeOptions" class="w-36" />
                </UFormField>
                <UFormField label="Scope">
                    <USelect v-model="selectedScope" :items="scopeOptions" class="w-48" />
                </UFormField>
                <UButton variant="outline" icon="i-lucide-trash-2" @click="clear">Clear</UButton>
            </div>

            <div class="mt-4 flex items-center justify-between text-sm text-muted">
                <div class="flex items-center gap-2">
                    <span class="size-2 rounded-full" :class="connected ? 'bg-success' : 'bg-error'" />
                    <span>{{ connected ? 'Live' : error ? 'Reconnecting…' : 'Connecting…' }}</span>
                </div>
                <span>{{ filteredLogs.length }} of {{ logs.length }} entries</span>
            </div>

            <div ref="logViewport" data-log-viewport class="mt-4 max-h-[65vh] overflow-auto rounded-lg bg-gray-950 text-gray-100 ring ring-default">
                <div v-if="!filteredLogs.length" class="p-8 text-center text-sm text-gray-400">No matching log entries.</div>
                <ol v-else aria-label="Log entries" class="divide-y divide-gray-800 font-mono text-xs">
                    <li
                        v-for="entry in filteredLogs"
                        :key="entry.id"
                        role="button"
                        tabindex="0"
                        :aria-label="`View log details: ${entry.msg}`"
                        class="grid cursor-pointer grid-cols-[auto_auto_auto_1fr] gap-3 px-4 py-2.5 hover:bg-gray-900 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
                        @click="openLogDetails(entry)"
                        @keydown.enter="openLogDetails(entry)"
                        @keydown.space.prevent="openLogDetails(entry)"
                    >
                        <time class="text-gray-500" :datetime="entry.time">{{ formatTime(entry.time) }}</time>
                        <UBadge :color="getTypeColor(entry.type)" variant="soft" size="sm" class="uppercase">{{ entry.type }}</UBadge>
                        <span class="text-cyan-300">{{ entry.scope ?? 'app' }}</span>
                        <div class="min-w-0">
                            <p class="whitespace-pre-wrap wrap-break-words">{{ entry.msg }}</p>
                            <template v-if="entry.context">
                                <pre class="mt-1 whitespace-pre-wrap wrap-break-words text-gray-400">{{ getVisibleContext(entry) }}</pre>
                                <UButton
                                    v-if="isLargeContext(entry.context)"
                                    color="neutral"
                                    variant="link"
                                    size="xs"
                                    class="mt-1 p-0"
                                    @click.stop="toggleContext(entry.id)"
                                >
                                    {{ expandedContextIds.has(entry.id) ? 'Show less' : 'Show more' }}
                                </UButton>
                            </template>
                        </div>
                    </li>
                </ol>
            </div>
        </UCard>

        <UModal v-model:open="logDetailsOpen" title="Log entry details" description="View or copy the complete structured log entry.">
            <template #body>
                <pre class="max-h-[65vh] overflow-auto whitespace-pre-wrap wrap-break-words rounded-lg bg-gray-950 p-4 font-mono text-xs text-gray-100">{{ JSON.stringify(selectedEntry, null, 2) }}</pre>
            </template>
            <template #footer>
                <div class="flex w-full justify-end gap-2">
                    <UButton variant="outline" @click="logDetailsOpen = false">Close details</UButton>
                    <UButton icon="i-lucide-copy" :color="copyStatus === 'failed' ? 'error' : 'primary'" @click="copyLogDetails">
                        {{ copyStatus === 'copied' ? 'Copied' : copyStatus === 'failed' ? 'Copy failed' : 'Copy JSON' }}
                    </UButton>
                </div>
            </template>
        </UModal>
    </PageContainer>
</template>
