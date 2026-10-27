/**
 * Evento disparado toda vez que trades, ledger ou settings são
 * persistidos no localStorage — usado pelo auto-sync do Google Drive
 * para reagir a mudanças reais quase na hora, em vez de depender só de
 * um intervalo fixo de verificação.
 */
const EVENT_NAME = 'target-hunter:data-changed'

export function notifyDataChanged(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVENT_NAME))
}

export function onDataChanged(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  window.addEventListener(EVENT_NAME, callback)
  return () => window.removeEventListener(EVENT_NAME, callback)
}
