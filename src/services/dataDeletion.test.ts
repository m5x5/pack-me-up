import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import PouchDB from 'pouchdb'
import PouchDBMemoryAdapter from 'pouchdb-adapter-memory'
import type { AppSession as Session } from '../types/AppSession'

vi.mock('@inrupt/solid-client', () => ({
    getSolidDataset: vi.fn(),
    getContainedResourceUrlAll: vi.fn(),
    deleteFile: vi.fn(),
    deleteContainer: vi.fn(),
    // solidPod.ts destructures this at module scope, so it has to exist for the
    // import of AuthenticationError below to succeed.
    universalAccess: { getAgentAccessAll: vi.fn(), setPublicAccess: vi.fn(), getPublicAccess: vi.fn() },
}))

import { getSolidDataset, getContainedResourceUrlAll, deleteFile, deleteContainer } from '@inrupt/solid-client'
import { deleteAllPodData, deleteAllLocalData, localDatabaseNames } from './dataDeletion'
import { AuthenticationError } from './solidPod'
import { PackingAppDatabase, databaseNameForNamespace, LOCAL_NAMESPACE } from './database'

PouchDB.plugin(PouchDBMemoryAdapter)

const mockGetSolidDataset = vi.mocked(getSolidDataset)
const mockGetContained = vi.mocked(getContainedResourceUrlAll)
const mockDeleteFile = vi.mocked(deleteFile)
const mockDeleteContainer = vi.mocked(deleteContainer)

const session = { fetch: vi.fn() } as unknown as Session
const POD = 'https://alice.example/'
const ROOT = `${POD}pack-me-up/`

function notFound() {
    return Object.assign(new Error('Not Found'), { statusCode: 404 })
}

/**
 * Stubs the pod as a tree of container URL -> contained resource URLs.
 * Anything not listed is treated as a container that does not exist.
 */
function givenPodTree(tree: Record<string, string[]>) {
    mockGetSolidDataset.mockImplementation(async (url: string) => {
        if (!(url in tree)) throw notFound()
        return { url } as never
    })
    mockGetContained.mockImplementation((dataset: unknown) => {
        const { url } = dataset as { url: string }
        return tree[url] ?? []
    })
}

describe('deleteAllPodData', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockDeleteFile.mockResolvedValue(undefined)
        mockDeleteContainer.mockResolvedValue(undefined)
    })

    it('deletes every file the app stores, including inside nested containers', async () => {
        givenPodTree({
            [ROOT]: [
                `${ROOT}packing-list-questions.ttl`,
                `${ROOT}shared-with-me.ttl`,
                `${ROOT}packing-lists/`,
                `${ROOT}backups/`,
            ],
            [`${ROOT}packing-lists/`]: [`${ROOT}packing-lists/a.ttl`, `${ROOT}packing-lists/b.ttl`],
            [`${ROOT}backups/`]: [`${ROOT}backups/backup-1.json`],
        })

        await deleteAllPodData(session, POD)

        const deleted = mockDeleteFile.mock.calls.map(([url]) => url)
        expect(deleted).toEqual(expect.arrayContaining([
            `${ROOT}packing-list-questions.ttl`,
            `${ROOT}shared-with-me.ttl`,
            `${ROOT}packing-lists/a.ttl`,
            `${ROOT}packing-lists/b.ttl`,
            `${ROOT}backups/backup-1.json`,
        ]))
        expect(deleted).toHaveLength(5)
    })

    it('empties a container before deleting it, as Solid requires', async () => {
        givenPodTree({
            [ROOT]: [`${ROOT}packing-lists/`],
            [`${ROOT}packing-lists/`]: [`${ROOT}packing-lists/a.ttl`],
        })

        const order: string[] = []
        mockDeleteFile.mockImplementation(async (url: string) => { order.push(`file:${url}`) })
        mockDeleteContainer.mockImplementation(async (url: string) => { order.push(`container:${url}`) })

        await deleteAllPodData(session, POD)

        expect(order).toEqual([
            `file:${ROOT}packing-lists/a.ttl`,
            `container:${ROOT}packing-lists/`,
            `container:${ROOT}`,
        ])
    })

    it('deletes the app container itself so no trace is left behind', async () => {
        givenPodTree({ [ROOT]: [] })

        await deleteAllPodData(session, POD)

        expect(mockDeleteContainer).toHaveBeenCalledWith(ROOT, expect.anything())
    })

    it('treats an already-absent container as success rather than an error', async () => {
        givenPodTree({})

        await expect(deleteAllPodData(session, POD)).resolves.toBeUndefined()
        expect(mockDeleteContainer).not.toHaveBeenCalled()
    })

    it('surfaces an expired session as an AuthenticationError', async () => {
        mockGetSolidDataset.mockRejectedValue(Object.assign(new Error('Unauthorized'), { statusCode: 401 }))

        await expect(deleteAllPodData(session, POD)).rejects.toBeInstanceOf(AuthenticationError)
    })
})

