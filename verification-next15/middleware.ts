import { NextResponse, type NextRequest } from 'next/server'

// ★版差の要: Next 15 ではファイル名は `middleware.ts`・エクスポート関数名は `middleware`。
//   Next 16 でこれが `proxy.ts` / `export function proxy` に改名される（15 では改名しない）。
// security.md の原則は版に依らず同じ: middleware は「未ログインを弾く粗い一次ガード」に留め、
// 本命の所有チェックは Server Action / Route Handler / lib/data 側で再チェックする（CVE-2025-29927）。
export function middleware(req: NextRequest) {
  const isAuthed = req.cookies.has('session')
  if (!isAuthed && req.nextUrl.pathname.startsWith('/dashboard')) {
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }
  return NextResponse.next()
}

export const config = { matcher: ['/dashboard/:path*'] }
