<script lang="ts">
  import { bridgeStore } from './bridge-store'
  import type { PackingListQuestionSet, Question, Item, Person } from '../edit-questions/types'
  import { newDraftQuestion } from '../edit-questions/types'
  import PeopleSection from './PeopleSection.svelte'
  import AlwaysNeededItemsSection from './AlwaysNeededItemsSection.svelte'
  import QuestionSection from './QuestionSection.svelte'
  import AddItemModal, { type AddItemDestination } from './AddItemModal.svelte'
  import JsonEditor from './JsonEditor.svelte'

  interface Props {
    initialData: PackingListQuestionSet
  }
  let { initialData }: Props = $props()

  let questionSet = $state<PackingListQuestionSet>(structuredClone(initialData))
  let autoSaveStatus = $state<'idle' | 'saving' | 'saved' | 'error'>('idle')
  let editorMode = $state<'visual' | 'json'>('visual')
  let jsonValue = $state('')
  let originalJsonValue = $state('')
  let jsonError = $state<string | null>(null)
  let allQuestionsCollapsed = $state<boolean | null>(true)
  let isAddItemModalOpen = $state(false)
  let addItemModalQuestions = $state<Question[]>([])
  let scrollVersion = $state(0)

  type ScrollTarget =
    | { type: 'always'; version: number }
    | { type: 'option'; qi: number; oi: number; version: number }
    | null
  let scrollTarget = $state<ScrollTarget>(null)

  // KEY FIX: allItemNames computed once, not on every render of every child
  let allItemNames = $derived(
    questionSet.questions.flatMap(q => q.options.flatMap(o => o.items.map(i => i.text)))
  )

  // Auto-save: skip pod sync updates using a flag
  let mounted = false
  let skipNextSave = false

  // Apply pod sync updates without triggering auto-save
  $effect(() => {
    const podData = $bridgeStore.podSyncData
    if (!podData) return
    skipNextSave = true
    questionSet = structuredClone(podData)
  })

  $effect(() => {
    JSON.stringify(questionSet) // track
    if (!mounted) { mounted = true; return }
    if (skipNextSave) { skipNextSave = false; return }
    debouncedSave()
  })

  let saveTimer: ReturnType<typeof setTimeout>
  function debouncedSave() {
    clearTimeout(saveTimer)
    autoSaveStatus = 'saving'
    saveTimer = setTimeout(async () => {
      const ok = await $bridgeStore.onSave($state.snapshot(questionSet) as PackingListQuestionSet)
      autoSaveStatus = ok ? 'saved' : 'error'
      if (ok) setTimeout(() => { autoSaveStatus = 'idle' }, 2000)
    }, 800)
  }

  function formatLastSync(date: Date | null) {
    if (!date) return 'Never'
    const diffSecs = Math.floor((Date.now() - date.getTime()) / 1000)
    if (diffSecs < 60) return 'Just now'
    if (diffSecs < 120) return '1 minute ago'
    if (diffSecs < 3600) return `${Math.floor(diffSecs / 60)} minutes ago`
    return date.toLocaleTimeString()
  }

  // ── People mutations ──────────────────────────────────────────────
  function addPerson() {
    const newPerson: Person = { id: crypto.randomUUID(), name: '' }
    const newSel = { personId: newPerson.id, selected: false }
    for (const q of questionSet.questions) {
      for (const o of q.options) {
        for (const item of o.items) item.personSelections.push({ ...newSel })
      }
    }
    for (const item of questionSet.alwaysNeededItems) item.personSelections.push({ ...newSel })
    questionSet.people.push(newPerson)
  }

  function removePerson(idx: number) {
    for (const q of questionSet.questions) {
      for (const o of q.options) {
        for (const item of o.items) item.personSelections.splice(idx, 1)
      }
    }
    for (const item of questionSet.alwaysNeededItems) item.personSelections.splice(idx, 1)
    questionSet.people.splice(idx, 1)
  }

  function changePersonName(idx: number, name: string) {
    questionSet.people[idx].name = name
  }

  // ── Always-needed item mutations ──────────────────────────────────
  function addAlwaysNeededItem() {
    const personSelections = questionSet.people.map(p => ({ personId: p.id, selected: false }))
    questionSet.alwaysNeededItems.push({ text: '', personSelections })
    scrollTarget = { type: 'always', version: ++scrollVersion }
  }

  function removeAlwaysNeededItem(idx: number) {
    questionSet.alwaysNeededItems.splice(idx, 1)
  }

  function changeAlwaysNeededItem(idx: number, updated: Item) {
    questionSet.alwaysNeededItems[idx] = updated
  }

  // ── Question mutations ────────────────────────────────────────────
  function addQuestion() {
    allQuestionsCollapsed = null
    questionSet.questions.push(newDraftQuestion(questionSet.questions.length))
  }

  function removeQuestion(qi: number) {
    questionSet.questions.splice(qi, 1)
  }

  function changeQuestion(qi: number, updated: Question) {
    questionSet.questions[qi] = updated
  }

  function moveQuestion(qi: number, direction: 'up' | 'down') {
    const target = direction === 'up' ? qi - 1 : qi + 1
    if (target < 0 || target >= questionSet.questions.length) return
    const tmp = questionSet.questions[qi]
    questionSet.questions[qi] = questionSet.questions[target]
    questionSet.questions[target] = tmp
  }

  // ── Add Item modal ────────────────────────────────────────────────
  function handleOpenAddItemModal() {
    addItemModalQuestions = $state.snapshot(questionSet.questions) as Question[]
    isAddItemModalOpen = true
  }

  function handleAddItemConfirm(destination: AddItemDestination, item: Item) {
    scrollVersion++
    if (destination.type === 'always') {
      questionSet.alwaysNeededItems.push(item)
      scrollTarget = { type: 'always', version: scrollVersion }
    } else {
      const qi = questionSet.questions.findIndex(q => q.id === destination.questionId)
      const oi = qi >= 0 ? questionSet.questions[qi].options.findIndex(o => o.id === destination.optionId) : -1
      if (qi >= 0 && oi >= 0) {
        questionSet.questions[qi].options[oi].items.push(item)
        scrollTarget = { type: 'option', qi, oi, version: scrollVersion }
      }
    }
    $bridgeStore.onShowToast(`Added "${item.text}"`, 'success')
  }

  // ── Reset ─────────────────────────────────────────────────────────
  function handleReset() {
    $bridgeStore.onReset()
  }

  // ── JSON editor ───────────────────────────────────────────────────
  async function handleSaveJson() {
    const result = await $bridgeStore.onSaveJson(jsonValue)
    if (result.error) {
      jsonError = result.error
      $bridgeStore.onShowToast('Cannot save: JSON validation failed', 'error')
    } else {
      jsonError = null
      originalJsonValue = jsonValue
      $bridgeStore.onShowToast('JSON saved successfully!', 'success')
    }
  }

  $effect(() => {
    // When switching to JSON mode, populate editor with current data
    if (editorMode === 'json') {
      const { _id, _rev, lastModified, ...clean } = $state.snapshot(questionSet) as PackingListQuestionSet
      const json = JSON.stringify(clean, null, 2)
      jsonValue = json
      originalJsonValue = json
    }
  })
