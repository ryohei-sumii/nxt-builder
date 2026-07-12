import 'server-only'

// スタブ: 実 ORM(Prisma/Drizzle) の代わりの最小インメモリ実装。
// 本物のシングルトン/接続プーラの発想は references/data-access.md 参照。
// 実 ORM では select で必要列だけ取得する（ここでは型を単純化するため全列返す）。
export type PostRow = { id: string; title: string; body: string; authorId: string; excerpt: string }
export type UserRow = { id: string; name: string }
export type OrderRow = { id: string; title: string }
export type ApiKeyRow = {
  id: string
  userId: string
  name: string
  prefix: string
  keyHash: string
  createdAt: Date
  lastUsedAt: Date | null
  revokedAt: Date | null
}

const _posts: PostRow[] = [{ id: 'p_1', title: 'hello', body: 'body', authorId: 'u_1', excerpt: 'ex' }]
const _users: UserRow[] = [{ id: 'u_1', name: 'Alice' }]
const _orders: OrderRow[] = [{ id: 'o_1', title: 'first order' }]
const _apiKeys: ApiKeyRow[] = [
  {
    id: '00000000-0000-4000-8000-000000000001',
    userId: 'u_1',
    name: '本番用',
    prefix: 'sk_live_ab12',
    keyHash: 'seed', // 実際は SHA-256 hex。平文は保存しない（crypto.ts 参照）
    createdAt: new Date(0),
    lastUsedAt: null,
    revokedAt: null,
  },
]

export const db = {
  post: {
    findUnique: async (args: { where: { id: string } }): Promise<PostRow | null> =>
      _posts.find((p) => p.id === args.where.id) ?? null,
    create: async (args: { data: { title: string; body: string; authorId: string } }): Promise<PostRow> => {
      const row: PostRow = { id: `p_${_posts.length + 1}`, excerpt: args.data.body.slice(0, 20), ...args.data }
      _posts.push(row)
      return row
    },
  },
  user: {
    findUnique: async (args: { where: { id: string } }): Promise<UserRow | null> =>
      _users.find((u) => u.id === args.where.id) ?? null,
  },
  order: {
    findMany: async (_args: { where: { userId: string } }): Promise<OrderRow[]> => _orders,
  },
  apiKey: {
    // IDOR 回避: where に userId を必ず含める（DAL が保証）。実 ORM では select で必要列のみ。
    findMany: async (args: { where: { userId: string } }): Promise<ApiKeyRow[]> =>
      _apiKeys.filter((k) => k.userId === args.where.userId),
    create: async (args: {
      data: { userId: string; name: string; prefix: string; keyHash: string }
    }): Promise<ApiKeyRow> => {
      const row: ApiKeyRow = {
        id: `k_${_apiKeys.length + 1}`,
        createdAt: new Date(),
        lastUsedAt: null,
        revokedAt: null,
        ...args.data,
      }
      _apiKeys.push(row)
      return row
    },
    // 実 ORM の update({ where: { id, userId }, ... }) 相当。所有 userId 一致時のみ更新＝IDOR 回避。
    revoke: async (args: { where: { id: string; userId: string } }): Promise<number> => {
      const row = _apiKeys.find(
        (k) => k.id === args.where.id && k.userId === args.where.userId && k.revokedAt === null,
      )
      if (!row) return 0
      row.revokedAt = new Date()
      return 1
    },
  },
}
