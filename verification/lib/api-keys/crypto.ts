import 'server-only'
import { createHash, randomBytes } from 'node:crypto'

// security.md: API キーは高エントロピー乱数なので、保存/照合は高速ハッシュ（SHA-256）が適切。
// パスワード（低エントロピー）と違い遅い KDF は不要。平文は保存せず、発行時に一度だけ返す。
const KEY_PREFIX = 'sk_live_'
const RANDOM_BYTES = 32
const PREFIX_DISPLAY_LENGTH = KEY_PREFIX.length + 4

export type GeneratedApiKey = {
  plaintext: string // 一度だけ表示。保存しない
  prefix: string // 非秘密の表示用断片
  keyHash: string // 保存してよいのはこれだけ
}

export function hashApiKey(plaintext: string): string {
  return createHash('sha256').update(plaintext).digest('hex')
}

export function generateApiKey(): GeneratedApiKey {
  const secret = randomBytes(RANDOM_BYTES).toString('base64url')
  const plaintext = `${KEY_PREFIX}${secret}`
  return {
    plaintext,
    prefix: plaintext.slice(0, PREFIX_DISPLAY_LENGTH),
    keyHash: hashApiKey(plaintext),
  }
}
