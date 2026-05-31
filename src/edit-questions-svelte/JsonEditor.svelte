<script lang="ts">
  import { validateQuestionSet, type ValidationError } from '../edit-questions/validation'

  interface Props {
    value: string
    originalValue: string
    error: string | null
    hasUnsavedChanges: boolean
    onchange: (v: string) => void
    onsave: () => void
    onValidationChange?: (errors: ValidationError[] | null) => void
  }

  let { value, originalValue, error, hasUnsavedChanges, onchange, onsave, onValidationChange }: Props = $props()

  let textarea: HTMLTextAreaElement
  let lineNumbers: HTMLDivElement
  let userPrompt = $state('')
  let copySuccess = $state(false)
  let showScrollTop = $state(false)
  let showDiff = $state(false)
  let diffTab = $state<'summary' | 'questions' | 'items'>('summary')
  let validationErrors = $state<ValidationError[] | null>(null)
  let isValidating = $state(false)

  let lineCount = $derived(value.split('\n').length)

  // Debounced validation
  let validationTimer: ReturnType<typeof setTimeout>
  $effect(() => {
    const v = value // track
    clearTimeout(validationTimer)
    validationTimer = setTimeout(() => {
      isValidating = true
      try {
        const parsed = JSON.parse(v)
        const result = validateQuestionSet(parsed, v)
        validationErrors = result.valid ? null : (result.errors ?? null)
        onValidationChange?.(validationErrors)
      } catch {
        validationErrors = null
        onValidationChange?.(null)
      }
      isValidating = false
    }, 800)
  })

  function jumpToLine(lineNumber: number) {
    if (!textarea) return
    const lines = value.split('\n')
    let charPosition = 0
    for (let i = 0; i < Math.min(lineNumber - 1, lines.length); i++) {
      charPosition += lines[i].length + 1
    }
    textarea.focus()
    textarea.setSelectionRange(charPosition, charPosition + (lines[lineNumber - 1]?.length || 0))
    textarea.scrollTop = Math.max(0, (lineNumber - 1) * 24 - 100)
  }

  function handleScroll() {
    if (textarea && lineNumbers) {
      lineNumbers.scrollTop = textarea.scrollTop
      showScrollTop = textarea.scrollTop > 200
    }
  }

  function generatePrompt() {
    return `You are helping to modify a packing list question set JSON. Please read the specifications below, review the current JSON, and make the requested changes.

# JSON Structure Specification

The JSON represents a packing list question set with the following structure:

## Top-Level Fields:
- **people**: Array of people who will be packing
  - Each person has: { id: string, name: string }

- **alwaysNeededItems**: Array of items always needed regardless of answers
  - Each item has: { text: string, personSelections: Array<{ personId: string, selected: boolean }> }

- **questions**: Array of questions that determine what to pack
  - Each question has:
    - id: string (UUID)
    - type: "draft" | "saved"
    - text: string (the question text)
    - order: number (display order)
    - questionType: "single-choice" | "multiple-choice" (optional, defaults to single-choice)
    - options: Array of answer options
      - Each option has:
        - id: string (UUID)
        - text: string (the answer text)
        - order: number (display order)
        - items: Array of items needed if this option is selected
          - Each item: { text: string, personSelections: Array<{ personId: string, selected: boolean }> }

## Important Rules:
1. All IDs should be valid UUIDs
2. questionType can be "single-choice" or "multiple-choice"
3. personSelections tracks which people need each item
4. The order field determines display order (lower numbers appear first)

# Current JSON:

\`\`\`json
${value}
\`\`\`

# Instructions:

Please make the following changes to the JSON and return ONLY the complete updated JSON (no explanations, just the JSON):

${userPrompt}`
  }

  async function handleCopyPrompt() {
    try {
      await navigator.clipboard.writeText(generatePrompt())
      copySuccess = true
      setTimeout(() => (copySuccess = false), 2000)
    } catch {
      alert('Failed to copy to clipboard')
    }
  }

  // Diff computations — only run when diff is shown
  function computeSummary() {
    try {
      const orig = JSON.parse(originalValue || '{}')
      const cur = JSON.parse(value || '{}')
      const oq = orig.questions || []; const cq = cur.questions || []
      const op = orig.people || []; const cp = cur.people || []
      const oi = new Set<string>(); const ci = new Set<string>()
      oq.forEach((q: {options?: {items?: {text: string}[]}[]}) => q.options?.forEach(o => o.items?.forEach(i => oi.add(i.text))))
      orig.alwaysNeededItems?.forEach((i: {text: string}) => oi.add(i.text))
      cq.forEach((q: {options?: {items?: {text: string}[]}[]}) => q.options?.forEach(o => o.items?.forEach(i => ci.add(i.text))))
      cur.alwaysNeededItems?.forEach((i: {text: string}) => ci.add(i.text))
      return {
        questionsAdded: cq.filter((q: {text: string}) => !oq.find((o: {text: string}) => o.text === q.text)).length,
        questionsRemoved: oq.filter((q: {text: string}) => !cq.find((c: {text: string}) => c.text === q.text)).length,
        questionsModified: cq.filter((q: {questionType?: string; text: string}) => { const o = oq.find((oq: {text: string}) => oq.text === q.text); return o && (o as {questionType?: string}).questionType !== q.questionType }).length,
        itemsAdded: Array.from(ci).filter(t => !oi.has(t)).length,
        itemsRemoved: Array.from(oi).filter(t => !ci.has(t)).length,
        peopleAdded: cp.filter((p: {name: string}) => !op.find((o: {name: string}) => o.name === p.name)).length,
        peopleRemoved: op.filter((p: {name: string}) => !cp.find((c: {name: string}) => c.name === p.name)).length,
      }
    } catch { return { questionsAdded: 0, questionsRemoved: 0, questionsModified: 0, itemsAdded: 0, itemsRemoved: 0, peopleAdded: 0, peopleRemoved: 0 } }
  }

  function computeQuestionsDiff() {
    try {
      const orig = JSON.parse(originalValue || '{}'); const cur = JSON.parse(value || '{}')
      const oq = orig.questions || []; const cq = cur.questions || []
      type Q = { text: string; questionType?: string }
      const added = cq.filter((q: Q) => !oq.find((o: Q) => o.text === q.text))
      const removed = oq.filter((q: Q) => !cq.find((c: Q) => c.text === q.text))
      const modified = cq.filter((q: Q) => { const o = oq.find((o: Q) => o.text === q.text); return o && o.questionType !== q.questionType })
        .map((q: Q) => { const o = oq.find((o: Q) => o.text === q.text); return { text: q.text, oldType: o?.questionType || 'single-choice', newType: q.questionType || 'single-choice' } })
      return { added, removed, modified }
    } catch { return { added: [], removed: [], modified: [] } }
  }

  function computeItemsDiff() {
    try {
      const orig = JSON.parse(originalValue || '{}'); const cur = JSON.parse(value || '{}')
      type Item = { text: string }; type Opt = { items?: Item[]; text: string }; type Q = { text: string; options?: Opt[] }
      const oLocs = new Map<string, string[]>(); const cLocs = new Map<string, string[]>()
      const collect = (qs: Q[], always: Item[], map: Map<string, string[]>) => {
        qs.forEach(q => q.options?.forEach(o => o.items?.forEach(i => { const l = map.get(i.text) || []; l.push(`${q.text} > ${o.text}`); map.set(i.text, l) })))
        always?.forEach(i => { const l = map.get(i.text) || []; l.push('Always Needed'); map.set(i.text, l) })
      }
      collect(orig.questions || [], orig.alwaysNeededItems || [], oLocs)
      collect(cur.questions || [], cur.alwaysNeededItems || [], cLocs)
      const added: {text: string; locations: string[]}[] = [], removed: {text: string; locations: string[]}[] = [], modified: {text: string; oldLocations: string[]; newLocations: string[]}[] = []
      cLocs.forEach((locs, text) => { const old = oLocs.get(text); if (!old) added.push({ text, locations: locs }); else if (JSON.stringify(locs.sort()) !== JSON.stringify(old.sort())) modified.push({ text, oldLocations: old, newLocations: locs }) })
      oLocs.forEach((locs, text) => { if (!cLocs.has(text)) removed.push({ text, locations: locs }) })
      return { added, removed, modified }
    } catch { return { added: [], removed: [], modified: [] } }
  }
