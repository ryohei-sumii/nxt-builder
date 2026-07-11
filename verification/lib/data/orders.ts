import 'server-only'
import { db } from '@/lib/db'

export async function getOrders(userId: string) {
  const rows = await db.order.findMany({ where: { userId } })
  return rows.map((o) => ({ id: o.id, title: o.title }))
}

export async function getRecommendations(userId: string) {
  const rows = await db.order.findMany({ where: { userId } })
  return rows.map((o) => ({ id: `rec_${o.id}`, title: `おすすめ: ${o.title}` }))
}
