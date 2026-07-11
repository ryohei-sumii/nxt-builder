import { NewPostForm } from './new-post-form'

// Server Component。フォーム（葉の Client Component）だけを差し込む。
export default function PostsPage() {
  return (
    <main>
      <h1>投稿</h1>
      <NewPostForm />
    </main>
  )
}
