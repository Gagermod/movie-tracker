import type { Movie, Series } from './types'

const FP_KEY = 'mt_fingerprint'

function generateFingerprint(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

export function getFingerprint(): string {
  let fp = localStorage.getItem(FP_KEY)
  if (!fp) {
    fp = generateFingerprint()
    localStorage.setItem(FP_KEY, fp)
  }
  return fp
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const fp = getFingerprint()
  const res = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'x-fp': fp,
      ...(init?.headers || {}),
    },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `Request failed (${res.status})`)
  }
  return res.json() as Promise<T>
}

export type AppData = {
  movies: Movie[]
  series: Series[]
}

type IdentityResponse = {
  ownerId: number
  shareUrl: string
}

export async function fetchIdentity(): Promise<IdentityResponse> {
  return request<IdentityResponse>('/api/identity')
}

export async function fetchData(): Promise<AppData> {
  return request<AppData>('/api/data')
}

export async function saveData(data: AppData): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>('/api/data', {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export async function fetchShared(shareId: string): Promise<AppData> {
  const res = await fetch(`/api/share/${shareId}`)
  if (!res.ok) throw new Error('Shared tracker not found')
  return res.json() as Promise<AppData>
}
