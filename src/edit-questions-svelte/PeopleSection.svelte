<script lang="ts">
  import type { Person } from '../edit-questions/types'

  interface Props {
    people: Person[]
    onAddPerson: () => void
    onRemovePerson: (idx: number) => void
    onChangeName: (idx: number, name: string) => void
  }

  let { people, onAddPerson, onRemovePerson, onChangeName }: Props = $props()

  let isExpanded = $state(false)

  let personLabel = $derived(people.length === 1 ? '1 person' : `${people.length} people`)
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
      <h2 class="text-lg font-medium text-gray-900">People <span class="text-sm font-normal text-gray-500">({personLabel})</span></h2>
      <p class="text-sm text-gray-600">Who you are packing for.</p>
    </div>
  </button>

  {#if isExpanded}
    <div class="space-y-4">
      {#each people as person, i (person.id)}
        <div class="flex items-center gap-2">
          <div class="flex-1">
            <label class="block text-sm font-medium text-gray-700 mb-1" for="person-{i}">Person {i + 1}</label>
            <input
              id="person-{i}"
              type="text"
              value={person.name}
              placeholder="Enter person name"
              oninput={(e) => onChangeName(i, (e.target as HTMLInputElement).value)}
              class="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
          {#if people.length > 1}
            <button
              type="button"
              onclick={() => onRemovePerson(i)}
              aria-label={`Remove person ${i + 1}`}
              class="mt-6 rounded-full p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors duration-200"
            >
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          {/if}
        </div>
      {/each}
    </div>
    <div class="mt-4">
      <button
        type="button"
        onclick={onAddPerson}
        class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors duration-200"
      >
        Add Person
      </button>
    </div>
  {/if}
</div>
