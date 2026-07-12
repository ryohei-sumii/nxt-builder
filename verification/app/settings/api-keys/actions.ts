'use server'
import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import { apiKeys } from '@/lib/data/api-keys'
import { apiKeyCreateLimiter } from '@/lib/rate-limit'
import { CreateApiKeySchema, RevokeApiKeySchema } from '@/lib/validation/api-key'

const SETTINGS_PATH = '/settings/api-keys'

// 成功時のみ平文を一度だけ返す（保存しない）。次のレンダリングで state がリセットされれば消える。
export type CreateKeyState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | { status: 'success'; plaintext: string; name: string }

// 境界: 認証 → レート制限 → Zod → DAL → 再検証。
export async function createApiKeyAction(
  _prev: CreateKeyState,
  formData: FormData,
): Promise<CreateKeyState> {
  const session = await auth()
  if (!session) return { status: 'error', message: 'ログインが必要です' } // 認証

  const { success } = await apiKeyCreateLimiter.limit(session.userId) // 濫用され得る発行経路を制限
  if (!success) {
    return { status: 'error', message: '発行の回数制限に達しました。しばらくして再試行してください' }
  }

  const parsed = CreateApiKeySchema.safeParse({ name: formData.get('name') }) // 全入力を検証
  if (!parsed.success) return { status: 'error', message: parsed.error.issues[0].message }

  const { plaintext, key } = await apiKeys.create(session.userId, parsed.data.name) // ハッシュのみ保存
  revalidatePath(SETTINGS_PATH)
  return { status: 'success', plaintext, name: key.name }
}

// 失効はサーバーフォームから直接呼ぶため引数は formData のみ・戻り値は void。
export async function revokeApiKeyAction(formData: FormData): Promise<void> {
  const session = await auth()
  if (!session) return // 認証

  const parsed = RevokeApiKeySchema.safeParse({ keyId: formData.get('keyId') })
  if (!parsed.success) return

  await apiKeys.revoke(session.userId, parsed.data.keyId) // 所有スコープは DAL（IDOR 回避）
  revalidatePath(SETTINGS_PATH)
}
