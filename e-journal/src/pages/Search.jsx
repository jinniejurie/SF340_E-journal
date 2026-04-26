import { useMemo, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, getDocs } from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'
import { Calendar } from 'lucide-react'
import Navbar from '../components/Navbar.jsx'
import { EmojiRenderer } from '../components/EmojiRenderer'
import { db, auth } from '../services/firebase'
import '../styles/Calendar.css'
import '../styles/Search.css'

const DEFAULT_EMOTIONS = [
    { id: 'm01', emoji: new URL('../assets/emoji/angri.PNG', import.meta.url).href, label: 'Angry' },
    { id: 'm02', emoji: new URL('../assets/emoji/uhhh.PNG', import.meta.url).href, label: 'Bad' },
    { id: 'm03', emoji: new URL('../assets/emoji/meh.PNG', import.meta.url).href, label: 'Calm' },
    { id: 'm04', emoji: new URL('../assets/emoji/happi.PNG', import.meta.url).href, label: 'Happy' },
    { id: 'm05', emoji: new URL('../assets/emoji/excited.PNG', import.meta.url).href, label: 'Excited' }
]

function getTodoDetail(id) {
  try {
    const raw = localStorage.getItem(`ejournal-todo-${id}`)
    if (!raw) return null
    const data = JSON.parse(raw)
    return {
      title: data.title ?? '',
      items: Array.isArray(data.items) ? data.items : []
    }
  } catch (e) {}
  return null
}

function getNoteDetail(id) {
  try {
    const raw = localStorage.getItem(`ejournal-note-${id}`)
    if (!raw) return null
    const data = JSON.parse(raw)
    const textBoxes = Array.isArray(data.textBoxes) ? data.textBoxes : []
    const textContent = textBoxes.map(t => (t.content || '').trim()).filter(Boolean).join(' ')
    return {
      title: data.title ?? '',
      tagName: data.tagName ?? '',
      textContent
    }
  } catch (e) {}
  return null
}

