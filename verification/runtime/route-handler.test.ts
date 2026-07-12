import { describe, it, expect, vi, beforeEach } from 'vitest'

// testing.md: Route Handler は POST(new Request(...)) を直接呼び、status/JSON をアサートする。
// 認証・データ層は差し替え可能な抽象（DIP）なのでモック注入できる。
// vi.mock はファイル先頭へ巻き上げられるため、参照する二重関数は vi.hoisted で先に確保する。
const { authMock, createMock } = vi.hoisted(() => ({ authMock: vi.fn(), createMock: vi.fn() }))
vi.mock('@/lib/auth', () => ({ auth: () => authMock() }))
vi.mock('@/lib/data/posts', () => ({ posts: { create: (input: unknown) => createMock(input) } }))

import { POST } from '@/app/api/posts/route'

function req(body: unknown) {
  return new Request('http://test/api/posts', { method: 'POST', body: JSON.stringify(body) })
}

describe('POST /api/posts の境界', () => {
  beforeEach(() => {
    authMock.mockReset()
    createMock.mockReset()
  })

  it('未ログインは 401（データ層に触れない）', async () => {
    authMock.mockResolvedValue(null)
    const res = await POST(req({ title: 'x', body: 'y' }))
    expect(res.status).toBe(401)
    expect(createMock).not.toHaveBeenCalled()
  })

  it('認証済みでも不正 body は 400', async () => {
    authMock.mockResolvedValue({ userId: 'u_1', role: 'user' })
    const res = await POST(req({ title: '' }))
    expect(res.status).toBe(400)
    expect(createMock).not.toHaveBeenCalled()
  })

  it('妥当なら 201 と作成結果を返し、authorId はセッション由来', async () => {
    authMock.mockResolvedValue({ userId: 'u_1', role: 'user' })
    createMock.mockResolvedValue({ id: 'p_1' })
    const res = await POST(req({ title: 'x', body: 'y' }))
    expect(res.status).toBe(201)
    expect(await res.json()).toEqual({ id: 'p_1' })
    // クライアント入力に authorId が混ざらず、サーバーが付与している
    expect(createMock).toHaveBeenCalledWith({ title: 'x', body: 'y', authorId: 'u_1' })
  })
})
