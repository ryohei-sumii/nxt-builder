import type { NextConfig } from 'next'

// 検証ハーネスは「パターンがコンパイル・ビルドできる」ことを担保する目的。
// cacheComponents はあえて有効化しない（既定=動的のままにして、'use cache' の制約でビルドが
// 複雑化するのを避ける）。キャッシュ意味論の検証はスコープ外（README 参照）。
const config: NextConfig = {}

export default config
