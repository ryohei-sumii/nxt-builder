'use server'
import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import { posts } from '@/lib/data/posts'
import { CreatePostSchema } from '@/lib/validation/post'

export type FormState = { error?: string; ok?: boolean }

// patterns.md §1: 認証（ログイン済みか）→ Zod 検証 → 永続化 → 再検証。
export async function createPost(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await auth()
  if (!session) return { error: 'ログインが必要です' } // 認証

  const parsed = CreatePostSchema.safeParse({
    title: formData.get('title'),
    body: formData.get('body'),
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message } // 検証

  await posts.create({ ...parsed.data, authorId: session.userId })
  revalidatePath('/posts')
  return { ok: true }
}
