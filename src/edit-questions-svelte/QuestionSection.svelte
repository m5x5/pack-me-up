<script lang="ts">
  import type { Question, Person, Option } from '../edit-questions/types'
  import { newOption } from '../edit-questions/types'
  import OptionSection from './OptionSection.svelte'

  interface Props {
    question: Question
    questionIndex: number
    allPeople: Person[]
    allItemNames: string[]
    forceCollapsed: boolean | null
    onRemove: () => void
    onChange: (updated: Question) => void
    onMoveUp?: () => void
    onMoveDown?: () => void
    scrollToOptionIndex?: number
    scrollToLastVersion?: number
  }

  let { question, questionIndex, allPeople, allItemNames, forceCollapsed, onRemove, onChange, onMoveUp, onMoveDown, scrollToOptionIndex, scrollToLastVersion }: Props = $props()

  let isExpanded = $state(true)

  $effect(() => {
    if (forceCollapsed !== null && forceCollapsed !== undefined) {
      isExpanded = !forceCollapsed
    }
  })

  $effect(() => {
    if (scrollToLastVersion != null) isExpanded = true
  })

  function updateText(text: string) {
    onChange({ ...question, text })
  }

  function updateQuestionType(questionType: 'single-choice' | 'multiple-choice') {
    onChange({ ...question, questionType })
  }

  function addOption() {
    const updated = { ...question, options: [...question.options, newOption(question.options.length)] }
    onChange(updated)
  }

  function removeOption(idx: number) {
    onChange({ ...question, options: question.options.filter((_, i) => i !== idx) })
  }

  function changeOption(idx: number, updated: Option) {
    const options = question.options.map((o, i) => i === idx ? updated : o)
    onChange({ ...question, options })
  }
</script>

<div class="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
  <div class="p-4 sm:p-6">
    <div class="flex items-center gap-2 sm:gap-4 mb-6">
      <button
        type="button"
        onclick={() => (isExpanded = !isExpanded)}
        class="text-gray-400 hover:text-gray-600 transition-colors duration-200"
        title={isExpanded ? 'Collapse' : 'Expand'}
      >
        <svg
          class="w-5 h-5 transform transition-transform duration-200 {isExpanded ? 'rotate-180' : ''}"
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <div class="flex flex-col gap-1">
        <button
          type="button"
          onclick={onMoveUp}
          disabled={!onMoveUp}
          class="text-gray-400 transition-colors duration-200 {onMoveUp ? 'hover:text-gray-600 cursor-pointer' : 'opacity-30 cursor-not-allowed'}"
          title="Move up"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
          </svg>
        </button>
        <button
          type="button"
          onclick={onMoveDown}
          disabled={!onMoveDown}
          class="text-gray-400 transition-colors duration-200 {onMoveDown ? 'hover:text-gray-600 cursor-pointer' : 'opacity-30 cursor-not-allowed'}"
          title="Move down"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      <div class="flex-1">
        <label class="block text-sm font-medium text-gray-700 mb-1" for="question-{questionIndex}">Question {questionIndex + 1}</label>
        <input
          id="question-{questionIndex}"
          type="text"
          value={question.text}
          placeholder="Enter your question"
          oninput={(e) => updateText((e.target as HTMLInputElement).value)}
          class="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
      </div>

      <button
        type="button"
        onclick={onRemove}
        aria-label={`Remove question ${questionIndex + 1}`}
        class="mt-6 rounded-full p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors duration-200"
      >
        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>

    {#if isExpanded}
      <div class="mb-4 pb-4 border-b border-gray-200">
        <p class="block text-sm font-medium text-gray-700 mb-2">Question Type</p>
        <div class="flex gap-4">
          <label class="flex items-center">
            <input
              type="radio"
              value="single-choice"
              checked={question.questionType === 'single-choice' || !question.questionType}
              onchange={() => updateQuestionType('single-choice')}
              class="mr-2"
            />
            <span class="text-sm text-gray-700">Single Choice</span>
          </label>
          <label class="flex items-center">
            <input
              type="radio"
              value="multiple-choice"
              checked={question.questionType === 'multiple-choice'}
              onchange={() => updateQuestionType('multiple-choice')}
              class="mr-2"
            />
            <span class="text-sm text-gray-700">Multiple Choice</span>
          </label>
        </div>
      </div>

      <div class="space-y-4">
        {#each question.options as option, oi (option.id)}
          <OptionSection
            {option}
            optionIndex={oi}
            {allPeople}
            {allItemNames}
            onRemove={() => removeOption(oi)}
            onChange={(updated) => changeOption(oi, updated)}
            scrollToLastVersion={oi === scrollToOptionIndex ? scrollToLastVersion : undefined}
          />
        {/each}
        <div class="mt-4">
          <button
            type="button"
            onclick={addOption}
            class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors duration-200"
          >
            Add Option
          </button>
        </div>
      </div>
    {/if}
  </div>
</div>
