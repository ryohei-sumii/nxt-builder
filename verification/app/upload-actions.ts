'use server'
import { z } from 'zod'
import { verifySession } from '@/lib/dal'
import { createPresignedPutUrl } from '@/lib/storage'

// cloud-webhooks.md: contentType は allowlist(enum)で強制。クライアント申告の任意文字列を
// 無検証で署名に載せない。サイズ上限は presigned PUT では range 強制できない → POST/HEAD 検証（README）。
const Input = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.enum(['image/png', 'image/jpeg', 'application/pdf']),
})

export async function getUploadUrl(input: unknown) {
  const { userId } = await verifySession() // 認証・認可
  const parsed = Input.safeParse(input)
  if (!parsed.success) return { error: 'invalid' as const }
  // 署名した contentType は PUT 時に一致必須＝型を強制できる。key は UUID 前置で衝突/上書き防止。
  const key = `users/${userId}/${crypto.randomUUID()}-${parsed.data.filename}`
  return { url: await createPresignedPutUrl(key, parsed.data.contentType), key }
}
