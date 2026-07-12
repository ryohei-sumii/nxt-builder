import { z } from 'zod'

// libraries.md: 境界スキーマを 1 箇所に。zod 4 書式（z.uuid()）。型は z.infer で導出。
export const CreateApiKeySchema = z.object({
  name: z.string().trim().min(1, 'ラベルは必須です').max(64, 'ラベルは64文字以内です'),
})
export const RevokeApiKeySchema = z.object({
  keyId: z.uuid('不正なキーIDです'),
})
export type CreateApiKeyInput = z.infer<typeof CreateApiKeySchema>
