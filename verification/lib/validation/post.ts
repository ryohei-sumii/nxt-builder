import { z } from 'zod'

// patterns.md §1: 検証スキーマを 1 箇所に定義し、型は z.infer で導出する。
export const CreatePostSchema = z.object({
  title: z.string().min(1, 'タイトルは必須です').max(200),
  body: z.string().min(1).max(10_000),
})
export type CreatePostInput = z.infer<typeof CreatePostSchema>

// 永続化ペイロード = フォーム入力 + サーバー由来の値（authorId はセッションから）。
export type CreatePostData = CreatePostInput & { authorId: string }
