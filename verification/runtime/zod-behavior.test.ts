import { describe, it, expect } from 'vitest'
import { z } from 'zod'

// tsc をすり抜ける「実行時の挙動」を固定する層。
// docs（libraries.md / patterns.md）がスニペットで主張する zod の挙動が、対象バージョンで
// 実際にその通りかを実行時に検証する。ここが崩れたら docs か推奨を見直す合図。

describe('libraries.md: 真偽値の文字列変換', () => {
  it('z.coerce.boolean は "false"/"0"/"off" を true にするフットガン（だから推奨しない）', () => {
    // この挙動が「直った」ら libraries.md の警告文言を見直す
    expect(z.coerce.boolean().parse('false')).toBe(true)
    expect(z.coerce.boolean().parse('0')).toBe(true)
    expect(z.coerce.boolean().parse('off')).toBe(true)
    expect(z.coerce.boolean().parse('')).toBe(false)
  })

  it('z.stringbool は truthy/falsy を正しく判定（推奨）', () => {
    const Flag = z.stringbool()
    expect(Flag.parse('true')).toBe(true)
    expect(Flag.parse('1')).toBe(true)
    expect(Flag.parse('yes')).toBe(true)
    expect(Flag.parse('on')).toBe(true)
    expect(Flag.parse('false')).toBe(false)
    expect(Flag.parse('0')).toBe(false)
    expect(Flag.parse('off')).toBe(false)
    // 型は boolean に推論される
    const b: boolean = Flag.parse('yes')
    expect(b).toBe(true)
  })

  it('enum + transform の代替も等価', () => {
    const Flag = z.enum(['true', 'false']).transform((v) => v === 'true')
    expect(Flag.parse('true')).toBe(true)
    expect(Flag.parse('false')).toBe(false)
  })
})

describe('libraries.md: 数値の文字列変換の注意', () => {
  it('z.coerce.number は空文字を 0 にする（任意入力欄で無言の 0 混入）', () => {
    expect(z.coerce.number().parse('')).toBe(0)
    // 意図を明示するなら optional/min 等で防ぐ
    expect(z.coerce.number().min(1).safeParse('').success).toBe(false)
  })
})

describe('cloud-webhooks.md: presigned の contentType allowlist', () => {
  const Input = z.object({
    filename: z.string().min(1).max(255),
    contentType: z.enum(['image/png', 'image/jpeg', 'application/pdf']),
  })
  it('許可された型は通り、許可外は弾く', () => {
    expect(Input.safeParse({ filename: 'a.png', contentType: 'image/png' }).success).toBe(true)
    expect(Input.safeParse({ filename: 'a.exe', contentType: 'application/x-msdownload' }).success).toBe(false)
  })
})

describe('security/patterns: Zod 4 の書式', () => {
  it('z.email() / z.url() が top-level で使える（Zod 4 推奨形）', () => {
    expect(z.email().safeParse('a@b.com').success).toBe(true)
    expect(z.email().safeParse('nope').success).toBe(false)
    expect(z.url().safeParse('https://x.dev').success).toBe(true)
  })
})
