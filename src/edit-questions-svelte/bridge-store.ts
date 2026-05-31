import { writable } from 'svelte/store'
import type { PackingListQuestionSet } from '../edit-questions/types'

export interface BridgeState {
  isLoggedIn: boolean
  foreignPodUrl: string | null | undefined
  syncingFromPod: boolean
  isSyncing: boolean
  lastSync: Date | null
  syncError: string | null
  podSyncData: PackingListQuestionSet | null
  onSave: (data: PackingListQuestionSet) => Promise<boolean>
  onSaveJson: (json: string) => Promise<{ error?: string }>
  onShowToast: (msg: string, type: 'success' | 'error') => void
  onReset: () => void
}

const noop = () => {}

export const bridgeStore = writable<BridgeState>({
  isLoggedIn: false,
  foreignPodUrl: null,
  syncingFromPod: false,
  isSyncing: false,
  lastSync: null,
  syncError: null,
  podSyncData: null,
  onSave: async () => false,
  onSaveJson: async () => ({}),
  onShowToast: noop,
  onReset: noop,
})
