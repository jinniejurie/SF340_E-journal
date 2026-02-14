import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronLeft, Download, Share2, Palette, Plus } from 'lucide-react'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import '../styles/ToDoList.css'

const getTodoFromCalendar = (todoId) => {
  try {
    const stored = localStorage.getItem('ejournal-notes')
    if (!stored) return null
    const notes = JSON.parse(stored)
    for (const dateKey of Object.keys(notes)) {
      const list = notes[dateKey] || []
      const todo = list.find((n) => String(n.id) === String(todoId) && n.type === 'todo')
      if (todo) return { todo, dateKey }
    }
  } catch (e) {}
  return null
}

const updateCalendarTodoName = (todoId, newName) => {
  try {
    const stored = localStorage.getItem('ejournal-notes')
    if (!stored) return
    const notes = JSON.parse(stored)
    for (const dateKey of Object.keys(notes)) {
      const list = notes[dateKey] || []
      const idx = list.findIndex((n) => String(n.id) === String(todoId) && n.type === 'todo')
      if (idx !== -1) {
        const updated = [...list]
        updated[idx] = { ...updated[idx], name: newName }
        notes[dateKey] = updated
        localStorage.setItem('ejournal-notes', JSON.stringify(notes))
        return
      }
    }
  } catch (e) {}
}

