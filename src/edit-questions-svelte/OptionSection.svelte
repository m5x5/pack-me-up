<script lang="ts">
  import type { Option, Person, Item } from '../edit-questions/types'
  import ItemPeopleSection from './ItemPeopleSection.svelte'
  import CreatableInput from './CreatableInput.svelte'

  interface Props {
    option: Option
    optionIndex: number
    allPeople: Person[]
    allItemNames: string[]
    onRemove: () => void
    onChange: (updated: Option) => void
    scrollToLastVersion?: number
  }

  let { option, optionIndex, allPeople, allItemNames, onRemove, onChange, scrollToLastVersion }: Props = $props()

  let isExpanded = $state(false)
  let everExpanded = $state(false)
  let newItemIndex = $state<number | null>(null)
  let itemEls: HTMLDivElement[] = []

  function expand() {
    if (!everExpanded) everExpanded = true
    isExpanded = true
  }

  $effect(() => {
    if (!scrollToLastVersion) return
    expand()
    requestAnimationFrame(() => {
      const idx = option.items.length - 1
      if (idx >= 0) {
        itemEls[idx]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        newItemIndex = idx
      }
    })
  })

  function updateText(text: string) {
    onChange({ ...option, text })
  }

  function addItem() {
    const newItem: Item = { text: '', personSelections: allPeople.map(p => ({ personId: p.id, selected: false })) }
    const updated = { ...option, items: [...option.items, newItem] }
    onChange(updated)
    requestAnimationFrame(() => { newItemIndex = updated.items.length - 1 })
  }

  function removeItem(idx: number) {
    onChange({ ...option, items: option.items.filter((_, i) => i !== idx) })
  }

  function changeItem(idx: number, updated: Item) {
    const items = option.items.map((it, i) => i === idx ? updated : it)
    onChange({ ...option, items })
  }
</script>

<div class="bg-gray-50 rounded-lg p-4">
  <div class="flex items-start gap-2 sm:gap-4 {isExpanded ? 'mb-4' : ''}">
    <button
      type="button"
      onclick={() => isExpanded ? (isExpanded = false) : expand()}
      class="text-gray-400 hover:text-gray-600 transition-colors duration-200 mt-7"
      title={isExpanded ? 'Collapse' : 'Expand'}
    >
      <svg
        class="w-5 h-5 transform transition-transform duration-200 {isExpanded ? 'rotate-180' : ''}"
        fill="none" viewBox="0 0 24 24" stroke="currentColor"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
      </svg>
    </button>
    <div class="flex-1">
      <label class="block text-sm font-medium text-gray-700 mb-1" for="option-{optionIndex}">Option {optionIndex + 1}</label>
      <input
        id="option-{optionIndex}"
        type="text"
        value={option.text}
        placeholder="Enter option text"
        oninput={(e) => updateText((e.target as HTMLInputElement).value)}
        class="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
      />
    </div>
    <button
      type="button"
      onclick={onRemove}
      aria-label={`Remove option ${optionIndex + 1}`}
      class="mt-6 rounded-full p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors duration-200"
    >
      <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  </div>

  {#if everExpanded}
    <div class="ml-0 sm:ml-4 space-y-3" class:hidden={!isExpanded}>
      <div class="text-sm font-medium text-gray-700 mb-2">Items:</div>
      {#each option.items as item, i}
        <div
          bind:this={itemEls[i]}
          class="flex items-start gap-2 sm:gap-3 rounded-md {i === newItemIndex ? 'ring-2 ring-primary-300' : ''}"
        >
          <div class="flex-1">
            <ItemPeopleSection
              personSelections={item.personSelections}
              {allPeople}
              onchange={(sels) => changeItem(i, { ...item, personSelections: sels })}
            />
            <CreatableInput
              value={item.text}
              options={allItemNames}
              placeholder="Enter item"
              onchange={(val) => changeItem(i, { ...item, text: val })}
            />
          </div>
          <button
            type="button"
            onclick={() => removeItem(i)}
            aria-label={`Remove item ${i + 1}`}
            class="mt-1 rounded-full p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors duration-200"
          >
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      {/each}
      <button
        type="button"
        onclick={addItem}
        class="mt-2 inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors duration-200"
      >
        Add Item
      </button>
    </div>
  {/if}
</div>