</script>

<div class="w-full flex flex-col items-center py-8 px-4">
  <div class="mb-8 w-full max-w-5xl">
    <h1 class="text-2xl font-bold text-gray-900">
      {$bridgeStore.foreignPodUrl ? 'Questions & Items' : 'My Questions & Items'}
    </h1>
    <p class="mt-2 text-gray-600">Customise the questions and packing items that generate your lists. Changes here affect all future packing lists you create.</p>
    <p class="mt-1 text-sm text-gray-400">Want to start from scratch? <a href="#/wizard" class="text-primary-600 hover:underline">Redo the setup wizard</a> to regenerate your questions.</p>


    <!-- Mobile status line -->
    <div class="lg:hidden mt-2 flex items-center gap-3 text-xs text-gray-400">
      {#if autoSaveStatus === 'saving'}
        <span class="flex items-center gap-1 text-blue-600">
          <svg class="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
          Saving…
        </span>
      {:else}
        <span>Saved</span>
      {/if}
      {#if $bridgeStore.isLoggedIn && !$bridgeStore.isSyncing && !$bridgeStore.syncError}
        <span>· Pod synced {formatLastSync($bridgeStore.lastSync)}</span>
      {/if}
    </div>
  </div>

  {#if editorMode === 'visual'}
    <div class="w-full max-w-5xl flex flex-col lg:flex-row lg:items-start lg:gap-8">
      <!-- Main form content -->
      <div class="space-y-6 flex-1 pb-32 lg:pb-8">
        <PeopleSection
          people={questionSet.people}
          onAddPerson={addPerson}
          onRemovePerson={removePerson}
          onChangeName={changePersonName}
        />
        <AlwaysNeededItemsSection
          items={questionSet.alwaysNeededItems}
          allPeople={questionSet.people}
          {allItemNames}
          onAddItem={addAlwaysNeededItem}
          onRemoveItem={removeAlwaysNeededItem}
          onChangeItem={changeAlwaysNeededItem}
          scrollToLastVersion={scrollTarget?.type === 'always' ? scrollTarget.version : undefined}
        />

        {#if questionSet.questions.length > 0}
          <div class="flex justify-end">
            <button
              type="button"
              onclick={() => (allQuestionsCollapsed = !allQuestionsCollapsed)}
              class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors duration-200"
            >
              {allQuestionsCollapsed ? 'Expand All' : 'Collapse All'}
            </button>
          </div>
        {/if}

        {#each questionSet.questions as question, qi (question.id)}
          <QuestionSection
            {question}
            questionIndex={qi}
            allPeople={questionSet.people}
            {allItemNames}
            forceCollapsed={allQuestionsCollapsed}
            onRemove={() => removeQuestion(qi)}
            onChange={(updated) => changeQuestion(qi, updated)}
            onMoveUp={qi > 0 ? () => moveQuestion(qi, 'up') : undefined}
            onMoveDown={qi < questionSet.questions.length - 1 ? () => moveQuestion(qi, 'down') : undefined}
            scrollToOptionIndex={scrollTarget?.type === 'option' && scrollTarget.qi === qi ? scrollTarget.oi : undefined}
            scrollToLastVersion={scrollTarget?.type === 'option' && scrollTarget.qi === qi ? scrollTarget.version : undefined}
          />
        {/each}

        <!-- Add Question button (large screens) -->
        <div class="hidden lg:block">
          <button
            type="button"
            onclick={addQuestion}
            class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors duration-200"
          >
            Add Question
          </button>
        </div>
      </div>

      <!-- Sticky sidebar (large screens) -->
      <div class="hidden lg:block lg:w-64 lg:sticky lg:top-24 flex-shrink-0">
        <div class="backdrop-blur-md bg-white/80 border border-gray-200 shadow-xl rounded-xl flex flex-col items-stretch gap-4 py-6 px-4 relative">
          {#if $bridgeStore.isLoggedIn && $bridgeStore.syncingFromPod}
            <div class="absolute -top-3 left-1/2 transform -translate-x-1/2 z-10 bg-blue-50 border border-blue-200 rounded-md px-3 py-1.5 flex items-center gap-1.5 shadow-md">
              <div class="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
              <span class="text-xs text-blue-700 font-medium whitespace-nowrap">Syncing from Pod...</span>
            </div>
          {/if}

          <!-- Auto-save status -->
          <div class="bg-gray-50 border border-gray-200 rounded-md p-3">
            <p class="text-xs font-semibold text-gray-700 mb-2">Auto-Save Status</p>
            <div class="flex items-center gap-2 transition-opacity duration-200 {autoSaveStatus === 'idle' ? 'opacity-60' : 'opacity-100'}">
              {#if autoSaveStatus === 'saving'}
                <div class="animate-spin h-3 w-3 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                <span class="text-xs text-blue-600">Saving...</span>
              {:else if autoSaveStatus === 'saved'}
                <div class="h-3 w-3 flex items-center justify-center text-green-500">✓</div>
                <span class="text-xs text-green-600">Saved</span>
              {:else if autoSaveStatus === 'error'}
                <div class="h-3 w-3 flex items-center justify-center text-red-500">✗</div>
                <span class="text-xs text-red-600">Error</span>
              {:else}
                <div class="h-3 w-3 flex items-center justify-center text-gray-500">✓</div>
                <span class="text-xs text-gray-600">All changes saved</span>
              {/if}
            </div>
          </div>

          {#if $bridgeStore.isLoggedIn}
            <div class="bg-gray-50 border border-gray-200 rounded-md p-3">
              <p class="text-xs font-semibold text-gray-700 mb-1">Pod Sync Status</p>
              <div class="flex items-center gap-2 mb-1">
                {#if $bridgeStore.isSyncing}
                  <div class="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                  <p class="text-xs text-gray-600">Polling...</p>
                {:else if $bridgeStore.syncError}
                  <div class="w-2 h-2 bg-red-500 rounded-full"></div>
                  <p class="text-xs text-red-600">Error</p>
                {:else}
                  <div class="w-2 h-2 bg-green-500 rounded-full"></div>
                  <p class="text-xs text-gray-600">Active</p>
                {/if}
              </div>
              <p class="text-xs text-gray-500">Last sync: {formatLastSync($bridgeStore.lastSync)}</p>
              {#if $bridgeStore.syncError}
                <p class="text-xs text-red-500 mt-1">{$bridgeStore.syncError}</p>
              {/if}
            </div>
          {/if}

          <button
            type="button"
            onclick={addQuestion}
            class="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors duration-200"
          >Add Question</button>
          <button
            type="button"
            onclick={handleOpenAddItemModal}
            class="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors duration-200"
          >Add Item...</button>
          <button
            type="button"
            onclick={() => (editorMode = 'json')}
            class="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors duration-200"
          >Edit JSON</button>
          <button
            type="button"
            onclick={handleReset}
            class="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors duration-200"
          >Reset form</button>
        </div>
      </div>
    </div>

    <!-- Sticky bottom bar (mobile) -->
    <div class="fixed bottom-0 left-0 w-full z-50 flex justify-center pointer-events-none lg:hidden">
      <div class="max-w-4xl w-full px-4 pb-4">
        <div class="backdrop-blur-md bg-white/80 border border-gray-200 shadow-xl rounded-xl flex items-center justify-center gap-3 py-3 px-4 pointer-events-auto relative">
          {#if $bridgeStore.isLoggedIn && $bridgeStore.syncingFromPod}
            <div class="absolute -top-3 left-1/2 transform -translate-x-1/2 z-10 bg-blue-50 border border-blue-200 rounded-md px-3 py-1.5 flex items-center gap-1.5 shadow-md">
              <div class="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
              <span class="text-xs text-blue-700 font-medium whitespace-nowrap">Syncing from Pod...</span>
            </div>
          {/if}
          <button type="button" onclick={addQuestion} class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors duration-200">Add Question</button>
          <button type="button" onclick={handleOpenAddItemModal} class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors duration-200">Add Item...</button>
          <button type="button" onclick={handleReset} class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-md transition-colors duration-200">Reset</button>
        </div>
      </div>
    </div>

    <AddItemModal
      isOpen={isAddItemModalOpen}
      questions={addItemModalQuestions}
      people={questionSet.people}
      existingItemNames={allItemNames}
      onClose={() => (isAddItemModalOpen = false)}
      onConfirm={handleAddItemConfirm}
    />
  {:else}
    <!-- JSON editor mode -->
    <div class="w-full max-w-5xl">
      <div class="mb-4 flex items-center gap-3">
        <button
          type="button"
          onclick={() => (editorMode = 'visual')}
          class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors duration-200"
        >
          ← Back to Visual Editor
        </button>
      </div>
      <JsonEditor
        value={jsonValue}
        originalValue={originalJsonValue}
        error={jsonError}
        hasUnsavedChanges={jsonValue !== originalJsonValue}
        onchange={(v) => (jsonValue = v)}
        onsave={handleSaveJson}
        onValidationChange={(errs) => { if (errs === null && jsonError) jsonError = null }}
      />
    </div>
  {/if}
</div>
