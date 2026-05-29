<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { Metadata, Path } from './upload.types'
import StepNavigationButtons from './StepNavigationButtons.vue'
import { useMetadata } from '~/composables/useMetadata'

type SelectOption = {
    label: string
    value: string
}

type Schema = z.output<typeof schema>

const props = defineProps<{ selectedPath?: Path }>()
const metadata = defineModel<Metadata | undefined>()
const emit = defineEmits<{
    back: []
    next: []
}>()

const mediaTypeOptions: SelectOption[] = [
    { label: 'Movie', value: 'movie' },
    { label: 'TV', value: 'tv' },
]

const sourceOptions: SelectOption[] = [
    { label: 'Web', value: 'Web' },
    { label: 'DVD', value: 'DVD' },
    { label: 'NTSC DVD', value: 'NTSC DVD' },
    { label: 'PAL DVD', value: 'PAL DVD' },
    { label: 'HDDVD', value: 'HDDVD' },
    { label: '3D BluRay', value: '3D BluRay' },
    { label: 'BluRay', value: 'BluRay' },
    { label: 'UHD BluRay', value: 'UHD BluRay' },
    { label: 'HDTV', value: 'HDTV' },
    { label: 'UHDTV', value: 'UHDTV' },
]

const sourceTypeOptions: SelectOption[] = [
    { label: 'Remux', value: 'REMUX' },
    { label: 'Encode', value: 'ENCODE' },
    { label: 'Web-DL', value: 'WEB-DL' },
    { label: 'WebRip', value: 'WEBRIP' },
    { label: 'HDTV', value: 'HDTV' },
]

