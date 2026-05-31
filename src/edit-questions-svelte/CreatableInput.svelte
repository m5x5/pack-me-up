<script lang="ts">
  import { onMount } from 'svelte'

  interface Props {
    value: string
    options: string[]
    placeholder?: string
    onchange: (value: string) => void
    autofocus?: boolean
  }

  let { value, options, placeholder = 'Enter item', onchange, autofocus = false }: Props = $props()

  let inputEl: HTMLInputElement
  const listId = `creatable-${Math.random().toString(36).slice(2)}`

  onMount(() => {
    if (autofocus) inputEl?.focus()
  })

  function handleBlur() {
    const trimmed = inputEl.value.trim()
    if (trimmed && trimmed !== value) onchange(trimmed)
  }

  function handleInput(e: Event) {
    // live-update so the datalist matches as the user types
    const v = (e.target as HTMLInputElement).value
    if (!v) onchange('')
  }

  function handleChange(e: Event) {
    const v = (e.target as HTMLInputElement).value
    onchange(v)
  }
</script>

<div class="relative">
  <input
    bind:this={inputEl}
    type="text"
    list={listId}
    {value}
    {placeholder}
    oninput={handleInput}
    onchange={handleChange}
    onblur={handleBlur}
    class="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
  />
  <datalist id={listId}>
    {#each options as opt (opt)}
      <option value={opt}></option>
    {/each}
  </datalist>
</div>
