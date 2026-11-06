import { useEffect, useState } from 'react'
import { readSettings, writeSettings, type SettingsRecord } from '../services/storage'

export function useSettings(): {
  settings: SettingsRecord
  update: (patch: Partial<SettingsRecord>) => void
} {
  const [settings, setSettings] = useState<SettingsRecord>(() => readSettings())

  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme
  }, [settings.theme])

  function update(patch: Partial<SettingsRecord>) {
    const next = { ...settings, ...patch, schemaVersion: 1 as const }
    setSettings(next)
    writeSettings(next)
  }

  return { settings, update }
}
