<script setup lang="ts">
const props = defineProps<{
    to?: string
}>()
</script>

<template>
    <NuxtLink :to="props.to" class="inline-flex items-center gap-2">
        <NuxtImg src="/img/logo.png" alt="logo" class="h-20 w-auto dark:invert" />
    </NuxtLink>
</template>
