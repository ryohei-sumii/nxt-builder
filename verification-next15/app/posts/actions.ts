'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'

// Server Action: 先頭で認証 → Zod safeParse（型注釈は検証ではない）。authorId はセッション由来。
// useActionState 互換の (prevState, formData) シグネチャ（版に依らない）。
const CreatePost = z.object({ title: z.string().min(1).max(200), body: z.string().min(1) })

export type CreatePostState = { error?: string; ok?: true }

export async function createPost(_prev: CreatePostState, formData: FormData): Promise<CreatePostState> {
  const session = await auth()
  if (!session) return { error: 'unauthorized' }

  const parsed = CreatePost.safeParse({
    title: formData.get('title'),
    body: formData.get('body'),
  })
  if (!parsed.success) return { error: 'invalid' }

  // await posts.create({ ...parsed.data, authorId: session.userId })
  revalidatePath('/posts')
  return { ok: true }
}
