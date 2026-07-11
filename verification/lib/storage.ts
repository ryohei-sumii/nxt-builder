import 'server-only'

// スタブ: 実体は @aws-sdk/s3-request-presigner 等。検証用にダミー URL を返す。
export async function createPresignedPutUrl(key: string, contentType: string): Promise<string> {
  return `https://example-bucket.s3.amazonaws.com/${key}?X-Amz-ContentType=${encodeURIComponent(contentType)}`
}
