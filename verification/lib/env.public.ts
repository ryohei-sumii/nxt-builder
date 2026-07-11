import { z } from 'zod'

// patterns.md §5: クライアントでも参照可（NEXT_PUBLIC_ のみ）。ビルド時にインライン化されるため個別に参照。
const PublicEnv = z.object({ NEXT_PUBLIC_APP_URL: z.url().default('http://localhost:3000') })

export const publicEnv = PublicEnv.parse({
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
})
