<script setup lang="ts">
type ButtonOptions = {
    label?: string
    disabled?: boolean
    loading?: boolean
    type?: 'button' | 'submit' | 'reset'
}

const props = defineProps<{
    back?: ButtonOptions
    next?: ButtonOptions
}>()

const emit = defineEmits<{
    back: []
    next: []
}>()

const backLabel = computed(() => props.back?.label ?? 'Back')
const nextLabel = computed(() => props.next?.label ?? 'Next')
const backDisabled = computed(() => props.back?.disabled ?? false)
const nextDisabled = computed(() => props.next?.disabled ?? false)
const backLoading = computed(() => props.back?.loading ?? false)
const nextLoading = computed(() => props.next?.loading ?? false)
const backType = computed(() => props.back?.type ?? 'button')
const nextType = computed(() => props.next?.type ?? 'button')
</script>

<template>
    <div class="flex justify-between pt-2">
        <UButton variant="outline" size="xl" :disabled="backDisabled" :loading="backLoading" :type="backType" @click="emit('back')">
            {{ backLabel }}
        </UButton>

        <UButton size="xl" :disabled="nextDisabled" :loading="nextLoading" :type="nextType" @click="emit('next')">
            {{ nextLabel }}
        </UButton>
    </div>
</template>