const serviceOptions: SelectOption[] = [
    { label: '9Now', value: '9NOW' },
    { label: 'A&E', value: 'AE' },
    { label: 'ABC (AU) iView', value: 'AUBC' },
    { label: 'ABC (US)', value: 'AMBC' },
    { label: 'Adult Swim', value: 'AS' },
    { label: 'Al Jazeera English', value: 'AJAZ' },
    { label: 'All4 (Channel 4)', value: 'ALL4' },
    { label: 'Amazon Prime Video', value: 'AMZN' },
    { label: 'AMC', value: 'AMC' },
    { label: `America's Test Kitchen`, value: 'ATK' },
    { label: 'Animal Planet', value: 'ANPL' },
    { label: 'AnimeLab', value: 'ANLB' },
    { label: 'AOL', value: 'AOL' },
    { label: 'Apple TV+', value: 'ATVP' },
    { label: 'ARD', value: 'ARD' },
    { label: 'BBC iPlayer', value: 'iP' },
    { label: 'Binge', value: 'BNGE' },
    { label: 'Blackpills', value: 'BKPL' },
    { label: 'Boomerang', value: 'BOOM' },
    { label: 'BravoTV', value: 'BRAV' },
    { label: 'Bravia Core', value: 'BCORE' },
    { label: 'C More', value: 'CMOR' },
    { label: 'Canal+', value: 'CNLP' },
    { label: 'Cartoon Network', value: 'CN' },
    { label: 'CBC', value: 'CBC' },
    { label: 'CBS', value: 'CBS' },
    { label: 'CHRGD', value: 'CHGD' },
    { label: 'Cinemax', value: 'CMAX' },
    { label: 'Club illico', value: 'CLBI' },
    { label: 'CNBC', value: 'CNBC' },
    { label: 'Comedians in Cars Getting Coffee', value: 'CCGC' },
    { label: 'Comedy Central', value: 'CC' },
    { label: 'Cooking Channel', value: 'COOK' },
    { label: 'Country Music Television', value: 'CMT' },
    { label: 'Crackle', value: 'CRKL' },
    { label: 'Crave', value: 'CRAV' },
    { label: 'Criterion Channel', value: 'CRIT' },
    { label: 'Crunchyroll', value: 'CR' },
    { label: 'CSpan', value: 'CSPN' },
    { label: 'CTV', value: 'CTV' },
    { label: 'CuriosityStream', value: 'CUR' },
    { label: 'The CW', value: 'CW' },
    { label: 'CWSeed', value: 'CWS' },
    { label: 'Daisuki', value: 'DSKI' },
    { label: 'DC Universe', value: 'DCU' },
    { label: 'Deadhouse Films', value: 'DHF' },
    { label: 'Destination America', value: 'DEST' },
    { label: 'Digiturk Dilediğin Yerde', value: 'DDY' },
    { label: 'DirecTV Now', value: 'DTV' },
    { label: 'Discovery Channel', value: 'DISC' },
    { label: 'Discovery+', value: 'DSCP' },
    { label: 'Disney', value: 'DSNY' },
    { label: 'Disney+', value: 'DSNP' },
    { label: 'DIY Network', value: 'DIY' },
    { label: 'Doc Club', value: 'DOCC' },
    { label: 'DPlay', value: 'DPLY' },
    { label: 'DramaFever', value: 'DF' },
    { label: 'Dropout', value: 'DRPO' },
    { label: 'DRTV', value: 'DRTV' },
    { label: 'E!', value: 'ETV' },
    { label: 'El Trece', value: 'ETTV' },
    { label: 'EPIX', value: 'EPIX' },
    { label: 'ESPN', value: 'ESPN' },
    { label: 'Esquire', value: 'ESQ' },
    { label: 'Family', value: 'FAM' },
    { label: 'Family Jr', value: 'FJR' },
    { label: 'Food Network', value: 'FOOD' },
    { label: 'Fox', value: 'FOX' },
    { label: 'Foxtel Now', value: 'FXTL' },
    { label: 'FPT Play', value: 'FPT' },
    { label: 'France.tv', value: 'FTV' },
    { label: 'Freeform', value: 'FREE' },
    { label: 'Funimation', value: 'FUNI' },
    { label: 'FYI Network', value: 'FYI' },
    { label: 'Global', value: 'GLBL' },
    { label: 'GloboSat Play', value: 'GLOB' },
    { label: 'go90', value: 'GO90' },
    { label: 'Google Play', value: 'PLAY' },
    { label: 'Hallmark', value: 'HLMK' },
    { label: 'HBO', value: 'HBO' },
    { label: 'HBO Max', value: 'HMAX' },
    { label: 'HGTV', value: 'HGTV' },
    { label: 'HIDIVE', value: 'HIDI' },
    { label: 'History Channel', value: 'HIST' },
    { label: 'Hotstar', value: 'HTSR' },
    { label: 'Hulu', value: 'HULU' },
    { label: 'Ici TOU.TV', value: 'TOU' },
    { label: 'IFC', value: 'IFC' },
    { label: 'Investigation Discovery', value: 'ID' },
    { label: 'iTunes', value: 'iT' },
    { label: 'ITV', value: 'ITV' },
    { label: 'Kanopy', value: 'KNPY' },
    { label: 'Kayo Sports', value: 'KAYO' },
    { label: 'Knowledge Network', value: 'KNOW' },
    { label: 'Lifetime', value: 'LIFE' },
    { label: 'Loving Nature', value: 'LN' },
    { label: 'Max', value: 'MAX' },
    { label: 'MBC', value: 'MBC' },
    { label: 'Motor Trend OnDemand', value: 'MTOD' },
    { label: 'MSNBC', value: 'MNBC' },
    { label: 'Mubi', value: 'MUBI' },
    { label: 'MTV', value: 'MTV' },
    { label: 'National Geographic', value: 'NATG' },
    { label: 'NBA League Pass', value: 'NBA' },
    { label: 'NBC', value: 'NBC' },
    { label: 'Netflix', value: 'NF' },
    { label: 'NFL Network', value: 'NFL' },
    { label: 'NFL Now', value: 'NFLN' },
    { label: 'NHL GameCenter', value: 'GC' },
    { label: 'Nickelodeon', value: 'NICK' },
    { label: 'Norsk Rikskringkasting', value: 'NRK' },
    { label: 'Now (Sky)', value: 'NOW' },
    { label: 'OnDemandKorea', value: 'ODK' },
    { label: 'Oxygen', value: 'OXGN' },
    { label: 'Paramount Network', value: 'PMNT' },
    { label: 'Paramount+', value: 'PMTP' },
    { label: 'PBS', value: 'PBS' },
    { label: 'PBS Kids', value: 'PBSK' },
    { label: 'Peacock', value: 'PCOK' },
    { label: 'Playstation Network', value: 'PSN' },
    { label: 'Pluzz', value: 'PLUZ' },
    { label: 'PokerGo', value: 'POGO' },
    { label: 'Project Alpha', value: 'PA' },
    { label: 'puhutv', value: 'PUHU' },
    { label: 'Quibi', value: 'QIBI' },
    { label: 'Rakuten TV', value: 'RKTN' },
    { label: 'The Roku Channel', value: 'ROKU' },
    { label: 'Rooster Teeth', value: 'RSTR' },
    { label: 'RTÉ', value: 'RTE' },
    { label: 'SBS (AU)', value: 'SBS' },
    { label: 'Seeso', value: 'SESO' },
    { label: 'Shomi', value: 'SHMI' },
    { label: 'Showtime', value: 'SHO' },
    { label: 'Shudder', value: 'SHDR' },
    { label: 'SkyShowtime', value: 'SKST' },
    { label: 'Spike', value: 'SPIK' },
    { label: 'Sportsnet', value: 'SNET' },
    { label: 'Sprout', value: 'SPRT' },
    { label: 'Stan', value: 'STAN' },
    { label: 'Star+', value: 'STRP' },
    { label: 'Starz', value: 'STZ' },
    { label: 'Sveriges Television', value: 'SVT' },
    { label: 'SwearNet', value: 'SWER' },
    { label: 'SyFy', value: 'SYFY' },
    { label: 'TBS', value: 'TBS' },
    { label: 'TenPlay', value: 'TEN' },
    { label: 'TFOU', value: 'TFOU' },
    { label: 'TIMvision', value: 'TIMV' },
    { label: 'TLC', value: 'TLC' },
    { label: 'Travel Channel', value: 'TRVL' },
    { label: 'TubiTV', value: 'TUBI' },
    { label: 'TV3 (IE)', value: 'TV3' },
    { label: 'TV4 (SE)', value: 'TV4' },
    { label: 'TVING', value: 'TVING' },
    { label: 'TVLand', value: 'TVL' },
    { label: 'UFC', value: 'UFC' },
    { label: 'UKTV', value: 'UKTV' },
    { label: 'Univision', value: 'UNIV' },
    { label: 'USA Network', value: 'USAN' },
    { label: 'Velocity', value: 'VLCT' },
    { label: 'VET Tv', value: 'VTRN' },
    { label: 'VH1', value: 'VH1' },
    { label: 'Viaplay', value: 'VIAP' },
    { label: 'Viceland', value: 'VICE' },
    { label: 'Viki', value: 'VIKI' },
    { label: 'Vimeo', value: 'VMEO' },
    { label: 'VRV', value: 'VRV' },
    { label: 'W Network', value: 'WNET' },
    { label: 'WatchMe', value: 'WME' },
    { label: 'WWE Network', value: 'WWEN' },
    { label: 'Xbox Video', value: 'XBOX' },
    { label: 'Yahoo', value: 'YHOO' },
    { label: 'YouTube Movies', value: 'YT' },
    { label: 'YouTube Red', value: 'RED' },
    { label: 'ZDF', value: 'ZDF' },
    { label: 'Hotstar', value: 'HS' },
    { label: 'Viu', value: 'VIU' },
    { label: 'WeTV', value: 'WETV' },
    { label: 'Wavve', value: 'WAVVE' },
    { label: 'Watcha', value: 'WATCHA' },
    { label: 'Coupang Play', value: 'CPNG' },
    { label: 'KBS', value: 'KBS' },
    { label: 'iMBC', value: 'IMBC' },
    { label: 'Kocowa', value: 'KCW' },
]

