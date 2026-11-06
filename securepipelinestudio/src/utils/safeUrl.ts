export function safeHttpsUrl(value: string): string | null {
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:') return null
    return url.href
  } catch {
    return null
  }
}
