import { Collapsible } from '@/components/collapsible'
import { posts } from '@/lib/data/posts'

// patterns.md §4: Server → Client の "donut"。サーバー描画を Client の殻に差し込む。
export default async function Page() {
  const post = await posts.byId('p_1')
  return (
    <main>
      <h1>nextjs-builder verification app</h1>
      {post && (
        <Collapsible title={post.title}>
          {/* children はサーバーで描画され、クライアント JS に乗らない */}
          <article>
            <p>{post.body}</p>
          </article>
        </Collapsible>
      )}
    </main>
  )
}