const resolutionOptions: SelectOption[] = [
    { label: '480i', value: '480i' },
    { label: '480p', value: '480p' },
    { label: '576i', value: '576i' },
    { label: '576p', value: '576p' },
    { label: '720p', value: '720p' },
    { label: '1080i', value: '1080i' },
    { label: '1080p', value: '1080p' },
    { label: '2160p', value: '2160p' },
]

const hdrOptions: SelectOption[] = [
    { label: 'DV', value: 'DV' },
    { label: 'HDR10+', value: 'HDR10+' },
    { label: 'HDR', value: 'HDR' },
    { label: 'HLG', value: 'HLG' },
]

const cutOptions: SelectOption[] = [
    { label: `Director's Cut`, value: `Director's Cut` },
    { label: 'Extended', value: 'Extended' },
    { label: 'Special Edition', value: 'Special Edition' },
    { label: 'Unrated', value: 'Unrated' },
    { label: 'Super Duper Cut', value: 'Super Duper Cut' },
]

const ratioOptions: SelectOption[] = [
    { label: 'IMAX', value: 'IMAX' },
    { label: 'Open Matte', value: 'Open Matte' },
    { label: 'MAR', value: 'MAR' },
]

const videoCodecOptions: SelectOption[] = [
    { label: 'MPEG-2', value: 'MPEG-2' },
    { label: 'VC-1', value: 'VC-1' },
    { label: 'AVC', value: 'AVC' },
    { label: 'H.264', value: 'H.264' },
    { label: 'HEVC', value: 'HEVC' },
    { label: 'x264', value: 'x264' },
    { label: 'x265', value: 'x265' },
]

