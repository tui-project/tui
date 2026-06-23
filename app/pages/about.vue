<script setup lang="ts">
const {
    public: { version },
} = useRuntimeConfig()

const trackers = [
    { name: 'Aither', code: 'ATH', url: 'https://aither.cc' },
    { name: 'Upload.cx', code: 'ULCX', url: 'https://upload.cx' },
]

const imageHosts = [{ name: 'ImgBB', url: 'https://imgbb.com', description: 'Free image hosting with API support' }]

const metadataSources = [
    { name: 'TMDB', label: 'The Movie Database', url: 'https://www.themoviedb.org', description: 'Movie and TV show metadata, posters, and language data' },
    { name: 'TVDB', label: 'The TVDB', url: 'https://thetvdb.com', description: 'TV series and episode metadata' },
]

const torrentClients = [{ name: 'qui', description: 'Self-hosted torrent manager — torrents are injected via the cross-seed API after a successful upload' }]

const mediaTools = [
    { name: 'MediaInfo', description: 'Reads technical and tag information from media files (codec, resolution, audio tracks, etc.)' },
    { name: 'FFmpeg', description: 'Generates screenshots and handles media processing' },
    { name: 'FFprobe', description: 'Probes media streams for duration, framerate, and container info' },
]

const stack = [
    { name: 'Nuxt 4', icon: 'i-lucide-layers', description: 'Full-stack Vue framework with file-based routing' },
    { name: 'Nitro', icon: 'i-lucide-server', description: 'Server engine powering the API routes' },
    { name: 'Nuxt UI v4', icon: 'i-lucide-palette', description: 'Component library built on Tailwind CSS v4' },
    { name: 'NeDB', icon: 'i-lucide-database', description: 'Embedded file-based database — no external server required' },
    { name: 'Zod', icon: 'i-lucide-shield-check', description: 'Runtime schema validation for all API requests' },
    { name: 'create-torrent', icon: 'i-lucide-magnet', description: 'Generates generic .torrent files from source paths' },
]
</script>

<template>
    <PageContainer>
        <PageHeader title="About" description="Information about this application, integrations, and technology stack." />

        <div class="space-y-6">
            <UCard variant="subtle">
                <div class="space-y-4">
                    <div class="flex items-center gap-3">
                        <AppLogo height="h-10" />
                    </div>
                    <p class="text-sm text-muted leading-relaxed">
                        A self-hosted application for uploading media to private BitTorrent trackers. Select a source file or folder, review auto-detected metadata, write a
                        description, and submit — tui handles torrent creation and queues the upload to your configured trackers.
                    </p>
                    <div class="flex flex-wrap gap-4 text-xs text-muted">
                        <span
                            >Version <span class="font-mono text-highlighted">v{{ version }}</span></span
                        >
                    </div>
                    <div>
                        <UButton
                            to="https://github.com/tui-project/tui-v2"
                            target="_blank"
                            rel="noopener noreferrer"
                            variant="outline"
                            size="sm"
                            icon="i-lucide-github"
                            trailing-icon="i-lucide-arrow-up-right"
                        >
                            View on GitHub
                        </UButton>
                    </div>
                </div>
            </UCard>

            <UCard variant="subtle">
                <template #header>
                    <h2 class="text-base font-semibold">Supported Trackers</h2>
                </template>
                <div class="flex flex-wrap gap-2">
                    <UButton
                        v-for="tracker in trackers"
                        :key="tracker.code"
                        :to="tracker.url"
                        target="_blank"
                        rel="noopener noreferrer"
                        variant="outline"
                        size="sm"
                        trailing-icon="i-lucide-arrow-up-right"
                    >
                        {{ tracker.name }}
                        <UBadge color="neutral" variant="soft" size="xs">{{ tracker.code }}</UBadge>
                    </UButton>
                </div>
            </UCard>

            <UCard variant="subtle">
                <template #header>
                    <h2 class="text-base font-semibold">Image Hosting</h2>
                </template>
                <div class="space-y-3">
                    <div v-for="host in imageHosts" :key="host.name" class="flex items-center justify-between">
                        <div class="flex items-center gap-3">
                            <UIcon name="i-lucide-image" class="size-4 shrink-0 text-primary" />
                            <div>
                                <div class="text-sm font-medium">{{ host.name }}</div>
                                <div class="text-xs text-muted">{{ host.description }}</div>
                            </div>
                        </div>
                        <UButton :to="host.url" target="_blank" rel="noopener noreferrer" variant="ghost" size="xs" icon="i-lucide-arrow-up-right" />
                    </div>
                </div>
            </UCard>

            <UCard variant="subtle">
                <template #header>
                    <h2 class="text-base font-semibold">Torrent Clients</h2>
                </template>
                <div class="space-y-3">
                    <div v-for="client in torrentClients" :key="client.name" class="flex items-start gap-3">
                        <UIcon name="i-lucide-download" class="mt-0.5 size-4 shrink-0 text-primary" />
                        <div>
                            <div class="text-sm font-medium">{{ client.name }}</div>
                            <div class="text-xs text-muted">{{ client.description }}</div>
                        </div>
                    </div>
                </div>
            </UCard>

            <UCard variant="subtle">
                <template #header>
                    <h2 class="text-base font-semibold">Metadata Sources</h2>
                </template>
                <div class="space-y-3">
                    <div v-for="source in metadataSources" :key="source.name" class="flex items-center justify-between">
                        <div class="flex items-center gap-3">
                            <UIcon name="i-lucide-film" class="size-4 shrink-0 text-primary" />
                            <div>
                                <div class="text-sm font-medium">{{ source.label }}</div>
                                <div class="text-xs text-muted">{{ source.description }}</div>
                            </div>
                        </div>
                        <UButton :to="source.url" target="_blank" rel="noopener noreferrer" variant="ghost" size="xs" icon="i-lucide-arrow-up-right" />
                    </div>
                </div>
            </UCard>

            <UCard variant="subtle">
                <template #header>
                    <h2 class="text-base font-semibold">Media Tools</h2>
                </template>
                <div class="space-y-3">
                    <div v-for="tool in mediaTools" :key="tool.name" class="flex items-start gap-3">
                        <UIcon name="i-lucide-wrench" class="mt-0.5 size-4 shrink-0 text-primary" />
                        <div>
                            <div class="text-sm font-medium">{{ tool.name }}</div>
                            <div class="text-xs text-muted">{{ tool.description }}</div>
                        </div>
                    </div>
                </div>
            </UCard>

            <UCard variant="subtle">
                <template #header>
                    <h2 class="text-base font-semibold">Stack</h2>
                </template>
                <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div v-for="item in stack" :key="item.name" class="flex items-start gap-3">
                        <UIcon :name="item.icon" class="mt-0.5 size-4 shrink-0 text-primary" />
                        <div>
                            <div class="text-sm font-medium">{{ item.name }}</div>
                            <div class="text-xs text-muted">{{ item.description }}</div>
                        </div>
                    </div>
                </div>
            </UCard>
        </div>
    </PageContainer>
</template>
