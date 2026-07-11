import 'server-only'
import { z } from 'zod'

// patterns.md §5: サーバー専用（秘密を含む）。クライアントから import 不可。
const ServerEnv = z.object({
  DATABASE_URL: z.url().default('postgres://localhost/dev'), // Zod 4 推奨形。検証用に default を許容
  AUTH_SECRET: z.string().min(32).default('x'.repeat(32)),
  PROVIDER_WEBHOOK_SECRET: z.string().min(1).default('whsec_test'),
})

export const serverEnv = ServerEnv.parse(process.env)
