/**
 * Fina camada sobre a Web Notifications API.
 *
 * Limitação conhecida: só funciona enquanto o navegador estiver aberto
 * (em segundo plano tudo bem, fechado não). Notificação "de verdade" com
 * o navegador fechado exige um backend com Web Push + Service Worker
 * (ver MELHORIAS.md).
 */

export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window
}

export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!isNotificationSupported()) return 'unsupported'
  return Notification.permission
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!isNotificationSupported()) return 'denied'
  if (Notification.permission !== 'default') return Notification.permission
  return Notification.requestPermission()
}

export function notify(title: string, body: string, tag?: string): void {
  if (!isNotificationSupported() || Notification.permission !== 'granted') return
  try {
    new Notification(title, { body, tag })
  } catch (error) {
    console.error('Erro ao exibir notificação:', error)
  }
}
