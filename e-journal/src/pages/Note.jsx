import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react'
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import { Resizable } from 're-resizable'
import { 
  Type, 
  Square, 
  Image as ImageIcon, 
  Download, 
  Share2, 
  ChevronLeft,
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
  Highlighter
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
  if (t && /<[a-z][\s\S]*>/i.test(t)) return s
  return `<p>${escapeHtml(s).replace(/\n/g, '<br>')}</p>`
}

/** Persist empty editors as '' so undo/load stays consistent */
function normalizeEditorStorage(html) {
  if (html == null || html === '' || html === '<br>') return ''
  const t = document.createElement('div')
  t.innerHTML = html
  const text = t.textContent?.replace(/\u200b/g, '').trim() ?? ''
  if (!text) return ''
  return html
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
  isContextMenuOpen,
  isRightClickRef,
  stopAllDragging,
  setIsDragging,
  skipPersistDuringCanvasDragRef,
  flushPersistFromSnapshot,
  handleContextMenu
}) {
  const elRef = useRef(null)
  const lastCommittedHtml = useRef(null)

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
      tabIndex={0}
      contentEditable
      suppressContentEditableWarning
      data-textbox-editor
      data-textbox-id={textBox.id}
      className={`note-textbox note-textbox-editor${isPostit ? ' note-textbox--postit' : ''}`}
      data-placeholder={isPostit ? 'Note' : 'Type here...'}
      style={{
        width: '100%',
        height: '100%',
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
      onFocus={() => handleSelectItem({ type: 'textbox', id: textBox.id })}
      onBlur={() => {
        if (textChangeTimeoutRef.current) {
          clearTimeout(textChangeTimeoutRef.current)
          textChangeTimeoutRef.current = null
        }
        setTimeout(() => saveToHistory(), 50)
        setTimeout(() => {
          const a = document.activeElement
          if (!a?.hasAttribute?.('data-textbox-editor') && !a?.closest?.('.note-text-format-toolbar')) {
            setTextToolbar(null)
            setToolbarInlineFormats(INITIAL_TOOLBAR_INLINE_FORMATS)
          }
        }, 0)
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
      onMouseDown={(e) => {
        if (e.button === 2) {
          isRightClickRef.current = true
          stopAllDragging()
          return
        }
        handleSelectItem({ type: 'textbox', id: textBox.id })
        stopAllDragging()
        isRightClickRef.current = false
        const startX = e.clientX
        const startY = e.clientY
        const startPosX = textBox.x
        const startPosY = textBox.y
        let hasMoved = false
        let dragging = false

        const handleMouseMove = (moveEvent) => {
          if (isRightClickRef.current || isContextMenuOpen) {
            stopAllDragging()
            return
          }
          const deltaX = Math.abs(moveEvent.clientX - startX)
          const deltaY = Math.abs(moveEvent.clientY - startY)
          if ((deltaX > 5 || deltaY > 5) && !dragging) {
            dragging = true
            hasMoved = true
            setIsDragging(true)
            skipPersistDuringCanvasDragRef.current = true
            elRef.current?.blur()
            moveEvent.preventDefault()
          }
          if (dragging) {
            moveEvent.preventDefault()
            const finalDeltaX = moveEvent.clientX - startX
            const finalDeltaY = moveEvent.clientY - startY
            setTextBoxes((prevTextBoxes) =>
              prevTextBoxes.map((tb) =>
                tb.id === textBox.id
                  ? { ...tb, x: startPosX + finalDeltaX, y: startPosY + finalDeltaY }
                  : tb
              )
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
        e.currentTarget.focus()
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
      maxZIndex: typeof data.maxZIndex === 'number' ? data.maxZIndex : 1
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

  // Close menus when selecting different item type
  const handleSelectItem = (item) => {
    setSelectedItem(item);
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
    }
  };
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [rotationHud, setRotationHud] = useState(null)
  const [contextMenu, setContextMenu] = useState(null)
  const [clipboard, setClipboard] = useState(null)
  const [isContextMenuOpen, setIsContextMenuOpen] = useState(false)
  const canvasRef = useRef(null)
  const fileInputRef = useRef(null)
  const activeDragHandlersRef = useRef({ mouseMove: null, mouseUp: null, contextMenu: null })
  const isRightClickRef = useRef(false)
  const stickerHostElementsRef = useRef(new Map())
  const stickerDragCleanupRef = useRef(null)
  const activeRotationDragRef = useRef(null)
  const skipPersistDuringCanvasDragRef = useRef(false)
  const persistSnapshotRef = useRef(null)
  const FIRESTORE_DEBOUNCE_MS = 2000

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
    maxZIndex
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
      maxZIndex: s.maxZIndex
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
      if (Array.isArray(data.textBoxes)) setTextBoxes(withDefaultRotation(data.textBoxes))
      if (Array.isArray(data.shapes)) setShapes(withDefaultRotation(data.shapes))
      if (Array.isArray(data.images)) setImages(withDefaultRotation(data.images))
      if (Array.isArray(data.stickers)) setStickers(withDefaultRotation(data.stickers))
      if (typeof data.maxZIndex === 'number') setMaxZIndex(data.maxZIndex)
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
      maxZIndex
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
  }, [storageKey, dateKey, title, tagName, tagColor, textBoxes, shapes, images, stickers, maxZIndex])

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
  }, [selectedItem, isEditingTitle, clipboard, pendingPostItColor, isAddingTextBox, showPostItMenu])

  useEffect(() => {
    const onSelectionChange = () => {
      const el = document.activeElement
      if (!el?.hasAttribute?.('data-textbox-editor')) {
        setTextToolbar(null)
        setToolbarInlineFormats(INITIAL_TOOLBAR_INLINE_FORMATS)
        return
      }
      const id = el.getAttribute('data-textbox-id')
      const rect = getNonCollapsedSelectionRectInEditor(el)
      if (!rect) {
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
      if (e.target.closest?.('.note-text-format-toolbar')) return
      if (e.target.closest?.('[data-textbox-editor]')) return
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

  const handleCanvasClick = (e) => {
    const onCanvasBg = e.target === canvasRef.current || e.target.classList.contains('note-content')

    if (pendingPostItColor && canvasRef.current && onCanvasBg) {
      const rect = canvasRef.current.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      const newTextBoxId = Date.now().toString()
      const newZIndex = maxZIndex + 1
      const entry = POSTIT_PALETTE.find((p) => p.color === pendingPostItColor) || POSTIT_PALETTE[0]
      const newTextBox = {
        id: newTextBoxId,
        content: '',
        x,
        y,
        width: 200,
        height: 176,
        rotation: 0,
        zIndex: newZIndex,
        variant: 'postit',
        postitColor: pendingPostItColor,
        postitTextColor: entry.textColor || '#2d2a26'
      }
      setMaxZIndex(newZIndex)
      setTextBoxes((prev) => [...prev, newTextBox])
      handleSelectItem({ type: 'textbox', id: newTextBoxId })
      setPendingPostItColor(null)
      setShowPostItMenu(false)
      setTimeout(() => saveToHistory(), 50)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          document.querySelector(`[data-textbox-editor][data-textbox-id="${newTextBoxId}"]`)?.focus()
        })
      })
      return
    }

    if (onCanvasBg) {
      handleSelectItem(null)
      setIsDragging(false)
    }

    setIsDragging(false)

    if (!isAddingTextBox || !canvasRef.current) return

    const rect = canvasRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    const newTextBoxId = Date.now().toString()
    const newZIndex = maxZIndex + 1
    const newTextBox = {
      id: newTextBoxId,
      content: '',
      x,
      y,
      width: 200,
      height: 100,
      rotation: 0,
      zIndex: newZIndex
    }

    setMaxZIndex(newZIndex)
    setTextBoxes([...textBoxes, newTextBox])
    handleSelectItem({ type: 'textbox', id: newTextBoxId })
    setIsAddingTextBox(false)
    setTimeout(() => saveToHistory(), 50)
  }

  const addShape = (type, clickX = null, clickY = null) => {
    let x = 400;
    let y = 300;
    
    // If click position provided, use it
    if (clickX !== null && clickY !== null && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      x = clickX - rect.left;
      y = clickY - rect.top;
    }
    
    const newZIndex = maxZIndex + 1;
    const newShape = {
      id: Date.now().toString(),
      type,
      x,
      y,
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
    let x = 300;
    let y = 400;
    
    // If click position provided, use it
    if (clickX !== null && clickY !== null && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      x = clickX - rect.left;
      y = clickY - rect.top;
    }
    
    const newZIndex = maxZIndex + 1;
    const newSticker = {
      id: Date.now().toString(),
      src: stickerSrc,
      x,
      y,
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
        x: 300,
        y: 300,
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
    setSelectedItem(null);
    setTimeout(() => saveToHistory(), 50)
  };

  const deleteShape = (id) => {
    setShapes(shapes.filter(s => s.id !== id));
    setSelectedItem(null);
    setTimeout(() => saveToHistory(), 50)
  };

  const deleteSticker = (id) => {
    setStickers(stickers.filter(s => s.id !== id));
    setSelectedItem(null);
    setTimeout(() => saveToHistory(), 50)
  };

  const deleteImage = (id) => {
    setImages(images.filter(i => i.id !== id));
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
    const cr = canvas.getBoundingClientRect()
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

  const downloadAsPDF = () => {
    alert('Download as PDF - In production, this would generate a PDF of the note');
  };

  const shareAsLink = () => {
    const link = window.location.href;
    navigator.clipboard.writeText(link);
    alert('Link copied to clipboard!');
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
          setShapes(prevShapes => prevShapes.map(s =>
            s.id === shape.id
              ? { ...s, width: s.width + d.width, height: s.height + d.height }
              : s
          ));
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
            const startPosX = shape.x;
            const startPosY = shape.y;
            let hasMoved = false;

            const handleMouseMove = (moveEvent) => {
              // Don't drag if context menu is open
              if (isContextMenuOpen) {
                stopAllDragging();
                return;
              }
              
              if (!hasMoved) {
                setIsDragging(true);
                hasMoved = true;
                skipPersistDuringCanvasDragRef.current = true;
              }
              moveEvent.preventDefault();
              const deltaX = moveEvent.clientX - startX;
              const deltaY = moveEvent.clientY - startY;
              
              setShapes(prevShapes => prevShapes.map(s =>
                s.id === shape.id
                  ? { ...s, x: startPosX + deltaX, y: startPosY + deltaY }
                  : s
              ));
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
            setSelectedItem({ type: 'shape', id: shape.id });
            setIsDragging(true);
            
            const touch = e.touches[0];
            const startX = touch.clientX;
            const startY = touch.clientY;
            const startPosX = shape.x;
            const startPosY = shape.y;
            let touchMoved = false;

            const handleTouchMove = (moveEvent) => {
              moveEvent.preventDefault();
              if (!touchMoved) {
                touchMoved = true;
                skipPersistDuringCanvasDragRef.current = true;
              }
              const touch = moveEvent.touches[0];
              const deltaX = touch.clientX - startX;
              const deltaY = touch.clientY - startY;
              
              setShapes(prevShapes => prevShapes.map(s =>
                s.id === shape.id
                  ? { ...s, x: startPosX + deltaX, y: startPosY + deltaY }
                  : s
              ));
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

  return (
    <div className="note-page">
      {loading && (
        <div className="note-loading" aria-hidden="true">
          กำลังโหลด...
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
                <button type="button" onClick={downloadAsPDF}><Download size={16} /> Download PDF</button>
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
          // Close all menus and tag selector when clicking on canvas
          if (e.target === canvasRef.current || e.target.classList.contains('note-content')) {
            setShowTagSelector(false);
            setIsCreatingNewTag(false);
            setShowShapesMenu(false);
            setShowStickersMenu(false);
            setShowPostItMenu(false);
            setShowShareMenu(false);
            setShowColorPicker(false);
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
        style={{ cursor: isAddingTextBox || pendingPostItColor ? 'crosshair' : 'default' }}
      >
        <div className="note-header">
          <div className="note-header-left">
            {isEditingTitle ? (
              <input
                className="note-title-input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={() => {
                  setIsEditingTitle(false)
                  setTimeout(() => saveToHistory(), 50)
                }}
                autoFocus
              />
            ) : (
              <h1 className="note-title" onClick={() => setIsEditingTitle(true)}>
                {title}
              </h1>
            )}

            {showTagSelector ? (
              <div className="note-tag-selector" onClick={(e) => e.stopPropagation()}>
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
            )}
          </div>
        </div>

        <div className="note-content">
          {[...textBoxes, ...shapes.map(s => ({ ...s, elementType: 'shape' })), ...images.map(i => ({ ...i, elementType: 'image' })), ...stickers.map(s => ({ ...s, elementType: 'sticker' }))]
            .sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))
            .map((element) => {
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
                      setImages(prevImages => prevImages.map(img =>
                        img.id === image.id
                          ? { ...img, width: img.width + d.width, height: img.height + d.height }
                          : img
                      ));
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
                        const startPosX = image.x;
                        const startPosY = image.y;
                        let hasMoved = false;

                        const handleMouseMove = (moveEvent) => {
                          // Don't drag if context menu is open
                          if (isContextMenuOpen) {
                            stopAllDragging();
                            return;
                          }
                          
                          if (!hasMoved) {
                            setIsDragging(true);
                            hasMoved = true;
                            skipPersistDuringCanvasDragRef.current = true;
                          }
                          moveEvent.preventDefault();
                          const deltaX = moveEvent.clientX - startX;
                          const deltaY = moveEvent.clientY - startY;
                          
                          setImages(prevImages => prevImages.map(img =>
                            img.id === image.id
                              ? { ...img, x: startPosX + deltaX, y: startPosY + deltaY }
                              : img
                          ));
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
                      setStickers(prevStickers => prevStickers.map(s =>
                        s.id === sticker.id
                          ? { ...s, width: s.width + d.width, height: s.height + d.height }
                          : s
                      ));
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
                        const startPosX = sticker.x;
                        const startPosY = sticker.y;
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
                            setStickers(prevStickers => prevStickers.map(s =>
                              s.id === sid
                                ? { ...s, x: startPosX + dx, y: startPosY + dy }
                                : s
                            ))
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
              const isPostit = textBox.variant === 'postit'
              const postitBg = textBox.postitColor || '#FEEF9F'
              const postitFg = textBox.postitTextColor || '#2d2a26'
              return (
              <Resizable
                key={textBox.id}
                size={{ width: textBox.width, height: textBox.height }}
                onResizeStart={() => {
                  setIsResizing(true);
                  setIsDragging(false);
                }}
                onResizeStop={(e, direction, ref, d) => {
                  setTextBoxes(prevTextBoxes => prevTextBoxes.map(tb =>
                    tb.id === textBox.id
                      ? { ...tb, width: tb.width + d.width, height: tb.height + d.height }
                      : tb
                  ));
                  setIsResizing(false);
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
                    const startPosX = textBox.x;
                    const startPosY = textBox.y;
                    let hasMoved = false;

                    const mouseMoveHandler = (moveEvent) => {
                      // Don't drag if context menu is open or right click detected
                      if (isContextMenuOpen || isRightClickRef.current) {
                        stopAllDragging();
                        return;
                      }
                      
                      if (!hasMoved) {
                        setIsDragging(true);
                        hasMoved = true;
                        skipPersistDuringCanvasDragRef.current = true;
                      }
                      moveEvent.preventDefault();
                      const deltaX = moveEvent.clientX - startX;
                      const deltaY = moveEvent.clientY - startY;
                      
                      setTextBoxes(prevTextBoxes => prevTextBoxes.map(tb =>
                        tb.id === textBox.id
                          ? { ...tb, x: startPosX + deltaX, y: startPosY + deltaY }
                          : tb
                      ));
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
                      const ed = e.currentTarget.querySelector('[data-textbox-editor]');
                      if (ed) {
                        ed.focus();
                        const range = document.createRange();
                        range.selectNodeContents(ed);
                        const sel = window.getSelection();
                        sel.removeAllRanges();
                        sel.addRange(range);
                      }
                    }
                  }}
                  onTouchStart={(e) => {
                    if (e.target.closest?.('[data-textbox-editor]') || e.target.closest('.react-resizable-handle')) return;
                    
                    e.stopPropagation();
                    handleSelectItem({ type: 'textbox', id: textBox.id });
                    
                    const touch = e.touches[0];
                    const startX = touch.clientX;
                    const startY = touch.clientY;
                    const startPosX = textBox.x;
                    const startPosY = textBox.y;
                    let hasMoved = false;

                    const handleTouchMove = (moveEvent) => {
                      if (!hasMoved) {
                        setIsDragging(true);
                        hasMoved = true;
                        skipPersistDuringCanvasDragRef.current = true;
                      }
                      moveEvent.preventDefault();
                      const touch = moveEvent.touches[0];
                      const deltaX = touch.clientX - startX;
                      const deltaY = touch.clientY - startY;
                      
                      setTextBoxes(prevTextBoxes => prevTextBoxes.map(tb =>
                        tb.id === textBox.id
                          ? { ...tb, x: startPosX + deltaX, y: startPosY + deltaY }
                          : tb
                      ));
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
                      isContextMenuOpen={isContextMenuOpen}
                      isRightClickRef={isRightClickRef}
                      stopAllDragging={stopAllDragging}
                      setIsDragging={setIsDragging}
                      skipPersistDuringCanvasDragRef={skipPersistDuringCanvasDragRef}
                      flushPersistFromSnapshot={flushPersistFromSnapshot}
                      handleContextMenu={handleContextMenu}
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
        </div>
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
          onMouseDown={(e) => e.preventDefault()}
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