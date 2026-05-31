<script lang="ts">
  import type { PersonSelection, Person } from '../edit-questions/types'

  interface Props {
    personSelections: PersonSelection[]
    allPeople: Person[]
    onchange: (selections: PersonSelection[]) => void
  }

  let { personSelections, allPeople, onchange }: Props = $props()

  let allSelected = $derived(personSelections.length > 0 && personSelections.every(s => s.selected))

  function toggleAll() {
    const next = !allSelected
    onchange(allPeople.map((p, i) => ({
      personId: personSelections[i]?.personId ?? p.id,
      selected: next,
    })))
  }

  function togglePerson(idx: number) {
    onchange(personSelections.map((s, i) => i === idx ? { ...s, selected: !s.selected } : s))
  }
</script>

<div class="flex items-center gap-2 flex-wrap mb-2">
  <button
    type="button"
    onclick={toggleAll}
    class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border-2 border-primary-200 text-primary-700 bg-white hover:bg-primary-50 hover:border-primary-300 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1"
    aria-label={allSelected ? 'Unselect all people' : 'Select all people'}
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

  {#each allPeople as person, i (person.id)}
    {@const isSelected = personSelections[i]?.selected ?? false}
    <label
      class="inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg border-2 cursor-pointer transition-all duration-200 {isSelected
        ? 'bg-primary-50 border-primary-400 text-primary-900 shadow-sm'
        : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50'}"
    >
      <input
        type="checkbox"
        checked={isSelected}
        onchange={() => togglePerson(i)}
        class="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-2 focus:ring-primary-500 focus:ring-offset-0 cursor-pointer"
        aria-label={`Select ${person.name}`}
      />
      <span class="font-medium select-none">{person.name}</span>
    </label>
  {/each}
</div>