const audioCodecOptions: SelectOption[] = [
    { label: 'AAC', value: 'AAC' },
    { label: 'Opus', value: 'Opus' },
    { label: 'DD', value: 'DD' },
    { label: 'DD+', value: 'DD+' },
    { label: 'TrueHD', value: 'TrueHD' },
    { label: 'DTS', value: 'DTS' },
    { label: 'DTS-HD MA', value: 'DTS-HD MA' },
    { label: 'DTS:X', value: 'DTS:X' },
    { label: 'FLAC', value: 'FLAC' },
]

const audioChannelOptions: SelectOption[] = [
    { label: '1.0', value: '1.0' },
    { label: '2.0', value: '2.0' },
    { label: '2.1', value: '2.1' },
    { label: '3.0', value: '3.0' },
    { label: '3.1', value: '3.1' },
    { label: '4.0', value: '4.0' },
    { label: '4.1', value: '4.1' },
    { label: '5.0', value: '5.0' },
    { label: '5.1', value: '5.1' },
    { label: '6.1', value: '6.1' },
    { label: '7.1', value: '7.1' },
]

const audioMetadataOptions: SelectOption[] = [
    { label: 'Atmos', value: 'Atmos' },
    { label: 'Auro3D', value: 'Auro3D' },
]

const languageOptions: SelectOption[] = [
    { value: 'ar', label: 'Arabic' },
    { value: 'da', label: 'Danish' },
    { value: 'de', label: 'German' },
    { value: 'en', label: 'English' },
    { value: 'es', label: 'Spanish' },
    { value: 'fi', label: 'Finnish' },
    { value: 'fr', label: 'French' },
    { value: 'hi', label: 'Hindi' },
    { value: 'it', label: 'Italian' },
    { value: 'ja', label: 'Japanese' },
    { value: 'ko', label: 'Korean' },
    { value: 'nl', label: 'Dutch' },
    { value: 'no', label: 'Norwegian' },
    { value: 'pl', label: 'Polish' },
    { value: 'pt', label: 'Portuguese' },
    { value: 'ru', label: 'Russian' },
    { value: 'sv', label: 'Swedish' },
    { value: 'ta', label: 'Tamil' },
    { value: 'th', label: 'Thai' },
    { value: 'tr', label: 'Turkish' },
    { value: 'zh', label: 'Chinese' },
]

