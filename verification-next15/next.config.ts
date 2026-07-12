import type { NextConfig } from 'next'

// Next 15 の版差検証ハーネス。Next 16 の Cache Components（cacheComponents + 'use cache'）は
// 使わない（15 では experimental で既定 OFF）。既定の動的レンダリングのままにする。
const config: NextConfig = {}

export default config
