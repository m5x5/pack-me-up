import { useEffect, useRef, useCallback, useState } from 'react'
import { mount, unmount } from 'svelte'
import { useDatabase } from '../components/DatabaseContext'
import { useSolidPod } from '../components/SolidPodContext'
import { useForeignPod } from '../components/ForeignPodContext'
import { useToast } from '../components/ToastContext'
import { useSyncCoordinator } from '../hooks/useSyncCoordinator'
import { usePodSync } from '../hooks/usePodSync'
import { DatabaseMigration } from '../services/migration'
import { POD_CONTAINERS } from '../services/solidPod'
import { questionSetToDataset, datasetToQuestionSet } from '../services/rdfSerialization'
import { PackingListQuestionSet } from '../edit-questions/types'
import { validateQuestionSet } from '../edit-questions/validation'
import { bridgeStore } from './bridge-store'
// @ts-ignore — Svelte component import
import EditQuestionsApp from './EditQuestionsApp.svelte'

export function EditQuestionsBridge() {
  const mountRef = useRef<HTMLDivElement>(null)
  const svelteInstanceRef = useRef<ReturnType<typeof mount> | null>(null)
  const [initialData, setInitialData] = useState<PackingListQuestionSet | null>(null)
  const [rev, setRev] = useState<string | undefined>(undefined)

  const { db, loginSyncInProgress } = useDatabase()
  const { isLoggedIn } = useSolidPod()
  const foreignPodCtx = useForeignPod()
  const foreignPodUrl = foreignPodCtx?.foreignPodUrl
  const { showToast } = useToast()

  const currentDataRef = useRef<PackingListQuestionSet | null>(null)
  const revRef = useRef<string | undefined>(undefined)
  revRef.current = rev

  const { syncingFromPod, handleSyncSuccess, handleSyncError, saveWithSyncPrevention } =
    useSyncCoordinator<PackingListQuestionSet>({
      currentData: currentDataRef.current,
      saveToLocalDb: async (data) => {
        if (foreignPodCtx) return { rev: '' }
        return await db.saveQuestionSet({ _id: '1', ...data, _rev: revRef.current })
      },
      updateFormAndState: (data, newRev) => {
        const updated = { ...data, _rev: newRev }
        currentDataRef.current = updated
        setRev(newRev)
        bridgeStore.update(s => ({ ...s, podSyncData: updated }))
      },
      conflictStrategy: 'fallback-to-pod',
    })

  const { lastSync, isSyncing, error: syncError, saveToPod } = usePodSync<PackingListQuestionSet>({
    pathConfig: {
      container: POD_CONTAINERS.ROOT,
      filename: 'packing-list-questions.ttl',
      podUrl: foreignPodUrl,
    },
    rdf: { serialize: questionSetToDataset, deserialize: datasetToQuestionSet },
    pollInterval: 5000,
    enabled: isLoggedIn || !!foreignPodUrl,
    onSyncSuccess: handleSyncSuccess,
    onSyncError: handleSyncError,
    onSaveSuccess: () => {},
    onSaveError: (error) => showToast(`Failed to save to Pod: ${error}`, 'error'),
  })

  const onSave = useCallback(async (data: PackingListQuestionSet): Promise<boolean> => {
    try {
      const dataToSave = { _id: '1', ...data, _rev: revRef.current }
      if (isLoggedIn) {
        const saved = await saveWithSyncPrevention(dataToSave, saveToPod)
        if (saved) {
          revRef.current = saved._rev
          setRev(saved._rev)
          currentDataRef.current = saved
          return true
        }
        return false
      } else {
        const withTs = { ...dataToSave, lastModified: new Date().toISOString() }
        const result = await db.saveQuestionSet(withTs)
        const saved = { ...withTs, _rev: result.rev }
        revRef.current = result.rev
        setRev(result.rev)
        currentDataRef.current = saved
        return true
      }
    } catch {
      return false
    }
  }, [isLoggedIn, db, saveWithSyncPrevention, saveToPod])

  const onSaveJson = useCallback(async (json: string): Promise<{ error?: string }> => {
    try {
      const parsed = JSON.parse(json)
      const validation = validateQuestionSet(parsed, json)
      if (!validation.valid) return { error: validation.error || 'Invalid question set structure' }
      const ok = await onSave(parsed)
      return ok ? {} : { error: 'Save failed' }
    } catch (e) {
      return { error: `Invalid JSON: ${e instanceof Error ? e.message : String(e)}` }
    }
  }, [onSave])

  const onReset = useCallback(() => {
    const defaultData: PackingListQuestionSet = {
      questions: [],
      people: [{ id: crypto.randomUUID(), name: 'Me' }],
      alwaysNeededItems: [],
    }
    // Re-mount Svelte with fresh data
    if (svelteInstanceRef.current) unmount(svelteInstanceRef.current)
    if (mountRef.current) {
      svelteInstanceRef.current = mount(EditQuestionsApp, {
        target: mountRef.current,
        props: { initialData: defaultData },
      })
    }
    currentDataRef.current = defaultData
    showToast('Form has been reset to default state', 'success')
  }, [showToast])

  // Keep bridge store in sync with React context values
  useEffect(() => {
    bridgeStore.update(s => ({
      ...s,
      isLoggedIn,
      foreignPodUrl,
      syncingFromPod,
      isSyncing,
      lastSync,
      syncError,
      onSave,
      onSaveJson,
      onShowToast: showToast,
      onReset,
    }))
  }, [isLoggedIn, foreignPodUrl, syncingFromPod, isSyncing, lastSync, syncError, onSave, onSaveJson, showToast, onReset])

  // Load initial data from PouchDB
  useEffect(() => {
    if (loginSyncInProgress) return
    const load = async () => {
      try {
        const migrationCheck = await DatabaseMigration.checkMigrationNeeded(db)
        if (migrationCheck.needed) {
          const result = await DatabaseMigration.performMigration(db)
          if (!result.success) { showToast('Database migration failed', 'error'); return }
          showToast('Database migrated successfully', 'success')
        }
        const doc = await db.getQuestionSet()
        setRev(doc._rev)
        currentDataRef.current = doc
        setInitialData(doc)
      } catch (err: unknown) {
        const name = typeof err === 'object' && err !== null && 'name' in err ? (err as { name: string }).name : ''
        if (name === 'not_found') {
          try {
            const newDoc = { _id: '1', questions: [], people: [{ id: crypto.randomUUID(), name: 'Me' }], alwaysNeededItems: [] }
            const result = await db.saveQuestionSet(newDoc)
            const saved = { ...newDoc, _rev: result.rev }
            setRev(result.rev)
            currentDataRef.current = saved
            setInitialData(saved)
          } catch { showToast('Failed to initialize database', 'error') }
        } else {
          showToast('Failed to load data', 'error')
        }
      }
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loginSyncInProgress])

  // Mount Svelte once initial data is ready
  useEffect(() => {
    if (!initialData || !mountRef.current) return
    svelteInstanceRef.current = mount(EditQuestionsApp, {
      target: mountRef.current,
      props: { initialData },
    })
    return () => {
      if (svelteInstanceRef.current) unmount(svelteInstanceRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!initialData])

  if (!initialData) {
    return (
      <div className="w-full flex flex-col items-center py-8 px-4">
        <div className="text-gray-500">Loading...</div>
      </div>
    )
  }

  return <div ref={mountRef} />
}
