import 'server-only'

// スタブ: 実 ORM(Prisma/Drizzle) の代わりの最小インメモリ実装。
// 本物のシングルトン/接続プーラの発想は references/data-access.md 参照。
// 実 ORM では select で必要列だけ取得する（ここでは型を単純化するため全列返す）。
export type PostRow = { id: string; title: string; body: string; authorId: string; excerpt: string }
export type UserRow = { id: string; name: string }
export type OrderRow = { id: string; title: string }

const _posts: PostRow[] = [{ id: 'p_1', title: 'hello', body: 'body', authorId: 'u_1', excerpt: 'ex' }]
const _users: UserRow[] = [{ id: 'u_1', name: 'Alice' }]
const _orders: OrderRow[] = [{ id: 'o_1', title: 'first order' }]

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
}
