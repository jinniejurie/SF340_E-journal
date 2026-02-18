import { useEffect, useMemo, useState } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '../services/firebase'
import { useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar.jsx'
import '../styles/Calendar.css'

function Calendar() {
  const getThaiToday = () => {
    const now = new Date()
    const formatter = new Intl.DateTimeFormat('th-TH', {
      timeZone: 'Asia/Bangkok',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    })
    const parts = formatter.formatToParts(now)
    const year = Number(parts.find(p => p.type === 'year')?.value)
    const month = Number(parts.find(p => p.type === 'month')?.value) - 1
    const day = Number(parts.find(p => p.type === 'day')?.value)
    return new Date(year, month, day)
  }

  const today = useMemo(() => getThaiToday(), [])
  const [currentDate, setCurrentDate] = useState(today)
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [isThemePickerOpen, setIsThemePickerOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedDay, setSelectedDay] = useState(null)
  const [showDayModal, setShowDayModal] = useState(false)
  const [selectedEmotion, setSelectedEmotion] = useState(null)
  const [showNoteCreation, setShowNoteCreation] = useState(false)
  const [noteType, setNoteType] = useState('')
  const [noteName, setNoteName] = useState('')
  const [selectedTag, setSelectedTag] = useState(null)
  const [showNewTagForm, setShowNewTagForm] = useState(false)
  const [newTagName, setNewTagName] = useState('')
  const [newTagColor, setNewTagColor] = useState('#FF6B6B')

  const navigate = useNavigate()

  const [color1, setColor1] = useState(() => {
    try {
      const stored = localStorage.getItem('ejournal-theme')
      if (stored) return JSON.parse(stored).c1
    } catch (e) {}
    return '#f3f0ea'
  })
  const [color2, setColor2] = useState(() => {
    try {
      const stored = localStorage.getItem('ejournal-theme')
      if (stored) return JSON.parse(stored).c2
    } catch (e) {}
    return '#4c3734'
  })
  const [color3, setColor3] = useState(() => {
    try {
      const stored = localStorage.getItem('ejournal-theme')
      if (stored) return JSON.parse(stored).c3
    } catch (e) {}
    return '#6e5a5a'
  })

  const [tags, setTags] = useState(() => {
    try {
      const stored = localStorage.getItem('ejournal-tags')
      if (stored) return JSON.parse(stored)
    } catch (e) {}
    return [
      { id: 'l01', name: 'Work', color: '#4ECDC4' },
      { id: 'l02', name: 'Goals', color: '#F38181' },
      { id: 'l03', name: 'Ideas', color: '#ffe27a' }
    ]
  })

  const [notes, setNotes] = useState(() => {
    try {
      const stored = localStorage.getItem('ejournal-notes')
      if (stored) return JSON.parse(stored)
    } catch (e) {}
    return {}
  })

  const [emotions, setEmotions] = useState([
    { id: 'm01', emoji: '😠', label: 'Angry' },
    { id: 'm02', emoji: '😢', label: 'Sad' },
    { id: 'm03', emoji: '😌', label: 'Calm' },
    { id: 'm04', emoji: '😊', label: 'Happy' },
    { id: 'm05', emoji: '🤩', label: 'Excited' }
  ])

  const flatNotes = useMemo(() => {
    return Object.entries(notes).flatMap(([dateKey, arr]) =>
      (arr || []).map(n => ({ ...n, dateKey }))
    )
  }, [notes])

  const searchResults = useMemo(() => {
    const q = (searchQuery || '').trim().toLowerCase()
    if (!q) return []
    return flatNotes
      .filter(n => (n.name || '').toLowerCase().includes(q))
      .slice(0, 8)
  }, [searchQuery, flatNotes])

  const handleSelectSearchResult = (note) => {
    try {
      const dateKey = note.dateKey || ''
      const parts = String(dateKey).split('-')
      if (parts.length >= 3) {
        const y = Number(parts[0])
        const m = Number(parts[1]) - 1
        const d = Number(parts[2])
        setCurrentDate(new Date(y, m, 1))
        setSelectedDay(d)
        setShowDayModal(true)
      }
    } catch (err) {
      if (note.type === 'todo') {
        navigate(`/calendar/toDoList?todoId=${note.id}`)
      } else {
        navigate('/calendar/note')
      }
    }
    setSearchQuery('')
    setSearchOpen(false)
  }

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December']
  const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

  const getDaysInMonth = (date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const days = []
    for (let i = 0; i < firstDay; i++) days.push(null)
    for (let day = 1; day <= daysInMonth; day++) days.push(day)
    while (days.length % 7 !== 0) days.push(null)
    return days
  }

  const days = getDaysInMonth(currentDate)
  const currentMonth = monthNames[currentDate.getMonth()]
  const currentYear = currentDate.getFullYear()

  const isToday = (day) => {
    if (!day) return false
    return (
      day === today.getDate() &&
      currentDate.getMonth() === today.getMonth() &&
      currentDate.getFullYear() === today.getFullYear()
    )
  }

  const goToPreviousMonth = () => {
    setCurrentDate((prev) => {
      const year = prev.getFullYear()
      const month = prev.getMonth()
      return month === 0 ? new Date(year - 1, 11, 1) : new Date(year, month - 1, 1)
    })
  }

  const goToNextMonth = () => {
    setCurrentDate((prev) => {
      const year = prev.getFullYear()
      const month = prev.getMonth()
      return month === 11 ? new Date(year + 1, 0, 1) : new Date(year, month + 1, 1)
    })
  }

  const applyThemeColors = (c1, c2, c3) => {
    const root = document.documentElement
    root.style.setProperty('--theme-color-1', c1)
    root.style.setProperty('--theme-color-2', c2)
    root.style.setProperty('--theme-color-3', c3)
  }

  useEffect(() => {
    applyThemeColors(color1, color2, color3)
    try {
      localStorage.setItem('ejournal-theme', JSON.stringify({ c1: color1, c2: color2, c3: color3 }))
    } catch (e) {}
  }, [color1, color2, color3])

  useEffect(() => {
    try { localStorage.setItem('ejournal-tags', JSON.stringify(tags)) } catch (e) {}
  }, [tags])

  useEffect(() => {
    if (!db) {
      console.warn('Firestore not initialized; skipping LABEL and MOOD sync.')
      return
    }

    const unsubLabels = onSnapshot(collection(db, 'LABEL'), snap => {
      setTags(snap.docs.map(d => {
        const data = d.data()
        return { id: d.id, name: data.name || data.labID || '', color: data.color || '#999' }
      }))
    }, err => console.error('LABEL onSnapshot error', err))

    const moodEmojiMap = {
      Angry: '😠', Sad: '😢', Calm: '😌', Happy: '😊', Excited: '🤩', Exited: '🤩'
    }

    const unsubMoods = onSnapshot(collection(db, 'MOOD'), snap => {
      setEmotions(snap.docs.map(d => {
        const data = d.data()
        const name = data.moodName || data.mood || data.name || ''
        return { id: d.id, label: name, emoji: moodEmojiMap[name] || '' }
      }))
    }, err => console.error('MOOD onSnapshot error', err))

    return () => {
      try { unsubLabels() } catch (e) {}
      try { unsubMoods() } catch (e) {}
    }
  }, [])

  useEffect(() => {
    try { localStorage.setItem('ejournal-notes', JSON.stringify(notes)) } catch (e) {}
  }, [notes])

  const handleDayClick = (day) => {
    if (day) {
      setSelectedDay(day)
      setShowDayModal(true)
      setSelectedEmotion(null)
      setShowNoteCreation(false)
      setNoteType('')
    }
  }

  const closeDayModal = () => {
    setShowDayModal(false)
    setSelectedDay(null)
    setShowNoteCreation(false)
    setNoteType('')
    setNoteName('')
    setSelectedTag(null)
    setShowNewTagForm(false)
    setNewTagName('')
    setNewTagColor('#FF6B6B')
  }

  const handleNoteTypeSelect = (type) => {
    setNoteType(type)
    setNoteName('')
    setSelectedTag(null)
  }

  const handleBackFromNoteCreation = () => {
    setShowNoteCreation(false)
    setNoteType('')
    setNoteName('')
    setSelectedTag(null)
    setShowNewTagForm(false)
  }

  const handleSaveNote = () => {
    if (noteType === 'note' && noteName.trim() && selectedTag) {
      const dateKey = `${currentYear}-${currentDate.getMonth() + 1}-${selectedDay}`
      const selectedTagObj = tags.find(t => t.id === selectedTag)
      const newNote = {
        id: Date.now(), type: 'note', name: noteName,
        tag: selectedTagObj, emotion: selectedEmotion,
        date: dateKey, createdAt: new Date().toISOString()
      }
      setNotes(prev => ({ ...prev, [dateKey]: [...(prev[dateKey] || []), newNote] }))
      closeDayModal()
      navigate(`/calendar/note?noteId=${newNote.id}`)
    } else if (noteType === 'todo' && noteName.trim()) {
      const dateKey = `${currentYear}-${currentDate.getMonth() + 1}-${selectedDay}`
      const newTodo = {
        id: Date.now(), type: 'todo', name: noteName,
        color: '#000000', emotion: selectedEmotion,
        date: dateKey, completed: false, createdAt: new Date().toISOString()
      }
      setNotes(prev => ({ ...prev, [dateKey]: [...(prev[dateKey] || []), newTodo] }))
      closeDayModal()
    }
  }

  const handleCreateNewTag = () => {
    if (newTagName.trim()) {
      const newTag = { id: Date.now(), name: newTagName, color: newTagColor }
      setTags(prev => [...prev, newTag])
      setSelectedTag(newTag.id)
      setShowNewTagForm(false)
      setNewTagName('')
      setNewTagColor('#FF6B6B')
    }
  }

  const getDayKey = (day) => `${currentYear}-${currentDate.getMonth() + 1}-${day}`
  const getDayNotes = (day) => {
    if (!day) return []
    return notes[getDayKey(day)] || []
  }

  const canSaveNote = () => {
    if (noteType === 'todo') return noteName.trim() !== ''
    if (noteType === 'note') return noteName.trim() !== '' && selectedTag !== null
    return false
  }

  return (
    <div className={`calendar-page${isSidebarOpen ? ' calendar-page--with-sidebar' : ''}`}>
      <Navbar
        open={isSidebarOpen}
        onOpenChange={setIsSidebarOpen}
        onOpenSearch={setSearchOpen}
        hideToggleButton
        ariaLabel="Calendar navigation"
      />

      {/* ===== TOOLBAR ===== */}
      <div className="calendar-toolbar">
        <div className="calendar-toolbar-left">
          <button
            className={`calendar-nav-btn calendar-nav-btn--in-toolbar ${isSidebarOpen ? 'calendar-nav-btn--hidden-keep-space' : ''}`}
            aria-label="Open menu"
            type="button"
            onClick={() => setIsSidebarOpen(true)}
          >
              <svg width="25" height="25" viewBox="0 0 25 25" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path fillRule="evenodd" clipRule="evenodd" d="M11.9465 2.57188C11.8737 2.64445 11.816 2.73066 11.7766 2.82557C11.7372 2.92049 11.7169 3.02224 11.7169 3.125C11.7169 3.22776 11.7372 3.32951 11.7766 3.42443C11.816 3.51934 11.8737 3.60555 11.9465 3.67813L20.7699 12.5L11.9465 21.3219C11.7998 21.4686 11.7173 21.6675 11.7173 21.875C11.7173 22.0825 11.7998 22.2814 11.9465 22.4281C12.0932 22.5748 12.2921 22.6572 12.4996 22.6572C12.707 22.6572 12.906 22.5748 13.0527 22.4281L22.4277 13.0531C22.5005 12.9806 22.5582 12.8943 22.5976 12.7994C22.637 12.7045 22.6572 12.6028 22.6572 12.5C22.6572 12.3972 22.637 12.2955 22.5976 12.2006C22.5582 12.1057 22.5005 12.0194 22.4277 11.9469L13.0527 2.57188C12.9801 2.49912 12.8939 2.4414 12.799 2.40201C12.7041 2.36263 12.6023 2.34235 12.4996 2.34235C12.3968 2.34235 12.2951 2.36263 12.2002 2.40201C12.1052 2.4414 12.019 2.49912 11.9465 2.57188Z" fill="currentColor" />
                <path fillRule="evenodd" clipRule="evenodd" d="M5.69646 2.57188C5.6237 2.64445 5.56598 2.73066 5.52659 2.82557C5.48721 2.92049 5.46693 3.02224 5.46693 3.125C5.46693 3.22776 5.48721 3.32951 5.52659 3.42443C5.56598 3.51934 5.6237 3.60555 5.69646 3.67813L14.5199 12.5L5.69646 21.3219C5.62382 21.3945 5.5662 21.4807 5.52689 21.5757C5.48758 21.6706 5.46734 21.7723 5.46734 21.875C5.46734 21.9777 5.48758 22.0794 5.52689 22.1743C5.5662 22.2693 5.62382 22.3555 5.69646 22.4281C5.76909 22.5008 5.85533 22.5584 5.95023 22.5977C6.04514 22.637 6.14686 22.6572 6.24958 22.6572C6.35231 22.6572 6.45402 22.637 6.54893 22.5977C6.64384 22.5584 6.73007 22.5008 6.80271 22.4281L16.1777 13.0531C16.2505 12.9806 16.3082 12.8943 16.3476 12.7994C16.387 12.7045 16.4072 12.6028 16.4072 12.5C16.4072 12.3972 16.387 12.2955 16.3476 12.2006C16.3082 12.1057 16.2505 12.0194 16.1777 11.9469L6.80271 2.57188C6.73013 2.49912 6.64392 2.4414 6.54901 2.40201C6.45409 2.36263 6.35234 2.34235 6.24958 2.34235C6.14682 2.34235 6.04507 2.36263 5.95015 2.40201C5.85524 2.4414 5.76903 2.49912 5.69646 2.57188Z" fill="currentColor" />
              </svg>
            </button>
          <div className="calendar-month-wrapper">
            <button className="calendar-month-btn" onClick={goToPreviousMonth} aria-label="Previous month">‹</button>
            <span className="calendar-month">{currentMonth}</span>
            <button className="calendar-month-btn" onClick={goToNextMonth} aria-label="Next month">›</button>
          </div>
        </div>

        {/* Right: search + customize above year */}
        <div className="calendar-toolbar-right" style={{ position: 'relative' }}>
          <div className="calendar-toolbar-right-top">
            {/* Search */}
            <div className={`calendar-search ${searchOpen ? 'calendar-search--open' : 'calendar-search--collapsed'}`}>
            {!searchOpen ? (
              <button className="calendar-search-toggle" onClick={() => setSearchOpen(true)} aria-label="Open search">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </button>
            ) : (
              <>
                <span className="calendar-search-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                </span>
                <input
                  className="calendar-search-input"
                  autoFocus
                  placeholder="Search notes..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Escape') setSearchOpen(false) }}
                />
                <button className="calendar-search-close" onClick={() => { setSearchOpen(false); setSearchQuery('') }}>✕</button>

                {searchResults.length > 0 && (
                  <div className="calendar-search-results">
                    {searchResults.map(r => (
                      <button key={r.id} className="calendar-search-result" onMouseDown={e => { e.preventDefault(); handleSelectSearchResult(r) }}>
                        <span className="result-name">{r.name}</span>
                        <span className="result-meta">{r.type === 'todo' ? 'To-do' : (r.tag?.name || '')}</span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

            {/* Customize */}
            <button className="calendar-customize-btn" onClick={() => setIsThemePickerOpen(prev => !prev)}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
              <span className="calendar-customize-label">Customize</span>
            </button>
          </div>
          <h2 className="calendar-year">{currentYear}</h2>

          {/* Theme Popover */}
          {isThemePickerOpen && (
            <div className="calendar-theme-popover">
              <input type="color" className="calendar-theme-swatch calendar-theme-swatch--pink" value={color1} onChange={e => setColor1(e.target.value)} title="Background color" />
              <input type="color" className="calendar-theme-swatch calendar-theme-swatch--blue" value={color2} onChange={e => setColor2(e.target.value)} title="Text color" />
              <input type="color" className="calendar-theme-swatch calendar-theme-swatch--brown" value={color3} onChange={e => setColor3(e.target.value)} title="Accent color" />
            </div>
          )}
        </div>
      </div>

      {/* ===== CALENDAR GRID ===== */}
      <div className="calendar-grid">
        {dayNames.map(day => (
          <div key={day} className="calendar-header-cell">{day}</div>
        ))}
        {days.map((day, index) => (
          <div
            key={index}
            className="calendar-day-cell"
            onClick={() => handleDayClick(day)}
            style={{ cursor: day ? 'pointer' : 'default' }}
          >
            {day && (
              <>
                {isToday(day) ? (
                  <div className="calendar-day-highlight">
                    <svg width="36" height="36" viewBox="0 0 36 36">
                      <circle cx="18" cy="18" r="18" fill="var(--calendar-today-circle)" />
                    </svg>
                    <span className="calendar-day-number-highlight">{day}</span>
                  </div>
                ) : (
                  <span className="calendar-day-number">{day}</span>
                )}

                {getDayNotes(day).length > 0 && (
                  <div className="calendar-note-indicators">
                    {getDayNotes(day).slice(0, 4).map((note) => (
                      <div
                        key={note.id}
                        className="calendar-note-dot"
                        style={{ backgroundColor: note.type === 'todo' ? '#000' : (note.tag?.color || '#999') }}
                      />
                    ))}
                    {getDayNotes(day).length > 4 && (
                      <span className="calendar-note-more">+{getDayNotes(day).length - 4}</span>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        ))}
      </div>

      {/* ===== DAY MODAL ===== */}
      {showDayModal && (
        <div className="modal-overlay" onClick={closeDayModal}>
          <div className="day-modal" onClick={e => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={closeDayModal}>✕</button>

            {!showNoteCreation ? (
              <>
                <div className="modal-header">
                  <h2 className="modal-date">{monthNames[currentDate.getMonth()]} {selectedDay}, {currentYear}</h2>
                </div>

                {/* Emotion Selector */}
                <div className="emotion-selector">
                  {emotions.map(emotion => (
                    <button
                      key={emotion.id}
                      className={`emotion-btn${selectedEmotion === emotion.id ? ' emotion-btn--selected' : ''}`}
                      onClick={() => setSelectedEmotion(emotion.id)}
                      aria-label={emotion.label}
                      title={emotion.label}
                    >
                      <span className="emotion-emoji">{emotion.emoji}</span>
                    </button>
                  ))}
                </div>

                {/* Notes List */}
                <div className="notes-list">
                  {getDayNotes(selectedDay).map(note => (
                    <div
                      key={note.id}
                      className="note-item"
                      role="button"
                      onClick={() => {
                        if (note.type === 'todo') {
                          navigate(`/calendar/toDoList?todoId=${note.id}`)
                        } else if (note.type === 'note') {
                          navigate(`/calendar/note?noteId=${note.id}`)
                        }
                        closeDayModal()
                      }}
                      style={{ cursor: 'pointer' }}
                    >
                      <div className="note-color-indicator" style={{ backgroundColor: note.type === 'todo' ? '#000' : (note.tag?.color || '#999') }} />
                      <div className="note-content">
                        <div className="note-name">{note.name}</div>
                        <div className="note-meta">
                          {note.type === 'todo' ? 'To-do List' : note.tag?.name}
                          {note.emotion && ` • ${emotions.find(e => e.id === note.emotion)?.emoji}`}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <button className="add-note-btn" onClick={() => setShowNoteCreation(true)}>
                  <span className="add-note-icon">+</span>
                  Create New Note
                </button>
              </>
            ) : (
              <>
                {!noteType ? (
                  <div className="note-type-selection">
                    <button className="back-btn" onClick={handleBackFromNoteCreation}>← Back</button>
                    <h3 className="note-type-title">Choose Note Type</h3>
                    <div className="note-type-options">
                      <button className="note-type-option note-type-todo" onClick={() => handleNoteTypeSelect('todo')}>
                        <div className="note-type-icon">✓</div>
                        <div>
                          <div className="note-type-label">To-do List</div>
                        </div>
                      </button>
                      <button className="note-type-option note-type-note" onClick={() => handleNoteTypeSelect('note')}>
                        <div className="note-type-icon">📝</div>
                        <div>
                          <div className="note-type-label">Note</div>
                          <div className="note-type-description">With custom tags</div>
                        </div>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="note-form">
                    <button className="back-btn" onClick={() => setNoteType('')}>← Back</button>
                    <h3 className="note-form-title">{noteType === 'todo' ? 'Create To-do List' : 'Create Note'}</h3>

                    <div className="form-group">
                      <label className="form-label">Name</label>
                      <input
                        className="form-input"
                        value={noteName}
                        onChange={e => setNoteName(e.target.value)}
                        placeholder={noteType === 'todo' ? 'Enter task name' : 'Enter note name'}
                        autoFocus
                      />
                    </div>

                    {noteType === 'note' && (
                      <div className="form-group">
                        <label className="form-label">Select Tag</label>
                        <div className="tag-list">
                          {tags.map(tag => (
                            <label key={tag.id} className="tag-option">
                              <input
                                type="radio"
                                name="tag"
                                value={tag.id}
                                checked={selectedTag === tag.id}
                                onChange={() => setSelectedTag(tag.id)}
                                className="tag-radio-input"
                              />
                              <div className="tag-radio-btn">
                                <div className="tag-color" style={{ backgroundColor: tag.color }} />
                                <span className="tag-name">{tag.name}</span>
                              </div>
                            </label>
                          ))}
                        </div>

                        {!showNewTagForm ? (
                          <button className="create-tag-btn" onClick={() => setShowNewTagForm(true)} type="button">
                            + Create New Tag
                          </button>
                        ) : (
                          <div className="new-tag-form">
                            <div className="new-tag-inputs">
                              <input
                                className="form-input"
                                value={newTagName}
                                onChange={e => setNewTagName(e.target.value)}
                                placeholder="Tag name"
                              />
                              <div className="color-picker-wrapper">
                                <input type="color" className="color-picker" value={newTagColor} onChange={e => setNewTagColor(e.target.value)} />
                                <div className="color-preview" style={{ backgroundColor: newTagColor }} />
                              </div>
                            </div>
                            <div className="new-tag-actions">
                              <button className="btn btn-secondary" onClick={() => { setShowNewTagForm(false); setNewTagName(''); setNewTagColor('#FF6B6B') }} type="button">Cancel</button>
                              <button className="btn btn-primary" onClick={handleCreateNewTag} type="button" disabled={!newTagName.trim()}>Add Tag</button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <button className="btn btn-primary btn-save" onClick={handleSaveNote} disabled={!canSaveNote()}>
                      Save {noteType === 'todo' ? 'To-do' : 'Note'}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default Calendar
