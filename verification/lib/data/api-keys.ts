import 'server-only'
import { cache } from 'react'
import { db } from '@/lib/db'
import { generateApiKey } from '@/lib/api-keys/crypto'

// data-access.md: 認可（所有スコープ）・select・DTO 化を DAL 内で完結。keyHash は DTO に載せない。
export type ApiKeyStatus = 'active' | 'revoked'

export interface ApiKeyDto {
  id: string
  name: string
  prefix: string
  createdAt: string
  lastUsedAt: string | null
  status: ApiKeyStatus
}

function toDto(row: {
  id: string
  name: string
  prefix: string
  createdAt: Date
  lastUsedAt: Date | null
  revokedAt: Date | null
}): ApiKeyDto {
  return {
    id: row.id,
    name: row.name,
    prefix: row.prefix,
    createdAt: row.createdAt.toISOString(),
    lastUsedAt: row.lastUsedAt ? row.lastUsedAt.toISOString() : null,
    status: row.revokedAt ? 'revoked' : 'active', // keyHash は返さない
  }
}

export interface CreatedApiKey {
  plaintext: string // 一度だけ表示。保存されない
  key: ApiKeyDto
}

export const apiKeys = {
  // 所有スコープで一覧（IDOR 回避）。DTO のみ返す。
  list: cache(async (userId: string): Promise<ApiKeyDto[]> => {
    const rows = await db.apiKey.findMany({ where: { userId } })
    return rows
      .slice()
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map(toDto)
  }),

  // 発行: ハッシュのみ保存。平文は呼び出し元へ一度だけ返す。
  create: async (userId: string, name: string): Promise<CreatedApiKey> => {
    const generated = generateApiKey()
    const row = await db.apiKey.create({
      data: { userId, name, prefix: generated.prefix, keyHash: generated.keyHash },
    })
    return { plaintext: generated.plaintext, key: toDto(row) }
  },

  // 失効: where に userId を含めるので他人のキーIDは 0 行（IDOR 回避）。成否は存否秘匿のため一様化可能。
  revoke: async (userId: string, keyId: string): Promise<boolean> => {
    const affected = await db.apiKey.revoke({ where: { id: keyId, userId } })
    return affected > 0
  },
}