function ToDoList() {
  const [searchParams] = useSearchParams()
  const todoId = searchParams.get('todoId')

  const calendarTodoResult = todoId ? getTodoFromCalendar(todoId) : null
  const calendarTodo = calendarTodoResult?.todo ?? null
  const defaultTitle = calendarTodo ? calendarTodo.name : 'Hawaii to do list 🏄🏻‍♀️️'

  const [title, setTitle] = useState(defaultTitle)
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [items, setItems] = useState(() => [
    { id: `default-${Date.now()}`, text: '', completed: false }
  ])
  const [openMenu, setOpenMenu] = useState(null) // 'customize' | 'share' | null

  const [paperColor, setPaperColor] = useState('#F7F7F7')
  const [textColor, setTextColor] = useState('#3A3030') // ใช้กับ title, ตัวอักษรรายการ, เส้นใต้, checkbox
  const paperRef = useRef(null)

  useEffect(() => {
    const result = todoId ? getTodoFromCalendar(todoId) : null
    if (result?.todo?.name) {
      setTitle(result.todo.name)
    }
  }, [todoId])

  const openCustomize = () => setOpenMenu((m) => (m === 'customize' ? null : 'customize'))
  const openShare = () => setOpenMenu((m) => (m === 'share' ? null : 'share'))

  const addItem = () => {
    const newItem = {
      id: Date.now().toString(),
      text: '',
      completed: false
    }
    setItems([...items, newItem])
  }

  const toggleItem = (id) => {
    setItems(items.map((item) =>
      item.id === id ? { ...item, completed: !item.completed } : item
    ))
  }

  const updateItemText = (id, text) => {
    setItems(items.map((item) =>
      item.id === id ? { ...item, text } : item
    ))
  }

  const deleteItem = (id) => {
    setItems(items.filter((item) => item.id !== id))
  }

  const downloadAsPDF = async () => {
    if (!paperRef.current) return
    setOpenMenu(null)
    try {
      const canvas = await html2canvas(paperRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: paperColor,
        logging: false
      })
      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      })
      const pageW = pdf.internal.pageSize.getWidth()
      const pageH = pdf.internal.pageSize.getHeight()
      const imgW = canvas.width
      const imgH = canvas.height
      const pxToMm = 0.264583
      const margin = 10
      let w = imgW * pxToMm
      let h = imgH * pxToMm
      const scale = Math.min((pageW - margin * 2) / w, (pageH - margin * 2) / h, 1)
      w *= scale
      h *= scale
      pdf.addImage(imgData, 'PNG', (pageW - w) / 2, (pageH - h) / 2, w, h)
      const safeName = (title || 'todo-list').replace(/[<>:"/\\|?*]/g, '').trim().slice(0, 60) || 'todo-list'
      pdf.save(`${safeName}.pdf`)
    } catch (err) {
      console.error(err)
      alert('ไม่สามารถสร้าง PDF ได้ กรุณาลองอีกครั้ง')
    }
  }

  const shareAsLink = () => {
    const link = window.location.href
    navigator.clipboard.writeText(link)
    alert('Link copied to clipboard!')
  }

  const navigate = useNavigate()

  return (
    <div className="todolist-page">
      <div className="todolist-navbar">
        <button
          className="todolist-nav-btn"
          onClick={() => navigate('/calendar')}
        >
          <ChevronLeft size={24} />
        </button>

        <div className="todolist-nav-controls">
          <div className="todolist-nav-dropdown">
            <button
              className="todolist-nav-btn"
              onClick={openCustomize}
              title="Customize"
              aria-expanded={openMenu === 'customize'}
            >
              <Palette size={20} />
            </button>
            {openMenu === 'customize' && (
              <div className="todolist-dropdown-menu todolist-customize-menu todolist-menu-small">
                <div className="customize-section">
                  <label>Paper Color</label>
                  <div className="color-picker-row">
                    <input
                      type="color"
                      value={paperColor}
                      onChange={(e) => setPaperColor(e.target.value)}
                    />
                    <span>{paperColor}</span>
                  </div>
                </div>
                <div className="customize-section">
                  <label>Text & line color</label>
                  <div className="color-picker-row">
                    <input
                      type="color"
                      value={textColor}
                      onChange={(e) => setTextColor(e.target.value)}
                    />
                    <span>{textColor}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="todolist-nav-divider" />

          <div className="todolist-nav-dropdown">
            <button
              className="todolist-nav-btn"
              onClick={openShare}
              title="Share"
              aria-expanded={openMenu === 'share'}
            >
              <Share2 size={20} />
            </button>
            {openMenu === 'share' && (
              <div className="todolist-dropdown-menu todolist-menu-small">
                <button onClick={shareAsLink}>📎 Copy Link</button>
                <button onClick={downloadAsPDF}><Download size={18} /> Download PDF</button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="todolist-container">
        <div ref={paperRef} className="todolist-paper" style={{ backgroundColor: paperColor }}>
          {isEditingTitle ? (
            <input
              className="todolist-title-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => {
                setIsEditingTitle(false)
                if (todoId) updateCalendarTodoName(todoId, title)
              }}
              autoFocus
              style={{ color: textColor }}
            />
          ) : (
            <h1 className="todolist-title" onClick={() => setIsEditingTitle(true)} style={{ color: textColor }}>
              {title}
            </h1>
          )}

          <div className="todolist-items">
            {items.map((item) => (
              <div key={item.id} className="todolist-item">
                <div className="todolist-item-content">
                  <button
                    className="todolist-checkbox"
                    onClick={() => toggleItem(item.id)}
                    style={{
                      borderColor: textColor,
                      backgroundColor: item.completed ? textColor : 'transparent'
                    }}
                  >
                    {item.completed && (
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path
                          d="M2 6L5 9L10 3"
                          stroke="white"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </button>

                  <input
                    type="text"
                    className={`todolist-item-input ${item.completed ? 'completed' : ''}`}
                    value={item.text}
                    onChange={(e) => updateItemText(item.id, e.target.value)}
                    placeholder="Type your task..."
                    style={{
                      borderBottomColor: textColor,
                      color: textColor,
                      textDecoration: item.completed ? 'line-through' : 'none'
                    }}
                  />

                  <button
                    className="todolist-delete-btn"
                    onClick={() => deleteItem(item.id)}
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}

            <button
              className="todolist-add-btn todolist-add-btn-circle"
              onClick={addItem}
              title="Add item"
              style={{
                color: textColor,
                backgroundColor: `${textColor}15`
              }}
            >
              <Plus size={20} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ToDoList
