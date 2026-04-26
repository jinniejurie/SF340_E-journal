import { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo } from 'react'
import { jsPDF } from 'jspdf'
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import { Resizable } from 're-resizable'
import { 
  Type, 
  Square, 
  Image as ImageIcon, 
  Download, 
  Share2, 
  ChevronLeft,
  ChevronDown,
  Triangle,
  Star,
  Minus,
  Circle,
  Sticker,
  Trash2,
  Palette,
  Copy,
  Scissors,
  Maximize2,
  ArrowDown,
  ArrowUp,
  Undo2,
  Redo2,
  RotateCw,
  StickyNote,
  Bold,
  Italic,
  Strikethrough,
  Highlighter,
  Pencil,
  ImagePlus
} from 'lucide-react'
import { auth } from '../services/firebase'
import { getNoteFromFirestore, saveNoteToFirestore } from '../services/noteService'
import '../styles/Note.css'

// Import sticker images
import sticker4 from '../assets/stickers/sticker4.png'
import sticker5 from '../assets/stickers/sticker5.png'
import sticker6 from '../assets/stickers/sticker6.png'
import sticker7 from '../assets/stickers/sticker7.png'
import sticker8 from '../assets/stickers/sticker8.png'
import sticker9 from '../assets/stickers/sticker9.png'
import sticker10 from '../assets/stickers/sticker10.png'
import c2Sticker1 from '../assets/stickers/collection2/work1.svg'
import c2Sticker2 from '../assets/stickers/collection2/work2.svg'
import c2Sticker3 from '../assets/stickers/collection2/work3.svg'
import c2Sticker4 from '../assets/stickers/collection2/work4.svg'
import c2Sticker5 from '../assets/stickers/collection2/work5.svg'
import c2Sticker6 from '../assets/stickers/collection2/work6.svg'
import c2Sticker7 from '../assets/stickers/collection2/work7.svg'

const POSTIT_PALETTE = [
  { color: '#FEEF9F', label: 'Yellow' },
  { color: '#FFD6E8', label: 'Pink' },
  { color: '#C5F0C8', label: 'Green' },
  { color: '#C4E4FF', label: 'Blue' },
  { color: '#E6DEFF', label: 'Lavender' },
  { color: '#FFE1C8', label: 'Peach' },
  { color: '#F5F5F5', label: 'Gray' },
  { color: '#1E293B', label: 'Dark', textColor: '#F8FAFC' }
]

const STICKER_COLLECTIONS = [
  {
    id: 1,
    label: 'Tapes',
    items: [sticker4, sticker5, sticker6, sticker7, sticker8, sticker9, sticker10]
  },
  {
    id: 2,
    label: 'Work? Nah',
    items: [c2Sticker1, c2Sticker2, c2Sticker3, c2Sticker4, c2Sticker5, c2Sticker6, c2Sticker7]
  }
]

const TEXT_FORE_PALETTE = [
  '#3A3030',
  '#1e293b',
  '#dc2626',
  '#ea580c',
  '#ca8a04',
  '#16a34a',
  '#2563eb',
  '#7c3aed',
  '#db2777',
  '#ffffff'
]

const TEXT_HIGHLIGHT_PALETTE = [
  '#FFF59D',
  '#FDE68A',
  '#FECACA',
  '#FED7AA',
  '#BBF7D0',
  '#BFDBFE',
  '#DDD6FE',
  '#FBCFE8',
  '#E5E5E5',
  '#FFFFFF'
]

const NOTE_STORAGE_KEY = (id) => `ejournal-note-${id ?? 'draft'}`

const PENCIL_PRESETS = [
  '#000000', '#ffffff', '#dc2626', '#ea580c',
  '#ca8a04', '#16a34a', '#2563eb', '#7c3aed',
  '#db2777', '#0891b2', '#65a30d', '#854d0e',
]

// ---- Page model ----
// เมื่อเปิดหนังสือ elements แต่ละตัวจะถูกวางใน .note-page-sheet ของหน้าตัวเอง
// x,y ใน state = พิกัดภายในหน้า (0…PAGE_WIDTH, 0…PAGE_HEIGHT)
// pageIndex บอกว่าอยู่หน้าไหน (0-based)
// ข้อมูลเก่าที่ไม่มี pageIndex จะถูกแปลงอัตโนมัติจาก x ที่ต่อเนื่อง
const PAGE_W = 560
const PAGE_H = 794  // A4 landscape (half-spread): 148.5 × 210mm @ ~96dpi

function _clamp(n, lo, hi) {
  return Number.isNaN(n) ? lo : Math.max(lo, Math.min(hi, n))
}

/** แปลง x,y ต่อเนื่อง → { pageIndex, x, y } ภายในหน้า */
function toPagedPos(absX, absY) {
  const pi = Math.max(0, Math.floor(absX / PAGE_W))
  return { pageIndex: pi, x: absX - pi * PAGE_W, y: absY }
}

/** ตรวจสอบและ normalize element ให้มี pageIndex, x, y ที่ถูกต้อง */
function normPaged(el) {
  if (!el || typeof el !== 'object') return el
  const rawX = typeof el.x === 'number' && !Number.isNaN(el.x) ? el.x : 0
  const rawY = typeof el.y === 'number' && !Number.isNaN(el.y) ? el.y : 0
  if (typeof el.pageIndex === 'number' && !Number.isNaN(el.pageIndex)) {
    return { ...el, pageIndex: Math.max(0, Math.floor(el.pageIndex)), x: rawX, y: rawY }
  }
  // ไม่มี pageIndex = ข้อมูลเก่า, x เดิมคือพิกัดต่อเนื่อง
  const pi = Math.max(0, Math.floor(rawX / PAGE_W))
  return { ...el, pageIndex: pi, x: rawX - pi * PAGE_W, y: rawY }
}

/** clamp ให้ element อยู่ในหน้า โดยพิจารณาขนาด */
function clampInPage(el, nx, ny, nw, nh) {
  const w = typeof nw === 'number' ? nw : (el?.width ?? 0)
  const h = typeof nh === 'number' ? nh : (el?.height ?? 0)
  return {
    x: _clamp(nx, 0, Math.max(0, PAGE_W - w)),
    y: _clamp(ny, 0, Math.max(0, PAGE_H - h))
  }
}

/**
 * เลื่อน element ข้ามสองหน้าในคู่เดียวกัน (book mode) หรือ clamp ในหน้าเดียว
 * startEl = snapshot ของ element ตอนเริ่ม drag  (ต้องมี pageIndex, x, y, width, height)
 * dx/dy   = pixel delta จาก mousedown ถึงปัจจุบัน
 * bookOpen  = isBookOpen ณ ตอน drag start
 * si        = spreadIndex ณ ตอน drag start
 */
function dragWithPageTransfer(startEl, dx, dy, bookOpen, si) {
  const w = startEl.width || 0
  const h = startEl.height || 0
  if (!bookOpen) {
    return {
      pageIndex: startEl.pageIndex,
      x: _clamp(startEl.x + dx, 0, Math.max(0, PAGE_W - w)),
      y: _clamp(startEl.y + dy, 0, Math.max(0, PAGE_H - h)),
    }
  }
  const pageOffset = startEl.pageIndex - si * 2   // 0 = left, 1 = right
  if (pageOffset < 0 || pageOffset > 1) {
    return {
      pageIndex: startEl.pageIndex,
      x: _clamp(startEl.x + dx, 0, Math.max(0, PAGE_W - w)),
      y: _clamp(startEl.y + dy, 0, Math.max(0, PAGE_H - h)),
    }
  }
  const spreadX = pageOffset * PAGE_W + startEl.x + dx
  const clampedSpreadX = _clamp(spreadX, 0, Math.max(0, PAGE_W * 2 - w))
  const clampedY = _clamp(startEl.y + dy, 0, Math.max(0, PAGE_H - h))
  const newOffset = clampedSpreadX >= PAGE_W ? 1 : 0
  return {
    pageIndex: si * 2 + newOffset,
    x: clampedSpreadX - newOffset * PAGE_W,
    y: clampedY,
  }
}

/** absX สำหรับ note-content ในโหมดปิดหนังสือ */
function absX(el) { return (el?.pageIndex ?? 0) * PAGE_W + (el?.x ?? 0) }
function absY(el) { return el?.y ?? 0 }

/** Single source of truth for textbox body size; never read font-size from HTML */
const DEFAULT_TEXTBOX_FONT_SIZE = 14
const TEXTBOX_FONT_SIZE_MIN = 6
const TEXTBOX_FONT_SIZE_MAX = 200
const TEXTBOX_FONT_SIZE_PRESETS = [8, 10, 12, 14, 18, 24, 36, 48, 56, 64, 72, 80, 96, 104, 112, 120, 128]

function clampTextBoxFontSize(n) {
  const x = Number(n)
  if (!Number.isFinite(x)) return DEFAULT_TEXTBOX_FONT_SIZE
  return Math.min(TEXTBOX_FONT_SIZE_MAX, Math.max(TEXTBOX_FONT_SIZE_MIN, Math.round(x)))
}

/** Remove font-size from inline styles / FONT size so contentEditable uses wrapper fontSize only */
function stripFontSizeFromHtml(html) {
  if (html == null || html === '') return html
  try {
    const d = document.createElement('div')
    d.innerHTML = html
    d.querySelectorAll('*').forEach((el) => {
      el.style.removeProperty('font-size')
      el.style.removeProperty('fontSize')
      if (el.tagName === 'FONT') el.removeAttribute('size')
      const st = el.getAttribute('style')
      if (st != null && st.trim() === '') el.removeAttribute('style')
    })
    return d.innerHTML
  } catch {
    return html
  }
}

function escapeHtml(text) {
  if (text == null) return ''
  const d = document.createElement('div')
  d.textContent = String(text)
  return d.innerHTML
}

/** Plain text or legacy notes → HTML for contentEditable */
function contentToEditableHtml(raw) {
  if (raw == null || raw === '') return '<p><br></p>'
  const s = String(raw)
  const t = s.trim()
  if (t && /<[a-z][\s\S]*>/i.test(t)) return stripFontSizeFromHtml(s)
  return stripFontSizeFromHtml(`<p>${escapeHtml(s).replace(/\n/g, '<br>')}</p>`)
}

/** Persist empty editors as '' so undo/load stays consistent */
function normalizeEditorStorage(html) {
  if (html == null || html === '' || html === '<br>') return ''
  const cleaned = stripFontSizeFromHtml(html)
  const t = document.createElement('div')
  t.innerHTML = cleaned
  const text = t.textContent?.replace(/\u200b/g, '').trim() ?? ''
  if (!text) return ''
  return cleaned
}

/** Viewport → coordinates inside `.note-content` (where absolute layers are positioned) */
function clientPointToNoteContentCoords(canvasEl, clientX, clientY) {
  if (!canvasEl) return { x: 0, y: 0 }
  const content = canvasEl.querySelector('.note-content')
  const r = (content ?? canvasEl).getBoundingClientRect()
  return { x: clientX - r.left, y: clientY - r.top }
}

function getNonCollapsedSelectionRectInEditor(root) {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null
  const range = sel.getRangeAt(0)
  if (!root.contains(range.commonAncestorContainer)) return null
  const r = range.getBoundingClientRect()
  if (r.width === 0 && r.height === 0) return null
  return r
}

const INITIAL_TOOLBAR_INLINE_FORMATS = {
  bold: false,
  italic: false,
  strikeThrough: false
}

function readInlineFormatState() {
  try {
    return {
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      strikeThrough:
        document.queryCommandState('strikeThrough') ||
        document.queryCommandState('strikethrough')
    }
  } catch {
    return { ...INITIAL_TOOLBAR_INLINE_FORMATS }
  }
}

/** Flip to true in dev to see which handler closes the floating text toolbar */
const DEBUG_NOTE_TEXT_TOOLBAR = false
function logNoteToolbarDebug(...args) {
  if (DEBUG_NOTE_TEXT_TOOLBAR) console.log('[NoteToolbar]', ...args)
}

/** Whitelist for “inside rich text UI” — use for document mousedown + selectionchange */
function isInsideRichTextToolbarWhitelist(node) {
  if (!node || typeof node.closest !== 'function') return false
  return !!(
    node.closest('[data-textbox-editor]') ||
    node.closest('.note-text-format-toolbar') ||
    node.closest('.note-font-size-canva')
  )
}

/** focus() alone often leaves no blinking caret until a later click; use the activating click coords when possible */
function placeCaretInContentEditable(el, clientX, clientY) {
  if (!el) return
  el.focus({ preventScroll: true })

  const collapseToEnd = () => {
    try {
      const sel = window.getSelection()
      const range = document.createRange()
      range.selectNodeContents(el)
      range.collapse(false)
      sel.removeAllRanges()
      sel.addRange(range)
    } catch {
      /* ignore */
    }
  }

  const hasPointer =
    typeof clientX === 'number' &&
    typeof clientY === 'number' &&
    !Number.isNaN(clientX) &&
    !Number.isNaN(clientY)

  let placed = false
  if (hasPointer && typeof document.caretRangeFromPoint === 'function') {
    try {
      const r = document.caretRangeFromPoint(clientX, clientY)
      if (r && el.contains(r.startContainer)) {
        const sel = window.getSelection()
        sel.removeAllRanges()
        sel.addRange(r)
        placed = true
      }
    } catch {
      /* ignore */
    }
  }
  if (!placed && hasPointer && typeof document.caretPositionFromPoint === 'function') {
    try {
      const pos = document.caretPositionFromPoint(clientX, clientY)
      if (pos?.offsetNode && el.contains(pos.offsetNode)) {
        const range = document.createRange()
        const { offsetNode, offset } = pos
        if (offsetNode.nodeType === Node.TEXT_NODE) {
          const len = offsetNode.textContent?.length ?? 0
          range.setStart(offsetNode, Math.min(Math.max(0, offset), len))
        } else {
          range.setStartBefore(el)
        }
        range.collapse(true)
        const sel = window.getSelection()
        sel.removeAllRanges()
        sel.addRange(range)
        placed = true
      }
    } catch {
      /* ignore */
    }
  }
  if (!placed) {
    collapseToEnd()
  }
}

