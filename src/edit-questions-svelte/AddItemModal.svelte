<script lang="ts">
  import type { Question, Person, PersonSelection, Item } from '../edit-questions/types'
  import CreatableInput from './CreatableInput.svelte'

  export type AddItemDestination =
    | { type: 'always' }
    | { type: 'option'; questionId: string; optionId: string }

  interface Props {
    isOpen: boolean
    questions: Question[]
    people: Person[]
    existingItemNames: string[]
    onClose: () => void
    onConfirm: (destination: AddItemDestination, item: Item) => void
  }

  let { isOpen, questions, people, existingItemNames, onClose, onConfirm }: Props = $props()

  let step = $state<'destination' | 'details'>('destination')
  let selectedDest = $state<AddItemDestination | null>(null)
  let destLabel = $state('')
  let text = $state('')
  let personSelections = $state<PersonSelection[]>([])
  let textError = $state(false)
  let peopleError = $state(false)

  $effect(() => {
    if (isOpen) {
      step = 'destination'
      selectedDest = null
      destLabel = ''
      text = ''
      personSelections = people.map(p => ({ personId: p.id, selected: false }))
      textError = false
      peopleError = false
    }
  })

  let allSelected = $derived(personSelections.length > 0 && personSelections.every(s => s.selected))

  function pickDestination(dest: AddItemDestination, label: string) {
    selectedDest = dest
    destLabel = label
    step = 'details'
  }

  function handleToggleAll() {
    const next = !allSelected
    personSelections = personSelections.map(s => ({ ...s, selected: next }))
    if (next) peopleError = false
  }

  function handleTogglePerson(idx: number) {
    personSelections = personSelections.map((s, i) => i === idx ? { ...s, selected: !s.selected } : s)
    if (personSelections.some(s => s.selected)) peopleError = false
  }

  function handleTextChange(val: string) {
    text = val
    if (val.trim()) textError = false
  }

  function handleConfirm() {
    if (!selectedDest) return
    const trimmed = text.trim()
    const missingText = !trimmed
    const missingPeople = people.length > 0 && !personSelections.some(s => s.selected)
    if (missingText) textError = true
    if (missingPeople) peopleError = true
    if (missingText || missingPeople) return
    onConfirm(selectedDest, { text: trimmed, personSelections })
    onClose()
  }
</script>

{#if isOpen}
  <div class="fixed inset-0 z-50 flex items-stretch sm:items-center sm:justify-center sm:p-8">
    <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" role="button" tabindex="-1" onclick={onClose} onkeydown={(e) => e.key === 'Escape' && onClose()}></div>
    <div
      role="dialog"
      aria-modal="true"
      class="relative flex flex-col w-full bg-white shadow-xl sm:rounded-lg sm:max-w-lg sm:h-[calc(100vh-8rem)]"
    >
      <div class="flex items-center justify-between px-4 py-4 border-b border-gray-200 sm:px-6">
        {#if step === 'details'}
          <button
            type="button"
            onclick={() => (step = 'destination')}
            class="mr-2 text-gray-400 hover:text-gray-600 focus:outline-none"
            aria-label="Back"
          >
            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
        {/if}
        <h3 class="text-lg font-semibold text-gray-900 flex-1 truncate">
          {step === 'destination' ? 'Add Item — where?' : destLabel}
        </h3>
        <button
          type="button"
          class="rounded-md text-gray-400 hover:text-gray-500 focus:outline-none"
          onclick={onClose}
        >
          <span class="sr-only">Close</span>
          <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {#if step === 'destination'}
        <div class="flex-1 overflow-y-auto px-2 py-2 space-y-1">
          <button
            type="button"
            onclick={() => pickDestination({ type: 'always' }, 'Always Needed Items')}
            class="w-full text-left px-3 py-2 rounded-md text-sm text-gray-800 hover:bg-gray-100 active:bg-gray-200 transition-colors"
          >
            Always Needed Items
          </button>
          {#each questions as q}
            {#each q.options as o (`${q.id}::${o.id}`)}
              <button
                type="button"
                onclick={() => pickDestination({ type: 'option', questionId: q.id, optionId: o.id }, `${q.text}: ${o.text}`)}
                class="w-full text-left px-3 py-2 rounded-md text-sm text-gray-800 hover:bg-gray-100 active:bg-gray-200 transition-colors"
              >
                <span class="text-gray-500">{q.text}:</span> {o.text}
              </button>
            {/each}
          {/each}
        </div>
      {/if}

      {#if step === 'details'}
        <div class="flex-1 overflow-y-auto px-4 py-4 sm:px-6 space-y-4">
          <div>
            <CreatableInput
              value={text}
              options={existingItemNames}
              placeholder="Enter item name"
              onchange={handleTextChange}
            />
            {#if textError}
              <p class="text-sm text-red-600 mt-1">Please enter an item name.</p>
            {/if}
          </div>

          {#if people.length > 0}
            <div>
              <div class="text-sm font-medium text-gray-700 mb-2">Who needs it?</div>
              {#if peopleError}
                <p class="text-sm text-red-600 mb-2">Please select at least one person.</p>
              {/if}
              <div class="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onclick={handleToggleAll}
                  class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border-2 border-primary-200 text-primary-700 bg-white hover:bg-primary-50 hover:border-primary-300 transition-all duration-200 focus:outline-none"
                >
                  <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    {#if allSelected}
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    {:else}
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                    {/if}
                  </svg>
                  {allSelected ? 'Unselect All' : 'Select All'}
                </button>
                {#each people as person, i (person.id)}
                  {@const isSelected = personSelections[i]?.selected ?? false}
                  <button
                    type="button"
                    onclick={() => handleTogglePerson(i)}
                    class="inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg border-2 cursor-pointer transition-all duration-200 {isSelected
                      ? 'bg-primary-50 border-primary-400 text-primary-900 shadow-sm'
                      : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50'}"
                  >
                    {person.name}
                  </button>
                {/each}
              </div>
            </div>
          {/if}

          <div class="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onclick={onClose}
              class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 rounded-md transition-colors duration-200"
            >
              Cancel
            </button>
            <button
              type="button"
              onclick={handleConfirm}
              class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-md transition-colors duration-200"
            >
              Add Item
            </button>
          </div>
        </div>
      {/if}
    </div>
  </div>
{/if}
