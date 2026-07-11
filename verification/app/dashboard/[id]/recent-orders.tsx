import { getOrders, getRecommendations } from '@/lib/data/orders'

// patterns.md §2: 独立取得は Promise.all で並列化（ウォーターフォール回避）。
export async function RecentOrders({ userId }: { userId: string }) {
  const [orders, recs] = await Promise.all([getOrders(userId), getRecommendations(userId)])
  return (
    <section>
      <ul>
        {orders.map((o) => (
          <li key={o.id}>{o.title}</li>
        ))}
      </ul>
      <aside>
        {recs.map((r) => (
          <span key={r.id}>{r.title}</span>
        ))}
      </aside>
    </section>
  )
}
