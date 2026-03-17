import type { Preset } from '../types/preset';

export async function listPresets(): Promise<Preset[]> {
  const res = await fetch('/api/presets');
  return res.json();
}

export async function createPreset(data?: Partial<Preset>): Promise<Preset> {
  const res = await fetch('/api/presets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data ?? {}),
  });
  return res.json();
}

export async function updatePreset(id: string, updates: Partial<Preset>): Promise<Preset> {
  const res = await fetch(`/api/presets/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  return res.json();
}

export async function deletePreset(id: string): Promise<void> {
  await fetch(`/api/presets/${id}`, { method: 'DELETE' });
}

export async function getSelectedPresetId(): Promise<string | null> {
  const res = await fetch('/api/presets/selected');
  const data = await res.json();
  return data.id ?? null;
}

export async function setSelectedPresetId(id: string): Promise<void> {
  await fetch('/api/presets/selected', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id }),
  });
}

export async function getThreadPreset(threadId: string): Promise<string | null> {
  const res = await fetch(`/api/thread-presets/${threadId}`);
  if (res.status === 404) return null;
  const data = await res.json();
  return data.presetId ?? null;
}

export async function saveThreadPreset(threadId: string, presetId: string): Promise<void> {
  await fetch('/api/thread-presets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ threadId, presetId }),
  });
}
