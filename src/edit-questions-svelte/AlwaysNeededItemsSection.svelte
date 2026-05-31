<script lang="ts">
  import type { Item, Person } from '../edit-questions/types'
  import ItemPeopleSection from './ItemPeopleSection.svelte'
  import CreatableInput from './CreatableInput.svelte'

  interface Props {
    items: Item[]
    allPeople: Person[]
    allItemNames: string[]
    onAddItem: () => void
    onRemoveItem: (idx: number) => void
    onChangeItem: (idx: number, updated: Item) => void
    scrollToLastVersion?: number
  }

  let { items, allPeople, allItemNames, onAddItem, onRemoveItem, onChangeItem, scrollToLastVersion }: Props = $props()

  let isExpanded = $state(false)
  let newItemIndex = $state<number | null>(null)
  let itemEls: HTMLDivElement[] = []

  $effect(() => {
    if (!scrollToLastVersion) return
    isExpanded = true
    const idx = items.length - 1
    if (idx >= 0) {
      requestAnimationFrame(() => {
        itemEls[idx]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        newItemIndex = idx
      })
    }
  })

  function handleAddItem() {
    onAddItem()
    requestAnimationFrame(() => {
      const idx = items.length // will be length after add
      newItemIndex = idx
    })
  }

  let itemCount = $derived(items.length)
  let itemLabel = $derived(`${itemCount} ${itemCount === 1 ? 'item' : 'items'}`)
</script>

<div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
  <button
    type="button"
    onclick={() => (isExpanded = !isExpanded)}
    class="flex items-center gap-2 mb-4 w-full text-left hover:bg-gray-50 -mx-4 -mt-4 px-4 pt-4 rounded-t-lg transition-colors duration-200"
  >
    <svg
      class="w-5 h-5 text-gray-400 transform transition-transform duration-200 {isExpanded ? 'rotate-180' : ''}"
      fill="none" viewBox="0 0 24 24" stroke="currentColor"
    >
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
    </svg>
    <div>
      <h2 class="text-lg font-medium text-gray-900">Always Needed Items <span class="text-sm font-normal text-gray-500">({itemLabel})</span></h2>
      <p class="text-sm text-gray-600">Items that should always be included in the packing list.</p>
    </div>
  </button>

  {#if isExpanded}
    <div class="space-y-3">
      {#each items as item, i}
        <div
          bind:this={itemEls[i]}
          class="flex items-start gap-2 sm:gap-3 rounded-md {i === newItemIndex ? 'ring-2 ring-primary-300' : ''}"
        >
          <div class="flex-1">
            <ItemPeopleSection
              personSelections={item.personSelections}
              {allPeople}
              onchange={(sels) => onChangeItem(i, { ...item, personSelections: sels })}
            />
            <CreatableInput
              value={item.text}
              options={allItemNames}
              placeholder="Enter item"
              onchange={(val) => onChangeItem(i, { ...item, text: val })}
            />
          </div>
          <button
            type="button"
            onclick={() => onRemoveItem(i)}
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
        onclick={handleAddItem}
        class="mt-2 inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors duration-200"
      >
        Add Item
      </button>
    </div>
  {/if}
</div>
