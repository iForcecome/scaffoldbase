// HTML 操作执行器 —— content-html 字符串 in，新字符串 out。
//
// 设计：
// - op 是声明性结构（不携带 DOM 引用）。dom-tools 产生 op，dispatcher 在
//   apply 时调 applyHtmlOps 真正落地。
// - 输入 contentHtml 必须已经分配过 sf-id（loadProject 时一次性处理）。
// - 插入的 HTML 片段会自动分配 sf-id（接续当前最大编号）。
// - 多个 op 在同一次 parse/serialize 内顺序应用，效率高 + 状态自洽。

import {
  parseHtml,
  serializeHtml,
  SF_ID_ATTR,
  type ParseResult,
} from './sf-ids'

export type HtmlOp =
  | { type: 'set_text'; sfId: string; text: string }
  | { type: 'set_attr'; sfId: string; name: string; value: string }
  | { type: 'remove_attr'; sfId: string; name: string }
  | { type: 'set_style'; sfId: string; property: string; value: string }
  | { type: 'add_class'; sfId: string; classNames: string[] }
  | { type: 'remove_class'; sfId: string; classNames: string[] }
  | { type: 'delete'; sfId: string }
  | { type: 'insert_html'; targetSfId: string; position: 'before' | 'prepend' | 'append' | 'after'; html: string }
  | { type: 'replace_html'; sfId: string; html: string }
  | { type: 'move'; sourceSfId: string; targetSfId: string; position: 'before' | 'prepend' | 'append' | 'after' }

export interface OpError {
  opIndex: number
  op: HtmlOp
  code: string
  message: string
}

export interface ApplyResult {
  html: string
  errors: OpError[]
  /** 受影响的 sf-id（用于上层失效缓存 / 提示）。包含插入新元素分配的 id。 */
  affectedIds: string[]
}

// 禁止改的属性 —— sf-id 本身改了会破坏后续定位
const PROTECTED_ATTRS = new Set([SF_ID_ATTR])

function findBySfId(parsed: ParseResult, sfId: string): Element | null {
  // 用 attribute selector 避免特殊字符问题（实际 id 都是 sf-N，正则简单）
  return parsed.doc.querySelector(`[${SF_ID_ATTR}="${sfId.replace(/"/g, '\\"')}"]`)
}

function nextIdInDoc(parsed: ParseResult): number {
  let maxId = -1
  parsed.doc.querySelectorAll<HTMLElement>(`[${SF_ID_ATTR}]`).forEach(el => {
    const v = el.getAttribute(SF_ID_ATTR) || ''
    const m = /^sf-(\d+)$/.exec(v)
    if (m) {
      const n = parseInt(m[1], 10)
      if (n > maxId) maxId = n
    }
  })
  return maxId + 1
}

function assignIdsInside(el: Element, nextRef: { value: number }, collect: string[]): void {
  if (!el.getAttribute(SF_ID_ATTR)) {
    const id = `sf-${nextRef.value++}`
    el.setAttribute(SF_ID_ATTR, id)
    collect.push(id)
  } else {
    collect.push(el.getAttribute(SF_ID_ATTR) as string)
  }
  for (let i = 0; i < el.children.length; i++) {
    assignIdsInside(el.children[i], nextRef, collect)
  }
}

function parseFragment(html: string): Element[] {
  const tpl = document.createElement('template')
  tpl.innerHTML = html
  return Array.from(tpl.content.children)
}