describe('localDatabaseNames', () => {
    beforeEach(() => {
        localStorage.clear()
    })

    it('always includes the anonymous database and the legacy pre-namespace ones', async () => {
        const names = await localDatabaseNames()

        expect(names).toEqual(expect.arrayContaining([
            databaseNameForNamespace(LOCAL_NAMESPACE),
            'packing-list-question-set',
            'packing-lists',
        ]))
    })

    it('includes a database for every pod this device has logged into', async () => {
        localStorage.setItem('pod-url:https://alice.example/profile/card#me', 'https://alice.example/')
        localStorage.setItem('pod-url:https://bob.example/profile/card#me', 'https://bob.example/')

        const names = await localDatabaseNames()

        expect(names).toContain(databaseNameForNamespace('alice.example'))
        expect(names).toContain(databaseNameForNamespace('bob.example'))
    })

    it('enumerates app databases the browser knows about, unwrapping PouchDB\'s _pouch_ prefix', async () => {
        vi.stubGlobal('indexedDB', {
            databases: async () => [
                { name: `_pouch_${databaseNameForNamespace('forgotten.example')}` },
                { name: '_pouch_something-else-entirely' },
                { name: undefined },
            ],
        })

        const names = await localDatabaseNames()

        expect(names).toContain(databaseNameForNamespace('forgotten.example'))
        expect(names).not.toContain('something-else-entirely')

        vi.unstubAllGlobals()
    })

    it('falls back to the known names when the browser cannot enumerate databases', async () => {
        vi.stubGlobal('indexedDB', {
            databases: async () => { throw new Error('not supported') },
        })

        await expect(localDatabaseNames()).resolves.toContain(databaseNameForNamespace(LOCAL_NAMESPACE))

        vi.unstubAllGlobals()
    })
})

describe('deleteAllLocalData', () => {
    beforeEach(() => {
        vi.spyOn(console, 'log').mockImplementation(() => {})
        localStorage.clear()
        sessionStorage.clear()
        PackingAppDatabase.forgetAllInstances()
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('destroys the stored packing data', async () => {
        const db = PackingAppDatabase.getInstance(LOCAL_NAMESPACE)
        await db.savePackingList({
            id: 'list-1',
            name: 'Cornwall',
            createdAt: new Date().toISOString(),
            lastModified: new Date().toISOString(),
            items: [],
        })
        expect(await db.isEmpty()).toBe(false)

        await deleteAllLocalData()

        PackingAppDatabase.forgetAllInstances()
        const reopened = PackingAppDatabase.getInstance(LOCAL_NAMESPACE)
        expect(await reopened.isEmpty()).toBe(true)
    })

    it('clears the migration backup and every other app key from storage', async () => {
        localStorage.setItem('packing-app-backup', '{"lists":[]}')
        localStorage.setItem('packing-list-view-prefs:list-1', '{}')
        localStorage.setItem('solid-last-provider-issuer', 'https://solidcommunity.net')
        sessionStorage.setItem('authReturnTo', '/view-lists')

        await deleteAllLocalData()

        expect(localStorage.length).toBe(0)
        expect(sessionStorage.length).toBe(0)
    })

    it('drops cached database handles so nothing keeps writing to a destroyed database', async () => {
        PackingAppDatabase.getInstance(LOCAL_NAMESPACE)

        await deleteAllLocalData()

        // @ts-expect-error - reading the private instance cache to assert it was cleared
        expect((PackingAppDatabase.instances as Map<string, unknown>).size).toBe(0)
    })
})
