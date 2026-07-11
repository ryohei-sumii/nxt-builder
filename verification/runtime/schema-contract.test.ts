import { describe, it, expect } from 'vitest'
import { CreatePostSchema } from '@/lib/validation/post'

// testing.md §3: 検証スキーマ（lib/validation/*）の境界値テスト。
// アプリ本体が実際に使う schema を import して契約を固定する（インライン再定義ではない）。
describe('CreatePostSchema の境界', () => {
  it('妥当な入力は通る', () => {
    expect(CreatePostSchema.safeParse({ title: 'x', body: 'y' }).success).toBe(true)
  })
  it('空タイトルは弾き、日本語メッセージを返す', () => {
    const r = CreatePostSchema.safeParse({ title: '', body: 'y' })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.issues[0].message).toBe('タイトルは必須です')
  })
  it('title 201 文字は max(200) で弾く', () => {
    expect(CreatePostSchema.safeParse({ title: 'a'.repeat(201), body: 'y' }).success).toBe(false)
  })
  it('body 空は弾く', () => {
    expect(CreatePostSchema.safeParse({ title: 'x', body: '' }).success).toBe(false)
  })
})