</script>

<div class="json-editor-container">
  <div class="json-editor-header">
    <h3>Raw JSON Editor</h3>
    <p class="json-editor-help">Edit the question set JSON directly.</p>
  </div>

  {#if error}
    <div class="json-editor-error json-editor-error-sticky">
      <div class="json-editor-error-header">
        <strong>{error.includes('Invalid JSON') ? 'JSON Syntax Error' : 'Validation Errors'}</strong>
        {#if !error.includes('Invalid JSON') && validationErrors && validationErrors.length > 0}
          <span class="json-editor-error-count">{validationErrors.length} issue{validationErrors.length > 1 ? 's' : ''}</span>
        {/if}
      </div>
      {#if validationErrors && validationErrors.length > 0}
        <ul class="json-editor-error-list">
          {#each validationErrors as err, idx}
            <li class="json-editor-error-item">
              <div class="json-editor-error-item-header">
                {#if err.lineNumber}<span class="json-editor-error-line">Line {err.lineNumber}</span>{/if}
                <code class="json-editor-error-path">{err.path}</code>
              </div>
              <div class="json-editor-error-message">{err.message}</div>
              {#if err.context}<div class="json-editor-error-context">{err.context}</div>{/if}
              {#if err.lineNumber}
                <button type="button" onclick={() => jumpToLine(err.lineNumber!)} class="json-editor-jump-button">
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                  Jump to error
                </button>
              {/if}
            </li>
          {/each}
        </ul>
      {:else}
        <p class="json-editor-error-simple">{error}</p>
      {/if}
    </div>
  {/if}

  {#if !error && validationErrors === null && hasUnsavedChanges}
    <div class="json-editor-success json-editor-success-sticky">
      <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span>JSON is valid and ready to save</span>
    </div>
  {/if}

  <div class="llm-prompt-section">
    <div class="llm-prompt-header">
      <h4>🤖 AI Assistant Prompt Generator</h4>
      <p class="llm-prompt-help">Describe changes you want, then click to generate a prompt for your favourite LLM.</p>
    </div>
    <div class="llm-prompt-input-group">
      <textarea
        class="llm-prompt-textarea"
        value={userPrompt}
        oninput={(e) => (userPrompt = (e.target as HTMLTextAreaElement).value)}
        placeholder="Example: Add a new question about the weather with options for sunny, rainy, and snowy."
        rows={3}
      ></textarea>
      <button
        type="button"
        onclick={handleCopyPrompt}
        class="llm-prompt-button"
        disabled={!userPrompt.trim()}
      >
        {#if copySuccess}
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
          Copied!
        {:else}
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          Generate and Copy Prompt
        {/if}
      </button>
    </div>
  </div>

  <div class="json-editor-save-section">
    <button
      type="button"
      onclick={onsave}
      class="json-editor-save-button {hasUnsavedChanges ? 'has-changes' : ''}"
      disabled={!!error}
    >
      <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
      </svg>
      {hasUnsavedChanges ? 'Save JSON Changes' : 'No Changes to Save'}
    </button>
    {#if hasUnsavedChanges}
      <p class="json-editor-save-hint">You have unsaved changes in the JSON editor</p>
    {/if}
  </div>

  {#if hasUnsavedChanges}
    <div class="diff-toggle-section">
      <button type="button" onclick={() => (showDiff = !showDiff)} class="diff-toggle-button">
        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        {showDiff ? 'Hide' : 'Show'} Changes (Diff View)
      </button>
    </div>
  {/if}

  {#if showDiff && hasUnsavedChanges}
    {@const qDiff = computeQuestionsDiff()}
    {@const iDiff = computeItemsDiff()}
    <div class="diff-view-container">
      <div class="diff-tabs">
        <button class="diff-tab {diffTab === 'summary' ? 'active' : ''}" onclick={() => (diffTab = 'summary')}>Summary</button>
        <button class="diff-tab {diffTab === 'questions' ? 'active' : ''}" onclick={() => (diffTab = 'questions')}>
          Questions ({qDiff.added.length + qDiff.removed.length + qDiff.modified.length})
        </button>
        <button class="diff-tab {diffTab === 'items' ? 'active' : ''}" onclick={() => (diffTab = 'items')}>
          Items ({iDiff.added.length + iDiff.removed.length + iDiff.modified.length})
        </button>
      </div>
      <div class="diff-tab-content">
        {#if diffTab === 'summary'}
          {@const s = computeSummary()}
          <div class="diff-summary">
            <div class="diff-summary-section">
              <h4>Questions</h4>
              {#if s.questionsAdded > 0}<div class="diff-summary-item added">+ {s.questionsAdded} added</div>{/if}
              {#if s.questionsRemoved > 0}<div class="diff-summary-item removed">- {s.questionsRemoved} removed</div>{/if}
              {#if s.questionsModified > 0}<div class="diff-summary-item modified">~ {s.questionsModified} modified</div>{/if}
              {#if !s.questionsAdded && !s.questionsRemoved && !s.questionsModified}<div class="diff-summary-item">No changes</div>{/if}
            </div>
            <div class="diff-summary-section">
              <h4>Items</h4>
              {#if s.itemsAdded > 0}<div class="diff-summary-item added">+ {s.itemsAdded} added</div>{/if}
              {#if s.itemsRemoved > 0}<div class="diff-summary-item removed">- {s.itemsRemoved} removed</div>{/if}
              {#if !s.itemsAdded && !s.itemsRemoved}<div class="diff-summary-item">No changes</div>{/if}
            </div>
            <div class="diff-summary-section">
              <h4>People</h4>
              {#if s.peopleAdded > 0}<div class="diff-summary-item added">+ {s.peopleAdded} added</div>{/if}
              {#if s.peopleRemoved > 0}<div class="diff-summary-item removed">- {s.peopleRemoved} removed</div>{/if}
              {#if !s.peopleAdded && !s.peopleRemoved}<div class="diff-summary-item">No changes</div>{/if}
            </div>
          </div>
        {/if}
        {#if diffTab === 'questions'}
          <div class="diff-questions">
            {#if qDiff.added.length + qDiff.removed.length + qDiff.modified.length === 0}
              <p class="diff-no-changes">No question changes</p>
            {:else}
              {#if qDiff.added.length > 0}
                <div class="diff-section">
                  <h4 class="diff-section-title added">Added Questions</h4>
                  {#each qDiff.added as q, i}<div class="diff-item added"><strong>{q.text}</strong> <span class="diff-item-meta">({q.questionType || 'single-choice'})</span></div>{/each}
                </div>
              {/if}
              {#if qDiff.removed.length > 0}
                <div class="diff-section">
                  <h4 class="diff-section-title removed">Removed Questions</h4>
                  {#each qDiff.removed as q}<div class="diff-item removed"><strong>{q.text}</strong></div>{/each}
                </div>
              {/if}
              {#if qDiff.modified.length > 0}
                <div class="diff-section">
                  <h4 class="diff-section-title modified">Modified Questions</h4>
                  {#each qDiff.modified as q}<div class="diff-item modified"><strong>{q.text}</strong><div class="diff-item-change">Type: {q.oldType} → {q.newType}</div></div>{/each}
                </div>
              {/if}
            {/if}
          </div>
        {/if}
        {#if diffTab === 'items'}
          <div class="diff-items">
            {#if iDiff.added.length + iDiff.removed.length + iDiff.modified.length === 0}
              <p class="diff-no-changes">No item changes</p>
            {:else}
              {#if iDiff.added.length > 0}
                <div class="diff-section">
                  <h4 class="diff-section-title added">Added Items</h4>
                  {#each iDiff.added as item}<div class="diff-item added"><strong>+ {item.text}</strong><div class="diff-item-locations">in: {item.locations.join(', ')}</div></div>{/each}
                </div>
              {/if}
              {#if iDiff.removed.length > 0}
                <div class="diff-section">
                  <h4 class="diff-section-title removed">Removed Items</h4>
                  {#each iDiff.removed as item}<div class="diff-item removed"><strong>- {item.text}</strong><div class="diff-item-locations">was in: {item.locations.join(', ')}</div></div>{/each}
                </div>
              {/if}
              {#if iDiff.modified.length > 0}
                <div class="diff-section">
                  <h4 class="diff-section-title modified">Modified Items</h4>
                  {#each iDiff.modified as item}<div class="diff-item modified"><strong>~ {item.text}</strong><div class="diff-item-locations">was: {item.oldLocations.join(', ')}</div><div class="diff-item-locations">now: {item.newLocations.join(', ')}</div></div>{/each}
                </div>
              {/if}
            {/if}
          </div>
        {/if}
      </div>
    </div>
  {/if}

  <div class="json-editor-wrapper">
    <div class="json-editor-line-numbers" bind:this={lineNumbers}>
      {#each { length: lineCount } as _, i}
        <div class="json-editor-line-number">{i + 1}</div>
      {/each}
    </div>
    <textarea
      bind:this={textarea}
      class="json-editor-textarea"
      {value}
      oninput={(e) => onchange((e.target as HTMLTextAreaElement).value)}
      onscroll={handleScroll}
      spellcheck={false}
      placeholder="Enter question set JSON..."
    ></textarea>
  </div>

  {#if showScrollTop}
    <button
      type="button"
      onclick={() => { if (textarea) textarea.scrollTop = 0 }}
      class="json-editor-scroll-top"
      title="Scroll to top"
    >
      <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 10l7-7m0 0l7 7m-7-7v18" />
      </svg>
    </button>
  {/if}
</div>