const requiredString = (message: string) => z.string().trim().min(1, message)
const requiredNumber = (message: string) =>
    z
        .number()
        .nullable()
        .refine((value) => value !== null, message)

const schema = z
    .object({
        fileName: z.string(),
        mediaType: z
            .string()
            .trim()
            .refine((value) => value === 'movie' || value === 'tv', {
                message: 'Media type is required',
            }),
        title: requiredString('Title is required'),
        originalTitle: z.string(),
        year: requiredNumber('Year is required'),
        source: requiredString('Source is required'),
        sourceType: requiredString('Type is required'),
        resolution: requiredString('Resolution is required'),
        language: z.array(z.string().trim().min(1)).min(1, 'Language is required'),
        originalLanguage: requiredString('Original language is required'),
        videoCodec: requiredString('Video codec is required'),
        audioCodec: requiredString('Audio codec is required'),
        audioChannels: requiredString('Audio channels are required'),
        audioMetadata: z.string(),
        tmdbId: requiredNumber('TMDb ID is required'),
        imdbId: requiredString('IMDb ID is required'),
        season: z.number().nullable(),
        episode: z.number().nullable(),
        episodeEnd: z.number().nullable(),
        specialName: z.string(),
        tvdbId: z.number().nullable(),
        releaseGroup: z.string(),
        service: z.string(),
        repack: z.number(),
        proper: z.number(),
        rerip: z.number(),
        cut: z.string(),
        ratio: z.string(),
        hybrid: z.boolean(),
        hi10p: z.boolean(),
        hdr: z.array(z.string()),
        locale: z.string(),
    })
    .superRefine((value, ctx) => {
        if (value.mediaType === 'tv') {
            if (value.season === null) {
                ctx.addIssue({ code: 'custom', path: ['season'], message: 'Season is required' })
            }
            if (value.tvdbId === null) {
                ctx.addIssue({ code: 'custom', path: ['tvdbId'], message: 'TVDB ID is required' })
            }
            if (value.episodeEnd !== null) {
                if (value.episode === null) {
                    ctx.addIssue({ code: 'custom', path: ['episode'], message: 'First episode is required for a range' })
                } else if (value.episodeEnd <= value.episode) {
                    ctx.addIssue({ code: 'custom', path: ['episodeEnd'], message: 'Must be greater than the first episode' })
                }
            }
        }
    })

const state = reactive<Metadata>({
    fileName: '',
    releaseGroup: '',
    mediaType: '',
    title: '',
    originalTitle: '',
    year: null,
    season: null,
    episode: null,
    episodeEnd: null,
    specialName: '',
    language: [],
    originalLanguage: '',
    sourceType: '',
    source: '',
    service: '',
    repack: 0,
    proper: 0,
    rerip: 0,
    cut: '',
    ratio: '',
    hybrid: false,
    hi10p: false,
    resolution: '',
    hdr: [],
    videoCodec: '',
    audioCodec: '',
    audioChannels: '',
    audioMetadata: '',
    tmdbId: null,
    imdbId: '',
    tvdbId: null,
    locale: '',
})

const { getMetadata, loading, error } = useMetadata()

const showMultiEpisode = ref(false)

const isTV = computed(() => state?.mediaType === 'tv')
const isSpecial = computed(() => isTV.value && (state.season === 0 || state.episode === 0))
const isMultiEpisode = computed(() => showMultiEpisode.value)
const isWebSource = computed(() => state?.source === 'Web')
const selectedPathLabel = computed(() => (props.selectedPath?.folder ? 'Folder' : 'File'))
const selectedPathValue = computed(() => props.selectedPath?.value)

