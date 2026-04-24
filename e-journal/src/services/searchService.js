function safeLower(value) {
  return String(value ?? '').toLowerCase()
}

function normalizeNotesByDate(notesByDate) {
  if (!notesByDate || typeof notesByDate !== 'object') return {}
  const normalized = {}

  Object.entries(notesByDate).forEach(([dateKey, value]) => {
    if (Array.isArray(value)) {
      normalized[dateKey] = value
      return
    }
    if (value && typeof value === 'object') {
      normalized[dateKey] = Object.values(value)
      return
    }
    normalized[dateKey] = []
  })

  return normalized
}

function formatDateKey(dateKey) {
  if (!dateKey) return ''
  const [year, month, day] = String(dateKey).split('-').map(Number)
  if (!year || !month || !day) return String(dateKey)
  const date = new Date(year, month - 1, day)
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  })
}

export function searchCalendarNotes({ notesByDate, query, emotionsById }) {
  const trimmedQuery = String(query ?? '').trim()
  if (!trimmedQuery) return []

  const q = safeLower(trimmedQuery)
  const normalizedNotes = normalizeNotesByDate(notesByDate)
  const allNotes = Object.entries(normalizedNotes).flatMap(([dateKey, notes]) =>
    (Array.isArray(notes) ? notes : []).map(note => ({ ...note, _dateKey: dateKey }))
  )

  const results = allNotes.filter(note => {
    const moodLabel = emotionsById?.[note.emotion]?.label ?? ''
    const moodEmoji = emotionsById?.[note.emotion]?.emoji ?? ''
    const tagName = note.type === 'note' ? note.tag?.name ?? '' : 'to-do list'
    const dateText = formatDateKey(note.date || note._dateKey)

    const haystack = [
      note.name,
      tagName,
      moodLabel,
      moodEmoji,
      note.type,
      dateText,
      note.date
    ]
      .map(safeLower)
      .join(' ')

    return haystack.includes(q)
  })

  return results
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    .slice(0, 20)
    .map(note => ({
      id: note.id,
      type: note.type,
      name: note.name,
      dateKey: note.date || note._dateKey,
      dateText: formatDateKey(note.date || note._dateKey),
      tagName: note.type === 'note' ? note.tag?.name ?? '' : 'To-do List',
      moodLabel: emotionsById?.[note.emotion]?.label ?? '',
      moodEmoji: emotionsById?.[note.emotion]?.emoji ?? ''
    }))
}
