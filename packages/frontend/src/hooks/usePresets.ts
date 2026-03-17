import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { Preset } from '../types/preset';
import * as presetsApi from '../api/presets-api';

export function usePresets() {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedPreset = useMemo(
    () => presets.find((p) => p.id === selectedPresetId) ?? null,
    [presets, selectedPresetId],
  );

  const loadPresets = useCallback(async () => {
    setLoading(true);
    try {
      const [list, selId] = await Promise.all([
        presetsApi.listPresets(),
        presetsApi.getSelectedPresetId(),
      ]);
      setPresets(list);
      setSelectedPresetId(selId);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPresets();
  }, [loadPresets]);

  const selectPreset = useCallback(async (id: string) => {
    setSelectedPresetId(id);
    await presetsApi.setSelectedPresetId(id);
  }, []);

  const createPreset = useCallback(async (data?: Partial<Preset>) => {
    const created = await presetsApi.createPreset(data);
    setPresets((prev) => [...prev, created]);
    setSelectedPresetId(created.id);
    await presetsApi.setSelectedPresetId(created.id);
    return created;
  }, []);

  const updatePreset = useCallback((id: string, updates: Partial<Preset>) => {
    // Optimistic local update
    setPresets((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...updates } : p)),
    );

    // Debounced API call
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(async () => {
      await presetsApi.updatePreset(id, updates);
    }, 500);
  }, []);

  const deletePresetFn = useCallback(
    async (id: string) => {
      await presetsApi.deletePreset(id);
      setPresets((prev) => {
        const remaining = prev.filter((p) => p.id !== id);
        if (selectedPresetId === id) {
          const next = remaining[0]?.id ?? null;
          setSelectedPresetId(next);
          if (next) {
            presetsApi.setSelectedPresetId(next);
          }
        }
        return remaining;
      });
    },
    [selectedPresetId],
  );

  const saveThreadPreset = useCallback(async (threadId: string, presetId: string) => {
    await presetsApi.saveThreadPreset(threadId, presetId);
  }, []);

  const getThreadPreset = useCallback(async (threadId: string) => {
    return presetsApi.getThreadPreset(threadId);
  }, []);

  return {
    presets,
    selectedPresetId,
    selectedPreset,
    loading,
    selectPreset,
    createPreset,
    updatePreset,
    deletePreset: deletePresetFn,
    saveThreadPreset,
    getThreadPreset,
  };
}