onMounted(async () => {
    const path = selectedPathValue.value

    if (!path) {
        return
    }

    if (metadata.value?.fileName) {
        Object.assign(state, metadata.value)
        showMultiEpisode.value = state.episodeEnd !== null

        return
    }

    const data = await getMetadata(path)
    Object.assign(state, data)

    showMultiEpisode.value = state.episodeEnd !== null
    metadata.value = state
})

watch(
    () => selectedPathValue.value,
    () => {
        metadata.value = undefined
    }
)

function onToggleMultiEpisode(value: boolean) {
    showMultiEpisode.value = value
}

function onSubmit(event: FormSubmitEvent<Schema>) {
    if (!showMultiEpisode.value) event.data.episodeEnd = null
    metadata.value = event.data
    emit('next')
}
</script>

<template>
    <UCard>
        <template #header>
            <div class="space-y-2">
                <div class="flex items-start justify-between gap-3">
                    <div>
                        <h2 class="text-lg font-semibold tracking-tight">Review Metadata</h2>
                        <p class="text-sm text-muted">Detected metadata is editable. Update anything before continuing.</p>
                    </div>
                </div>
                <p v-if="selectedPathValue && !loading && !error" class="text-xs text-muted" aria-label="selected-file-or-folder">
                    {{ selectedPathLabel }}: <span class="font-medium">{{ state?.fileName || 'Unknown file' }}</span>
                </p>
            </div>
        </template>

        <div class="space-y-5">
            <UAlert v-if="!selectedPathValue" color="neutral" variant="soft" title="Select a source path first" description="Go back to Step 1 and choose a file or folder." />

            <UAlert
                v-else-if="error"
                color="error"
                variant="soft"
                title="Failed to detect media information."
                description="Please check the selected path or fill metadata manually."
            />

            <div v-else-if="loading" class="space-y-2">
                <USkeleton class="h-20 w-full" />
                <USkeleton class="h-20 w-full" />
                <USkeleton class="h-20 w-full" />
            </div>

            <UForm v-else :schema="schema" :state="state" class="space-y-5 metadata-form" @submit="onSubmit">
                <section class="rounded-xl border border-default/70 bg-elevated/30 p-4 space-y-4 shadow-xs">
                    <h3 class="text-sm font-semibold text-default">Basic Details</h3>
                    <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        <UFormField label="Media Type" name="mediaType" required>
                            <USelect v-model="state.mediaType" size="xl" class="w-full" placeholder="Select media type" :items="mediaTypeOptions" />
                        </UFormField>

                        <UFormField label="Title" name="title" required>
                            <UInput v-model="state.title" size="xl" class="w-full" placeholder="Enter title" />
                        </UFormField>

                        <UFormField label="Original Title">
                            <UInput v-model="state.originalTitle" size="xl" class="w-full" placeholder="Enter original title" />
                        </UFormField>

                        <UFormField label="Year" name="year" required>
                            <UInputNumber
                                v-model="state.year"
                                size="xl"
                                class="w-full"
                                placeholder="Enter year"
                                :increment="false"
                                :decrement="false"
                                :format-options="{ useGrouping: false }"
                            />
                        </UFormField>
                    </div>
                </section>

                <section v-if="isTV" class="rounded-xl border border-default/70 bg-elevated/30 p-4 space-y-4 shadow-xs">
                    <h3 class="text-sm font-semibold text-default">TV Details</h3>
                    <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        <UFormField label="Season" name="season" required>
                            <UInputNumber
                                v-model="state.season"
                                size="xl"
                                class="w-full"
                                placeholder="Enter season"
                                :increment="false"
                                :decrement="false"
                                :format-options="{ useGrouping: false }"
                            />
                        </UFormField>

                        <UFormField name="episode" label="Episode">
                            <template #hint>
                                <USwitch :model-value="isMultiEpisode" size="sm" label="Multi-episode" aria-label="Multi-episode" @update:model-value="onToggleMultiEpisode" />
                            </template>
                            <div class="flex items-center gap-2">
                                <UInputNumber
                                    v-model="state.episode"
                                    size="xl"
                                    class="w-full"
                                    :placeholder="isMultiEpisode ? 'First' : 'Enter episode'"
                                    :aria-label="isMultiEpisode ? 'First Episode' : 'Episode'"
                                    :increment="false"
                                    :decrement="false"
                                    :format-options="{ useGrouping: false }"
                                />
                                <template v-if="isMultiEpisode">
                                    <span class="text-muted shrink-0 text-sm font-medium">–</span>
                                    <UFormField name="episodeEnd" class="w-full">
                                        <UInputNumber
                                            v-model="state.episodeEnd"
                                            size="xl"
                                            class="w-full"
                                            placeholder="Last"
                                            aria-label="Last Episode"
                                            :increment="false"
                                            :decrement="false"
                                            :format-options="{ useGrouping: false }"
                                        />
                                    </UFormField>
                                </template>
                            </div>
                        </UFormField>

                        <UFormField v-if="isSpecial" label="Special Name">
                            <UInput v-model="state.specialName" size="xl" class="w-full" placeholder="Enter special name" />
                        </UFormField>
                    </div>
                </section>

                <section class="rounded-xl border border-default/70 bg-elevated/30 p-4 space-y-4 shadow-xs">
                    <h3 class="text-sm font-semibold text-default">Source And Release</h3>
                    <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        <UFormField label="Source" name="source" required>
                            <USelect v-model="state.source" size="xl" class="w-full" placeholder="Select source" :items="sourceOptions" />
                        </UFormField>

                        <UFormField label="Type" name="sourceType" required>
                            <USelect v-model="state.sourceType" size="xl" class="w-full" placeholder="Select type" :items="sourceTypeOptions" />
                        </UFormField>

                        <UFormField v-if="isWebSource" label="Service" required>
                            <USelect v-model="state.service" size="xl" class="w-full" placeholder="Select service" :items="serviceOptions" />
                        </UFormField>

                        <UFormField label="Release Group">
                            <UInput v-model="state.releaseGroup" size="xl" class="w-full" placeholder="Enter release group" />
                        </UFormField>

                        <UFormField label="Resolution" name="resolution" required>
                            <USelect v-model="state.resolution" size="xl" class="w-full" placeholder="Select resolution" :items="resolutionOptions" />
                        </UFormField>

                        <UFormField label="HDR">
                            <USelect v-model="state.hdr" size="xl" class="w-full" placeholder="Select HDR" :items="hdrOptions" multiple />
                        </UFormField>

                        <UFormField label="Language" name="language" required>
                            <USelect v-model="state.language" size="xl" class="w-full" placeholder="Select language" :items="languageOptions" multiple />
                        </UFormField>

                        <UFormField label="Original Language" name="originalLanguage">
                            <USelect v-model="state.originalLanguage" size="xl" class="w-full" :items="languageOptions" placeholder="Select original language" />
                        </UFormField>

                        <UFormField label="Cut">
                            <USelect v-model="state.cut" size="xl" class="w-full" placeholder="Select cut" :items="cutOptions" />
                        </UFormField>

                        <UFormField label="Ratio">
                            <USelect v-model="state.ratio" size="xl" class="w-full" placeholder="Select ratio" :items="ratioOptions" />
                        </UFormField>

                        <UFormField label="Locale">
                            <UInput v-model="state.locale" size="xl" class="w-full" placeholder="e.g. US, KR, GB" />
                        </UFormField>

                        <UFormField label="Flags" class="md:col-span-2">
                            <div class="flex flex-wrap items-center gap-4 py-2">
                                <div class="flex items-center gap-1.5">
                                    <UCheckbox
                                        :model-value="state.repack > 0"
                                        size="xl"
                                        label="Repack"
                                        color="neutral"
                                        aria-label="Repack"
                                        @update:model-value="(v) => (state.repack = v ? 1 : 0)"
                                    />
                                    <UInput v-if="state.repack > 0" v-model.number="state.repack" type="number" size="sm" :min="1" class="w-14" aria-label="Repack number" />
                                </div>
                                <div class="flex items-center gap-1.5">
                                    <UCheckbox
                                        :model-value="state.proper > 0"
                                        size="xl"
                                        label="Proper"
                                        color="neutral"
                                        aria-label="Proper"
                                        @update:model-value="(v) => (state.proper = v ? 1 : 0)"
                                    />
                                    <UInput v-if="state.proper > 0" v-model.number="state.proper" type="number" size="sm" :min="1" class="w-14" aria-label="Proper number" />
                                </div>
                                <div class="flex items-center gap-1.5">
                                    <UCheckbox
                                        :model-value="state.rerip > 0"
                                        size="xl"
                                        label="ReRip"
                                        color="neutral"
                                        aria-label="ReRip"
                                        @update:model-value="(v) => (state.rerip = v ? 1 : 0)"
                                    />
                                    <UInput v-if="state.rerip > 0" v-model.number="state.rerip" type="number" size="sm" :min="1" class="w-14" aria-label="ReRip number" />
                                </div>
                                <UCheckbox v-model="state.hybrid" size="xl" label="Hybrid" color="neutral" aria-label="Hybrid" />
                                <UCheckbox
                                    v-if="state.videoCodec === 'AVC' || state.videoCodec === 'H.264' || state.videoCodec === 'x264'"
                                    v-model="state.hi10p"
                                    size="xl"
                                    label="Hi10P"
                                    color="neutral"
                                    aria-label="Hi10P"
                                />
                            </div>
                        </UFormField>
                    </div>
                </section>

                <section class="rounded-xl border border-default/70 bg-elevated/30 p-4 space-y-4 shadow-xs">
                    <h3 class="text-sm font-semibold text-default">Technical</h3>
                    <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        <UFormField label="Video Codec" name="videoCodec" required>
                            <USelect v-model="state.videoCodec" size="xl" class="w-full" placeholder="Select video codec" :items="videoCodecOptions" />
                        </UFormField>

                        <UFormField label="Audio Codec" name="audioCodec" required>
                            <USelect v-model="state.audioCodec" size="xl" class="w-full" placeholder="Select audio codec" :items="audioCodecOptions" />
                        </UFormField>

                        <UFormField label="Audio Channels" name="audioChannels" required>
                            <USelect v-model="state.audioChannels" size="xl" class="w-full" placeholder="Select audio channels" :items="audioChannelOptions" />
                        </UFormField>

                        <UFormField label="Audio Metadata">
                            <USelect v-model="state.audioMetadata" size="xl" class="w-full" placeholder="Select audio metadata" :items="audioMetadataOptions" />
                        </UFormField>
                    </div>
                </section>

                <section class="rounded-xl border border-default/70 bg-elevated/30 p-4 space-y-4 shadow-xs">
                    <h3 class="text-sm font-semibold text-default">External IDs</h3>
                    <div class="grid gap-4 md:grid-cols-3">
                        <UFormField label="TMDb ID" name="tmdbId" required>
                            <UInputNumber
                                v-model="state.tmdbId"
                                size="xl"
                                class="w-full"
                                placeholder="Enter TMDb ID"
                                :increment="false"
                                :decrement="false"
                                :format-options="{ useGrouping: false }"
                            />
                        </UFormField>

                        <UFormField label="IMDb ID" name="imdbId" required>
                            <UInput v-model="state.imdbId" size="xl" class="w-full" placeholder="Enter IMDb ID" />
                        </UFormField>

                        <UFormField v-if="isTV" label="TVDB ID" name="tvdbId" required>
                            <UInputNumber
                                v-model="state.tvdbId"
                                size="xl"
                                class="w-full"
                                placeholder="Enter TVDb ID"
                                :increment="false"
                                :decrement="false"
                                :format-options="{ useGrouping: false }"
                            />
                        </UFormField>
                    </div>
                </section>
                <StepNavigationButtons :next="{ type: 'submit' }" @back="emit('back')" />
            </UForm>
        </div>
    </UCard>
</template>