function Search() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('all') // 'all' | 'note' | 'todo'
  const [moodFilter, setMoodFilter] = useState(null)  // null = all, or emotion id
  const [emotions, setEmotions] = useState(DEFAULT_EMOTIONS)
  const [notes, setNotes] = useState({})
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [showMonthPicker, setShowMonthPicker] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState(null)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())

  const loadNotes = () => {
    try {
      const stored = localStorage.getItem('ejournal-notes')
      setNotes(stored ? JSON.parse(stored) : {})
    } catch (err) {}
  }

  useEffect(() => {
    loadNotes()
    const handler = (e) => {
      if (e.key === 'ejournal-notes') loadNotes()
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [])

  const flatNotes = useMemo(() => {
    return Object.entries(notes).flatMap(([dateKey, arr]) =>
      (arr || []).map(n => ({ ...n, dateKey }))
    )
  }, [notes])

  // โหลด MOOD จาก Firestore (เหมือน Calendar) เพื่อให้ id ที่ใช้ตรงกับ note.emotion
  useEffect(() => {
    if (!db || !auth) return

    let cancelled = false
    const moodEmojiMap = {
      Angry: '😠',
      Sad: '😢',
      Calm: '😌',
      Happy: '😊',
      Excited: '🤩',
      Exited: '🤩'
    }

    const loadMoods = async () => {
      try {
        const snap = await getDocs(collection(db, 'MOOD'))
        if (cancelled) return
        if (!snap.empty) {
          setEmotions(
            snap.docs.map(d => {
              const data = d.data()
              const name = data.moodName || data.mood || data.name || ''
              return { id: d.id, label: name, emoji: moodEmojiMap[name] || '' }
            })
          )
        }
      } catch (err) {
        if (!cancelled && (err?.code === 'permission-denied' || err?.message?.includes('permission'))) {
          console.warn('MOOD (Search): No read permission. Using default moods. Add read rule for MOOD in Firestore if needed.')
        }
      }
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (cancelled) return
      if (user) {
        loadMoods()
      }
    })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])

  const results = useMemo(() => {
    const q = (query || '').trim().toLowerCase()
    let list = flatNotes

    if (typeFilter === 'note') list = list.filter(n => n.type === 'note')
    else if (typeFilter === 'todo') list = list.filter(n => n.type === 'todo')

    if (moodFilter) list = list.filter(n => (n.emotion || n.mood) === moodFilter)

    // Filter by month and year if selected
    if (selectedMonth !== null && selectedYear) {
      list = list.filter(n => {
        try {
          const dateParts = String(n.dateKey).split('-')
          if (dateParts.length >= 2) {
            const noteYear = parseInt(dateParts[0])
            const noteMonth = parseInt(dateParts[1])
            return noteYear === selectedYear && noteMonth === selectedMonth
          }
        } catch (e) {}
        return false
      })
    }

    if (!q) return list

    return list.filter(n => {
      const nameMatch = (n.name || '').toLowerCase().includes(q)
      const tagMatch = (n.tag?.name || '').toLowerCase().includes(q)
      if (nameMatch || tagMatch) return true

      if (n.type === 'todo') {
        const detail = getTodoDetail(n.id)
        if (detail?.items) {
          const itemsText = detail.items.map(i => (i.text || '').toLowerCase()).join(' ')
          if (itemsText.includes(q)) return true
        }
      }

      if (n.type === 'note') {
        const detail = getNoteDetail(n.id)
        if (detail?.textContent?.toLowerCase().includes(q)) return true
      }

      return false
    })
  }, [query, typeFilter, moodFilter, flatNotes, selectedMonth, selectedYear])

  const handleSelect = (item) => {
    if (item.type === 'todo') {
      navigate(`/calendar/toDoList?todoId=${item.id}`)
    } else {
      navigate(`/calendar/note?noteId=${item.id}`, { state: { note: item } })
    }
  }

  const formatDate = (dateKey) => {
    try {
      const parts = String(dateKey).split('-')
      if (parts.length >= 3) {
        const d = parts[2]
        const m = Number(parts[1]) - 1
        const y = parts[0]
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
        return `${months[m] || ''} ${d}, ${y}`
      }
    } catch (e) {}
    return dateKey
  }

  return (
    <div className={`calendar-page search-page ${isSidebarOpen ? 'calendar-page--with-sidebar' : ''}`}>
      <Navbar
        defaultOpen={false}
        open={isSidebarOpen}
        onOpenChange={setIsSidebarOpen}
        hideToggleButton
        ariaLabel="Search navigation"
      />

      <button
        className={`search-nav-btn ${isSidebarOpen ? 'search-nav-btn--hidden' : ''}`}
        aria-label="Open menu"
        type="button"
        onClick={() => setIsSidebarOpen(true)}
      >
        <svg width="25" height="25" viewBox="0 0 25 25" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path fillRule="evenodd" clipRule="evenodd" d="M11.9465 2.57188C11.8737 2.64445 11.816 2.73066 11.7766 2.82557C11.7372 2.92049 11.7169 3.02224 11.7169 3.125C11.7169 3.22776 11.7372 3.32951 11.7766 3.42443C11.816 3.51934 11.8737 3.60555 11.9465 3.67813L20.7699 12.5L11.9465 21.3219C11.7998 21.4686 11.7173 21.6675 11.7173 21.875C11.7173 22.0825 11.7998 22.2814 11.9465 22.4281C12.0932 22.5748 12.2921 22.6572 12.4996 22.6572C12.707 22.6572 12.906 22.5748 13.0527 22.4281L22.4277 13.0531C22.5005 12.9806 22.5582 12.8943 22.5976 12.7994C22.637 12.7045 22.6572 12.6028 22.6572 12.5C22.6572 12.3972 22.637 12.2955 22.5976 12.2006C22.5582 12.1057 22.5005 12.0194 22.4277 11.9469L13.0527 2.57188C12.9801 2.49912 12.8939 2.4414 12.799 2.40201C12.7041 2.36263 12.6023 2.34235 12.4996 2.34235C12.3968 2.34235 12.2951 2.36263 12.2002 2.40201C12.1052 2.4414 12.019 2.49912 11.9465 2.57188Z" fill="currentColor" />
          <path fillRule="evenodd" clipRule="evenodd" d="M5.69646 2.57188C5.6237 2.64445 5.56598 2.73066 5.52659 2.82557C5.48721 2.92049 5.46693 3.02224 5.46693 3.125C5.46693 3.22776 5.48721 3.32951 5.52659 3.42443C5.56598 3.51934 5.6237 3.60555 5.69646 3.67813L14.5199 12.5L5.69646 21.3219C5.62382 21.3945 5.5662 21.4807 5.52689 21.5757C5.48758 21.6706 5.46734 21.7723 5.46734 21.875C5.46734 21.9777 5.48758 22.0794 5.52689 22.1743C5.5662 22.2693 5.62382 22.3555 5.69646 22.4281C5.76909 22.5008 5.85533 22.5584 5.95023 22.5977C6.04514 22.637 6.14686 22.6572 6.24958 22.6572C6.35231 22.6572 6.45402 22.637 6.54893 22.5977C6.64384 22.5584 6.73007 22.5008 6.80271 22.4281L16.1777 13.0531C16.2505 12.9806 16.3082 12.8943 16.3476 12.7994C16.387 12.7045 16.4072 12.6028 16.4072 12.5C16.4072 12.3972 16.387 12.2955 16.3476 12.2006C16.3082 12.1057 16.2505 12.0194 16.1777 11.9469L6.80271 2.57188C6.73013 2.49912 6.64392 2.4414 6.54901 2.40201C6.45409 2.36263 6.35234 2.34235 6.24958 2.34235C6.14682 2.34235 6.04507 2.36263 5.95015 2.40201C5.85524 2.4414 5.76903 2.49912 5.69646 2.57188Z" fill="currentColor" />
        </svg>
      </button>

      <div className="search-main">
        <h1 className="search-hero-title">Search</h1>
        <div className="search-hero">
          <div className="search-bar-container" style={{ display: 'flex', alignItems: 'stretch', gap: '10px' }}>
            <div className="search-bar search-bar--hero">
              <span className="search-bar-icon" aria-hidden>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </span>
              <input
                type="search"
                className="search-bar-input"
                placeholder="Search notes, to-dos, tags..."
                value={query}
                onChange={e => setQuery(e.target.value)}
                autoFocus
                aria-label="Search"
              />
            </div>
            <div className="search-month-picker-wrapper" style={{ position: 'relative', display: 'flex', alignItems: 'stretch' }}>
              <button
                type="button"
                className={`search-month-btn${showMonthPicker ? ' search-month-btn--active' : ''}${selectedMonth !== null ? ' search-month-btn--selected' : ''}`}
                onClick={() => setShowMonthPicker(!showMonthPicker)}
                title="Search by month"
                aria-label="Search by month"
                aria-expanded={showMonthPicker}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  aspectRatio: '1 / 1',
                  padding: 0,
                  border: selectedMonth !== null
                    ? '2px solid #222'
                    : showMonthPicker
                      ? '2px solid #444'
                      : '2px solid #d0d0d0',
                  borderRadius: '12px',
                  background: selectedMonth !== null ? '#222' : showMonthPicker ? '#f5f5f5' : '#fff',
                  color: selectedMonth !== null ? '#fff' : '#444',
                  cursor: 'pointer',
                  flexShrink: 0,
                  transition: 'border-color 0.18s, background 0.18s, color 0.18s',
                  boxShadow: showMonthPicker ? '0 2px 8px rgba(0,0,0,0.10)' : 'none',
                  minWidth: 0,
                }}
              >
                <Calendar size={20} />
              </button>

              {showMonthPicker && (
                <>
                  {/* Backdrop */}
                  <div
                    style={{ position: 'fixed', inset: 0, zIndex: 99 }}
                    onClick={() => setShowMonthPicker(false)}
                    aria-hidden
                  />
                  <div
                    className="search-month-picker-dropdown"
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 10px)',
                      right: 0,
                      zIndex: 100,
                      background: '#fff',
                      border: '1.5px solid #e8e8e8',
                      borderRadius: '16px',
                      boxShadow: '0 8px 32px rgba(0,0,0,0.13)',
                      padding: '18px 18px 14px',
                      minWidth: '260px',
                    }}
                  >
                    {/* Year row */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                      <button
                        type="button"
                        onClick={() => setSelectedYear(y => y - 1)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', fontSize: '16px', color: '#555', borderRadius: '8px', lineHeight: 1 }}
                        aria-label="Previous year"
                      >‹</button>
                      <span style={{ fontWeight: 600, fontSize: '15px', color: '#222', letterSpacing: '0.02em' }}>{selectedYear}</span>
                      <button
                        type="button"
                        onClick={() => setSelectedYear(y => y + 1)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', fontSize: '16px', color: '#555', borderRadius: '8px', lineHeight: 1 }}
                        aria-label="Next year"
                      >›</button>
                    </div>

                    {/* Month grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                      {[
                        'January', 'February', 'March', 'April', 'May', 'June',
                        'July', 'August', 'September', 'October', 'November', 'December'
                      ].map((month, idx) => {
                        const isActive = selectedMonth === idx + 1
                        return (
                          <button
                            key={month}
                            type="button"
                            onClick={() => {
                              setSelectedMonth(selectedMonth === idx + 1 ? null : idx + 1)
                              setShowMonthPicker(false)
                            }}
                            style={{
                              padding: '7px 4px',
                              border: isActive ? '2px solid #222' : '1.5px solid transparent',
                              borderRadius: '10px',
                              background: isActive ? '#222' : 'transparent',
                              color: isActive ? '#fff' : '#444',
                              fontWeight: isActive ? 600 : 400,
                              fontSize: '13px',
                              cursor: 'pointer',
                              transition: 'background 0.15s, color 0.15s, border-color 0.15s',
                              textAlign: 'center',
                            }}
                            onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = '#f2f2f2'; e.currentTarget.style.borderColor = '#ddd' } }}
                            onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent' } }}
                          >
                            {month.slice(0, 3)}
                          </button>
                        )
                      })}
                    </div>

                    {/* Clear filter */}
                    {selectedMonth !== null && (
                      <button
                        type="button"
                        onClick={() => { setSelectedMonth(null); setShowMonthPicker(false) }}
                        style={{
                          marginTop: '12px',
                          width: '100%',
                          padding: '7px',
                          border: '1.5px solid #e0e0e0',
                          borderRadius: '10px',
                          background: 'transparent',
                          color: '#888',
                          fontSize: '13px',
                          cursor: 'pointer',
                          transition: 'background 0.15s',
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = '#f7f7f7'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        Clear month filter
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="search-filters">
          <div className="search-filter-group">
            <span className="search-filter-label">Type</span>
            <div className="search-filter-options">
              {['all', 'note', 'todo'].map(t => (
                <button
                  key={t}
                  type="button"
                  className={`search-filter-btn ${typeFilter === t ? 'search-filter-btn--active' : ''}`}
                  onClick={() => setTypeFilter(t)}
                >
                  {t === 'all' ? 'All' : t === 'note' ? 'Note' : 'To-do'}
                </button>
              ))}
            </div>
          </div>

          <div className="search-filter-group">
            <span className="search-filter-label">Mood</span>
            <div className="search-filter-options search-filter-options--mood">
              <button
                type="button"
                className={`search-filter-btn search-filter-btn--mood ${!moodFilter ? 'search-filter-btn--active' : ''}`}
                onClick={() => setMoodFilter(null)}
              >
                All
              </button>
              {emotions.map(e => (
                <button
                  key={e.id}
                  type="button"
                  className={`search-filter-btn search-filter-btn--mood ${moodFilter === e.id ? 'search-filter-btn--active' : ''}`}
                  onClick={() => setMoodFilter(moodFilter === e.id ? null : e.id)}
                  title={e.label}
                  aria-label={e.label}
                >
                  <EmojiRenderer emoji={e.emoji} label={e.label} />
                </button>
              ))}
            </div>
          </div>
        </div>

        <section className="search-results-section" aria-label="Search results">
          {results.length === 0 ? (
            <div className="search-empty">
              {flatNotes.length === 0
                ? <p>No notes or to-dos yet. Create some from the Calendar!</p>
                : moodFilter
                  ? <p>No notes with this mood. Try a different mood or clear the filter.</p>
                  : <p>No results match your search. Try different keywords or filters.</p>
              }
            </div>
          ) : (
            <ul className="search-results-list">
              {results.map(item => (
                <li key={`${item.dateKey}-${item.id}`} className="search-result-item">
                  <button
                    type="button"
                    className="search-result-card"
                    onClick={() => handleSelect(item)}
                  >
                    <div
                      className="search-result-indicator"
                      style={{ backgroundColor: item.type === 'todo' ? '#333' : (item.tag?.color || '#999') }}
                    />
                    <div className="search-result-content">
                      <span className="search-result-name">{item.name || 'Untitled'}</span>
                      <div className="search-result-meta">
                        <span>{item.type === 'todo' ? 'To-do List' : (item.tag?.name || 'Note')}</span>
                        <span className="search-result-date">{formatDate(item.dateKey)}</span>
                        {(item.emotion || item.mood) && (
                          <span className="search-result-mood">
                            <EmojiRenderer emoji={emotions.find(ev => ev.id === (item.emotion || item.mood))?.emoji || ''} />
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="search-result-arrow">→</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}

export default Search
