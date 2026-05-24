import { randomUUID } from 'node:crypto'
import type { PageData } from '../db/schema.js'

export interface IngestionMaterialInput {
  filename: string
  mimeType?: string
  content: string
  intendedUse?: 'page' | 'reference' | 'requirements' | 'asset' | 'auto'
}

export interface IngestionResult {
  pages: PageData[]
}

/**
 * v2 极简 ingestion：上传的 HTML 文件直接成为页面，不再解析为 schema。
 * 非 HTML 文件目前忽略（v3 物料库会重做）。
 */
export function ingestMaterials(input: { prompt?: string; materials: IngestionMaterialInput[] }): IngestionResult {
  const pages: PageData[] = []

  for (const material of input.materials) {
    if (!isHtmlMaterial(material)) continue

    const id = `page-${randomUUID().slice(0, 8)}`
    const title = deriveTitle(material) ?? '未命名页面'

    pages.push({
      id,
      title,
      layoutId: null,
      contentHtml: material.content,
    })
  }

  return { pages }
}

function isHtmlMaterial(m: IngestionMaterialInput): boolean {
  if (m.intendedUse && m.intendedUse !== 'page' && m.intendedUse !== 'auto') return false
  const lowerFilename = m.filename.toLowerCase()
  const isHtmlByExt = lowerFilename.endsWith('.html') || lowerFilename.endsWith('.htm')
  const isHtmlByMime = !!m.mimeType && /html/i.test(m.mimeType)
  const looksLikeHtml = /<html|<!doctype html|<body|<head/i.test(m.content.slice(0, 500))
  return isHtmlByExt || isHtmlByMime || looksLikeHtml
}

function deriveTitle(m: IngestionMaterialInput): string | null {
  const titleMatch = m.content.match(/<title[^>]*>([^<]+)<\/title>/i)
  if (titleMatch?.[1]?.trim()) return titleMatch[1].trim()
  const h1Match = m.content.match(/<h1[^>]*>([^<]+)<\/h1>/i)
  if (h1Match?.[1]?.trim()) return h1Match[1].trim()
  const filenameWithoutExt = m.filename.replace(/\.(html|htm)$/i, '')
  return filenameWithoutExt || null
}
