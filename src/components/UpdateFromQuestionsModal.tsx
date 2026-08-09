import { useMemo, useState } from 'react'
import { Modal } from './Modal'
import { Button } from './Button'
import type { QuestionSetChange } from '../create-packing-list/updateFromQuestions'
import { PackingListItem } from '../create-packing-list/types'

interface UpdateFromQuestionsModalProps {
    isOpen: boolean
    onClose: () => void
    changes: QuestionSetChange[]
    onConfirm: (selected: QuestionSetChange[]) => void
}

const forWhom = (item: PackingListItem) =>
    item.communal || item.personId === '' ? 'Shared' : item.personName || 'Unassigned'

// One human-readable line per change; the checkbox's accessible name.
function describeChange(change: QuestionSetChange): string {
    switch (change.type) {
        case 'add': {
            const { item } = change
            return `Add ${item.itemText}${item.personName ? ` for ${item.personName}` : ''}`
        }
        case 'remove':
            return `Remove ${change.item.itemText}${change.item.personName ? ` for ${change.item.personName}` : ''}`
        case 'sharing':
            return change.direction === 'shared'
                ? `Make ${change.itemText} a shared item`
                : `Give everyone their own ${change.itemText}`
        case 'update': {
            const parts: string[] = []
            if (change.kinds.includes('renamed')) parts.push(`rename ${change.before.itemText} to ${change.after.itemText}`)
            if (change.kinds.includes('moved')) parts.push(`move ${change.before.itemText} to ${change.after.category}`)
            if (change.kinds.includes('quantity')) parts.push(`change ${change.before.itemText} quantity to ${change.after.quantity ?? 1}`)
            const [first, ...rest] = parts
            const joined = [first.charAt(0).toUpperCase() + first.slice(1), ...rest].join(', ')
            return `${joined}${change.before.personName ? ` for ${change.before.personName}` : ''}`
        }
    }
}

function sectionOf(change: QuestionSetChange): 'add' | 'change' | 'remove' {
    if (change.type === 'add') return 'add'
    if (change.type === 'remove') return 'remove'
    return 'change'
}

const SECTIONS = [
    { key: 'add' as const, title: 'New items' },
    { key: 'change' as const, title: 'Changed items' },
    { key: 'remove' as const, title: 'No longer in your questions' },
]

export function UpdateFromQuestionsModal({
    isOpen,
    onClose,
    changes,
    onConfirm,
}: UpdateFromQuestionsModalProps) {
    // Everything starts selected; the user unchecks what they don't want.
    // Changes are keyed by their index — the array is stable for the modal's life.
    const [excluded, setExcluded] = useState<Set<number>>(new Set())

    const sections = useMemo(() => SECTIONS
        .map(section => ({
            ...section,
            entries: changes
                .map((change, index) => ({ change, index }))
                .filter(({ change }) => sectionOf(change) === section.key),
        }))
        .filter(section => section.entries.length > 0),
    [changes])

    const selected = changes.filter((_, i) => !excluded.has(i))
    const onlyAdditions = selected.every(c => c.type === 'add')

    const toggle = (index: number) => {
        setExcluded(prev => {
            const next = new Set(prev)
            if (next.has(index)) next.delete(index)
            else next.add(index)
            return next
        })
    }

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Update from questions">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Your questions have changed since this list was made. Choose which updates to apply.
            </p>
            <div className="max-h-96 overflow-y-auto space-y-4">
                {sections.map(section => (
                    <div key={section.key}>
                        <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">{section.title}</p>
                        <div className="space-y-1">
                            {section.entries.map(({ change, index }) => (
                                <label key={index} className="flex items-center gap-3 px-2 py-1.5 rounded hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        aria-label={describeChange(change)}
                                        checked={!excluded.has(index)}
                                        onChange={() => toggle(index)}
                                        className="h-4 w-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                                    />
                                    <span className={change.type === 'remove' ? 'text-gray-500 dark:text-gray-400 line-through' : 'text-gray-900 dark:text-gray-100'}>
                                        {change.type === 'add' && (
                                            <>
                                                {change.item.itemText}
                                                {change.item.quantity !== undefined && (
                                                    <span className="ml-1.5 text-sm text-gray-500 dark:text-gray-400 no-underline">×{change.item.quantity}</span>
                                                )}
                                                <span className="ml-1.5 text-sm text-gray-500 dark:text-gray-400">{forWhom(change.item)}</span>
                                            </>
                                        )}
                                        {change.type === 'remove' && (
                                            <>
                                                {change.item.itemText}
                                                <span className="ml-1.5 text-sm text-gray-500 dark:text-gray-400">{forWhom(change.item)}</span>
                                            </>
                                        )}
                                        {change.type === 'update' && (
                                            <>
                                                {change.kinds.includes('renamed')
                                                    ? <>{change.before.itemText} <span aria-hidden="true">→</span> {change.after.itemText}</>
                                                    : change.before.itemText}
                                                {change.kinds.includes('moved') && (
                                                    <span className="ml-1.5 text-sm text-gray-500 dark:text-gray-400">now in {change.after.category}</span>
                                                )}
                                                {change.kinds.includes('quantity') && (
                                                    <span className="ml-1.5 text-sm text-gray-500 dark:text-gray-400">×{change.before.quantity ?? 1} <span aria-hidden="true">→</span> ×{change.after.quantity ?? 1}</span>
                                                )}
                                                <span className="ml-1.5 text-sm text-gray-500 dark:text-gray-400">{forWhom(change.before)}</span>
                                            </>
                                        )}
                                        {change.type === 'sharing' && (
                                            <>
                                                {change.itemText}
                                                <span className="ml-1.5 text-sm text-gray-500 dark:text-gray-400">
                                                    {change.direction === 'shared' ? 'now packed once for everyone' : 'now one per person'}
                                                </span>
                                            </>
                                        )}
                                    </span>
                                </label>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
            <div className="mt-6 flex justify-end gap-2">
                <Button type="button" variant="secondary" onClick={onClose}>
                    Cancel
                </Button>
                <Button
                    type="button"
                    variant="primary"
                    onClick={() => onConfirm(selected)}
                    disabled={selected.length === 0}
                >
                    {selected.length === 0
                        ? 'Apply changes'
                        : onlyAdditions
                            ? `Add ${selected.length} item${selected.length === 1 ? '' : 's'}`
                            : `Apply ${selected.length} change${selected.length === 1 ? '' : 's'}`}
                </Button>
            </div>
        </Modal>
    )
}