function applyOne(parsed: ParseResult, op: HtmlOp, nextRef: { value: number }, affected: string[]): void {
  switch (op.type) {
    case 'set_text': {
      const el = findBySfId(parsed, op.sfId)
      if (!el) throw new OpFail('target_not_found', `sf-id "${op.sfId}" 不存在`)
      el.textContent = op.text
      affected.push(op.sfId)
      return
    }
    case 'set_attr': {
      const el = findBySfId(parsed, op.sfId)
      if (!el) throw new OpFail('target_not_found', `sf-id "${op.sfId}" 不存在`)
      if (PROTECTED_ATTRS.has(op.name)) throw new OpFail('protected_attr', `属性 "${op.name}" 不允许直接修改`)
      el.setAttribute(op.name, op.value)
      affected.push(op.sfId)
      return
    }
    case 'remove_attr': {
      const el = findBySfId(parsed, op.sfId)
      if (!el) throw new OpFail('target_not_found', `sf-id "${op.sfId}" 不存在`)
      if (PROTECTED_ATTRS.has(op.name)) throw new OpFail('protected_attr', `属性 "${op.name}" 不允许移除`)
      el.removeAttribute(op.name)
      affected.push(op.sfId)
      return
    }
    case 'set_style': {
      const el = findBySfId(parsed, op.sfId) as HTMLElement | null
      if (!el) throw new OpFail('target_not_found', `sf-id "${op.sfId}" 不存在`)
      // 空字符串 = 删除此属性
      el.style.setProperty(op.property, op.value)
      if (op.value === '') el.style.removeProperty(op.property)
      affected.push(op.sfId)
      return
    }
    case 'add_class': {
      const el = findBySfId(parsed, op.sfId)
      if (!el) throw new OpFail('target_not_found', `sf-id "${op.sfId}" 不存在`)
      for (const cls of op.classNames) {
        const trimmed = cls.trim()
        if (trimmed) el.classList.add(trimmed)
      }
      affected.push(op.sfId)
      return
    }
    case 'remove_class': {
      const el = findBySfId(parsed, op.sfId)
      if (!el) throw new OpFail('target_not_found', `sf-id "${op.sfId}" 不存在`)
      for (const cls of op.classNames) {
        const trimmed = cls.trim()
        if (trimmed) el.classList.remove(trimmed)
      }
      affected.push(op.sfId)
      return
    }
    case 'delete': {
      const el = findBySfId(parsed, op.sfId)
      if (!el) throw new OpFail('target_not_found', `sf-id "${op.sfId}" 不存在`)
      if (el === parsed.doc.body || el === parsed.doc.documentElement) {
        throw new OpFail('cannot_delete_root', '不允许删除 body 或 html 元素')
      }
      affected.push(op.sfId)
      el.remove()
      return
    }
    case 'insert_html': {
      const target = findBySfId(parsed, op.targetSfId)
      if (!target) throw new OpFail('target_not_found', `sf-id "${op.targetSfId}" 不存在`)
      const fragmentEls = parseFragment(op.html)
      if (fragmentEls.length === 0) throw new OpFail('empty_fragment', 'html 解析后为空')
      // 把所有顶层元素插入 + 内部递归分配 sf-id
      for (const newEl of fragmentEls) {
        // 用 importNode 适配跨 document
        const imported = parsed.doc.importNode(newEl, true) as Element
        assignIdsInside(imported, nextRef, affected)
        insertAtPosition(target, imported, op.position)
      }
      return
    }
    case 'move': {
      const source = findBySfId(parsed, op.sourceSfId)
      if (!source) throw new OpFail('source_not_found', `sf-id "${op.sourceSfId}" 不存在`)
      const target = findBySfId(parsed, op.targetSfId)
      if (!target) throw new OpFail('target_not_found', `sf-id "${op.targetSfId}" 不存在`)
      if (source === target) throw new OpFail('same_node', '不能移动到自身')
      if (source === parsed.doc.body || source === parsed.doc.documentElement) {
        throw new OpFail('cannot_move_root', '不允许移动 body 或 html')
      }
      // target 不能是 source 的后代（否则会断链）
      if (source.contains(target)) {
        throw new OpFail('target_is_descendant', '不能把元素移动到自己的后代里')
      }
      // before / after 时 target 不能是 body / html（body 没有兄弟）
      if ((op.position === 'before' || op.position === 'after') &&
          (target === parsed.doc.body || target === parsed.doc.documentElement)) {
        throw new OpFail('invalid_target', 'before/after body 或 html 不可行，请改用 prepend/append')
      }
      source.remove()
      insertAtPosition(target, source, op.position)
      affected.push(op.sourceSfId)
      return
    }
    case 'replace_html': {
      const el = findBySfId(parsed, op.sfId)
      if (!el) throw new OpFail('target_not_found', `sf-id "${op.sfId}" 不存在`)
      if (el === parsed.doc.body || el === parsed.doc.documentElement) {
        throw new OpFail('cannot_replace_root', '不允许替换 body 或 html 元素')
      }
      const fragmentEls = parseFragment(op.html)
      if (fragmentEls.length === 0) throw new OpFail('empty_fragment', 'html 解析后为空')
      const first = parsed.doc.importNode(fragmentEls[0], true) as Element
      // 保留原 sf-id（让后续指令仍能引用），其余 children 新分配
      const originalSfId = el.getAttribute(SF_ID_ATTR)
      if (originalSfId) first.setAttribute(SF_ID_ATTR, originalSfId)
      assignIdsInside(first, nextRef, affected)
      el.replaceWith(first)
      // 兄弟元素也插入到同位置
      let cursor: Element = first
      for (let i = 1; i < fragmentEls.length; i++) {
        const sibling = parsed.doc.importNode(fragmentEls[i], true) as Element
        assignIdsInside(sibling, nextRef, affected)
        cursor.after(sibling)
        cursor = sibling
      }
      return
    }
    default: {
      const _exhaustive: never = op
      throw new OpFail('unknown_op', `未知 op 类型: ${JSON.stringify(_exhaustive)}`)
    }
  }
}

function insertAtPosition(target: Element, newEl: Element, position: 'before' | 'prepend' | 'append' | 'after'): void {
  switch (position) {
    case 'before':
      target.before(newEl)
      return
    case 'prepend':
      target.prepend(newEl)
      return
    case 'append':
      target.append(newEl)
      return
    case 'after':
      target.after(newEl)
      return
  }
}

class OpFail extends Error {
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}

/**
 * 依次应用 ops。任一 op 失败被记录但不中断后续；返回最终 HTML + 错误清单。
 * 这样部分成功也能落地，调用方根据 errors.length 决定是否回滚。
 */
export function applyHtmlOps(contentHtml: string, ops: HtmlOp[]): ApplyResult {
  if (ops.length === 0) {
    return { html: contentHtml, errors: [], affectedIds: [] }
  }
  const parsed = parseHtml(contentHtml)
  const nextRef = { value: nextIdInDoc(parsed) }
  const errors: OpError[] = []
  const affected: string[] = []

  for (let i = 0; i < ops.length; i++) {
    const op = ops[i]
    try {
      applyOne(parsed, op, nextRef, affected)
    } catch (err) {
      if (err instanceof OpFail) {
        errors.push({ opIndex: i, op, code: err.code, message: err.message })
      } else {
        errors.push({
          opIndex: i,
          op,
          code: 'unexpected_error',
          message: err instanceof Error ? err.message : String(err),
        })
      }
    }
  }

  return { html: serializeHtml(parsed), errors, affectedIds: affected }
}