/** Canva-style: one numeric field + chevron dropdown presets */
function NoteFontSizeCanvaControl({ committedSize, onApply }) {
  const [draft, setDraft] = useState(() =>
    String(Math.round(clampTextBoxFontSize(committedSize ?? DEFAULT_TEXTBOX_FONT_SIZE)))
  )
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)
  const inputRef = useRef(null)
  const inputFocusedRef = useRef(false)

  useEffect(() => {
    if (inputFocusedRef.current) return
    setDraft(
      String(Math.round(clampTextBoxFontSize(committedSize ?? DEFAULT_TEXTBOX_FONT_SIZE)))
    )
  }, [committedSize])

  useEffect(() => {
    if (!open) return
    const onDocDown = (e) => {
      if (rootRef.current?.contains(e.target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDocDown, true)
    return () => document.removeEventListener('mousedown', onDocDown, true)
  }, [open])

  const applyDraft = () => {
    const n = parseInt(String(draft).replace(/\D/g, ''), 10)
    if (!Number.isFinite(n)) {
      setDraft(
        String(Math.round(clampTextBoxFontSize(committedSize ?? DEFAULT_TEXTBOX_FONT_SIZE)))
      )
      return
    }
    const c = clampTextBoxFontSize(n)
    onApply(c)
    setDraft(String(c))
  }

  const currentApplied = Math.round(
    clampTextBoxFontSize(committedSize ?? DEFAULT_TEXTBOX_FONT_SIZE)
  )

  return (
    <div
      ref={rootRef}
      className="note-font-size-canva"
    >
      <div className="note-font-size-canva-row">
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          className="note-font-size-canva-input"
          aria-label="Font size in pixels"
          value={draft}
          onFocus={(e) => {
            inputFocusedRef.current = true
            e.target.select()
            setOpen(true)
          }}
          onClick={(e) => {
            e.stopPropagation()
            inputRef.current?.focus()
            e.currentTarget.select()
            setOpen(true)
          }}
          onChange={(e) => {
            let v = e.target.value.replace(/\D/g, '')
            if (v === '') {
              setDraft('')
              return
            }
            const n = parseInt(v, 10)
            if (!Number.isFinite(n)) {
              setDraft('')
              return
            }
            if (n > TEXTBOX_FONT_SIZE_MAX) setDraft(String(TEXTBOX_FONT_SIZE_MAX))
            else setDraft(v)
          }}
          onBlur={() => {
            inputFocusedRef.current = false
            applyDraft()
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              const n = parseInt(String(draft).replace(/\D/g, ''), 10)
              if (Number.isFinite(n)) {
                const c = clampTextBoxFontSize(n)
                onApply(c)
                setDraft(String(c))
              } else {
                setDraft(String(currentApplied))
              }
              requestAnimationFrame(() => {
                inputRef.current?.focus()
                inputRef.current?.select()
              })
            }
          }}
        />
        <button
          type="button"
          className="note-font-size-canva-chevron"
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-label="Font size presets"
          onMouseDown={(e) => {
            e.preventDefault()
            e.stopPropagation()
          }}
          onClick={() => {
            setOpen((o) => !o)
            requestAnimationFrame(() => {
              inputRef.current?.focus()
              inputRef.current?.select()
            })
          }}
        >
          <ChevronDown size={14} strokeWidth={2} />
        </button>
      </div>
      {open && (
        <ul className="note-font-size-canva-dropdown" role="listbox">
          {TEXTBOX_FONT_SIZE_PRESETS.map((pz) => (
            <li key={pz} role="none">
              <button
                type="button"
                role="option"
                aria-selected={currentApplied === pz}
                className={`note-font-size-canva-option${currentApplied === pz ? ' is-current' : ''}`}
                onMouseDown={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                }}
                onClick={() => {
                  onApply(pz)
                  setDraft(String(pz))
                  setOpen(false)
                  requestAnimationFrame(() => inputRef.current?.focus())
                }}
              >
                {pz}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function NoteTextEditor({
  textBox,
  isPostit,
  postitBg,
  postitFg,
  textChangeTimeoutRef,
  saveToHistory,
  setTextBoxes,
  setTextToolbar,
  setToolbarInlineFormats,
  handleSelectItem,
  isSelected,
  isEditing,
  textBoxSelectionSyncRef,
  beginTextBoxEditing,
  endTextBoxEditing,
  isContextMenuOpen,
  isRightClickRef,
  stopAllDragging,
  setIsDragging,
  skipPersistDuringCanvasDragRef,
  flushPersistFromSnapshot,
  handleContextMenu,
  isBookOpen,
  spreadIndex,
}) {
  const elRef = useRef(null)
  const lastCommittedHtml = useRef(null)
  /** True only after beginTextBoxEditing() from 2nd click — avoid wiping drag-selection on every click */
  const pendingPointerCaretRef = useRef(false)

  useLayoutEffect(() => {
    lastCommittedHtml.current = null
  }, [textBox.id])

  useLayoutEffect(() => {
    const el = elRef.current
    if (!el) return
    if (lastCommittedHtml.current === null) {
      el.innerHTML = contentToEditableHtml(textBox.content)
      lastCommittedHtml.current = textBox.content
      el.classList.toggle('note-textbox-editor--empty', !el.textContent?.replace(/\u200b/g, '').trim())
      return
    }
    if (textBox.content !== lastCommittedHtml.current) {
      el.innerHTML = contentToEditableHtml(textBox.content)
      lastCommittedHtml.current = textBox.content
      el.classList.toggle('note-textbox-editor--empty', !el.textContent?.replace(/\u200b/g, '').trim())
    }
  }, [textBox.content, textBox.id])

  useLayoutEffect(() => {
    if (!isEditing) return
    const el = elRef.current
    if (!el) return
    let innerRaf = 0
    const outerRaf = requestAnimationFrame(() => {
      innerRaf = requestAnimationFrame(() => {
        const node = elRef.current
        if (!node?.isContentEditable) return
        if (document.activeElement !== node) {
          node.focus({ preventScroll: true })
        }
        const sel = window.getSelection()
        const anchorOk = sel.anchorNode && node.contains(sel.anchorNode)
        if (!anchorOk) {
          placeCaretInContentEditable(node)
        }
      })
    })
    return () => {
      cancelAnimationFrame(outerRaf)
      cancelAnimationFrame(innerRaf)
    }
  }, [isEditing, textBox.id])

  useLayoutEffect(() => {
    if (!isEditing) pendingPointerCaretRef.current = false
  }, [isEditing])

  const pushHtml = (html) => {
    const stored = normalizeEditorStorage(html)
    lastCommittedHtml.current = stored
    setTextBoxes((prev) =>
      prev.map((tb) => (tb.id === textBox.id ? { ...tb, content: stored } : tb))
    )
    if (textChangeTimeoutRef.current) clearTimeout(textChangeTimeoutRef.current)
    textChangeTimeoutRef.current = setTimeout(() => {
      saveToHistory()
    }, 500)
  }

  return (
    <div
      ref={elRef}
      role="textbox"
      tabIndex={isEditing ? 0 : -1}
      contentEditable={isEditing}
      suppressContentEditableWarning
      data-textbox-editor
      data-textbox-id={textBox.id}
      className={`note-textbox note-textbox-editor${isPostit ? ' note-textbox--postit' : ''}${isEditing ? '' : ' note-textbox-editor--move-mode'}`}
      data-placeholder={isPostit ? 'Note' : 'Type here...'}
      style={{
        width: '100%',
        height: '100%',
        fontSize: `${clampTextBoxFontSize(textBox.fontSize ?? DEFAULT_TEXTBOX_FONT_SIZE)}px`,
        ...(isPostit
          ? {
              backgroundColor: postitBg,
              color: postitFg,
              ['--postit-bg']: postitBg
            }
          : {})
      }}
      onInput={(e) => {
        const html = e.currentTarget.innerHTML
        pushHtml(html)
        e.currentTarget.classList.toggle(
          'note-textbox-editor--empty',
          !e.currentTarget.textContent?.replace(/\u200b/g, '').trim()
        )
        const rect = getNonCollapsedSelectionRectInEditor(e.currentTarget)
        if (rect) {
          setTextToolbar({
            top: rect.bottom + 8,
            left: rect.left + rect.width / 2,
            textBoxId: textBox.id
          })
          setToolbarInlineFormats(readInlineFormatState())
        } else {
          setTextToolbar(null)
          setToolbarInlineFormats(INITIAL_TOOLBAR_INLINE_FORMATS)
        }
      }}
      onFocus={() => {
        if (isEditing) {
          handleSelectItem({ type: 'textbox', id: textBox.id })
        }
      }}
      onBlur={(e) => {
        if (textChangeTimeoutRef.current) {
          clearTimeout(textChangeTimeoutRef.current)
          textChangeTimeoutRef.current = null
        }
        const rt = e?.relatedTarget ?? null

        if (isEditing && !isInsideRichTextToolbarWhitelist(rt)) {
          endTextBoxEditing()
        }

        if (!rt) return

        const isInAllowedUI =
          !!rt?.closest?.('.note-text-format-toolbar') ||
          !!rt?.closest?.('.note-font-size-canva')

        if (
          !rt?.hasAttribute?.('data-textbox-editor') &&
          !isInAllowedUI
        ) {
          setTextToolbar(null)
          setToolbarInlineFormats(INITIAL_TOOLBAR_INLINE_FORMATS)
        }
      }}
      onMouseUp={(e) => {
        const el = e.currentTarget
        const rect = getNonCollapsedSelectionRectInEditor(el)
        if (rect) {
          setTextToolbar({
            top: rect.bottom + 8,
            left: rect.left + rect.width / 2,
            textBoxId: textBox.id
          })
          setToolbarInlineFormats(readInlineFormatState())
        }
      }}
      onKeyUp={(e) => {
        const el = e.currentTarget
        const rect = getNonCollapsedSelectionRectInEditor(el)
        if (rect) {
          setTextToolbar({
            top: rect.bottom + 8,
            left: rect.left + rect.width / 2,
            textBoxId: textBox.id
          })
          setToolbarInlineFormats(readInlineFormatState())
        } else if (window.getSelection()?.isCollapsed) {
          setTextToolbar(null)
          setToolbarInlineFormats(INITIAL_TOOLBAR_INLINE_FORMATS)
        }
      }}
      onClick={(e) => {
        e.stopPropagation()
        handleSelectItem({ type: 'textbox', id: textBox.id })
        if (!isEditing || !pendingPointerCaretRef.current) return
        pendingPointerCaretRef.current = false
        const x = e.clientX
        const y = e.clientY
        requestAnimationFrame(() => {
          const el = elRef.current
          if (!el?.isContentEditable) return
          placeCaretInContentEditable(el, x, y)
        })
      }}
      onMouseDown={(e) => {
        if (e.button === 2) {
          isRightClickRef.current = true
          stopAllDragging()
          return
        }
        e.stopPropagation()
        if (isEditing) {
          stopAllDragging()
          isRightClickRef.current = false
          return
        }
        // Sync ref updates in handleSelectItem before re-render; isSelected alone can lag one click behind.
        const wasAlreadySelected = textBoxSelectionSyncRef.current === textBox.id
        handleSelectItem({ type: 'textbox', id: textBox.id })
        stopAllDragging()
        isRightClickRef.current = false
        const startX = e.clientX
        const startY = e.clientY
        const startEl = { ...textBox }; const capBookOpen = isBookOpen; const capSpreadIdx = spreadIndex;
        let hasMoved = false
        let dragging = false

        const handleMouseMove = (moveEvent) => {
          if (isRightClickRef.current || isContextMenuOpen) { stopAllDragging(); return; }
          const absDx = Math.abs(moveEvent.clientX - startX)
          const absDy = Math.abs(moveEvent.clientY - startY)
          if ((absDx > 5 || absDy > 5) && !dragging) {
            dragging = true; hasMoved = true; setIsDragging(true); skipPersistDuringCanvasDragRef.current = true; moveEvent.preventDefault();
          }
          if (dragging) {
            moveEvent.preventDefault()
            const finalDeltaX = moveEvent.clientX - startX
            const finalDeltaY = moveEvent.clientY - startY
            setTextBoxes((prevTextBoxes) =>
              prevTextBoxes.map((tb) => {
                if (tb.id !== textBox.id) return tb
                const pos = dragWithPageTransfer(startEl, finalDeltaX, finalDeltaY, capBookOpen, capSpreadIdx)
                return { ...tb, pageIndex: pos.pageIndex, x: pos.x, y: pos.y }
              })
            )
          }
        }

        const handleMouseUp = () => {
          setIsDragging(false)
          document.removeEventListener('mousemove', handleMouseMove)
          document.removeEventListener('mouseup', handleMouseUp)
          if (hasMoved && !isRightClickRef.current) {
            skipPersistDuringCanvasDragRef.current = false
            requestAnimationFrame(() => flushPersistFromSnapshot())
            setTimeout(() => saveToHistory(), 50)
          } else if (!hasMoved && wasAlreadySelected && !isRightClickRef.current) {
            pendingPointerCaretRef.current = true
            beginTextBoxEditing()
          }
          isRightClickRef.current = false
        }

        const contextMenuHandler = () => {
          isRightClickRef.current = true
          stopAllDragging()
        }

        document.addEventListener('mousemove', handleMouseMove)
        document.addEventListener('mouseup', handleMouseUp)
        document.addEventListener('contextmenu', contextMenuHandler, { once: true })
      }}
      onContextMenu={(e) => {
        e.stopPropagation()
        isRightClickRef.current = true
        stopAllDragging()
        handleContextMenu(e, { type: 'textbox', id: textBox.id })
      }}
      onDoubleClick={(e) => {
        e.stopPropagation()
        if (!isEditing) {
          handleSelectItem({ type: 'textbox', id: textBox.id }, { startEditing: true })
        }
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && isEditing) {
          e.stopPropagation()
          setTextToolbar(null)
          setToolbarInlineFormats(INITIAL_TOOLBAR_INLINE_FORMATS)
          endTextBoxEditing()
          elRef.current?.blur()
        }
      }}
    />
  )
}

function getNoteFromLocalStorage(storageKey) {
  try {
    const raw = localStorage.getItem(NOTE_STORAGE_KEY(storageKey))
    if (!raw) return null
    const data = JSON.parse(raw)
    return {
      title: data.title ?? '',
      tagName: data.tagName ?? '',
      tagColor: data.tagColor ?? '#FF6B6B',
      textBoxes: withDefaultRotation(data.textBoxes),
      shapes: withDefaultRotation(data.shapes),
      images: withDefaultRotation(data.images),
      stickers: withDefaultRotation(data.stickers),
      maxZIndex: typeof data.maxZIndex === 'number' ? data.maxZIndex : 1,
      coverTitle: data.coverTitle ?? '',
      coverColor: data.coverColor ?? '',
      coverImage: data.coverImage ?? '',
      coverTitlePos: data.coverTitlePos ?? null
    }
  } catch (e) {}
  return null
}

function saveNoteToLocalStorage(storageKey, payload) {
  try {
    localStorage.setItem(NOTE_STORAGE_KEY(storageKey), JSON.stringify(payload))
  } catch (e) {}
}

function withDefaultRotation(items) {
  if (!Array.isArray(items)) return []
  return items.map((it) => ({
    ...it,
    rotation: typeof it.rotation === 'number' && !Number.isNaN(it.rotation) ? it.rotation : 0
  }))
}

function normalizeDisplay360(deg) {
  let d = Math.round(deg) % 360
  if (d < 0) d += 360
  return d
}

function Note() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const noteId = searchParams.get('noteId')
  
  // Get the latest note from localStorage (for backward compatibility)
  const getLatestNote = () => {
    try {
      const stored = localStorage.getItem('ejournal-notes')
      if (stored) {
        const notes = JSON.parse(stored)
        const allNotes = Object.values(notes).flat()
        if (allNotes.length > 0) {
          const sortedNotes = allNotes.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
          return sortedNotes[0]
        }
      }
    } catch (e) {}
    return null
  }

  // Get tags from localStorage
  const getTags = () => {
    try {
      const stored = localStorage.getItem('ejournal-tags')
      if (stored) return JSON.parse(stored)
    } catch (e) {}
    return []
  }

  const latestNote = getLatestNote()
  const tags = getTags()
  const noteTag = latestNote && latestNote.tag ? tags.find(t => t.id === latestNote.tag.id) || latestNote.tag : null
  const storageKey = noteId ?? 'draft'
  const dateKey = latestNote?.date ?? null

  const [title, setTitle] = useState(latestNote?.name || '23 January 2026')
  const [isBookOpen, setIsBookOpen] = useState(false)
  const [coverTitle, setCoverTitle] = useState(latestNote?.name || 'My Journal')
  const [coverColor, setCoverColor] = useState('#7b5636')
  const [coverImage, setCoverImage] = useState('')
  const [coverTitlePos, setCoverTitlePos] = useState({ x: 50, y: 43 })
  const [spreadIndex, setSpreadIndex] = useState(0)
  // 0 = หน้าซ้าย (left page), 1 = หน้าขวา (right page) ของ spread ปัจจุบัน
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [tagName, setTagName] = useState(noteTag?.name || '🪰 Aura Loss')
  const [tagColor, setTagColor] = useState(noteTag?.color || '#FF6B6B')
  const [showTagSelector, setShowTagSelector] = useState(false)
  const [isCreatingNewTag, setIsCreatingNewTag] = useState(false)
  const [newTagName, setNewTagName] = useState('')
  const [newTagColor, setNewTagColor] = useState('#FF6B6B')
  const [textBoxes, setTextBoxes] = useState([])
  const [shapes, setShapes] = useState([])
  const [images, setImages] = useState([])
  const [stickers, setStickers] = useState([])
  const [maxZIndex, setMaxZIndex] = useState(1)
  const [showShapesMenu, setShowShapesMenu] = useState(false)
  const [showStickersMenu, setShowStickersMenu] = useState(false)
  const [showPostItMenu, setShowPostItMenu] = useState(false)
  const [pendingPostItColor, setPendingPostItColor] = useState(null)
  const [activeStickerCollectionIndex, setActiveStickerCollectionIndex] = useState(0)
  const [showShareMenu, setShowShareMenu] = useState(false)
  const [isAddingTextBox, setIsAddingTextBox] = useState(false)
  const [loading, setLoading] = useState(false)
  const [selectedItem, setSelectedItem] = useState(null)
  const [editingTextBoxId, setEditingTextBoxId] = useState(null)
  /** Mirrors selected textbox id synchronously in handleSelectItem (state lags one paint). */
  const textBoxSelectionSyncRef = useRef(null)
  const saveEnabledRef = useRef(false)
  const firestoreSaveTimeoutRef = useRef(null)
  const [showColorPicker, setShowColorPicker] = useState(false)
  
  // Undo/Redo history
  const [history, setHistory] = useState([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const isRestoringRef = useRef(false)
  const textChangeTimeoutRef = useRef(null)
  const [textToolbar, setTextToolbar] = useState(null)
  const [formatPaletteOpen, setFormatPaletteOpen] = useState(null)
  const [toolbarInlineFormats, setToolbarInlineFormats] = useState(INITIAL_TOOLBAR_INLINE_FORMATS)
  /** Blocks toolbar close while user is in pointer interaction with toolbar / font-size UI */
  const isInteractingWithToolbarRef = useRef(false)

  useEffect(() => {
    let clearRaf = 0
    const onPointerDownCapture = (e) => {
      if (isInsideRichTextToolbarWhitelist(e.target)) {
        isInteractingWithToolbarRef.current = true
        logNoteToolbarDebug('pointerdown capture: whitelist', e.target)
      }
    }
    const onPointerUpCapture = () => {
      cancelAnimationFrame(clearRaf)
      clearRaf = requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          isInteractingWithToolbarRef.current = false
          logNoteToolbarDebug('interaction flag cleared (after rAF)')
        })
      })
    }
    document.addEventListener('pointerdown', onPointerDownCapture, true)
    document.addEventListener('pointerup', onPointerUpCapture, true)
    return () => {
      cancelAnimationFrame(clearRaf)
      document.removeEventListener('pointerdown', onPointerDownCapture, true)
      document.removeEventListener('pointerup', onPointerUpCapture, true)
    }
  }, [])

  const endTextBoxEditing = useCallback(() => {
    setEditingTextBoxId(null)
  }, [])

  // Close menus when selecting different item type
  const handleSelectItem = (item, options = {}) => {
    textBoxSelectionSyncRef.current = item?.type === 'textbox' ? item.id : null
    setSelectedItem(item)
    if (options.startEditing && item?.type === 'textbox') {
      setEditingTextBoxId(item.id)
    } else {
      setEditingTextBoxId((prev) => {
        if (item?.type === 'textbox' && item.id === prev) return prev
        return null
      })
    }
    // Close all menus when selecting an item
    if (item) {
      // Only show color picker if selecting a shape
      if (item.type !== 'shape') {
        setShowColorPicker(false);
      } else {
        // If selecting a shape, close other menus but keep color picker if it was open
        // (don't auto-open it, just keep its state)
      }
      // Always close dropdown menus when selecting an item
      setShowShareMenu(false);
      setShowShapesMenu(false);
      setShowStickersMenu(false);
      setShowPostItMenu(false);
    } else {
      // If deselecting, close all menus
      setShowColorPicker(false);
      setShowShareMenu(false);
      setShowShapesMenu(false);
      setShowStickersMenu(false);
      setShowPostItMenu(false);
      setShowPencilMenu(false);
    }
  }
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [rotationHud, setRotationHud] = useState(null)
  const [contextMenu, setContextMenu] = useState(null)
  const [clipboard, setClipboard] = useState(null)
  const [isContextMenuOpen, setIsContextMenuOpen] = useState(false)

  // ---- Pencil drawing ----
  const [isPencilMode, setIsPencilMode] = useState(false)
  const [pencilColor, setPencilColor] = useState('#222222')
  const [pencilThickness, setPencilThickness] = useState(3)
  const [showPencilMenu, setShowPencilMenu] = useState(false)
  // drawingStrokes stores finished strokes as {dataUrl, pageIndex, id}
  const [drawingStrokes, setDrawingStrokes] = useState([])
  // per-page canvas refs for live drawing (not in React state)
  const drawCanvasRefs = useRef({}) // pageIndex -> canvas element
  const drawingActiveRef = useRef(false)
  const pencilColorRef = useRef('#222222')
  const pencilThicknessRef = useRef(3)
  const pencilMenuRef = useRef(null)

  // keep refs in sync with state so canvas handlers always see latest values
  useEffect(() => { pencilColorRef.current = pencilColor }, [pencilColor])
  useEffect(() => { pencilThicknessRef.current = pencilThickness }, [pencilThickness])

  // ---- Page background image ----
  const [pageBgImage, setPageBgImage] = useState('') // base64 or URL
  const pageBgInputRef = useRef(null)
  const canvasRef = useRef(null)
  const fileInputRef = useRef(null)
  const coverImageInputRef = useRef(null)
  const activeDragHandlersRef = useRef({ mouseMove: null, mouseUp: null, contextMenu: null })
  const isRightClickRef = useRef(false)
  const stickerHostElementsRef = useRef(new Map())
  const stickerDragCleanupRef = useRef(null)
  const activeRotationDragRef = useRef(null)
  const skipPersistDuringCanvasDragRef = useRef(false)
  /** { id, startW, startH, startFs } — scale fontSize during corner resize */
  const textBoxResizeSessionRef = useRef(null)
  const persistSnapshotRef = useRef(null)
  const FIRESTORE_DEBOUNCE_MS = 2000

  useEffect(() => {
    if (!coverTitle || coverTitle === 'My Journal') {
      setCoverTitle(title || 'My Journal')
    }
  }, [title, coverTitle])

  const handleCoverImageUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      setCoverImage(String(ev.target?.result || ''))
    }
    reader.readAsDataURL(file)
  }

  const handleCoverTitleMouseDown = (e) => {
    e.preventDefault()
    e.stopPropagation()
    const card = e.currentTarget.closest('.note-book-cover-card')
    if (!card) return
    const rect = card.getBoundingClientRect()
    const startX = e.clientX
    const startY = e.clientY
    const start = { ...coverTitlePos }

    const onMove = (ev) => {
      const dx = ((ev.clientX - startX) / rect.width) * 100
      const dy = ((ev.clientY - startY) / rect.height) * 100
      const x = Math.max(10, Math.min(90, start.x + dx))
      const y = Math.max(12, Math.min(88, start.y + dy))
      setCoverTitlePos({ x, y })
    }
    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  const goToNextSpread = useCallback(() => {
    if (pageTurnInProgress.current) return
    pageTurnInProgress.current = true
    setTurningPage(true)
    setTimeout(() => setSpreadIndex((prev) => prev + 1), 150)
    setTimeout(() => { setTurningPage(false); pageTurnInProgress.current = false }, 300)
  }, [])

  const goToPrevSpread = useCallback(() => {
    if (pageTurnInProgress.current) return
    pageTurnInProgress.current = true
    setTurningPage(true)
    setTimeout(() => setSpreadIndex((prev) => Math.max(0, prev - 1)), 150)
    setTimeout(() => { setTurningPage(false); pageTurnInProgress.current = false }, 300)
  }, [])

  const [showExportModal, setShowExportModal] = useState(false)
  const [exportSpreads, setExportSpreads] = useState(null) // null = all; Set<number> = selected spread indices

  persistSnapshotRef.current = {
    storageKey,
    dateKey,
    title,
    tagName,
    tagColor,
    textBoxes,
    shapes,
    images,
    stickers,
    maxZIndex,
    coverTitle,
    coverColor,
    coverImage,
    coverTitlePos
  }

  const flushPersistFromSnapshot = useCallback(() => {
    if (!saveEnabledRef.current) return
    const s = persistSnapshotRef.current
    if (!s) return
    const payload = {
      dateKey: s.dateKey ?? undefined,
      title: s.title,
      tagName: s.tagName,
      tagColor: s.tagColor,
      textBoxes: s.textBoxes,
      shapes: s.shapes,
      images: s.images,
      stickers: s.stickers,
      maxZIndex: s.maxZIndex,
      coverTitle: s.coverTitle,
      coverColor: s.coverColor,
      coverImage: s.coverImage,
      coverTitlePos: s.coverTitlePos
    }
    saveNoteToLocalStorage(s.storageKey, payload)
    if (auth?.currentUser && noteId && s.dateKey) {
      if (firestoreSaveTimeoutRef.current) clearTimeout(firestoreSaveTimeoutRef.current)
      firestoreSaveTimeoutRef.current = setTimeout(() => {
        firestoreSaveTimeoutRef.current = null
        saveNoteToFirestore(noteId, payload).catch(() => {})
      }, FIRESTORE_DEBOUNCE_MS)
    }
  }, [noteId])

  // โหลดจาก localStorage/Firestore ตอนเข้า
  useEffect(() => {
    setLoading(true)
    saveEnabledRef.current = false
    let cancelled = false
    let enableSaveTimer = null
    const key = noteId ?? 'draft'

    const applyLoaded = (data) => {
      if (!data) return
      if (data.title !== undefined) setTitle(data.title)
      if (data.tagName !== undefined) setTagName(data.tagName)
      if (data.tagColor !== undefined) setTagColor(data.tagColor)
      if (Array.isArray(data.textBoxes)) setTextBoxes(withDefaultRotation(data.textBoxes).map(normPaged))
      if (Array.isArray(data.shapes)) setShapes(withDefaultRotation(data.shapes).map(normPaged))
      if (Array.isArray(data.images)) setImages(withDefaultRotation(data.images).map(normPaged))
      if (Array.isArray(data.stickers)) setStickers(withDefaultRotation(data.stickers).map(normPaged))
      if (typeof data.maxZIndex === 'number') setMaxZIndex(data.maxZIndex)
      if (data.coverTitle !== undefined) setCoverTitle(data.coverTitle || 'My Journal')
      if (data.coverColor) setCoverColor(data.coverColor)
      if (data.coverImage !== undefined) setCoverImage(data.coverImage || '')
      if (data.coverTitlePos && typeof data.coverTitlePos.x === 'number' && typeof data.coverTitlePos.y === 'number') {
        setCoverTitlePos(data.coverTitlePos)
      }
    }

    const enableSave = () => {
      enableSaveTimer = setTimeout(() => { saveEnabledRef.current = true }, 150)
    }

    const fromLocal = getNoteFromLocalStorage(key)
    if (fromLocal) applyLoaded(fromLocal)

    if (auth?.currentUser && noteId) {
      getNoteFromFirestore(noteId)
        .then((data) => {
          if (cancelled) return
          if (data) applyLoaded(data)
        })
        .catch(() => {})
        .finally(() => {
          if (!cancelled) setLoading(false)
          enableSave()
        })
    } else {
      setLoading(false)
      enableSave()
    }
    return () => {
      cancelled = true
      if (enableSaveTimer) clearTimeout(enableSaveTimer)
    }
  }, [noteId])

  // บันทึก localStorage ทันที; Firestore ใช้ debounce 2 วินาที เพื่อลด Write quota
  useEffect(() => {
    if (!saveEnabledRef.current) return
    if (skipPersistDuringCanvasDragRef.current) return
    const payload = {
      dateKey: dateKey ?? undefined,
      title,
      tagName,
      tagColor,
      textBoxes,
      shapes,
      images,
      stickers,
      maxZIndex,
      coverTitle,
      coverColor,
      coverImage,
      coverTitlePos
    }
    saveNoteToLocalStorage(storageKey, payload)

    if (auth?.currentUser && noteId && dateKey) {
      if (firestoreSaveTimeoutRef.current) clearTimeout(firestoreSaveTimeoutRef.current)
      firestoreSaveTimeoutRef.current = setTimeout(() => {
        firestoreSaveTimeoutRef.current = null
        saveNoteToFirestore(noteId, payload).catch(() => {})
      }, FIRESTORE_DEBOUNCE_MS)
    }
    return () => {
      if (firestoreSaveTimeoutRef.current) {
        clearTimeout(firestoreSaveTimeoutRef.current)
        firestoreSaveTimeoutRef.current = null
        if (auth?.currentUser && noteId && dateKey) {
          saveNoteToFirestore(noteId, payload).catch(() => {})
        }
      }
    }
  }, [storageKey, dateKey, title, tagName, tagColor, textBoxes, shapes, images, stickers, maxZIndex, coverTitle, coverColor, coverImage, coverTitlePos])

  // Listen for storage changes to sync in real-time
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'ejournal-notes') {
        const latestNote = getLatestNote()
        if (latestNote) {
          setTitle(latestNote.name)
        }
      }
      if (e.key === 'ejournal-tags') {
        const tags = getTags()
        const latestNote = getLatestNote()
        const noteTag = latestNote && latestNote.tag ? tags.find(t => t.id === latestNote.tag.id) || latestNote.tag : null
        if (noteTag) {
          setTagName(noteTag.name)
          setTagColor(noteTag.color)
        }
      }
    }

    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [])

  // Update note name in calendar localStorage when title changes (sync with calendar)
  // ใช้เฉพาะ [title, noteId] เพื่อไม่ให้ effect รันทุก re-render จาก latestNote
  useEffect(() => {
    if (!noteId) return
    try {
      const stored = localStorage.getItem('ejournal-notes')
      if (!stored) return
      const notes = JSON.parse(stored)
      const allNotes = Object.values(notes).flat()
      if (allNotes.length === 0) return
      const sorted = allNotes.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      const latest = sorted[0]
      if (!latest || String(latest.id) !== String(noteId)) return
      const dateKey = latest.date
      if (notes[dateKey]) {
        const updatedNotes = notes[dateKey].map(n =>
          n.id === latest.id ? { ...n, name: title } : n
        )
        notes[dateKey] = updatedNotes
        localStorage.setItem('ejournal-notes', JSON.stringify(notes))
      }
    } catch (e) {}
  }, [title, noteId])

  // Undo/Redo functions
  const saveToHistory = () => {
    if (isRestoringRef.current) return
    const snapshot = {
      textBoxes: [...textBoxes],
      shapes: [...shapes],
      images: [...images],
      stickers: [...stickers],
      title,
      tagName,
      tagColor,
      maxZIndex
    }
    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1)
      newHistory.push(snapshot)
      return newHistory.slice(-50) // เก็บแค่ 50 รายการล่าสุด
    })
    setHistoryIndex(prev => Math.min(prev + 1, 49))
  }

  const applyRichTextCommand = useCallback(
    (textBoxId, command, value = null) => {
      const el = document.querySelector(`[data-textbox-editor][data-textbox-id="${textBoxId}"]`)
      if (!el) return
      el.focus()
      try {
        document.execCommand('styleWithCSS', false, 'true')
      } catch (_) {}
      try {
        document.execCommand(command, false, value)
      } catch (_) {}
      const stored = normalizeEditorStorage(el.innerHTML)
      setTextBoxes((prev) =>
        prev.map((tb) => (tb.id === textBoxId ? { ...tb, content: stored } : tb))
      )
      if (textChangeTimeoutRef.current) clearTimeout(textChangeTimeoutRef.current)
      textChangeTimeoutRef.current = setTimeout(() => saveToHistory(), 400)
      requestAnimationFrame(() => {
        const rect = getNonCollapsedSelectionRectInEditor(el)
        if (rect) {
          setTextToolbar({
            top: rect.bottom + 8,
            left: rect.left + rect.width / 2,
            textBoxId
          })
        }
        setToolbarInlineFormats(readInlineFormatState())
      })
    },
    [saveToHistory]
  )

  const applyTextHighlight = useCallback(
    (textBoxId, color) => {
      const el = document.querySelector(`[data-textbox-editor][data-textbox-id="${textBoxId}"]`)
      if (!el) return
      el.focus()
      try {
        document.execCommand('styleWithCSS', false, 'true')
      } catch (_) {}
      let ok = false
      try {
        ok = document.execCommand('hiliteColor', false, color)
      } catch (_) {}
      if (!ok) {
        try {
          document.execCommand('backColor', false, color)
        } catch (_) {}
      }
      const stored = normalizeEditorStorage(el.innerHTML)
      setTextBoxes((prev) =>
        prev.map((tb) => (tb.id === textBoxId ? { ...tb, content: stored } : tb))
      )
      if (textChangeTimeoutRef.current) clearTimeout(textChangeTimeoutRef.current)
      textChangeTimeoutRef.current = setTimeout(() => saveToHistory(), 400)
      requestAnimationFrame(() => {
        const rect = getNonCollapsedSelectionRectInEditor(el)
        if (rect) {
          setTextToolbar({
            top: rect.bottom + 8,
            left: rect.left + rect.width / 2,
            textBoxId
          })
        }
        setToolbarInlineFormats(readInlineFormatState())
      })
    },
    [saveToHistory]
  )

  const updateTextBoxFontSize = useCallback(
    (textBoxId, value) => {
      const n =
        typeof value === 'number'
          ? value
          : parseInt(String(value).replace(/\D/g, ''), 10)
      if (!Number.isFinite(n)) return
      const fs = clampTextBoxFontSize(n)
      setTextBoxes((prev) =>
        prev.map((tb) => (tb.id === textBoxId ? { ...tb, fontSize: fs } : tb))
      )
      setTimeout(() => saveToHistory(), 50)
    },
    [saveToHistory]
  )

  const handleUndo = () => {
    if (historyIndex > 0) {
      isRestoringRef.current = true
      const prevSnapshot = history[historyIndex - 1]
      setTextBoxes(prevSnapshot.textBoxes)
      setShapes(prevSnapshot.shapes)
      setImages(prevSnapshot.images)
      setStickers(prevSnapshot.stickers)
      setTitle(prevSnapshot.title)
      setTagName(prevSnapshot.tagName)
      setTagColor(prevSnapshot.tagColor)
      setMaxZIndex(prevSnapshot.maxZIndex)
      setHistoryIndex(prev => prev - 1)
      setTimeout(() => { isRestoringRef.current = false }, 100)
    }
  }

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      isRestoringRef.current = true
      const nextSnapshot = history[historyIndex + 1]
      setTextBoxes(nextSnapshot.textBoxes)
      setShapes(nextSnapshot.shapes)
      setImages(nextSnapshot.images)
      setStickers(nextSnapshot.stickers)
      setTitle(nextSnapshot.title)
      setTagName(nextSnapshot.tagName)
      setTagColor(nextSnapshot.tagColor)
      setMaxZIndex(nextSnapshot.maxZIndex)
      setHistoryIndex(prev => prev + 1)
      setTimeout(() => { isRestoringRef.current = false }, 100)
    }
  }

  // บันทึก history ตอนโหลดเสร็จ (initial state)
  useEffect(() => {
    if (!loading && saveEnabledRef.current && history.length === 0) {
      const snapshot = {
        textBoxes: [...textBoxes],
        shapes: [...shapes],
        images: [...images],
        stickers: [...stickers],
        title,
        tagName,
        tagColor,
        maxZIndex
      }
      setHistory([snapshot])
      setHistoryIndex(0)
    }
  }, [loading, textBoxes, shapes, images, stickers, title, tagName, tagColor, maxZIndex, history.length])

  // Update tag in localStorage when tag changes
  const updateTagInStorage = (newName, newColor) => {
    if (latestNote && noteTag) {
      try {
        const tags = getTags()
        const updatedTags = tags.map(t => 
          t.id === noteTag.id ? { ...t, name: newName, color: newColor } : t
        )
        localStorage.setItem('ejournal-tags', JSON.stringify(updatedTags))
        
        // Also update the note's tag reference
        const stored = localStorage.getItem('ejournal-notes')
        if (stored) {
          const notes = JSON.parse(stored)
          const dateKey = latestNote.date
          if (notes[dateKey]) {
            const updatedNotes = notes[dateKey].map(n => {
              if (n.id === latestNote.id && n.tag) {
                return { ...n, tag: { ...n.tag, name: newName, color: newColor } }
              }
              return n
            })
            notes[dateKey] = updatedNotes
            localStorage.setItem('ejournal-notes', JSON.stringify(notes))
          }
        }
      } catch (e) {}
    }
  }

  // Create new tag
  const createNewTag = () => {
    if (newTagName.trim()) {
      const tags = getTags()
      const newTag = {
        id: Date.now().toString(),
        name: newTagName,
        color: newTagColor
      }
      const updatedTags = [...tags, newTag]
      localStorage.setItem('ejournal-tags', JSON.stringify(updatedTags))
      
      // Update note to use new tag
      const currentLatestNote = getLatestNote()
      if (currentLatestNote) {
        try {
          const stored = localStorage.getItem('ejournal-notes')
          if (stored) {
            const notes = JSON.parse(stored)
            const dateKey = currentLatestNote.date
            if (notes[dateKey]) {
              const updatedNotes = notes[dateKey].map(n => {
                if (n.id === currentLatestNote.id) {
                  return { ...n, tag: newTag }
                }
                return n
              })
              notes[dateKey] = updatedNotes
              localStorage.setItem('ejournal-notes', JSON.stringify(notes))
            }
          }
        } catch (e) {
          console.error('Error creating tag:', e)
        }
      }
      
      setTagName(newTagName)
      setTagColor(newTagColor)
      setNewTagName('')
      setNewTagColor('#FF6B6B')
      setIsCreatingNewTag(false)
      setShowTagSelector(false)
      setTimeout(() => saveToHistory(), 50)
    }
  }

  // Select existing tag
  const selectTag = (tag) => {
    const currentLatestNote = getLatestNote()
    if (currentLatestNote) {
      try {
        const stored = localStorage.getItem('ejournal-notes')
        if (stored) {
          const notes = JSON.parse(stored)
          const dateKey = currentLatestNote.date
          if (notes[dateKey]) {
            const updatedNotes = notes[dateKey].map(n => {
              if (n.id === currentLatestNote.id) {
                return { ...n, tag: tag }
              }
              return n
            })
            notes[dateKey] = updatedNotes
            localStorage.setItem('ejournal-notes', JSON.stringify(notes))
          }
        }
      } catch (e) {
        console.error('Error updating tag:', e)
      }
    }
    setTagName(tag.name)
    setTagColor(tag.color)
    setShowTagSelector(false)
    setIsCreatingNewTag(false)
    setTimeout(() => saveToHistory(), 50)
  }

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      const inRichText = e.target.closest?.('[data-textbox-editor]')

      // Don't trigger canvas shortcuts when typing in inputs / textarea / rich text box
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || inRichText) {
        if (inRichText && e.key === 'Escape') {
          setTextToolbar(null)
          setToolbarInlineFormats(INITIAL_TOOLBAR_INLINE_FORMATS)
          setEditingTextBoxId(null)
          if (document.activeElement?.hasAttribute?.('data-textbox-editor')) {
            document.activeElement.blur()
          }
        }
        if (e.target.tagName === 'TEXTAREA' || inRichText) {
          const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
          const modifier = isMac ? e.metaKey : e.ctrlKey

          if (modifier && ['c', 'v', 'x', 'a', 'b', 'i', 'u'].includes(e.key.toLowerCase())) {
            return
          }
        }
        return
      }

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
      const modifier = isMac ? e.metaKey : e.ctrlKey

      if (isBookOpen && !modifier && e.key === 'ArrowRight') {
        e.preventDefault()
        goToNextSpread()
        return
      }
      if (isBookOpen && !modifier && e.key === 'ArrowLeft') {
        e.preventDefault()
        goToPrevSpread()
        return
      }

      if (e.key === 'Escape') {
        if (pendingPostItColor || isAddingTextBox || showPostItMenu) {
          e.preventDefault()
        }
        setPendingPostItColor(null)
        setIsAddingTextBox(false)
        setShowPostItMenu(false)
        setTextToolbar(null)
        setToolbarInlineFormats(INITIAL_TOOLBAR_INLINE_FORMATS)
      }

      // Delete/Backspace
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedItem && !isEditingTitle) {
        if (document.activeElement?.hasAttribute?.('data-textbox-editor')) {
          return
        }
        e.preventDefault()
        if (selectedItem.type === 'textbox') {
          deleteTextBox(selectedItem.id)
        } else if (selectedItem.type === 'shape') {
          deleteShape(selectedItem.id)
        } else if (selectedItem.type === 'image') {
          deleteImage(selectedItem.id)
        } else if (selectedItem.type === 'sticker') {
          deleteSticker(selectedItem.id)
        }
      }
      // Copy (Ctrl+C / Cmd+C)
      else if (modifier && e.key === 'c' && selectedItem) {
        e.preventDefault();
        copyItem();
      }
      // Cut (Ctrl+X / Cmd+X)
      else if (modifier && e.key === 'x' && selectedItem) {
        e.preventDefault();
        cutItem();
      }
      // Paste (Ctrl+V / Cmd+V)
      else if (modifier && e.key === 'v' && clipboard) {
        e.preventDefault();
        pasteItem();
      }
      // Duplicate (Ctrl+D / Cmd+D)
      else if (modifier && e.key === 'd' && selectedItem) {
        e.preventDefault();
        duplicateItem();
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedItem, isEditingTitle, clipboard, pendingPostItColor, isAddingTextBox, showPostItMenu, isBookOpen, spreadIndex])

  useEffect(() => {
    const onSelectionChange = () => {
      if (isInteractingWithToolbarRef.current) {
        logNoteToolbarDebug('selectionchange: skip (isInteractingWithToolbarRef)')
        return
      }
      const el = document.activeElement
      if (isInsideRichTextToolbarWhitelist(el)) {
        logNoteToolbarDebug('selectionchange: skip (whitelist activeElement)', el)
        return
      }
      if (!el?.hasAttribute?.('data-textbox-editor')) {
        logNoteToolbarDebug('selectionchange: close (not editor)', el)
        setTextToolbar(null)
        setToolbarInlineFormats(INITIAL_TOOLBAR_INLINE_FORMATS)
        return
      }
      const id = el.getAttribute('data-textbox-id')
      const rect = getNonCollapsedSelectionRectInEditor(el)
      if (!rect) {
        logNoteToolbarDebug('selectionchange: close (no rect)')
        setTextToolbar(null)
        setToolbarInlineFormats(INITIAL_TOOLBAR_INLINE_FORMATS)
        return
      }
      setTextToolbar({
        top: rect.bottom + 8,
        left: rect.left + rect.width / 2,
        textBoxId: id
      })
      setToolbarInlineFormats(readInlineFormatState())
    }
    document.addEventListener('selectionchange', onSelectionChange)
    return () => document.removeEventListener('selectionchange', onSelectionChange)
  }, [])

  useEffect(() => {
    const closeToolbar = (e) => {
      const t = e.target
      if (isInteractingWithToolbarRef.current) {
        logNoteToolbarDebug('mousedown closeToolbar: skip (isInteractingWithToolbarRef)')
        return
      }
      if (isInsideRichTextToolbarWhitelist(t)) {
        logNoteToolbarDebug('mousedown closeToolbar: skip (whitelist)', t)
        return
      }
      logNoteToolbarDebug('mousedown closeToolbar: set null', t)
      setTextToolbar(null)
      setFormatPaletteOpen(null)
      setToolbarInlineFormats(INITIAL_TOOLBAR_INLINE_FORMATS)
    }
    document.addEventListener('mousedown', closeToolbar)
    return () => document.removeEventListener('mousedown', closeToolbar)
  }, [])

  useEffect(() => {
    if (!textToolbar) setFormatPaletteOpen(null)
  }, [textToolbar])

  useEffect(() => {
    if (formatPaletteOpen == null) return
    const closePalette = (e) => {
      if (e.target.closest?.('.note-text-format-palette')) return
      if (e.target.closest?.('.note-text-format-palette-trigger')) return
      setFormatPaletteOpen(null)
    }
    document.addEventListener('mousedown', closePalette, true)
    return () => document.removeEventListener('mousedown', closePalette, true)
  }, [formatPaletteOpen])

  // หน้าปัจจุบันที่ active (ซ้าย/ขวา) สำหรับวาง element ใหม่
  const currentPageIndex = isBookOpen ? spreadIndex * 2 : 0

  const handleCanvasClick = (e) => {
    const target = e.target
    const onCanvasBg =
      target === canvasRef.current ||
      target.classList?.contains('note-content') ||
      target.classList?.contains('note-page-sheet')

    if (pendingPostItColor && canvasRef.current && onCanvasBg) {
      const { x: ax, y: ay } = clientPointToNoteContentCoords(
        canvasRef.current,
        e.clientX,
        e.clientY
      )
      const paged = isBookOpen ? toPagedPos(ax, ay) : { pageIndex: 0, x: ax, y: ay }
      const newTextBoxId = Date.now().toString()
      const newZIndex = maxZIndex + 1
      const entry = POSTIT_PALETTE.find((p) => p.color === pendingPostItColor) || POSTIT_PALETTE[0]
      const newTextBox = {
        id: newTextBoxId,
        content: '',
        pageIndex: paged.pageIndex,
        x: paged.x,
        y: paged.y,
        width: 200,
        height: 176,
        rotation: 0,
        zIndex: newZIndex,
        fontSize: DEFAULT_TEXTBOX_FONT_SIZE,
        variant: 'postit',
        postitColor: pendingPostItColor,
        postitTextColor: entry.textColor || '#2d2a26'
      }
      setMaxZIndex(newZIndex)
      setTextBoxes((prev) => [...prev, newTextBox])
      handleSelectItem({ type: 'textbox', id: newTextBoxId }, { startEditing: true })
      setPendingPostItColor(null)
      setShowPostItMenu(false)
      setTimeout(() => saveToHistory(), 50)
      return
    }

    if (onCanvasBg) {
      handleSelectItem(null)
      setIsDragging(false)
    }

    setIsDragging(false)

    if (!isAddingTextBox || !canvasRef.current) return

    const { x: ax2, y: ay2 } = clientPointToNoteContentCoords(
      canvasRef.current,
      e.clientX,
      e.clientY
    )
    const paged2 = isBookOpen ? toPagedPos(ax2, ay2) : { pageIndex: 0, x: ax2, y: ay2 }

    const newTextBoxId = Date.now().toString()
    const newZIndex = maxZIndex + 1
    const newTextBox = {
      id: newTextBoxId,
      content: '',
      pageIndex: paged2.pageIndex,
      x: paged2.x,
      y: paged2.y,
      width: 200,
      height: 100,
      rotation: 0,
      zIndex: newZIndex,
      fontSize: DEFAULT_TEXTBOX_FONT_SIZE
    }

    setMaxZIndex(newZIndex)
    setTextBoxes([...textBoxes, newTextBox])
    handleSelectItem({ type: 'textbox', id: newTextBoxId }, { startEditing: true })
    setIsAddingTextBox(false)
    setTimeout(() => saveToHistory(), 50)
  }

  const addShape = (type, clickX = null, clickY = null) => {
    let ax = currentPageIndex * PAGE_W + 200
    let ay = 200
    
    if (clickX !== null && clickY !== null && canvasRef.current) {
      const p = clientPointToNoteContentCoords(canvasRef.current, clickX, clickY)
      ax = p.x
      ay = p.y
    }
    const paged = isBookOpen ? toPagedPos(ax, ay) : { pageIndex: 0, x: ax, y: ay }
    
    const newZIndex = maxZIndex + 1;
    const newShape = {
      id: Date.now().toString(),
      type,
      pageIndex: paged.pageIndex,
      x: paged.x,
      y: paged.y,
      width: type === 'line' ? 200 : 100,
      height: type === 'line' ? 2 : 100,
      fillColor: 'transparent',
      strokeColor: '#3A3030',
      strokeWidth: 2,
      rotation: 0,
      zIndex: newZIndex
    };
    
    setMaxZIndex(newZIndex);
    setShapes([...shapes, newShape]);
    handleSelectItem({ type: 'shape', id: newShape.id });
    setShowShapesMenu(false);
    setTimeout(() => saveToHistory(), 50)
  };

  const addSticker = (stickerSrc, clickX = null, clickY = null) => {
    // ใน book mode: วางกลาง spread (หน้าซ้ายใกล้สัน) เพื่อให้ drag ไปหน้าไหนก็ได้
    let ax = isBookOpen
      ? spreadIndex * 2 * PAGE_W + (PAGE_W / 2 - 75)   // กลางหน้าซ้าย
      : currentPageIndex * PAGE_W + 180
    let ay = 200

    if (clickX !== null && clickY !== null && canvasRef.current) {
      const p = clientPointToNoteContentCoords(canvasRef.current, clickX, clickY)
      ax = p.x
      ay = p.y
    }
    const paged = isBookOpen ? toPagedPos(ax, ay) : { pageIndex: 0, x: ax, y: ay }
    
    const newZIndex = maxZIndex + 1;
    const newSticker = {
      id: Date.now().toString(),
      src: stickerSrc,
      pageIndex: paged.pageIndex,
      x: paged.x,
      y: paged.y,
      width: 150,
      height: 150,
      rotation: 0,
      zIndex: newZIndex
    };
    
    setMaxZIndex(newZIndex);
    setStickers([...stickers, newSticker]);
    handleSelectItem({ type: 'sticker', id: newSticker.id });
    setShowStickersMenu(false);
    setShowPostItMenu(false);
    setTimeout(() => saveToHistory(), 50)
  };

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const newZIndex = maxZIndex + 1;
      const newImage = {
        id: Date.now().toString(),
        src: event.target?.result,
        pageIndex: currentPageIndex,
        x: 80,
        y: 80,
        width: 300,
        height: 200,
        rotation: 0,
        zIndex: newZIndex
      };
      
      setMaxZIndex(newZIndex);
      setImages([...images, newImage]);
      setTimeout(() => saveToHistory(), 50)
    };
    reader.readAsDataURL(file);
  };

  const deleteTextBox = (id) => {
    setTextBoxes(textBoxes.filter(tb => tb.id !== id));
    textBoxSelectionSyncRef.current = null
    setSelectedItem(null);
    setEditingTextBoxId((prev) => (prev === id ? null : prev))
    setTimeout(() => saveToHistory(), 50)
  };

  const deleteShape = (id) => {
    setShapes(shapes.filter(s => s.id !== id));
    textBoxSelectionSyncRef.current = null
    setSelectedItem(null);
    setTimeout(() => saveToHistory(), 50)
  };

  const deleteSticker = (id) => {
    setStickers(stickers.filter(s => s.id !== id));
    textBoxSelectionSyncRef.current = null
    setSelectedItem(null);
    setTimeout(() => saveToHistory(), 50)
  };

  const deleteImage = (id) => {
    setImages(images.filter(i => i.id !== id));
    textBoxSelectionSyncRef.current = null
    setSelectedItem(null);
    setTimeout(() => saveToHistory(), 50)
  };

  // Function to stop all dragging
  const stopAllDragging = () => {
    const stickerCleanup = stickerDragCleanupRef.current
    stickerDragCleanupRef.current = null
    stickerCleanup?.()
    if (activeRotationDragRef.current) {
      document.removeEventListener('mousemove', activeRotationDragRef.current.move)
      document.removeEventListener('mouseup', activeRotationDragRef.current.up)
      activeRotationDragRef.current = null
      setRotationHud(null)
    }
    if (skipPersistDuringCanvasDragRef.current) {
      skipPersistDuringCanvasDragRef.current = false
      requestAnimationFrame(() => flushPersistFromSnapshot())
    }
    setIsDragging(false);
    isRightClickRef.current = false;
    // Remove any active drag handlers
    if (activeDragHandlersRef.current.mouseMove) {
      document.removeEventListener('mousemove', activeDragHandlersRef.current.mouseMove);
      activeDragHandlersRef.current.mouseMove = null;
    }
    if (activeDragHandlersRef.current.mouseUp) {
      document.removeEventListener('mouseup', activeDragHandlersRef.current.mouseUp);
      activeDragHandlersRef.current.mouseUp = null;
    }
    if (activeDragHandlersRef.current.contextMenu) {
      document.removeEventListener('contextmenu', activeDragHandlersRef.current.contextMenu);
      activeDragHandlersRef.current.contextMenu = null;
    }
  };

  const startRotateDrag = (e, box, rotation, setRotationDeg) => {
    e.stopPropagation()
    e.preventDefault()
    stopAllDragging()
    const canvas = canvasRef.current
    if (!canvas) return
    const content = canvas.querySelector('.note-content') ?? canvas
    const cr = content.getBoundingClientRect()
    const cx = cr.left + box.x + box.w / 2
    const cy = cr.top + box.y + box.h / 2
    const startRad = Math.atan2(e.clientY - cy, e.clientX - cx)
    const startRot = typeof rotation === 'number' && !Number.isNaN(rotation) ? rotation : 0
    skipPersistDuringCanvasDragRef.current = true

    const onMove = (ev) => {
      ev.preventDefault()
      const rad = Math.atan2(ev.clientY - cy, ev.clientX - cx)
      let dr = rad - startRad
      if (dr > Math.PI) dr -= 2 * Math.PI
      if (dr < -Math.PI) dr += 2 * Math.PI
      const nextDeg = startRot + dr * (180 / Math.PI)
      setRotationDeg(nextDeg)
      setRotationHud({
        clientX: ev.clientX,
        clientY: ev.clientY,
        degrees: normalizeDisplay360(nextDeg)
      })
    }
    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      activeRotationDragRef.current = null
      setRotationHud(null)
      skipPersistDuringCanvasDragRef.current = false
      requestAnimationFrame(() => flushPersistFromSnapshot())
      setTimeout(() => saveToHistory(), 50)
    }
    activeRotationDragRef.current = { move: onMove, up: onUp }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    setRotationHud({
      clientX: e.clientX,
      clientY: e.clientY,
      degrees: normalizeDisplay360(startRot)
    })
  }

  // Context menu functions
  const handleContextMenu = (e, item) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Stop any ongoing dragging immediately
    stopAllDragging();
    setIsContextMenuOpen(true);
    
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      item: item
    });
  };

  const handleCanvasContextMenu = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsContextMenuOpen(true);
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      item: null // null means canvas/empty space
    });
  };

  const closeContextMenu = () => {
    setContextMenu(null);
    setIsContextMenuOpen(false);
  };

  const copyItem = () => {
    if (!selectedItem) return;
    
    let itemData = null;
    if (selectedItem.type === 'textbox') {
      itemData = { type: 'textbox', data: textBoxes.find(tb => tb.id === selectedItem.id) };
    } else if (selectedItem.type === 'shape') {
      itemData = { type: 'shape', data: shapes.find(s => s.id === selectedItem.id) };
    } else if (selectedItem.type === 'image') {
      itemData = { type: 'image', data: images.find(i => i.id === selectedItem.id) };
    } else if (selectedItem.type === 'sticker') {
      itemData = { type: 'sticker', data: stickers.find(s => s.id === selectedItem.id) };
    }
    
    if (itemData) {
      setClipboard(itemData);
    }
    closeContextMenu();
  };

  const cutItem = () => {
    copyItem();
    if (selectedItem) {
      if (selectedItem.type === 'textbox') {
        deleteTextBox(selectedItem.id);
      } else if (selectedItem.type === 'shape') {
        deleteShape(selectedItem.id);
      } else if (selectedItem.type === 'image') {
        deleteImage(selectedItem.id);
      } else if (selectedItem.type === 'sticker') {
        deleteSticker(selectedItem.id);
      }
    }
  };

  const pasteItem = () => {
    if (!clipboard) return;
    
    const offset = 20;
    const newZIndex = maxZIndex + 1;
    if (clipboard.type === 'textbox') {
      const newItem = {
        ...clipboard.data,
        id: Date.now().toString(),
        x: clipboard.data.x + offset,
        y: clipboard.data.y + offset,
        zIndex: newZIndex
      };
      setMaxZIndex(newZIndex);
      setTextBoxes([...textBoxes, newItem]);
      handleSelectItem({ type: 'textbox', id: newItem.id });
    } else if (clipboard.type === 'shape') {
      const newItem = {
        ...clipboard.data,
        id: Date.now().toString(),
        x: clipboard.data.x + offset,
        y: clipboard.data.y + offset,
        zIndex: newZIndex
      };
      setMaxZIndex(newZIndex);
      setShapes([...shapes, newItem]);
      handleSelectItem({ type: 'shape', id: newItem.id });
    } else if (clipboard.type === 'image') {
      const newItem = {
        ...clipboard.data,
        id: Date.now().toString(),
        x: clipboard.data.x + offset,
        y: clipboard.data.y + offset,
        zIndex: newZIndex
      };
      setMaxZIndex(newZIndex);
      setImages([...images, newItem]);
      handleSelectItem({ type: 'image', id: newItem.id });
    } else if (clipboard.type === 'sticker') {
      const newItem = {
        ...clipboard.data,
        id: Date.now().toString(),
        x: clipboard.data.x + offset,
        y: clipboard.data.y + offset,
        zIndex: newZIndex
      };
      setMaxZIndex(newZIndex);
      setStickers([...stickers, newItem]);
      handleSelectItem({ type: 'sticker', id: newItem.id });
    }
    closeContextMenu();
    setTimeout(() => saveToHistory(), 50)
  };

  const duplicateItem = () => {
    if (!selectedItem) return;
    
    const offset = 20;
    const newZIndex = maxZIndex + 1;
    if (selectedItem.type === 'textbox') {
      const original = textBoxes.find(tb => tb.id === selectedItem.id);
      if (original) {
        const newItem = {
          ...original,
          id: Date.now().toString(),
          x: original.x + offset,
          y: original.y + offset,
          zIndex: newZIndex
        };
        setMaxZIndex(newZIndex);
        setTextBoxes([...textBoxes, newItem]);
        handleSelectItem({ type: 'textbox', id: newItem.id });
      }
    } else if (selectedItem.type === 'shape') {
      const original = shapes.find(s => s.id === selectedItem.id);
      if (original) {
        const newItem = {
          ...original,
          id: Date.now().toString(),
          x: original.x + offset,
          y: original.y + offset,
          zIndex: newZIndex
        };
        setMaxZIndex(newZIndex);
        setShapes([...shapes, newItem]);
        handleSelectItem({ type: 'shape', id: newItem.id });
      }
    } else if (selectedItem.type === 'image') {
      const original = images.find(i => i.id === selectedItem.id);
      if (original) {
        const newItem = {
          ...original,
          id: Date.now().toString(),
          x: original.x + offset,
          y: original.y + offset,
          zIndex: newZIndex
        };
        setMaxZIndex(newZIndex);
        setImages([...images, newItem]);
        handleSelectItem({ type: 'image', id: newItem.id });
      }
    } else if (selectedItem.type === 'sticker') {
      const original = stickers.find(s => s.id === selectedItem.id);
      if (original) {
        const newItem = {
          ...original,
          id: Date.now().toString(),
          x: original.x + offset,
          y: original.y + offset,
          zIndex: newZIndex
        };
        setMaxZIndex(newZIndex);
        setStickers([...stickers, newItem]);
        handleSelectItem({ type: 'sticker', id: newItem.id });
      }
    }
    closeContextMenu();
    setTimeout(() => saveToHistory(), 50)
  };

  // Get all elements with their z-index for ordering
  const getAllElements = () => {
    const allElements = [
      ...textBoxes.map(tb => ({ ...tb, elementType: 'textbox' })),
      ...shapes.map(s => ({ ...s, elementType: 'shape' })),
      ...images.map(i => ({ ...i, elementType: 'image' })),
      ...stickers.map(s => ({ ...s, elementType: 'sticker' }))
    ];
    return allElements.sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
  };

  const sendToBack = () => {
    if (!selectedItem) return;
    
    const allElements = getAllElements();
    // Find the minimum zIndex among all elements (excluding the selected one)
    const otherElements = allElements.filter(el => {
      if (selectedItem.type === 'textbox') return el.elementType !== 'textbox' || el.id !== selectedItem.id;
      if (selectedItem.type === 'shape') return el.elementType !== 'shape' || el.id !== selectedItem.id;
      if (selectedItem.type === 'image') return el.elementType !== 'image' || el.id !== selectedItem.id;
      if (selectedItem.type === 'sticker') return el.elementType !== 'sticker' || el.id !== selectedItem.id;
      return true;
    });
    
    // Set zIndex to be the minimum among other elements, or 1 if no other elements
    // Use 1 as minimum to ensure element is visible above background
    const minZIndex = otherElements.length > 0 
      ? Math.min(...otherElements.map(el => el.zIndex || 1))
      : 1;
    
    // If minZIndex is already 1, keep it at 1 (don't go below 1)
    // Otherwise, set to minZIndex - 1 to place it behind other elements
    const newZIndex = minZIndex <= 1 ? 1 : minZIndex - 1;
    
    if (selectedItem.type === 'textbox') {
      setTextBoxes(textBoxes.map(tb => 
        tb.id === selectedItem.id ? { ...tb, zIndex: newZIndex } : tb
      ));
    } else if (selectedItem.type === 'shape') {
      setShapes(shapes.map(s => 
        s.id === selectedItem.id ? { ...s, zIndex: newZIndex } : s
      ));
    } else if (selectedItem.type === 'image') {
      setImages(images.map(i => 
        i.id === selectedItem.id ? { ...i, zIndex: newZIndex } : i
      ));
    } else if (selectedItem.type === 'sticker') {
      setStickers(stickers.map(s => 
        s.id === selectedItem.id ? { ...s, zIndex: newZIndex } : s
      ));
    }
    
    closeContextMenu();
    setTimeout(() => saveToHistory(), 50)
  };

  const bringToFront = () => {
    if (!selectedItem) return;
    
    const newZIndex = maxZIndex + 1;
    
    if (selectedItem.type === 'textbox') {
      setTextBoxes(textBoxes.map(tb => 
        tb.id === selectedItem.id ? { ...tb, zIndex: newZIndex } : tb
      ));
    } else if (selectedItem.type === 'shape') {
      setShapes(shapes.map(s => 
        s.id === selectedItem.id ? { ...s, zIndex: newZIndex } : s
      ));
    } else if (selectedItem.type === 'image') {
      setImages(images.map(i => 
        i.id === selectedItem.id ? { ...i, zIndex: newZIndex } : i
      ));
    } else if (selectedItem.type === 'sticker') {
      setStickers(stickers.map(s => 
        s.id === selectedItem.id ? { ...s, zIndex: newZIndex } : s
      ));
    }
    
    setMaxZIndex(newZIndex);
    closeContextMenu();
    setTimeout(() => saveToHistory(), 50)
  };

  // Close context menu when clicking elsewhere
  useEffect(() => {
    const handleClick = () => closeContextMenu();
    if (contextMenu) {
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [contextMenu]);

  const updateShapeColor = (id, fillColor, strokeColor) => {
    setShapes(shapes.map(s => s.id === id ? { ...s, fillColor, strokeColor } : s));
  };

  const updateShapeStroke = (id, strokeWidth) => {
    setShapes(shapes.map(s => s.id === id ? { ...s, strokeWidth } : s));
  };

  const [isExportingPdf, setIsExportingPdf] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)
  const [turningPage, setTurningPage] = useState(false)
  const pageTurnInProgress = useRef(false)

  // ---- PDF Export: direct canvas drawing (pixel-perfect WYSIWYG) ----

  /**
   * Load any image src → HTMLImageElement without tainting the canvas.
   * - data:/blob: URLs → load directly (no crossOrigin needed)
   * - HTTP URLs     → fetch() → blob URL (same-origin, never taints canvas)
   */
  const loadImageEl = (src) => {
    if (!src) return Promise.resolve(null)

    const fromUrl = (url) => new Promise((res) => {
      const img = new Image()
      img.onload = () => res(img)
      img.onerror = () => res(null)
      img.src = url
    })

    if (src.startsWith('data:') || src.startsWith('blob:')) {
      return fromUrl(src)
    }

    return fetch(src)
      .then(r => r.blob())
      .then(blob => {
        const blobUrl = URL.createObjectURL(blob)
        return fromUrl(blobUrl).then(img => {
          URL.revokeObjectURL(blobUrl)
          return img
        })
      })
      .catch(() => fromUrl(src))
  }

  /** Draw a shape onto ctx at origin (0,0) — caller must translate first */
  const drawShapeToCtx = (ctx, el) => {
    const { width: w, height: h } = el
    const sw = el.strokeWidth || 1
    ctx.fillStyle = el.fillColor || 'transparent'
    ctx.strokeStyle = el.strokeColor || '#000000'
    ctx.lineWidth = sw
    if (el.type === 'rectangle') {
      if (el.fillColor && el.fillColor !== 'transparent') ctx.fillRect(0, 0, w, h)
      ctx.strokeRect(sw / 2, sw / 2, w - sw, h - sw)
    } else if (el.type === 'circle') {
      ctx.beginPath()
      ctx.ellipse(w / 2, h / 2, Math.max(1, w / 2 - sw / 2), Math.max(1, h / 2 - sw / 2), 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
    } else if (el.type === 'triangle') {
      ctx.beginPath()
      ctx.moveTo(w * 0.5, h * 0.1)
      ctx.lineTo(w * 0.9, h * 0.9)
      ctx.lineTo(w * 0.1, h * 0.9)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
    } else if (el.type === 'star') {
      const pts = [[50,10],[61,35],[88,35],[66,52],[74,78],[50,62],[26,78],[34,52],[12,35],[39,35]]
      ctx.beginPath()
      pts.forEach(([px, py], i) => {
        const nx = (px / 100) * w
        const ny = (py / 100) * h
        if (i === 0) ctx.moveTo(nx, ny); else ctx.lineTo(nx, ny)
      })
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
    } else if (el.type === 'line') {
      // render as filled rectangle to match CSS border rendering
      ctx.fillStyle = el.strokeColor || '#000000'
      ctx.fillRect(0, (h - sw) / 2, w, sw)
    }
  }

  /**
   * Draw a textbox (rich HTML content) directly onto ctx at origin (0,0).
   * Parses HTML DOM to extract text with bold/italic/color/highlight/strikethrough,
   * then renders with Canvas 2D text API — never taints the canvas.
   */
  const drawTextBoxToCtx = (ctx, el) => {
    const isPostit = el.variant === 'postit'
    const bg     = isPostit ? (el.postitColor     || '#FEEF9F') : null
    const fg     = isPostit ? (el.postitTextColor || '#2d2a26') : '#3A3030'
    const fs     = el.fontSize || 14
    const pad    = 8
    const lineH  = Math.round(fs * 1.4)

    if (bg) { ctx.fillStyle = bg; ctx.fillRect(0, 0, el.width, el.height) }

    // --- parse HTML → flat segment list ---
    const segs = []
    const parseNode = (node, st) => {
      if (node.nodeType === 3) {
        if (node.textContent) segs.push({ text: node.textContent, ...st })
        return
      }
      if (node.nodeType !== 1) return
      const tag = node.tagName.toLowerCase()
      const ns  = { ...st }
      if (tag === 'br')  { segs.push({ text: '\n', ...st }); return }
      if (tag === 'strong' || tag === 'b')              ns.bold   = true
      if (tag === 'em'     || tag === 'i')              ns.italic = true
      if (tag === 's' || tag === 'del' || tag === 'strike') ns.strike = true
      const style = node.getAttribute?.('style') || ''
      const mc = style.match(/\bcolor\s*:\s*([^;]+)/)
      const mh = style.match(/background(?:-color)?\s*:\s*([^;]+)/)
      if (mc) ns.color = mc[1].trim()
      if (mh) ns.hl    = mh[1].trim()
      const isBlock = /^(p|div|li|h[1-6]|blockquote)$/.test(tag)
      if (isBlock && segs.length > 0 && segs[segs.length - 1]?.text !== '\n')
        segs.push({ text: '\n', ...st })
      node.childNodes.forEach(c => parseNode(c, ns))
      if (isBlock) segs.push({ text: '\n', ...st })
    }
    const tmp = document.createElement('div')
    tmp.innerHTML = el.content || ''
    tmp.childNodes.forEach(c => parseNode(c, {}))

    // --- render segments with word-wrap ---
    let cx = pad
    let cy = pad + fs
    ctx.textBaseline = 'alphabetic'

    for (const seg of segs) {
      if (seg.text === '\n') {
        cx = pad; cy += lineH
        if (cy > el.height) break
        continue
      }
      ctx.font = `${seg.italic ? 'italic ' : ''}${seg.bold ? 'bold ' : ''}${fs}px sans-serif`
      const tokens = seg.text.split(/(\s+)/)
      for (const tok of tokens) {
        if (!tok) continue
        const tw = ctx.measureText(tok).width
        if (cx + tw > el.width - pad && cx > pad) {
          cx = pad; cy += lineH
          if (cy > el.height) return
          if (/^\s+$/.test(tok)) continue
        }
        if (seg.hl && seg.hl !== 'transparent') {
          ctx.save(); ctx.fillStyle = seg.hl
          ctx.fillRect(cx, cy - fs * 0.85, tw, lineH * 0.95)
          ctx.restore()
        }
        ctx.fillStyle = seg.color || fg
        ctx.fillText(tok, cx, cy)
        if (seg.strike) {
          ctx.save(); ctx.fillStyle = seg.color || fg
          ctx.fillRect(cx, cy - fs * 0.35, tw, 1)
          ctx.restore()
        }
        cx += tw
      }
    }
  }

  const downloadAsPDF = async (spreadsToExport = null) => {
    if (isExportingPdf) return
    setIsExportingPdf(true)
    setShowExportModal(false)

    /** Draw one element onto ctx; caller must translate/rotate first */
    const drawEl = async (ctx, el) => {
      if (el.elementType === 'image' || el.elementType === 'sticker') {
        const img = await loadImageEl(el.src)
        if (!img) return
        if (el.elementType === 'sticker') {
          const nw = img.naturalWidth  || el.width
          const nh = img.naturalHeight || el.height
          const scale = Math.min(el.width / nw, el.height / nh)
          const dw = nw * scale
          const dh = nh * scale
          ctx.drawImage(img, (el.width - dw) / 2, (el.height - dh) / 2, dw, dh)
        } else {
          ctx.drawImage(img, 0, 0, el.width, el.height)
        }
      } else if (el.elementType === 'shape') {
        drawShapeToCtx(ctx, el)
      } else {
        drawTextBoxToCtx(ctx, el)
      }
    }

    /** Place a set of elements onto ctx; offsetX = left-edge of their "page" in ctx space */
    const drawPageEls = async (ctx, els, offsetX = 0) => {
      for (const el of els) {
        ctx.save()
        ctx.translate(offsetX + el.x + el.width / 2, el.y + el.height / 2)
        ctx.rotate(((el.rotation ?? 0) * Math.PI) / 180)
        ctx.translate(-el.width / 2, -el.height / 2)
        await drawEl(ctx, el)
        ctx.restore()
      }
    }

    try {
      const numSpreads = Math.ceil(totalPages / 2)
      const spreadsArr = spreadsToExport ?? Array.from({ length: numSpreads }, (_, i) => i)

      if (isBookOpen) {
        // ── Book mode: each selected spread → 1 landscape PDF page (1120 × 794) ──
        const SPREAD_W = PAGE_W * 2
        const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [SPREAD_W, PAGE_H] })

        let firstPage = true
        for (const si of spreadsArr) {
          if (!firstPage) pdf.addPage()
          firstPage = false

          const canvas = document.createElement('canvas')
          canvas.width  = SPREAD_W * 2
          canvas.height = PAGE_H * 2
          const ctx = canvas.getContext('2d')
          ctx.scale(2, 2)

          ctx.fillStyle = '#f8f3e8'
          ctx.fillRect(0, 0, SPREAD_W, PAGE_H)

          const leftEls  = allSortedElements.filter(el => (el.pageIndex ?? 0) === si * 2)
          await drawPageEls(ctx, leftEls, 0)

          const rightEls = allSortedElements.filter(el => (el.pageIndex ?? 0) === si * 2 + 1)
          await drawPageEls(ctx, rightEls, PAGE_W)

          const imgData = canvas.toDataURL('image/jpeg', 0.92)
          pdf.addImage(imgData, 'JPEG', 0, 0, SPREAD_W, PAGE_H)
        }

        pdf.save(`${title || 'note'}.pdf`)
      } else {
        // ── Normal mode: each selected spread → 2 portrait PDF pages ──
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: [PAGE_W, PAGE_H] })

        let firstPage = true
        for (const si of spreadsArr) {
          for (let offset = 0; offset < 2; offset++) {
            const pi = si * 2 + offset
            if (pi >= totalPages) continue

            if (!firstPage) pdf.addPage()
            firstPage = false

            const canvas = document.createElement('canvas')
            canvas.width  = PAGE_W * 2
            canvas.height = PAGE_H * 2
            const ctx = canvas.getContext('2d')
            ctx.scale(2, 2)

            ctx.fillStyle = '#f8f3e8'
            ctx.fillRect(0, 0, PAGE_W, PAGE_H)

            const pageEls = allSortedElements.filter(el => (el.pageIndex ?? 0) === pi)
            await drawPageEls(ctx, pageEls, 0)

            const imgData = canvas.toDataURL('image/jpeg', 0.92)
            pdf.addImage(imgData, 'JPEG', 0, 0, PAGE_W, PAGE_H)
          }
        }

        pdf.save(`${title || 'note'}.pdf`)
      }
    } catch (err) {
      console.error('PDF export error:', err)
      alert(`Export failed: ${err?.message || err}`)
    } finally {
      setIsExportingPdf(false)
    }
  }

  const shareAsLink = () => {
    const link = window.location.href;
    navigator.clipboard.writeText(link);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const getSelectedShape = () => {
    if (selectedItem?.type === 'shape') {
      return shapes.find(s => s.id === selectedItem.id);
    }
    return null;
  };

  const renderShape = (shape) => {
    const isSelected = selectedItem?.type === 'shape' && selectedItem.id === shape.id;
    
    const shapeContent = () => {
      switch (shape.type) {
        case 'rectangle':
          return (
            <div
              style={{
                width: '100%',
                height: '100%',
                backgroundColor: shape.fillColor,
                border: `${shape.strokeWidth}px solid ${shape.strokeColor}`
              }}
            />
          );
        case 'circle':
          return (
            <div
              style={{
                width: '100%',
                height: '100%',
                backgroundColor: shape.fillColor,
                borderRadius: '50%',
                border: `${shape.strokeWidth}px solid ${shape.strokeColor}`
              }}
            />
          );
        case 'triangle':
          return (
            <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
              <polygon
                points="50,10 90,90 10,90"
                fill={shape.fillColor}
                stroke={shape.strokeColor}
                strokeWidth={shape.strokeWidth}
              />
            </svg>
          );
        case 'star':
          return (
            <svg width="100%" height="100%" viewBox="0 0 100 100">
              <polygon
                points="50,10 61,35 88,35 66,52 74,78 50,62 26,78 34,52 12,35 39,35"
                fill={shape.fillColor}
                stroke={shape.strokeColor}
                strokeWidth={shape.strokeWidth}
              />
            </svg>
          );
        case 'line':
          return (
            <div
              style={{
                width: '100%',
                height: `${shape.strokeWidth}px`,
                backgroundColor: shape.strokeColor
              }}
            />
          );
        default:
          return null;
      }
    };

    return (
      <Resizable
        key={shape.id}
        size={{ width: shape.width, height: shape.height }}
        className={`note-shape ${isSelected ? 'selected' : ''}`}
        style={{
          position: 'absolute',
          left: shape.x,
          top: shape.y,
          zIndex: shape.zIndex || 1,
          transform: `rotate(${shape.rotation ?? 0}deg)`,
          transformOrigin: 'center center'
        }}
        onResizeStart={() => {
          setIsResizing(true);
          setIsDragging(false);
        }}
        onResizeStop={(e, direction, ref, d) => {
          setShapes(prevShapes => prevShapes.map(s => {
            if (s.id !== shape.id) return s
            const n = normPaged(s)
            const nw = Math.max(10, n.width + d.width)
            const nh = Math.max(10, n.height + d.height)
            const c = clampInPage(n, n.x, n.y, nw, nh)
            return { ...n, x: c.x, y: c.y, width: nw, height: nh }
          }));
          setIsResizing(false);
          setTimeout(() => saveToHistory(), 50)
        }}
        enable={{
          top: true,
          right: true,
          bottom: true,
          left: true,
          topRight: true,
          bottomRight: true,
          bottomLeft: true,
          topLeft: true
        }}
        handleStyles={{
          top: { cursor: 'n-resize' },
          right: { cursor: 'e-resize' },
          bottom: { cursor: 's-resize' },
          left: { cursor: 'w-resize' },
          topRight: { cursor: 'ne-resize' },
          bottomRight: { cursor: 'se-resize' },
          bottomLeft: { cursor: 'sw-resize' },
          topLeft: { cursor: 'nw-resize' }
        }}
      >
        <div
          className="note-shape-content"
          onContextMenu={(e) => {
            // Stop dragging immediately when right-clicking
            stopAllDragging();
            handleContextMenu(e, { type: 'shape', id: shape.id });
          }}
          onMouseDown={(e) => {
            // Don't drag if context menu is open
            if (isContextMenuOpen) {
              return;
            }
            
            // Stop any previous dragging first
            stopAllDragging();
            
            // Don't drag if clicking on resize handle - let Resizable handle it
            if (e.target.closest('.react-resizable-handle')) {
              handleSelectItem({ type: 'shape', id: shape.id });
              return;
            }
            if (e.target.closest('.note-rotate-handle')) return;
            if (e.target.closest('.note-delete-btn')) return;
            e.stopPropagation();
            handleSelectItem({ type: 'shape', id: shape.id });
            
            const startX = e.clientX;
            const startY = e.clientY;
            const startEl = { ...shape }; const capBookOpen = isBookOpen; const capSpreadIdx = spreadIndex;
            let hasMoved = false;

            const handleMouseMove = (moveEvent) => {
              if (isContextMenuOpen) { stopAllDragging(); return; }
              if (!hasMoved) { setIsDragging(true); hasMoved = true; skipPersistDuringCanvasDragRef.current = true; }
              moveEvent.preventDefault();
              const deltaX = moveEvent.clientX - startX;
              const deltaY = moveEvent.clientY - startY;
              setShapes(prevShapes => prevShapes.map(s => {
                if (s.id !== shape.id) return s
                const pos = dragWithPageTransfer(startEl, deltaX, deltaY, capBookOpen, capSpreadIdx)
                return { ...s, pageIndex: pos.pageIndex, x: pos.x, y: pos.y }
              }));
            };

            const handleMouseUp = () => {
              setIsDragging(false);
              if (activeDragHandlersRef.current.mouseMove === handleMouseMove) {
                document.removeEventListener('mousemove', handleMouseMove);
                activeDragHandlersRef.current.mouseMove = null;
              }
              if (activeDragHandlersRef.current.mouseUp === handleMouseUp) {
                document.removeEventListener('mouseup', handleMouseUp);
                activeDragHandlersRef.current.mouseUp = null;
              }
              if (hasMoved) {
                skipPersistDuringCanvasDragRef.current = false
                requestAnimationFrame(() => flushPersistFromSnapshot())
                setTimeout(() => saveToHistory(), 50)
              }
            };

            // Store handlers in ref
            activeDragHandlersRef.current.mouseMove = handleMouseMove;
            activeDragHandlersRef.current.mouseUp = handleMouseUp;
            
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
          }}
          onTouchStart={(e) => {
            if (e.target.closest('.react-resizable-handle')) return;
            e.stopPropagation();
            textBoxSelectionSyncRef.current = null
            setSelectedItem({ type: 'shape', id: shape.id });
            setIsDragging(true);
            
            const touch = e.touches[0];
            const startX = touch.clientX;
            const startY = touch.clientY;
            const startElT = { ...shape }; const capBookOpenT = isBookOpen; const capSpreadIdxT = spreadIndex;
            let touchMoved = false;

            const handleTouchMove = (moveEvent) => {
              moveEvent.preventDefault();
              if (!touchMoved) { touchMoved = true; skipPersistDuringCanvasDragRef.current = true; }
              const tc = moveEvent.touches[0];
              const deltaX = tc.clientX - startX;
              const deltaY = tc.clientY - startY;
              setShapes(prevShapes => prevShapes.map(s => {
                if (s.id !== shape.id) return s
                const pos = dragWithPageTransfer(startElT, deltaX, deltaY, capBookOpenT, capSpreadIdxT)
                return { ...s, pageIndex: pos.pageIndex, x: pos.x, y: pos.y }
              }));
            };

            const handleTouchEnd = () => {
              setIsDragging(false);
              document.removeEventListener('touchmove', handleTouchMove);
              document.removeEventListener('touchend', handleTouchEnd);
              if (touchMoved) {
                skipPersistDuringCanvasDragRef.current = false
                requestAnimationFrame(() => flushPersistFromSnapshot())
                setTimeout(() => saveToHistory(), 50)
              }
            };

            document.addEventListener('touchmove', handleTouchMove, { passive: false });
            document.addEventListener('touchend', handleTouchEnd);
          }}
        >
          {shapeContent()}
        </div>
        {isSelected && (
          <>
            <button
              type="button"
              className="note-rotate-handle"
              aria-label="Rotate"
              onMouseDown={(e) => startRotateDrag(
                e,
                { x: shape.x, y: shape.y, w: shape.width, h: shape.height },
                shape.rotation,
                (deg) => setShapes((prev) => prev.map((s) => (s.id === shape.id ? { ...s, rotation: deg } : s)))
              )}
            >
              <RotateCw size={14} />
            </button>
            <button
              className="note-delete-btn"
              onClick={() => deleteShape(shape.id)}
              style={{ top: '-12px', left: '-12px' }}
            >
              <Trash2 size={16} />
            </button>
            <div 
              className="note-resize-indicator"
              style={{ 
                position: 'absolute', 
                bottom: '-8px', 
                right: '-8px',
                width: '24px',
                height: '24px',
                pointerEvents: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#B593C2',
                borderRadius: '50%',
                border: '2px solid white',
                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'
              }}
            >
              <Maximize2 size={14} color="white" style={{ transform: 'scaleX(-1)' }} />
            </div>
          </>
        )}
      </Resizable>
    );
  };

  // ---- Pencil canvas helper ----
  // Returns mouseDown handler for a page canvas. Draws imperatively; only calls setState on mouseUp.
  const makePencilHandlers = useCallback((pi) => {
    return {
      onMouseDown(e) {
        if (!isPencilMode) return
        const canvas = drawCanvasRefs.current[pi]
        if (!canvas) return
        e.preventDefault(); e.stopPropagation()
        drawingActiveRef.current = true
        const ctx = canvas.getContext('2d')
        const rect = canvas.getBoundingClientRect()
        const color = pencilColorRef.current
        const thickness = pencilThicknessRef.current

        // Catmull-Rom smooth drawing — keep last two points
        let pts = []
        const getPos = (ev) => ({ x: ev.clientX - rect.left, y: ev.clientY - rect.top })
        const startPt = getPos(e)
        pts.push(startPt, startPt)

        // Draw a small dot for single click
        ctx.save()
        ctx.beginPath()
        ctx.arc(startPt.x, startPt.y, thickness / 2, 0, Math.PI * 2)
        ctx.fillStyle = color
        ctx.fill()
        ctx.restore()

        const drawSegment = (p0, p1, p2, p3) => {
          // Catmull-Rom to Bezier conversion
          const cp1x = p1.x + (p2.x - p0.x) / 6
          const cp1y = p1.y + (p2.y - p0.y) / 6
          const cp2x = p2.x - (p3.x - p1.x) / 6
          const cp2y = p2.y - (p3.y - p1.y) / 6
          ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y)
        }

        const applyPencilTexture = (ctx, thickness, color) => {
          // Pencil grain: random offset strokes at low opacity
          const grains = Math.max(2, Math.floor(thickness * 1.2))
          for (let i = 0; i < grains; i++) {
            const jx = (Math.random() - 0.5) * thickness * 0.7
            const jy = (Math.random() - 0.5) * thickness * 0.7
            ctx.save()
            ctx.translate(jx, jy)
            ctx.globalAlpha = 0.07 + Math.random() * 0.10
            ctx.stroke()
            ctx.restore()
          }
        }

        ctx.save()
        ctx.strokeStyle = color
        ctx.lineWidth = thickness
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        ctx.globalAlpha = 0.88
        ctx.beginPath()
        ctx.moveTo(startPt.x, startPt.y)

        const onMove = (mv) => {
          if (!drawingActiveRef.current) return
          const pt = getPos(mv)
          pts.push(pt)
          if (pts.length >= 4) {
            const [p0, p1, p2, p3] = pts.slice(-4)
            drawSegment(p0, p1, p2, p3)
            ctx.stroke()
            applyPencilTexture(ctx, thickness, color)
            ctx.beginPath()
            ctx.moveTo(p2.x, p2.y)
          } else if (pts.length === 3) {
            const [p0, p1, p2] = pts
            ctx.lineTo(p2.x, p2.y)
            ctx.stroke()
            applyPencilTexture(ctx, thickness, color)
            ctx.beginPath()
            ctx.moveTo(p2.x, p2.y)
          }
        }

        const onUp = () => {
          ctx.restore()
          drawingActiveRef.current = false
          // Bake the canvas to a dataURL and store as a finished stroke
          const dataUrl = canvas.toDataURL()
          setDrawingStrokes(prev => [...prev, { id: Date.now(), pageIndex: pi, dataUrl }])
          // Clear the live canvas (the stroke is now in the stored image layer)
          ctx.clearRect(0, 0, canvas.width, canvas.height)
          document.removeEventListener('mousemove', onMove)
          document.removeEventListener('mouseup', onUp)
        }

        document.addEventListener('mousemove', onMove)
        document.addEventListener('mouseup', onUp)
      }
    }
  }, [isPencilMode])

  // ---- สร้าง element list ที่ normalize แล้ว + จัดกลุ่มตาม page ----
  const allSortedElements = useMemo(() => {
    const raw = [
      ...textBoxes.map(tb => normPaged(tb)),
      ...shapes.map(s => ({ ...normPaged(s), elementType: 'shape' })),
      ...images.map(i => ({ ...normPaged(i), elementType: 'image' })),
      ...stickers.map(s => ({ ...normPaged(s), elementType: 'sticker' }))
    ]
    return raw.sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))
  }, [textBoxes, shapes, images, stickers])

  const totalPages = useMemo(() => {
    const maxPage = allSortedElements.reduce((m, el) => Math.max(m, el.pageIndex ?? 0), 0)
    // ต้อง render อย่างน้อย 2 หน้าของ spread ปัจจุบัน + ทุกหน้าที่มี element
    const minFromSpread = (spreadIndex + 1) * 2
    return Math.max(minFromSpread, maxPage + 1)
  }, [allSortedElements, spreadIndex])

  return (
    <div className={`note-page ${isBookOpen ? 'note-page--book-open' : 'note-page--book-closed'}`}>
      {linkCopied && (
        <div className="note-toast">Link copied to clipboard!</div>
      )}

      {showExportModal && (() => {
        const numSpreads = Math.ceil(totalPages / 2)
        const allSelected = exportSpreads === null
        return (
          <div className="note-export-overlay" role="dialog" aria-modal="true" aria-label="Export PDF" onClick={() => setShowExportModal(false)}>
            <div className="note-export-modal" onClick={(e) => e.stopPropagation()}>
              <div className="note-export-modal-header">
                <span>Export PDF</span>
                <button className="note-export-modal-close" onClick={() => setShowExportModal(false)} aria-label="Close">✕</button>
              </div>

              <div className="note-export-modal-body">
                <p className="note-export-modal-label">Pages to export</p>

                <label className="note-export-radio">
                  <input type="radio" name="export-scope" checked={allSelected} onChange={() => setExportSpreads(null)} />
                  All pages
                </label>

                <label className="note-export-radio">
                  <input
                    type="radio"
                    name="export-scope"
                    checked={!allSelected}
                    onChange={() => setExportSpreads(new Set(Array.from({ length: numSpreads }, (_, i) => i)))}
                  />
                  Select spreads
                </label>

                {!allSelected && (
                  <div className="note-export-spread-list">
                    {Array.from({ length: numSpreads }, (_, si) => (
                      <label key={si} className="note-export-spread-item">
                        <input
                          type="checkbox"
                          checked={exportSpreads.has(si)}
                          onChange={(e) => {
                            const next = new Set(exportSpreads)
                            if (e.target.checked) next.add(si)
                            else next.delete(si)
                            setExportSpreads(next)
                          }}
                        />
                        <span className="note-export-spread-label">
                          Spread {si + 1}
                          <span className="note-export-spread-pages">p.{si * 2 + 1} & p.{si * 2 + 2}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div className="note-export-modal-footer">
                <button className="note-export-btn-cancel" onClick={() => setShowExportModal(false)}>Cancel</button>
                <button
                  className="note-export-btn-confirm"
                  disabled={isExportingPdf || (!allSelected && exportSpreads.size === 0)}
                  onClick={() => {
                    const arr = allSelected ? null : [...exportSpreads].sort((a, b) => a - b)
                    downloadAsPDF(arr)
                  }}
                >
                  <Download size={14} />
                  {isExportingPdf ? 'Exporting…' : 'Export PDF'}
                </button>
              </div>
            </div>
          </div>
        )
      })()}
      {loading && (
        <div className="note-loading" aria-hidden="true">
          กำลังโหลด...
        </div>
      )}
      {!isBookOpen && (
        <div className="note-book-cover-overlay">
          <div className="note-book-cover-settings">
            <h3>Cover Settings</h3>
            <label>
              Title
              <input
                type="text"
                value={coverTitle}
                onChange={(e) => setCoverTitle(e.target.value)}
                placeholder="Book title"
              />
            </label>
            <label>
              Color
              <input
                type="color"
                value={coverColor}
                onChange={(e) => setCoverColor(e.target.value)}
              />
            </label>
            <button type="button" onClick={() => coverImageInputRef.current?.click()}>
              Upload Cover Image
            </button>
            <input
              ref={coverImageInputRef}
              type="file"
              accept="image/*"
              onChange={handleCoverImageUpload}
              style={{ display: 'none' }}
            />
          </div>
          <button
            type="button"
            className="note-book-cover-card"
            onClick={() => setIsBookOpen(true)}
            style={{
              backgroundColor: coverImage ? undefined : coverColor,
              backgroundImage: coverImage ? `url(${coverImage})` : 'none'
            }}
          >
            <div className="note-book-cover-card-overlay" />
            <h2
              className="note-book-cover-title"
              style={{ left: `${coverTitlePos.x}%`, top: `${coverTitlePos.y}%` }}
              onMouseDown={handleCoverTitleMouseDown}
            >
              {coverTitle || 'My Journal'}
            </h2>
            <p>Click to open</p>
          </button>
        </div>
      )}
      <div className="note-navbar">
        <button
          type="button"
          className="note-nav-btn"
          data-tooltip="Back"
          aria-label="Back to calendar"
          onClick={() => {
            navigate('/calendar');
          }}
        >
          <ChevronLeft size={24} />
        </button>
        <button
          type="button"
          className="note-nav-btn"
          onClick={() => setIsBookOpen((prev) => !prev)}
        >
          {isBookOpen ? 'Close Book' : 'Open Book'}
        </button>

        {/* ชื่อ Note + Tag ใน navbar */}
        <div className="note-nav-meta">
          {isEditingTitle ? (
            <input
              className="note-title-input note-title-input--nav"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => {
                setIsEditingTitle(false)
                setTimeout(() => saveToHistory(), 50)
              }}
              autoFocus
            />
          ) : (
            <span className="note-title--nav" onClick={() => setIsEditingTitle(true)}>
              {title || 'Untitled'}
            </span>
          )}
          {showTagSelector ? (
            <div className="note-tag-selector note-tag-selector--nav" onClick={(e) => e.stopPropagation()}>
              <div className="tag-selector-header">
                <button
                  type="button"
                  className="back-btn"
                  aria-label="Close tag selector"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowTagSelector(false);
                    setIsCreatingNewTag(false);
                  }}
                >←</button>
                <h4>Select Tag</h4>
              </div>
              {!isCreatingNewTag ? (
                <>
                  <div className="tag-list">
                    {getTags().map(tag => (
                      <div
                        key={tag.id}
                        className="tag-option"
                        onClick={(e) => {
                          e.stopPropagation();
                          selectTag(tag);
                        }}
                        style={{ backgroundColor: tag.color }}
                      >
                        {tag.name}
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="create-tag-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsCreatingNewTag(true);
                    }}
                  >
                    + Create New Tag
                  </button>
                </>
              ) : (
                <div className="create-tag-form">
                  <input
                    type="text"
                    placeholder="Tag name"
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newTagName.trim()) {
                        createNewTag();
                      }
                    }}
                    style={{ marginBottom: '0.5rem', padding: '0.5rem', border: '1px solid #e0e0e0', borderRadius: '4px' }}
                    autoFocus
                  />
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <input
                      type="color"
                      value={newTagColor}
                      onChange={(e) => setNewTagColor(e.target.value)}
                      style={{ width: '40px', height: '40px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: '0.85rem', color: '#666' }}>Color</span>
                  </div>
                  <button
                    type="button"
                    className="save-tag-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      createNewTag();
                    }}
                    disabled={!newTagName.trim()}
                  >
                    Save
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="note-tag-with-date">
              <div
                className="note-tag"
                style={{ backgroundColor: tagColor }}
                role="button"
                aria-label="Select or create tag"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setShowTagSelector(true);
                  }
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setShowTagSelector(true);
                }}
              >
                {tagName}
              </div>
              {latestNote?.date && (
                <span className="note-date-display">
                  {new Date(latestNote.date).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    year: '2-digit'
                  })}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="note-nav-controls">
          <span className="note-nav-tooltip-host" data-tooltip="Undo">
            <button
              type="button"
              className="note-nav-btn"
              onClick={handleUndo}
              disabled={historyIndex <= 0}
              aria-label="Undo"
            >
              <Undo2 size={20} />
            </button>
          </span>
          <span className="note-nav-tooltip-host" data-tooltip="Redo">
            <button
              type="button"
              className="note-nav-btn"
              onClick={handleRedo}
              disabled={historyIndex >= history.length - 1}
              aria-label="Redo"
            >
              <Redo2 size={20} />
            </button>
          </span>

          <div className="note-nav-divider" />

          <button
            type="button"
            className={`note-nav-btn ${isAddingTextBox ? 'active' : ''}`}
            data-tooltip="Text"
            aria-label="Add text box"
            onClick={() => {
              const newState = !isAddingTextBox;
              setIsAddingTextBox(newState);
              // Close all menus when toggling text box mode
              if (newState) {
                setShowShapesMenu(false);
                setShowStickersMenu(false);
                setShowPostItMenu(false);
                setPendingPostItColor(null);
                setShowShareMenu(false);
                setShowColorPicker(false);
              }
            }}
          >
            <Type size={20} />
          </button>

          <div className="note-nav-dropdown">
            <button
              type="button"
              className="note-nav-btn"
              data-tooltip="Shapes"
              aria-label="Add shape"
              onClick={() => {
                const newState = !showShapesMenu;
                setShowShapesMenu(newState);
                // Close other menus when opening this menu
                if (newState) {
                  setShowStickersMenu(false);
                  setShowPostItMenu(false);
                  setShowShareMenu(false);
                  setShowColorPicker(false);
                }
              }}
            >
              <Square size={20} />
            </button>
            {showShapesMenu && (
              <div className="note-dropdown-menu">
                <button
                  type="button"
                  onClick={(e) => {
                    const clickX = e.clientX;
                    const clickY = e.clientY;
                    addShape('rectangle', clickX, clickY);
                  }}
                ><Square size={18} /> Rectangle</button>
                <button
                  type="button"
                  onClick={(e) => {
                    const clickX = e.clientX;
                    const clickY = e.clientY;
                    addShape('circle', clickX, clickY);
                  }}
                ><Circle size={18} /> Circle</button>
                <button
                  type="button"
                  onClick={(e) => {
                    const clickX = e.clientX;
                    const clickY = e.clientY;
                    addShape('triangle', clickX, clickY);
                  }}
                ><Triangle size={18} /> Triangle</button>
                <button
                  type="button"
                  onClick={(e) => {
                    const clickX = e.clientX;
                    const clickY = e.clientY;
                    addShape('star', clickX, clickY);
                  }}
                ><Star size={18} /> Star</button>
                <button
                  type="button"
                  onClick={(e) => {
                    const clickX = e.clientX;
                    const clickY = e.clientY;
                    addShape('line', clickX, clickY);
                  }}
                ><Minus size={18} /> Line</button>
              </div>
            )}
          </div>

          <div className="note-nav-dropdown">
            <button
              type="button"
              className="note-nav-btn"
              data-tooltip="Stickers"
              aria-label="Add sticker"
              onClick={() => {
                const newState = !showStickersMenu;
                setShowStickersMenu(newState);
                // Close other menus when opening this menu
                if (newState) {
                  setShowShapesMenu(false);
                  setShowPostItMenu(false);
                  setShowShareMenu(false);
                  setShowColorPicker(false);
                }
              }}
            >
              <Sticker size={20} />
            </button>
            {showStickersMenu && (
              <div className="note-dropdown-menu note-stickers-menu-wrapper">
                <div className="note-sticker-collection-tabs" role="tablist">
                  {STICKER_COLLECTIONS.map((col, idx) => (
                    <button
                      key={col.id}
                      type="button"
                      role="tab"
                      aria-selected={activeStickerCollectionIndex === idx}
                      className={`note-sticker-collection-tab ${activeStickerCollectionIndex === idx ? 'active' : ''}`}
                      onClick={() => setActiveStickerCollectionIndex(idx)}
                    >
                      {col.label}
                    </button>
                  ))}
                </div>
                <div className="note-stickers-menu">
                  {STICKER_COLLECTIONS[activeStickerCollectionIndex].items.map((stickerSrc, index) => (
                    <button
                      key={`${activeStickerCollectionIndex}-${index}`}
                      type="button"
                      onClick={(e) => {
                        const clickX = e.clientX;
                        const clickY = e.clientY;
                        addSticker(stickerSrc, clickX, clickY);
                      }}
                      className="sticker-btn"
                    >
                      <img
                        src={stickerSrc}
                        alt={`${STICKER_COLLECTIONS[activeStickerCollectionIndex].label} ${index + 1}`}
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="note-nav-dropdown">
            <button
              type="button"
              className={`note-nav-btn ${pendingPostItColor ? 'active' : ''}`}
              data-tooltip="Post-it"
              aria-label="Post-it notes"
              onClick={() => {
                const newState = !showPostItMenu
                setShowPostItMenu(newState)
                if (newState) {
                  setShowShapesMenu(false)
                  setShowStickersMenu(false)
                  setShowShareMenu(false)
                  setShowColorPicker(false)
                  setIsAddingTextBox(false)
                }
              }}
            >
              <StickyNote size={20} />
            </button>
            {showPostItMenu && (
              <div className="note-dropdown-menu note-postit-menu" onMouseDown={(e) => e.stopPropagation()}>
                <div className="note-postit-menu-title">Post-it</div>
                <div className="note-postit-swatches">
                  {POSTIT_PALETTE.map((sw) => (
                    <button
                      key={sw.color}
                      type="button"
                      className="note-postit-swatch"
                      aria-label={sw.label}
                      style={{ backgroundColor: sw.color }}
                      onClick={(ev) => {
                        ev.stopPropagation()
                        setPendingPostItColor(sw.color)
                        setShowPostItMenu(false)
                        setIsAddingTextBox(false)
                        setShowShapesMenu(false)
                        setShowStickersMenu(false)
                      }}
                    />
                  ))}
                </div>
                <p className="note-postit-hint">Click on the page to place</p>
              </div>
            )}
          </div>

          <button
            type="button"
            className="note-nav-btn"
            data-tooltip="Image"
            aria-label="Add image"
            onClick={() => {
              // Close all menus when clicking image button
              setShowShapesMenu(false);
              setShowStickersMenu(false);
              setShowPostItMenu(false);
              setPendingPostItColor(null);
              setShowShareMenu(false);
              setShowColorPicker(false);
              fileInputRef.current?.click();
            }}
          >
            <ImageIcon size={20} />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            style={{ display: 'none' }}
          />

          {/* ---- Pencil tool ---- */}
          <div className="note-nav-dropdown" ref={pencilMenuRef}>
            <button
              type="button"
              className={`note-nav-btn${isPencilMode ? ' active' : ''}`}
              data-tooltip="Pencil"
              aria-label="Pencil draw"
              style={isPencilMode ? { color: pencilColor, background: 'rgba(0,0,0,0.08)' } : {}}
              onClick={() => {
                const next = !isPencilMode
                setIsPencilMode(next)
                setShowPencilMenu(next)
                if (next) {
                  setIsAddingTextBox(false); setShowShapesMenu(false)
                  setShowStickersMenu(false); setShowPostItMenu(false)
                  setShowShareMenu(false); setShowColorPicker(false)
                  setPendingPostItColor(null)
                }
              }}
            >
              <Pencil size={20} />
            </button>
            {showPencilMenu && (
              <div
                className="note-dropdown-menu"
                style={{ width: 220, padding: '12px 14px' }}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <div style={{ fontWeight: 600, fontSize: 12, color: '#555', marginBottom: 8 }}>Pencil</div>

                {/* Thickness */}
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>
                    Thickness: <strong>{pencilThickness}px</strong>
                  </div>
                  <input
                    type="range" min={1} max={24} value={pencilThickness}
                    onChange={(e) => setPencilThickness(Number(e.target.value))}
                    style={{ width: '100%', accentColor: pencilColor }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#aaa' }}>
                    <span>Thin</span><span>Thick</span>
                  </div>
                </div>

                {/* Preview */}
                <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    flex: 1, height: pencilThickness + 8, background: pencilColor,
                    borderRadius: pencilThickness / 2 + 4, border: '1px solid rgba(0,0,0,0.1)'
                  }} />
                </div>

                {/* Color presets */}
                <div style={{ fontSize: 11, color: '#888', marginBottom: 6 }}>Color</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 5, marginBottom: 8 }}>
                  {PENCIL_PRESETS.map(c => (
                    <button
                      key={c} type="button"
                      onClick={() => setPencilColor(c)}
                      style={{
                        width: 26, height: 26, borderRadius: '50%',
                        background: c,
                        border: pencilColor === c ? '2.5px solid #333' : '1.5px solid rgba(0,0,0,0.15)',
                        cursor: 'pointer', boxShadow: pencilColor === c ? '0 0 0 2px white inset' : 'none',
                        transition: 'transform 0.1s',
                      }}
                      aria-label={`Color ${c}`}
                    />
                  ))}
                </div>

                {/* Color wheel */}
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, color: '#555' }}>
                  <input
                    type="color" value={pencilColor}
                    onChange={(e) => setPencilColor(e.target.value)}
                    style={{ width: 28, height: 28, border: 'none', borderRadius: 6, cursor: 'pointer', padding: 0 }}
                  />
                  Custom color
                </label>

                <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setDrawingStrokes([])}
                    style={{
                      flex: 1, padding: '5px 0', border: '1px solid #e0e0e0', borderRadius: 6,
                      background: '#fff', fontSize: 12, cursor: 'pointer', color: '#c00'
                    }}
                  >Clear all</button>
                  <button
                    type="button"
                    onClick={() => { setIsPencilMode(false); setShowPencilMenu(false) }}
                    style={{
                      flex: 1, padding: '5px 0', border: '1px solid #e0e0e0', borderRadius: 6,
                      background: '#222', fontSize: 12, cursor: 'pointer', color: '#fff'
                    }}
                  >Done</button>
                </div>
              </div>
            )}
          </div>

          {/* ---- Page BG image upload ---- */}
          <button
            type="button"
            className="note-nav-btn"
            data-tooltip="Page Background"
            aria-label="Change page background"
            onClick={() => pageBgInputRef.current?.click()}
          >
            <ImagePlus size={20} />
          </button>
          <input
            ref={pageBgInputRef}
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (!file) return
              const reader = new FileReader()
              reader.onload = (ev) => setPageBgImage(String(ev.target?.result || ''))
              reader.readAsDataURL(file)
              e.target.value = ''
            }}
            style={{ display: 'none' }}
          />

          {selectedItem?.type === 'shape' && (
            <>
              <div className="note-nav-divider" />
              <div className="note-nav-dropdown">
                <button
                  type="button"
                  className="note-nav-btn"
                  data-tooltip="Color"
                  aria-label="Customize shape color"
                  onClick={() => {
                    const newState = !showColorPicker;
                    setShowColorPicker(newState);
                    // Close other menus when opening color picker
                    if (newState) {
                      setShowShareMenu(false);
                      setShowShapesMenu(false);
                      setShowStickersMenu(false);
                      setShowPostItMenu(false);
                    }
                  }}
                >
                  <Palette size={20} />
                </button>
                {showColorPicker && getSelectedShape() && (
                  <div className="note-dropdown-menu note-color-menu">
                    <div className="color-control">
                      <label>Fill Color</label>
                      <input
                        type="color"
                        value={getSelectedShape().fillColor === 'transparent' ? '#FFFFFF' : getSelectedShape().fillColor}
                        onChange={(e) => updateShapeColor(selectedItem.id, e.target.value, getSelectedShape().strokeColor)}
                      />
                      <button
                        type="button"
                        className="transparent-btn"
                        aria-label="No fill"
                        onClick={() => updateShapeColor(selectedItem.id, 'transparent', getSelectedShape().strokeColor)}
                      >
                        None
                      </button>
                    </div>
                    <div className="color-control">
                      <label>Stroke Color</label>
                      <input
                        type="color"
                        value={getSelectedShape().strokeColor}
                        onChange={(e) => updateShapeColor(selectedItem.id, getSelectedShape().fillColor, e.target.value)}
                      />
                    </div>
                    <div className="color-control">
                      <label>Stroke Width</label>
                      <input
                        type="number"
                        min="0"
                        max="20"
                        value={getSelectedShape().strokeWidth}
                        onChange={(e) => updateShapeStroke(selectedItem.id, Number(e.target.value))}
                        style={{ width: '60px', padding: '0.25rem', border: '1px solid #e0e0e0', borderRadius: '4px' }}
                      />
                      <span style={{ fontSize: '0.85rem', color: '#666' }}>px</span>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          <div className="note-nav-divider" />

          <div className="note-nav-dropdown">
            <button
              type="button"
              className="note-nav-btn"
              data-tooltip="Share"
              aria-label="Share"
              onClick={() => {
                const newState = !showShareMenu;
                setShowShareMenu(newState);
                // Close other menus when opening share menu
                if (newState) {
                  setShowColorPicker(false);
                  setShowShapesMenu(false);
                  setShowStickersMenu(false);
                  setShowPostItMenu(false);
                }
              }}
            >
              <Share2 size={20} />
            </button>
            {showShareMenu && (
              <div className="note-dropdown-menu">
                <button type="button" onClick={shareAsLink}><Copy size={16} /> Copy Link</button>
                <button type="button" onClick={() => { setShowShareMenu(false); setExportSpreads(null); setShowExportModal(true) }} disabled={isExportingPdf}>
                  <Download size={16} /> {isExportingPdf ? 'Exporting…' : 'Download PDF'}
                </button>
              </div>
            )}
          </div>

        </div>
      </div>

      <div 
        className="note-canvas"
        ref={canvasRef}
        onContextMenu={handleCanvasContextMenu}
        onClick={(e) => {
          const onBg = e.target === canvasRef.current ||
            e.target.classList?.contains('note-content') ||
            e.target.classList?.contains('note-page-sheet') ||
            e.target.classList?.contains('note-book-viewport')

          // Close all menus and tag selector when clicking on canvas
          if (onBg) {
            setShowTagSelector(false);
            setIsCreatingNewTag(false);
            setShowShapesMenu(false);
            setShowStickersMenu(false);
            setShowPostItMenu(false);
            setShowShareMenu(false);
            setShowColorPicker(false);
            setShowPencilMenu(false);
            handleSelectItem(null);
          }
          handleCanvasClick(e);
        }}
        onMouseDown={(e) => {
          // Deselect when clicking directly on canvas
          if (e.target === canvasRef.current || e.target.classList.contains('note-content')) {
            handleSelectItem(null);
          }
        }}
        style={{ cursor: isPencilMode ? 'crosshair' : (isAddingTextBox || pendingPostItColor ? 'crosshair' : 'default') }}
      >
        {isBookOpen ? (
          /* Book mode: viewport wrapper (overflow:visible) ➜ clip-wrapper (overflow:hidden) ➜ pages */
          <div className="note-book-viewport">
            {/* Arrows วางนอก clip area */}
            <button type="button" className="note-book-arrow note-book-arrow--left" onClick={goToPrevSpread} aria-label="Previous spread">
              ‹
            </button>
            <button type="button" className="note-book-arrow note-book-arrow--right" onClick={goToNextSpread} aria-label="Next spread">
              ›
            </button>

            {/* Pagination วางใต้ spread */}
            <div className="note-book-pagination">
              <span className="page-num-label">
                p.{spreadIndex * 2 + 1} – p.{spreadIndex * 2 + 2}
              </span>
            </div>

            {/* Clip container: clamp the sliding pages only */}
            <div className={`note-book-pages-clip${isDragging ? ' note-book-pages-clip--dragging' : ''}${turningPage ? ' note-book-pages-clip--turning' : ''}`}>
            <div
              className="note-content note-content--pages"
              style={{ transform: `translateX(-${spreadIndex * PAGE_W * 2}px)` }}
            >
              {Array.from({ length: totalPages }, (_, pi) => {
                return (<div key={pi} className="note-page-sheet" style={pageBgImage ? {
                  backgroundImage: `url(${pageBgImage})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                } : {}}>
                  {/* Finished strokes image layer */}
                  {drawingStrokes.filter(s => s.pageIndex === pi).map(stroke => (
                    <img
                      key={stroke.id}
                      src={stroke.dataUrl}
                      alt=""
                      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 8999 }}
                    />
                  ))}
                  {/* Live drawing canvas (active stroke only, never causes React re-render) */}
                  <canvas
                    ref={(el) => { if (el) { drawCanvasRefs.current[pi] = el; el.width = PAGE_W; el.height = PAGE_H } else { delete drawCanvasRefs.current[pi] } }}
                    width={PAGE_W}
                    height={PAGE_H}
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: isPencilMode ? 'all' : 'none', zIndex: 9000, cursor: isPencilMode ? 'crosshair' : 'default', touchAction: 'none' }}
                    {...makePencilHandlers(pi)}
                  />
                  {allSortedElements.filter(el => (el.pageIndex ?? 0) === pi).map((element) => {
              if (element.elementType === 'shape') {
                const shape = element;
                const isSelected = selectedItem?.type === 'shape' && selectedItem.id === shape.id;
                return renderShape(shape, isSelected);
              } else if (element.elementType === 'image') {
                const image = element;
                const isSelected = selectedItem?.type === 'image' && selectedItem.id === image.id;
                return (
                  <Resizable
                    key={image.id}
                    size={{ width: image.width, height: image.height }}
                    onResizeStart={() => {
                      setIsResizing(true);
                      setIsDragging(false);
                    }}
                    onResizeStop={(e, direction, ref, d) => {
                      setImages(prevImages => prevImages.map(img => {
                        if (img.id !== image.id) return img
                        const n = normPaged(img)
                        const nw = Math.max(10, n.width + d.width)
                        const nh = Math.max(10, n.height + d.height)
                        const c = clampInPage(n, n.x, n.y, nw, nh)
                        return { ...n, x: c.x, y: c.y, width: nw, height: nh }
                      }));
                      setIsResizing(false);
                      setTimeout(() => saveToHistory(), 50)
                    }}
                    className={`note-image-wrapper ${isSelected ? 'selected' : ''}`}
                    style={{
                      position: 'absolute',
                      left: image.x,
                      top: image.y,
                      zIndex: image.zIndex || 1,
                      transform: `rotate(${image.rotation ?? 0}deg)`,
                      transformOrigin: 'center center'
                    }}
                    enable={{
                      top: true,
                      right: true,
                      bottom: true,
                      left: true,
                      topRight: true,
                      bottomRight: true,
                      bottomLeft: true,
                      topLeft: true
                    }}
                    handleStyles={{
                      top: { cursor: 'n-resize' },
                      right: { cursor: 'e-resize' },
                      bottom: { cursor: 's-resize' },
                      left: { cursor: 'w-resize' },
                      topRight: { cursor: 'ne-resize' },
                      bottomRight: { cursor: 'se-resize' },
                      bottomLeft: { cursor: 'sw-resize' },
                      topLeft: { cursor: 'nw-resize' }
                    }}
                  >
                    <div
                      className="note-image-container"
                      onContextMenu={(e) => {
                        // Stop dragging immediately when right-clicking
                        stopAllDragging();
                        handleContextMenu(e, { type: 'image', id: image.id });
                      }}
                      onMouseDown={(e) => {
                        // Don't drag if context menu is open
                        if (isContextMenuOpen) {
                          return;
                        }
                        
                        // Stop any previous dragging first
                        stopAllDragging();
                        
                        // Don't drag if clicking on resize handle - let Resizable handle it
                        if (e.target.closest('.react-resizable-handle')) {
                          handleSelectItem({ type: 'image', id: image.id });
                          return;
                        }
                        
                        // Don't drag if clicking on delete button
                        if (e.target.closest('.note-delete-btn')) {
                          return;
                        }
                        if (e.target.closest('.note-rotate-handle')) {
                          return;
                        }
                        
                        e.stopPropagation();
                        handleSelectItem({ type: 'image', id: image.id });
                        
                        const startX = e.clientX;
                        const startY = e.clientY;
                        const startEl = { ...image }; const capBookOpen = isBookOpen; const capSpreadIdx = spreadIndex;
                        let hasMoved = false;

                        const handleMouseMove = (moveEvent) => {
                          if (isContextMenuOpen) { stopAllDragging(); return; }
                          if (!hasMoved) { setIsDragging(true); hasMoved = true; skipPersistDuringCanvasDragRef.current = true; }
                          moveEvent.preventDefault();
                          const deltaX = moveEvent.clientX - startX;
                          const deltaY = moveEvent.clientY - startY;
                          setImages(prevImages => prevImages.map(img => {
                            if (img.id !== image.id) return img
                            const pos = dragWithPageTransfer(startEl, deltaX, deltaY, capBookOpen, capSpreadIdx)
                            return { ...img, pageIndex: pos.pageIndex, x: pos.x, y: pos.y }
                          }));
                        };

                        const handleMouseUp = () => {
                          setIsDragging(false);
                          if (activeDragHandlersRef.current.mouseMove === handleMouseMove) {
                            document.removeEventListener('mousemove', handleMouseMove);
                            activeDragHandlersRef.current.mouseMove = null;
                          }
                          if (activeDragHandlersRef.current.mouseUp === handleMouseUp) {
                            document.removeEventListener('mouseup', handleMouseUp);
                            activeDragHandlersRef.current.mouseUp = null;
                          }
                          if (hasMoved) {
                            skipPersistDuringCanvasDragRef.current = false
                            requestAnimationFrame(() => flushPersistFromSnapshot())
                            setTimeout(() => saveToHistory(), 50)
                          }
                        };

                        // Store handlers in ref
                        activeDragHandlersRef.current.mouseMove = handleMouseMove;
                        activeDragHandlersRef.current.mouseUp = handleMouseUp;
                        
                        document.addEventListener('mousemove', handleMouseMove);
                        document.addEventListener('mouseup', handleMouseUp);
                      }}
                    >
                      <img
                        src={image.src}
                        alt="Uploaded"
                        className="note-image"
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          pointerEvents: 'none'
                        }}
                      />
                    </div>
                    {isSelected && (
                      <>
                        <button
                          type="button"
                          className="note-rotate-handle"
                          aria-label="Rotate"
                          onMouseDown={(e) => startRotateDrag(
                            e,
                            { x: image.x, y: image.y, w: image.width, h: image.height },
                            image.rotation,
                            (deg) => setImages((prev) => prev.map((img) => (img.id === image.id ? { ...img, rotation: deg } : img)))
                          )}
                        >
                          <RotateCw size={14} />
                        </button>
                        <button
                          className="note-delete-btn"
                          onClick={() => deleteImage(image.id)}
                          style={{ top: '-12px', left: '-12px' }}
                        >
                          <Trash2 size={16} />
                        </button>
                        <div 
                          className="note-resize-indicator"
                          style={{ 
                            position: 'absolute', 
                            bottom: '-8px', 
                            right: '-8px',
                            width: '24px',
                            height: '24px',
                            pointerEvents: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: '#B593C2',
                            borderRadius: '50%',
                            border: '2px solid white',
                            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'
                          }}
                        >
                          <Maximize2 size={14} color="white" style={{ transform: 'scaleX(-1)' }} />
                        </div>
                      </>
                    )}
                  </Resizable>
                );
              } else if (element.elementType === 'sticker') {
                const sticker = element;
                const isSelected = selectedItem?.type === 'sticker' && selectedItem.id === sticker.id;
                const sid = sticker.id
                return (
                  <div
                    key={sid}
                    className="note-sticker-host"
                    style={{
                      position: 'absolute',
                      left: sticker.x,
                      top: sticker.y,
                      zIndex: sticker.zIndex || 1,
                      width: sticker.width,
                      height: sticker.height,
                      willChange: 'transform',
                      transform: `rotate(${sticker.rotation ?? 0}deg)`,
                      transformOrigin: 'center center'
                    }}
                    ref={(el) => {
                      if (el) stickerHostElementsRef.current.set(sid, el)
                      else stickerHostElementsRef.current.delete(sid)
                    }}
                  >
                  <Resizable
                    size={{ width: sticker.width, height: sticker.height }}
                    onResizeStart={() => {
                      setIsResizing(true);
                      setIsDragging(false);
                    }}
                    onResizeStop={(e, direction, ref, d) => {
                      setStickers(prevStickers => prevStickers.map(s => {
                        if (s.id !== sticker.id) return s
                        const n = normPaged(s)
                        const nw = Math.max(10, n.width + d.width)
                        const nh = Math.max(10, n.height + d.height)
                        const c = clampInPage(n, n.x, n.y, nw, nh)
                        return { ...n, x: c.x, y: c.y, width: nw, height: nh }
                      }));
                      setIsResizing(false);
                      setTimeout(() => saveToHistory(), 50)
                    }}
                    className={`note-sticker-wrapper ${isSelected ? 'selected' : ''}`}
                    style={{
                      position: 'relative',
                      left: 0,
                      top: 0
                    }}
                    enable={{
                      top: true,
                      right: true,
                      bottom: true,
                      left: true,
                      topRight: true,
                      bottomRight: true,
                      bottomLeft: true,
                      topLeft: true
                    }}
                    handleStyles={{
                      top: { cursor: 'n-resize' },
                      right: { cursor: 'e-resize' },
                      bottom: { cursor: 's-resize' },
                      left: { cursor: 'w-resize' },
                      topRight: { cursor: 'ne-resize' },
                      bottomRight: { cursor: 'se-resize' },
                      bottomLeft: { cursor: 'sw-resize' },
                      topLeft: { cursor: 'nw-resize' }
                    }}
                  >
                    <div
                      className="note-sticker-container"
                      onContextMenu={(e) => {
                        // Stop dragging immediately when right-clicking
                        stopAllDragging();
                        handleContextMenu(e, { type: 'sticker', id: sticker.id });
                      }}
                      onMouseDown={(e) => {
                        // Don't drag if context menu is open
                        if (isContextMenuOpen) {
                          return;
                        }
                        
                        // Stop any previous dragging first
                        stopAllDragging();
                        
                        // Don't drag if clicking on resize handle - let Resizable handle it
                        if (e.target.closest('.react-resizable-handle')) {
                          handleSelectItem({ type: 'sticker', id: sticker.id });
                          return;
                        }
                        
                        // Don't drag if clicking on delete button
                        if (e.target.closest('.note-delete-btn')) {
                          return;
                        }
                        if (e.target.closest('.note-rotate-handle')) {
                          return;
                        }
                        
                        e.stopPropagation();
                        e.preventDefault();
                        handleSelectItem({ type: 'sticker', id: sticker.id });
                        
                        const startX = e.clientX;
                        const startY = e.clientY;
                        const startEl = { ...sticker }; const capBookOpen = isBookOpen; const capSpreadIdx = spreadIndex;
                        const dragRot = sticker.rotation ?? 0;
                        let hasMoved = false;
                        const dragDelta = { dx: 0, dy: 0 };

                        stickerDragCleanupRef.current = () => {
                          const host = stickerHostElementsRef.current.get(sid)
                          if (host) host.style.transform = `rotate(${dragRot}deg)`
                        }

                        const handleStickerDragMove = (moveEvent) => {
                          if (isContextMenuOpen) {
                            stopAllDragging();
                            return;
                          }
                          if (!hasMoved) {
                            hasMoved = true;
                            skipPersistDuringCanvasDragRef.current = true;
                          }
                          moveEvent.preventDefault();
                          dragDelta.dx = moveEvent.clientX - startX;
                          dragDelta.dy = moveEvent.clientY - startY;
                          const host = stickerHostElementsRef.current.get(sid)
                          if (host) {
                            host.style.transform = `translate(${dragDelta.dx}px, ${dragDelta.dy}px) rotate(${dragRot}deg)`
                          }
                        };

                        const handleStickerDragUp = () => {
                          setIsDragging(false);
                          if (activeDragHandlersRef.current.mouseMove === handleStickerDragMove) {
                            document.removeEventListener('mousemove', handleStickerDragMove);
                            activeDragHandlersRef.current.mouseMove = null;
                          }
                          if (activeDragHandlersRef.current.mouseUp === handleStickerDragUp) {
                            document.removeEventListener('mouseup', handleStickerDragUp);
                            activeDragHandlersRef.current.mouseUp = null;
                          }
                          const cleanup = stickerDragCleanupRef.current
                          stickerDragCleanupRef.current = null
                          const { dx, dy } = dragDelta
                          cleanup?.()
                          if (hasMoved) {
                            skipPersistDuringCanvasDragRef.current = false
                            setStickers(prevStickers => prevStickers.map(s => {
                              if (s.id !== sid) return s
                              const pos = dragWithPageTransfer(startEl, dx, dy, capBookOpen, capSpreadIdx)
                              return { ...s, pageIndex: pos.pageIndex, x: pos.x, y: pos.y }
                            }))
                            requestAnimationFrame(() => flushPersistFromSnapshot())
                            setTimeout(() => saveToHistory(), 50)
                          }
                        };

                        activeDragHandlersRef.current.mouseMove = handleStickerDragMove;
                        activeDragHandlersRef.current.mouseUp = handleStickerDragUp;
                        
                        document.addEventListener('mousemove', handleStickerDragMove);
                        document.addEventListener('mouseup', handleStickerDragUp);
                      }}
                    >
                      <img
                        src={sticker.src}
                        alt="Sticker"
                        className="note-sticker"
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'contain',
                          pointerEvents: 'none'
                        }}
                      />
                    </div>
                    {isSelected && (
                      <>
                        <button
                          type="button"
                          className="note-rotate-handle"
                          aria-label="Rotate"
                          onMouseDown={(e) => startRotateDrag(
                            e,
                            { x: sticker.x, y: sticker.y, w: sticker.width, h: sticker.height },
                            sticker.rotation,
                            (deg) => setStickers((prev) => prev.map((s) => (s.id === sid ? { ...s, rotation: deg } : s)))
                          )}
                        >
                          <RotateCw size={14} />
                        </button>
                        <button
                          className="note-delete-btn"
                          onClick={() => deleteSticker(sticker.id)}
                          style={{ top: '-12px', left: '-12px' }}
                        >
                          <Trash2 size={16} />
                        </button>
                        <div 
                          className="note-resize-indicator"
                          style={{ 
                            position: 'absolute', 
                            bottom: '-8px', 
                            right: '-8px',
                            width: '24px',
                            height: '24px',
                            pointerEvents: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: '#B593C2',
                            borderRadius: '50%',
                            border: '2px solid white',
                            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'
                          }}
                        >
                          <Maximize2 size={14} color="white" style={{ transform: 'scaleX(-1)' }} />
                        </div>
                      </>
                    )}
                  </Resizable>
                  </div>
                );
              }
              
              // textbox
              const textBox = element;
              const isSelected = selectedItem?.type === 'textbox' && selectedItem.id === textBox.id;
              const isTextBoxEditing = editingTextBoxId === textBox.id
              const isPostit = textBox.variant === 'postit'
              const postitBg = textBox.postitColor || '#FEEF9F'
              const postitFg = textBox.postitTextColor || '#2d2a26'
              return (
              <Resizable
                key={textBox.id}
                minWidth={48}
                minHeight={32}
                size={{ width: textBox.width, height: textBox.height }}
                onResizeStart={() => {
                  textBoxResizeSessionRef.current = {
                    id: textBox.id,
                    startW: textBox.width,
                    startH: textBox.height,
                    startFs: clampTextBoxFontSize(
                      textBox.fontSize ?? DEFAULT_TEXTBOX_FONT_SIZE
                    )
                  }
                  setIsResizing(true)
                  setIsDragging(false)
                  skipPersistDuringCanvasDragRef.current = true
                }}
                onResize={(e, direction, ref, d) => {
                  const s = textBoxResizeSessionRef.current
                  if (!s || s.id !== textBox.id) return
                  const nw = Math.max(48, s.startW + d.width)
                  const nh = Math.max(32, s.startH + d.height)
                  const scale = (nw / s.startW + nh / s.startH) / 2
                  const nfs = clampTextBoxFontSize(Math.round(s.startFs * scale))
                  setTextBoxes((prevTextBoxes) =>
                    prevTextBoxes.map((tb) => {
                      if (tb.id !== textBox.id) return tb
                      const n = normPaged(tb)
                      const c = clampInPage(n, n.x, n.y, nw, nh)
                      return { ...n, x: c.x, y: c.y, width: nw, height: nh, fontSize: nfs }
                    })
                  )
                }}
                onResizeStop={() => {
                  textBoxResizeSessionRef.current = null
                  setIsResizing(false)
                  skipPersistDuringCanvasDragRef.current = false
                  requestAnimationFrame(() => flushPersistFromSnapshot())
                  setTimeout(() => saveToHistory(), 50)
                }}
                className={`note-textbox-wrapper ${isSelected ? 'selected' : ''}${isPostit ? ' note-textbox-wrapper--postit' : ''}`}
                style={{
                  position: 'absolute',
                  left: textBox.x,
                  top: textBox.y,
                  zIndex: textBox.zIndex || 1,
                  transform: `rotate(${textBox.rotation ?? 0}deg)`,
                  transformOrigin: 'center center'
                }}
                enable={{
                  top: false,
                  right: false,
                  bottom: false,
                  left: false,
                  topRight: true,
                  bottomRight: true,
                  bottomLeft: true,
                  topLeft: true
                }}
                handleStyles={{
                  topRight: { cursor: 'ne-resize' },
                  bottomRight: { cursor: 'se-resize' },
                  bottomLeft: { cursor: 'sw-resize' },
                  topLeft: { cursor: 'nw-resize' }
                }}
              >
                <div
                  className="note-textbox-container"
                  style={{ position: 'relative' }}
                  onContextMenu={(e) => {
                    // Stop dragging immediately when right-clicking
                    stopAllDragging();
                    handleContextMenu(e, { type: 'textbox', id: textBox.id });
                  }}
                  onMouseDown={(e) => {
                    // Check if right mouse button (button === 2)
                    if (e.button === 2) {
                      isRightClickRef.current = true;
                      stopAllDragging();
                      return;
                    }
                    
                    // Don't drag if context menu is open
                    if (isContextMenuOpen) {
                      return;
                    }
                    
                    // Stop any previous dragging first
                    stopAllDragging();
                    isRightClickRef.current = false;

                    if (isTextBoxEditing) {
                      if (e.target.closest?.('[data-textbox-editor]')) {
                        handleSelectItem({ type: 'textbox', id: textBox.id });
                      }
                      return;
                    }
                    
                    // Don't drag if clicking on rich text editor - handle separately
                    if (e.target.closest?.('[data-textbox-editor]')) {
                      handleSelectItem({ type: 'textbox', id: textBox.id });
                      return;
                    }
                    
                    // Don't drag if clicking on resize handle - let Resizable handle it
                    if (e.target.closest('.react-resizable-handle')) {
                      handleSelectItem({ type: 'textbox', id: textBox.id });
                      return;
                    }
                    
                    // Don't drag if clicking on delete button
                    if (e.target.closest('.note-delete-btn')) {
                      return;
                    }
                    if (e.target.closest('.note-rotate-handle')) {
                      return;
                    }
                    
                    e.stopPropagation();
                    e.preventDefault();
                    handleSelectItem({ type: 'textbox', id: textBox.id });
                    
                    const startX = e.clientX;
                    const startY = e.clientY;
                    const startEl = { ...textBox }; const capBookOpen = isBookOpen; const capSpreadIdx = spreadIndex;
                    let hasMoved = false;

                    const mouseMoveHandler = (moveEvent) => {
                      if (isContextMenuOpen || isRightClickRef.current) { stopAllDragging(); return; }
                      if (!hasMoved) { setIsDragging(true); hasMoved = true; skipPersistDuringCanvasDragRef.current = true; }
                      moveEvent.preventDefault();
                      const deltaX = moveEvent.clientX - startX;
                      const deltaY = moveEvent.clientY - startY;
                      setTextBoxes(prevTextBoxes => prevTextBoxes.map(tb => {
                        if (tb.id !== textBox.id) return tb
                        const pos = dragWithPageTransfer(startEl, deltaX, deltaY, capBookOpen, capSpreadIdx)
                        return { ...tb, pageIndex: pos.pageIndex, x: pos.x, y: pos.y }
                      }));
                    };

                    const mouseUpHandler = () => {
                      setIsDragging(false);
                      if (activeDragHandlersRef.current.mouseMove === mouseMoveHandler) {
                        document.removeEventListener('mousemove', mouseMoveHandler);
                        activeDragHandlersRef.current.mouseMove = null;
                      }
                      if (activeDragHandlersRef.current.mouseUp === mouseUpHandler) {
                        document.removeEventListener('mouseup', mouseUpHandler);
                        activeDragHandlersRef.current.mouseUp = null;
                      }
                      if (activeDragHandlersRef.current.contextMenu === contextMenuHandler) {
                        document.removeEventListener('contextmenu', contextMenuHandler);
                        activeDragHandlersRef.current.contextMenu = null;
                      }
                      if (hasMoved && !isRightClickRef.current) {
                        skipPersistDuringCanvasDragRef.current = false
                        requestAnimationFrame(() => flushPersistFromSnapshot())
                        setTimeout(() => saveToHistory(), 50)
                      }
                      isRightClickRef.current = false;
                    };

                    const contextMenuHandler = () => {
                      isRightClickRef.current = true;
                      stopAllDragging();
                    };

                    // Store handlers in ref BEFORE adding listeners
                    activeDragHandlersRef.current.mouseMove = mouseMoveHandler;
                    activeDragHandlersRef.current.mouseUp = mouseUpHandler;
                    activeDragHandlersRef.current.contextMenu = contextMenuHandler;
                    
                    document.addEventListener('mousemove', mouseMoveHandler);
                    document.addEventListener('mouseup', mouseUpHandler);
                    document.addEventListener('contextmenu', contextMenuHandler, { once: true });
                  }}
                  onDoubleClick={(e) => {
                    if (!e.target.closest?.('[data-textbox-editor]')) {
                      e.stopPropagation();
                      handleSelectItem({ type: 'textbox', id: textBox.id }, { startEditing: true });
                      requestAnimationFrame(() => {
                        requestAnimationFrame(() => {
                          const ed = e.currentTarget.querySelector('[data-textbox-editor]');
                          if (ed) {
                            ed.focus();
                            const range = document.createRange();
                            range.selectNodeContents(ed);
                            const sel = window.getSelection();
                            sel.removeAllRanges();
                            sel.addRange(range);
                          }
                        });
                      });
                    }
                  }}
                  onTouchStart={(e) => {
                    if (e.target.closest?.('[data-textbox-editor]') || e.target.closest('.react-resizable-handle')) return;
                    
                    e.stopPropagation();
                    handleSelectItem({ type: 'textbox', id: textBox.id });
                    
                    const touch = e.touches[0];
                    const startX = touch.clientX;
                    const startY = touch.clientY;
                    const startElT = { ...textBox }; const capBookOpenT = isBookOpen; const capSpreadIdxT = spreadIndex;
                    let hasMoved = false;

                    const handleTouchMove = (moveEvent) => {
                      if (!hasMoved) { setIsDragging(true); hasMoved = true; skipPersistDuringCanvasDragRef.current = true; }
                      moveEvent.preventDefault();
                      const tc = moveEvent.touches[0];
                      const deltaX = tc.clientX - startX;
                      const deltaY = tc.clientY - startY;
                      setTextBoxes(prevTextBoxes => prevTextBoxes.map(tb => {
                        if (tb.id !== textBox.id) return tb
                        const pos = dragWithPageTransfer(startElT, deltaX, deltaY, capBookOpenT, capSpreadIdxT)
                        return { ...tb, pageIndex: pos.pageIndex, x: pos.x, y: pos.y }
                      }));
                    };

                    const handleTouchEnd = () => {
                      setIsDragging(false);
                      document.removeEventListener('touchmove', handleTouchMove);
                      document.removeEventListener('touchend', handleTouchEnd);
                      if (hasMoved) {
                        skipPersistDuringCanvasDragRef.current = false
                        requestAnimationFrame(() => flushPersistFromSnapshot())
                        setTimeout(() => saveToHistory(), 50)
                      }
                    };

                    document.addEventListener('touchmove', handleTouchMove, { passive: false });
                    document.addEventListener('touchend', handleTouchEnd);
                  }}
                >
                  <div style={{ width: '100%', height: '100%', position: 'relative' }}>
                    <NoteTextEditor
                      textBox={textBox}
                      isPostit={isPostit}
                      postitBg={postitBg}
                      postitFg={postitFg}
                      textChangeTimeoutRef={textChangeTimeoutRef}
                      saveToHistory={saveToHistory}
                      setTextBoxes={setTextBoxes}
                      setTextToolbar={setTextToolbar}
                      setToolbarInlineFormats={setToolbarInlineFormats}
                      handleSelectItem={handleSelectItem}
                      isSelected={isSelected}
                      isEditing={isTextBoxEditing}
                      textBoxSelectionSyncRef={textBoxSelectionSyncRef}
                      beginTextBoxEditing={() => setEditingTextBoxId(textBox.id)}
                      endTextBoxEditing={endTextBoxEditing}
                      isContextMenuOpen={isContextMenuOpen}
                      isRightClickRef={isRightClickRef}
                      stopAllDragging={stopAllDragging}
                      setIsDragging={setIsDragging}
                      skipPersistDuringCanvasDragRef={skipPersistDuringCanvasDragRef}
                      flushPersistFromSnapshot={flushPersistFromSnapshot}
                      handleContextMenu={handleContextMenu}
                      isBookOpen={isBookOpen}
                      spreadIndex={spreadIndex}
                    />
                    {isSelected && (
                      <>
                        <button
                          type="button"
                          className="note-rotate-handle"
                          aria-label="Rotate"
                          onMouseDown={(e) => startRotateDrag(
                            e,
                            { x: textBox.x, y: textBox.y, w: textBox.width, h: textBox.height },
                            textBox.rotation,
                            (deg) => setTextBoxes((prev) => prev.map((tb) => (tb.id === textBox.id ? { ...tb, rotation: deg } : tb)))
                          )}
                        >
                          <RotateCw size={14} />
                        </button>
                        <button
                          className="note-delete-btn"
                          onClick={() => deleteTextBox(textBox.id)}
                          style={{ top: '-12px', left: '-12px' }}
                        >
                          <Trash2 size={16} />
                        </button>
                        <div 
                          className="note-resize-indicator"
                          style={{ 
                            position: 'absolute', 
                            bottom: '-8px', 
                            right: '-8px',
                            width: '24px',
                            height: '24px',
                            pointerEvents: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: '#B593C2',
                            borderRadius: '50%',
                            border: '2px solid white',
                            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'
                          }}
                        >
                          <Maximize2 size={14} color="white" style={{ transform: 'scaleX(-1)' }} />
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </Resizable>
            );
                  })}
                </div>)}
              )}
            </div>
            </div>
          </div>
        ) : (
          /* Non-book mode: same per-page approach, just no clipping, abs positioned */
          <div className="note-content" style={{ position: 'relative', minHeight: totalPages * 0 + PAGE_H }}>
            {Array.from({ length: totalPages }, (_, pi) => (
              <div key={pi} style={{ position: 'absolute', left: pi * PAGE_W, top: 0, width: PAGE_W, height: PAGE_H, overflow: 'visible',
                ...(pageBgImage ? { backgroundImage: `url(${pageBgImage})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {})
              }}>
                {/* Finished strokes image layer */}
                {drawingStrokes.filter(s => s.pageIndex === pi).map(stroke => (
                  <img
                    key={stroke.id}
                    src={stroke.dataUrl}
                    alt=""
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 8999 }}
                  />
                ))}
                {/* Live drawing canvas */}
                <canvas
                  ref={(el) => { if (el) { drawCanvasRefs.current[pi] = el; el.width = PAGE_W; el.height = PAGE_H } else { delete drawCanvasRefs.current[pi] } }}
                  width={PAGE_W}
                  height={PAGE_H}
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: isPencilMode ? 'all' : 'none', zIndex: 9000, cursor: isPencilMode ? 'crosshair' : 'default', touchAction: 'none' }}
                  {...makePencilHandlers(pi)}
                />
                {allSortedElements.filter(el => (el.pageIndex ?? 0) === pi).map((element) => {
                  if (element.elementType === 'shape') {
                    const shape = element; const isSelected = selectedItem?.type === 'shape' && selectedItem.id === shape.id;
                    return renderShape(shape, isSelected);
                  } else if (element.elementType === 'image') {
                    const image = element; const isSelected = selectedItem?.type === 'image' && selectedItem.id === image.id;
                    return (
                      <Resizable key={image.id} size={{ width: image.width, height: image.height }}
                        onResizeStart={() => { setIsResizing(true); setIsDragging(false); }}
                        onResizeStop={(e, direction, ref, d) => {
                          setImages(prevImages => prevImages.map(img => {
                            if (img.id !== image.id) return img
                            const n = normPaged(img); const nw = Math.max(10, n.width + d.width); const nh = Math.max(10, n.height + d.height);
                            const c = clampInPage(n, n.x, n.y, nw, nh); return { ...n, x: c.x, y: c.y, width: nw, height: nh }
                          })); setIsResizing(false); setTimeout(() => saveToHistory(), 50)
                        }}
                        className={`note-image-wrapper ${isSelected ? 'selected' : ''}`}
                        style={{ position: 'absolute', left: image.x, top: image.y, zIndex: image.zIndex || 1, transform: `rotate(${image.rotation ?? 0}deg)`, transformOrigin: 'center center' }}
                        enable={{ top:true, right:true, bottom:true, left:true, topRight:true, bottomRight:true, bottomLeft:true, topLeft:true }}
                      >
                        <div className="note-image-container"
                          onMouseDown={(e) => {
                            if (isContextMenuOpen || e.target.closest('.react-resizable-handle') || e.target.closest('.note-delete-btn') || e.target.closest('.note-rotate-handle')) return;
                            e.stopPropagation(); stopAllDragging(); handleSelectItem({ type: 'image', id: image.id });
                            const startX = e.clientX; const startY = e.clientY;
                            const startEl = { ...image }; const capBookOpen = isBookOpen; const capSpreadIdx = spreadIndex;
                            let hasMoved = false;
                            const handleMouseMove = (moveEvent) => {
                              if (isContextMenuOpen) { stopAllDragging(); return; }
                              if (!hasMoved) { setIsDragging(true); hasMoved = true; skipPersistDuringCanvasDragRef.current = true; }
                              moveEvent.preventDefault(); const deltaX = moveEvent.clientX - startX; const deltaY = moveEvent.clientY - startY;
                              setImages(prevImages => prevImages.map(img => {
                                if (img.id !== image.id) return img; const pos = dragWithPageTransfer(startEl, deltaX, deltaY, capBookOpen, capSpreadIdx); return { ...img, pageIndex: pos.pageIndex, x: pos.x, y: pos.y }
                              }));
                            };
                            const handleMouseUp = () => {
                              setIsDragging(false);
                              document.removeEventListener('mousemove', handleMouseMove); document.removeEventListener('mouseup', handleMouseUp);
                              if (hasMoved) { skipPersistDuringCanvasDragRef.current = false; requestAnimationFrame(() => flushPersistFromSnapshot()); setTimeout(() => saveToHistory(), 50); }
                            };
                            document.addEventListener('mousemove', handleMouseMove); document.addEventListener('mouseup', handleMouseUp);
                          }}
                        >
                          <img src={image.src} alt="Uploaded" className="note-image" style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }} />
                        </div>
                        {isSelected && (<>
                          <button type="button" className="note-rotate-handle" aria-label="Rotate"
                            onMouseDown={(e) => startRotateDrag(e, { x: image.x, y: image.y, w: image.width, h: image.height }, image.rotation, (deg) => setImages(prev => prev.map(img => img.id === image.id ? { ...img, rotation: deg } : img)))}
                          ><RotateCw size={14} /></button>
                          <button className="note-delete-btn" onClick={() => deleteImage(image.id)} style={{ top: '-12px', left: '-12px' }}><Trash2 size={16} /></button>
                        </>)}
                      </Resizable>
                    );
                  } else if (element.elementType === 'sticker') {
                    const sticker = element; const isSelected = selectedItem?.type === 'sticker' && selectedItem.id === sticker.id; const sid = sticker.id;
                    return (
                      <div key={sid} className="note-sticker-host" style={{ position: 'absolute', left: sticker.x, top: sticker.y, zIndex: sticker.zIndex || 1, width: sticker.width, height: sticker.height, transform: `rotate(${sticker.rotation ?? 0}deg)`, transformOrigin: 'center center' }}>
                        <Resizable size={{ width: sticker.width, height: sticker.height }}
                          onResizeStart={() => { setIsResizing(true); setIsDragging(false); }}
                          onResizeStop={(e, direction, ref, d) => {
                            setStickers(prevStickers => prevStickers.map(s => {
                              if (s.id !== sticker.id) return s; const n = normPaged(s); const nw = Math.max(10, n.width + d.width); const nh = Math.max(10, n.height + d.height);
                              const c = clampInPage(n, n.x, n.y, nw, nh); return { ...n, x: c.x, y: c.y, width: nw, height: nh }
                            })); setIsResizing(false); setTimeout(() => saveToHistory(), 50)
                          }}
                          className={`note-sticker-wrapper ${isSelected ? 'selected' : ''}`} style={{ position: 'relative', left: 0, top: 0 }}
                          enable={{ top:true, right:true, bottom:true, left:true, topRight:true, bottomRight:true, bottomLeft:true, topLeft:true }}
                        >
                          <div className="note-sticker-container"
                            onMouseDown={(e) => {
                              if (isContextMenuOpen || e.target.closest('.react-resizable-handle') || e.target.closest('.note-delete-btn') || e.target.closest('.note-rotate-handle')) return;
                              e.stopPropagation(); e.preventDefault(); handleSelectItem({ type: 'sticker', id: sticker.id });
                              const startX = e.clientX; const startY = e.clientY;
                              const startEl = { ...sticker }; const capBookOpen = isBookOpen; const capSpreadIdx = spreadIndex;
                              let hasMoved = false;
                              const handleUp = () => {
                                setIsDragging(false); document.removeEventListener('mousemove', handleMove); document.removeEventListener('mouseup', handleUp);
                                if (hasMoved) { skipPersistDuringCanvasDragRef.current = false; setStickers(prev => prev.map(s => { if (s.id !== sid) return s; const pos = dragWithPageTransfer(startEl, 0, 0, capBookOpen, capSpreadIdx); return { ...s, pageIndex: pos.pageIndex, x: pos.x, y: pos.y }; })); requestAnimationFrame(() => flushPersistFromSnapshot()); setTimeout(() => saveToHistory(), 50); }
                              };
                              const handleMove = (mv) => {
                                if (!hasMoved) { hasMoved = true; skipPersistDuringCanvasDragRef.current = true; } mv.preventDefault();
                                const dx = mv.clientX - startX; const dy = mv.clientY - startY;
                                setStickers(prev => prev.map(s => { if (s.id !== sid) return s; const pos = dragWithPageTransfer(startEl, dx, dy, capBookOpen, capSpreadIdx); return { ...s, pageIndex: pos.pageIndex, x: pos.x, y: pos.y }; }));
                              };
                              document.addEventListener('mousemove', handleMove); document.addEventListener('mouseup', handleUp);
                            }}
                          >
                            <img src={sticker.src} alt="Sticker" className="note-sticker" style={{ width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none' }} />
                          </div>
                          {isSelected && (<>
                            <button type="button" className="note-rotate-handle" aria-label="Rotate"
                              onMouseDown={(e) => startRotateDrag(e, { x: sticker.x, y: sticker.y, w: sticker.width, h: sticker.height }, sticker.rotation, (deg) => setStickers(prev => prev.map(s => s.id === sid ? { ...s, rotation: deg } : s)))}
                            ><RotateCw size={14} /></button>
                            <button className="note-delete-btn" onClick={() => deleteSticker(sticker.id)} style={{ top: '-12px', left: '-12px' }}><Trash2 size={16} /></button>
                          </>)}
                        </Resizable>
                      </div>
                    );
                  } else {
                    const textBox = element; const isSelected = selectedItem?.type === 'textbox' && selectedItem.id === textBox.id;
                    const isPostit = textBox.variant === 'postit'; const postitBg = textBox.postitColor || '#FEEF9F'; const postitFg = textBox.postitTextColor || '#2d2a26';
                    return (
                      <Resizable key={textBox.id} minWidth={48} minHeight={32} size={{ width: textBox.width, height: textBox.height }}
                        onResizeStart={() => { setIsResizing(true); setIsDragging(false); skipPersistDuringCanvasDragRef.current = true; }}
                        onResizeStop={() => { setIsResizing(false); skipPersistDuringCanvasDragRef.current = false; requestAnimationFrame(() => flushPersistFromSnapshot()); setTimeout(() => saveToHistory(), 50); }}
                        className={`note-textbox-wrapper ${isSelected ? 'selected' : ''}${isPostit ? ' note-textbox-wrapper--postit' : ''}`}
                        style={{ position: 'absolute', left: textBox.x, top: textBox.y, zIndex: textBox.zIndex || 1, transform: `rotate(${textBox.rotation ?? 0}deg)`, transformOrigin: 'center center' }}
                        enable={{ topRight:true, bottomRight:true, bottomLeft:true, topLeft:true }}
                      >
                        <div className="note-textbox-container" style={{ position: 'relative' }}
                          onMouseDown={(e) => { if (e.button === 2 || isContextMenuOpen) return; handleSelectItem({ type: 'textbox', id: textBox.id }); }}
                        >
                          <div className={`note-textbox${isPostit ? ' note-textbox--postit' : ''}`} style={isPostit ? { backgroundColor: postitBg, color: postitFg } : {}} />
                          {isSelected && (<>
                            <button type="button" className="note-rotate-handle" aria-label="Rotate"
                              onMouseDown={(e) => startRotateDrag(e, { x: textBox.x, y: textBox.y, w: textBox.width, h: textBox.height }, textBox.rotation, (deg) => setTextBoxes(prev => prev.map(tb => tb.id === textBox.id ? { ...tb, rotation: deg } : tb)))}
                            ><RotateCw size={14} /></button>
                            <button className="note-delete-btn" onClick={() => deleteTextBox(textBox.id)} style={{ top: '-12px', left: '-12px' }}><Trash2 size={16} /></button>
                          </>)}
                        </div>
                      </Resizable>
                    );
                  }
                })}
              </div>
            ))}
          </div>
        )}
      </div>

      {textToolbar && (
        <div
          className="note-text-format-toolbar"
          style={{
            position: 'fixed',
            top: textToolbar.top,
            left: textToolbar.left,
            transform: 'translateX(-50%)',
            zIndex: 15000
          }}
          role="toolbar"
          aria-label="Text formatting"
          onMouseDown={(e) => {
            const t = e.target
            // อย่า preventDefault บน input / font-size UI — จะทำให้โฟกัสหายและ toolbar ปิด
            if (t?.closest?.('.note-font-size-canva')) return
            if (t?.tagName === 'INPUT' || t?.tagName === 'TEXTAREA' || t?.tagName === 'SELECT')
              return
            e.preventDefault()
          }}
        >
          <button
            type="button"
            className={`note-nav-btn${toolbarInlineFormats.bold ? ' active' : ''}`}
            data-tooltip="Bold"
            aria-label="Bold"
            aria-pressed={toolbarInlineFormats.bold}
            onClick={() => applyRichTextCommand(textToolbar.textBoxId, 'bold')}
          >
            <Bold size={15} />
          </button>
          <button
            type="button"
            className={`note-nav-btn${toolbarInlineFormats.italic ? ' active' : ''}`}
            data-tooltip="Italic"
            aria-label="Italic"
            aria-pressed={toolbarInlineFormats.italic}
            onClick={() => applyRichTextCommand(textToolbar.textBoxId, 'italic')}
          >
            <Italic size={15} />
          </button>
          <button
            type="button"
            className={`note-nav-btn${toolbarInlineFormats.strikeThrough ? ' active' : ''}`}
            data-tooltip="Strikethrough"
            aria-label="Strikethrough"
            aria-pressed={toolbarInlineFormats.strikeThrough}
            onClick={() => applyRichTextCommand(textToolbar.textBoxId, 'strikeThrough')}
          >
            <Strikethrough size={15} />
          </button>
          <span className="note-text-format-divider" aria-hidden />
          <NoteFontSizeCanvaControl
            key={`tb-fs-${textToolbar.textBoxId}`}
            committedSize={
              textBoxes.find((t) => t.id === textToolbar.textBoxId)?.fontSize ??
              DEFAULT_TEXTBOX_FONT_SIZE
            }
            onApply={(n) => updateTextBoxFontSize(textToolbar.textBoxId, n)}
          />
          <span className="note-text-format-divider" aria-hidden />
          <div className="note-text-format-picker">
            <button
              type="button"
              className="note-nav-btn note-text-format-palette-trigger"
              data-tooltip="Text color"
              aria-label="Text color"
              aria-expanded={formatPaletteOpen === 'fore'}
              onClick={() =>
                setFormatPaletteOpen((p) => (p === 'fore' ? null : 'fore'))
              }
            >
              <span className="note-text-format-color-icon" aria-hidden>
                A
              </span>
            </button>
            {formatPaletteOpen === 'fore' && (
              <div
                className="note-text-format-palette"
                onMouseDown={(e) => e.preventDefault()}
              >
                <div className="note-text-format-palette-grid">
                  {TEXT_FORE_PALETTE.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className="note-text-format-swatch"
                      style={{ backgroundColor: c }}
                      title={c}
                      aria-label={`Text color ${c}`}
                      onClick={() => {
                        applyRichTextCommand(textToolbar.textBoxId, 'foreColor', c)
                        setFormatPaletteOpen(null)
                      }}
                    />
                  ))}
                </div>
                <label className="note-text-format-palette-custom">
                  Custom color…
                  <input
                    type="color"
                    defaultValue="#3A3030"
                    aria-label="Pick custom text color"
                    onInput={(e) =>
                      applyRichTextCommand(
                        textToolbar.textBoxId,
                        'foreColor',
                        e.target.value
                      )
                    }
                  />
                </label>
              </div>
            )}
          </div>
          <div className="note-text-format-picker">
            <button
              type="button"
              className="note-nav-btn note-text-format-palette-trigger"
              data-tooltip="Highlight"
              aria-label="Highlight"
              aria-expanded={formatPaletteOpen === 'highlight'}
              onClick={() =>
                setFormatPaletteOpen((p) => (p === 'highlight' ? null : 'highlight'))
              }
            >
              <Highlighter size={15} />
            </button>
            {formatPaletteOpen === 'highlight' && (
              <div
                className="note-text-format-palette"
                onMouseDown={(e) => e.preventDefault()}
              >
                <div className="note-text-format-palette-grid">
                  {TEXT_HIGHLIGHT_PALETTE.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className="note-text-format-swatch"
                      style={{ backgroundColor: c }}
                      title={c}
                      aria-label={`Highlight ${c}`}
                      onClick={() => {
                        applyTextHighlight(textToolbar.textBoxId, c)
                        setFormatPaletteOpen(null)
                      }}
                    />
                  ))}
                </div>
                <label className="note-text-format-palette-custom">
                  Custom color…
                  <input
                    type="color"
                    defaultValue="#FFF59D"
                    aria-label="Pick custom highlight color"
                    onInput={(e) =>
                      applyTextHighlight(textToolbar.textBoxId, e.target.value)
                    }
                  />
                </label>
              </div>
            )}
          </div>
        </div>
      )}

      {rotationHud && (
        <div
          className="note-rotation-hud"
          style={{ left: rotationHud.clientX, top: rotationHud.clientY }}
          role="status"
          aria-live="polite"
        >
          {rotationHud.degrees}°
        </div>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="note-context-menu"
          style={{
            position: 'fixed',
            left: contextMenu.x,
            top: contextMenu.y,
            zIndex: 10000
          }}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {contextMenu.item ? (
            <>
              <button onClick={() => { copyItem(); closeContextMenu(); }}>
                <Copy size={16} /> Copy
              </button>
              <button onClick={() => { cutItem(); closeContextMenu(); }}>
                <Scissors size={16} /> Cut
              </button>
              {clipboard && (
                <button onClick={() => { pasteItem(); closeContextMenu(); }}>
                  Paste
                </button>
              )}
              <button onClick={() => { duplicateItem(); closeContextMenu(); }}>
                Duplicate
              </button>
              <div className="context-menu-divider" />
              <button onClick={() => { bringToFront(); }}>
                <ArrowUp size={16} /> Bring to Front
              </button>
              <button onClick={() => { sendToBack(); }}>
                <ArrowDown size={16} /> Send to Back
              </button>
              <div className="context-menu-divider" />
              <button onClick={() => {
                if (contextMenu.item.type === 'textbox') {
                  deleteTextBox(contextMenu.item.id);
                } else if (contextMenu.item.type === 'shape') {
                  deleteShape(contextMenu.item.id);
                } else if (contextMenu.item.type === 'image') {
                  deleteImage(contextMenu.item.id);
                } else if (contextMenu.item.type === 'sticker') {
                  deleteSticker(contextMenu.item.id);
                }
                closeContextMenu();
              }}>
                <Trash2 size={16} /> Delete
              </button>
            </>
          ) : (
            <>
              {clipboard && (
                <button onClick={() => { pasteItem(); closeContextMenu(); }}>
                  <Copy size={16} /> Paste
                </button>
              )}
            </>
          )}
        </div>
      )}

    </div>
  )
}

export default Note
