/**
 * Integração com Google Drive via Google Identity Services (GIS), 100%
 * client-side — sem backend, sem client secret. Usa o escopo completo
 * `drive` (não `drive.file`) porque o destino é uma pasta fixa, criada
 * fora deste app e compartilhada com outras ferramentas (cash flow,
 * patrimônio) — `drive.file` só enxergaria arquivos que o próprio app
 * criasse, nunca essa pasta já existente.
 *
 * Pré-requisito (fora do código), no Google Cloud Console:
 * - OAuth Client ID, exposto como `NEXT_PUBLIC_GOOGLE_CLIENT_ID`.
 * - O escopo `https://www.googleapis.com/auth/drive` precisa estar
 *   listado na tela de consentimento OAuth do projeto.
 */

const GIS_SCRIPT_SRC = 'https://accounts.google.com/gsi/client'
const DRIVE_API = 'https://www.googleapis.com/drive/v3'
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3'
const USERINFO_API = 'https://www.googleapis.com/oauth2/v3/userinfo'
const SCOPES = 'https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/userinfo.email'

/** Pasta fixa, compartilhada com outros apps (cash flow, patrimônio). */
export const TRADES_DRIVE_FOLDER_ID = '1siYo_G-N_Kdgmb7SDGwIlGIUEPSPQ-hw'
const BACKUP_FILE_NAME = 'trades-data.json'

export function getGoogleClientId(): string | undefined {
  return process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
}

export function isGoogleDriveConfigured(): boolean {
  return Boolean(getGoogleClientId())
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient(config: {
            client_id: string
            scope: string
            callback: (response: { access_token?: string; error?: string; expires_in?: number }) => void
          }): { requestAccessToken(options: { prompt: string }): void }
          revoke(accessToken: string, done: () => void): void
        }
      }
    }
  }
}

/**
 * Cache em memória do último access token obtido. Sem isso, toda ação
 * (sync, restore, desconectar) pedia um token novo ao Google — e se a
 * sessão silenciosa falhasse por qualquer motivo, isso podia abrir o
 * popup de login até para ações que não deveriam precisar disso, como
 * desconectar.
 */
let cachedToken: { value: string; expiresAt: number } | null = null
const TOKEN_EXPIRY_SAFETY_MARGIN_MS = 30_000

function getCachedToken(): string | null {
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.value
  return null
}

/** Token em memória, se ainda válido, sem disparar nenhuma chamada ao Google. */
export function getCachedAccessToken(): string | null {
  return getCachedToken()
}

/** Esquece o token em memória — usado ao desconectar, mesmo sem revogar no Google. */
export function clearCachedToken(): void {
  cachedToken = null
}

let gisLoadPromise: Promise<void> | null = null

/**
 * Carrega o script do Google Identity Services antecipadamente (ex: ao
 * montar a página, não só no clique do botão). Sem isso, o primeiro
 * clique em "Conectar"/"Sincronizar" dispara o carregamento do script e
 * só then chama `requestAccessToken` — esse intervalo assíncrono pode
 * ser o suficiente para o navegador invalidar o gesto do clique e
 * bloquear o popup do Google por engano ("Failed to open popup window").
 */
export function preloadGoogleIdentityServices(): void {
  loadGisScript().catch(() => {
    // Falha de rede aqui não é fatal — a próxima chamada real tenta de novo.
  })
}

function loadGisScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('Ambiente sem window'))
  if (window.google?.accounts?.oauth2) return Promise.resolve()
  if (gisLoadPromise) return gisLoadPromise

  gisLoadPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${GIS_SCRIPT_SRC}"]`)
    if (existing) {
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () => reject(new Error('Falha ao carregar script do Google')))
      return
    }

    const script = document.createElement('script')
    script.src = GIS_SCRIPT_SRC
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Falha ao carregar script do Google'))
    document.head.appendChild(script)
  })

  return gisLoadPromise
}

const ACCESS_TOKEN_TIMEOUT_MS = 90_000

/**
 * Pede um access token ao Google. `prompt: 'consent'` mostra a tela de
 * login/consentimento (primeira conexão); `prompt: ''` tenta renovar em
 * silêncio usando a sessão já autorizada (usado no auto-sync).
 *
 * O popup do Google (login inválido, cancelado pelo usuário, etc.) nem
 * sempre aciona o callback do token client — sem um timeout, a promise
 * fica pendurada para sempre e a UI trava no estado "conectando".
 */
