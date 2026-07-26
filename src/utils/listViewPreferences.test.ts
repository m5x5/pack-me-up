import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import {
    DEFAULT_LIST_VIEW_PREFERENCES,
    loadListViewPreferences,
    saveListViewPreferences,
    listViewPreferencesKey,
} from './listViewPreferences'

describe('listViewPreferences', () => {
    beforeEach(() => {
        localStorage.clear()
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    describe('loading', () => {
        it('returns the defaults for a list that has never been opened', () => {
            expect(loadListViewPreferences('list-1')).toEqual(DEFAULT_LIST_VIEW_PREFERENCES)
        })

        it('returns the defaults when there is no list id', () => {
            expect(loadListViewPreferences(undefined)).toEqual(DEFAULT_LIST_VIEW_PREFERENCES)
        })

        it('reads back what was saved', () => {
            saveListViewPreferences('list-1', {
                viewMode: 'question',
                showPacked: true,
                collapsedSections: ['Alice', '__shared__'],
                collapsedGroups: ['Alice::Clothes'],
            })

            expect(loadListViewPreferences('list-1')).toEqual({
                viewMode: 'question',
                showPacked: true,
                collapsedSections: ['Alice', '__shared__'],
                collapsedGroups: ['Alice::Clothes'],
            })
        })

        it('keeps each list\'s preferences separate', () => {
            saveListViewPreferences('list-1', { ...DEFAULT_LIST_VIEW_PREFERENCES, collapsedSections: ['Alice'] })

            expect(loadListViewPreferences('list-2')).toEqual(DEFAULT_LIST_VIEW_PREFERENCES)
        })
    })

    describe('surviving bad stored data', () => {
        it('falls back to the defaults when the stored value is not JSON', () => {
            localStorage.setItem(listViewPreferencesKey('list-1'), 'not json{')

            expect(loadListViewPreferences('list-1')).toEqual(DEFAULT_LIST_VIEW_PREFERENCES)
        })

        it('falls back to the defaults when the stored value is not an object', () => {
            localStorage.setItem(listViewPreferencesKey('list-1'), '"just a string"')

            expect(loadListViewPreferences('list-1')).toEqual(DEFAULT_LIST_VIEW_PREFERENCES)
        })

        it('ignores a view mode it does not recognise', () => {
            localStorage.setItem(listViewPreferencesKey('list-1'), JSON.stringify({ viewMode: 'sideways' }))

            expect(loadListViewPreferences('list-1').viewMode).toBe('person')
        })

        it('ignores collapsed keys that are not strings', () => {
            localStorage.setItem(
                listViewPreferencesKey('list-1'),
                JSON.stringify({ collapsedSections: ['Alice', 7, null, 'Bob'], collapsedGroups: 'nope' }),
            )

            const prefs = loadListViewPreferences('list-1')
            expect(prefs.collapsedSections).toEqual(['Alice', 'Bob'])
            expect(prefs.collapsedGroups).toEqual([])
        })

        it('fills in fields the stored value is missing', () => {
            localStorage.setItem(listViewPreferencesKey('list-1'), JSON.stringify({ showPacked: true }))

            expect(loadListViewPreferences('list-1')).toEqual({
                ...DEFAULT_LIST_VIEW_PREFERENCES,
                showPacked: true,
            })
        })
    })

    describe('when storage is unavailable', () => {
        it('returns the defaults rather than throwing on read', () => {
            vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
                throw new Error('SecurityError')
            })

            expect(() => loadListViewPreferences('list-1')).not.toThrow()
            expect(loadListViewPreferences('list-1')).toEqual(DEFAULT_LIST_VIEW_PREFERENCES)
        })

        it('swallows the failure on write', () => {
            vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
                throw new Error('QuotaExceededError')
            })

            expect(() => saveListViewPreferences('list-1', DEFAULT_LIST_VIEW_PREFERENCES)).not.toThrow()
        })
    })

    describe('saving', () => {
        it('does nothing without a list id', () => {
            const setItem = vi.spyOn(Storage.prototype, 'setItem')

            saveListViewPreferences(undefined, DEFAULT_LIST_VIEW_PREFERENCES)

            expect(setItem).not.toHaveBeenCalled()
        })

        it('does not leave an entry behind for a list left at its defaults', () => {
            saveListViewPreferences('list-1', DEFAULT_LIST_VIEW_PREFERENCES)

            expect(localStorage.getItem(listViewPreferencesKey('list-1'))).toBeNull()
        })

        it('clears a stored entry once the list is back to its defaults', () => {
            saveListViewPreferences('list-1', { ...DEFAULT_LIST_VIEW_PREFERENCES, collapsedSections: ['Alice'] })
            expect(localStorage.getItem(listViewPreferencesKey('list-1'))).not.toBeNull()

            saveListViewPreferences('list-1', DEFAULT_LIST_VIEW_PREFERENCES)

            expect(localStorage.getItem(listViewPreferencesKey('list-1'))).toBeNull()
        })
    })
})