export async function requestAccessToken(prompt: 'consent' | '' = ''): Promise<string> {
  if (prompt === '') {
    const cached = getCachedToken()
    if (cached) return cached
  }

  const clientId = getGoogleClientId()
  if (!clientId) throw new Error('Google Drive não configurado (NEXT_PUBLIC_GOOGLE_CLIENT_ID ausente)')

  await loadGisScript()
  if (!window.google?.accounts?.oauth2) throw new Error('Google Identity Services indisponível')

  const tokenPromise = new Promise<string>((resolve, reject) => {
    const client = window.google!.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPES,
      callback: (response) => {
        if (response.error || !response.access_token) {
          reject(new Error(response.error || 'Não foi possível obter acesso ao Google Drive'))
          return
        }
        cachedToken = {
          value: response.access_token,
          expiresAt: Date.now() + (response.expires_in ?? 3600) * 1000 - TOKEN_EXPIRY_SAFETY_MARGIN_MS,
        }
        resolve(response.access_token)
      },
    })
    client.requestAccessToken({ prompt })
  })

  const timeoutPromise = new Promise<string>((_, reject) => {
    setTimeout(
      () => reject(new Error('Tempo esgotado esperando a autorização do Google')),
      ACCESS_TOKEN_TIMEOUT_MS,
    )
  })

  return Promise.race([tokenPromise, timeoutPromise])
}

export function revokeAccessToken(accessToken: string): Promise<void> {
  return new Promise((resolve) => {
    if (!window.google?.accounts?.oauth2) {
      resolve()
      return
    }
    window.google.accounts.oauth2.revoke(accessToken, () => resolve())
  })
}

async function driveFetch(accessToken: string, url: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(url, {
    ...init,
    headers: {
      ...init?.headers,
      Authorization: `Bearer ${accessToken}`,
    },
  })
  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`Erro na API do Google Drive (${response.status}): ${body || response.statusText}`)
  }
  return response
}

export async function getGoogleAccountEmail(accessToken: string): Promise<string | null> {
  try {
    const response = await driveFetch(accessToken, USERINFO_API)
    const data = await response.json()
    return data.email || null
  } catch {
    return null
  }
}

/** Nome de exibição da pasta fixa (só para mostrar na UI; falha em silêncio). */
export async function getFolderName(accessToken: string, folderId: string): Promise<string | null> {
  try {
    const response = await driveFetch(accessToken, `${DRIVE_API}/files/${folderId}?fields=name`)
    const data = await response.json()
    return data.name || null
  } catch {
    return null
  }
}

async function findFile(
  accessToken: string,
  query: string,
): Promise<{ id: string; name: string } | null> {
  const url = `${DRIVE_API}/files?q=${encodeURIComponent(query)}&fields=files(id,name)&spaces=drive`
  const response = await driveFetch(accessToken, url)
  const data = await response.json()
  return data.files?.[0] || null
}

/** Cria ou atualiza o arquivo de backup dentro da pasta, com o JSON exportado do app. */
export async function uploadBackup(accessToken: string, folderId: string, content: string): Promise<void> {
  const existing = await findFile(
    accessToken,
    `'${folderId}' in parents and name='${BACKUP_FILE_NAME}' and trashed=false`,
  )

  const fileId = existing
    ? existing.id
    : await (async () => {
      const response = await driveFetch(accessToken, `${DRIVE_API}/files?fields=id`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: BACKUP_FILE_NAME, parents: [folderId] }),
      })
      const data = await response.json()
      return data.id as string
    })()

  await driveFetch(accessToken, `${DRIVE_UPLOAD_API}/files/${fileId}?uploadType=media`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: content,
  })
}

/** Lê o conteúdo do arquivo de backup na pasta, ou `null` se ainda não existir. */
export async function downloadBackup(accessToken: string, folderId: string): Promise<string | null> {
  const existing = await findFile(
    accessToken,
    `'${folderId}' in parents and name='${BACKUP_FILE_NAME}' and trashed=false`,
  )
  if (!existing) return null

  const response = await driveFetch(accessToken, `${DRIVE_API}/files/${existing.id}?alt=media`)
  return response.text()
}
