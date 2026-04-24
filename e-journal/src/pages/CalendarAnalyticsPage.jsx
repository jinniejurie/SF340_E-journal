import { useEffect, useMemo, useState } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'
import Navbar from '../components/Navbar.jsx'
import MoodSummaryCard from '../components/analytics/MoodSummaryCard.jsx'
import MoodChart from '../components/analytics/MoodChart.jsx'
import { auth, db } from '../services/firebase'
import { getCalendarNotesFromFirestore } from '../services/calendarNotesService'
import '../styles/Analytics.css'

const DEFAULT_EMOTIONS = [
  { id: 'm01', emoji: '😠', label: 'Angry', score: 1 },
  { id: 'm02', emoji: '😢', label: 'Sad', score: 2 },
  { id: 'm03', emoji: '😌', label: 'Calm', score: 3 },
  { id: 'm04', emoji: '😊', label: 'Happy', score: 4 },
  { id: 'm05', emoji: '🤩', label: 'Excited', score: 5 },
]

function parseDateKey(dateKey) {
  const parts = String(dateKey || '').split('-')
  if (parts.length < 3) return null
  const year = Number(parts[0])
  const month = Number(parts[1])
  const day = Number(parts[2])
  if (!year || !month || !day) return null
  return { year, month, day, monthKey: `${year}-${String(month).padStart(2, '0')}` }
}

function CalendarAnalyticsPage() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [entries, setEntries] = useState([])
  const [moodMap, setMoodMap] = useState({})
  const [selectedMonth, setSelectedMonth] = useState('')

  useEffect(() => {
    if (!auth) {
      setLoading(false)
      return
    }

    let cancelled = false
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (cancelled) return
      setLoading(true)

      if (!user) {
        setEntries([])
        setMoodMap(Object.fromEntries(DEFAULT_EMOTIONS.map((m) => [m.id, m])))
        setLoading(false)
        return
      }

      try {
        const [calendarNotes, moodSnap] = await Promise.all([
          getCalendarNotesFromFirestore(),
          db ? getDocs(collection(db, 'MOOD')) : Promise.resolve(null),
        ])

        const nextMoodMap = {}
        if (moodSnap && !moodSnap.empty) {
          moodSnap.docs.forEach((d, idx) => {
            const data = d.data()
            const label = data.moodName || data.mood || data.name || `Mood ${idx + 1}`
            nextMoodMap[d.id] = {
              id: d.id,
              label,
              emoji: DEFAULT_EMOTIONS.find((e) => e.label === label)?.emoji || '',
            }
          })
        }

        DEFAULT_EMOTIONS.forEach((m) => {
          if (!nextMoodMap[m.id]) nextMoodMap[m.id] = m
        })

        const flatEntries = Object.values(calendarNotes || {})
          .flat()
          .filter((item) => item?.emotion && parseDateKey(item.date))

        if (!cancelled) {
          setMoodMap(nextMoodMap)
          setEntries(flatEntries)
        }
      } catch (_) {
        // Fallback to local cache to keep analytics available offline.
        try {
          const raw = localStorage.getItem('ejournal-notes')
          const cached = raw ? JSON.parse(raw) : {}
          const flatEntries = Object.values(cached)
            .flat()
            .filter((item) => item?.emotion && parseDateKey(item.date || item.dateKey))
          if (!cancelled) {
            setMoodMap(Object.fromEntries(DEFAULT_EMOTIONS.map((m) => [m.id, m])))
            setEntries(flatEntries)
          }
        } catch (_) {
          if (!cancelled) setEntries([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])

  const availableMonths = useMemo(() => {
    const monthSet = new Set()
    entries.forEach((entry) => {
      const parsed = parseDateKey(entry.date || entry.dateKey)
      if (parsed) monthSet.add(parsed.monthKey)
    })
    return Array.from(monthSet).sort((a, b) => (a > b ? -1 : 1))
  }, [entries])

  useEffect(() => {
    if (!selectedMonth && availableMonths.length > 0) {
      setSelectedMonth(availableMonths[0])
    }
  }, [availableMonths, selectedMonth])

  const monthlyEntries = useMemo(() => {
    if (!selectedMonth) return []
    return entries.filter((entry) => {
      const parsed = parseDateKey(entry.date || entry.dateKey)
      return parsed?.monthKey === selectedMonth
    })
  }, [entries, selectedMonth])

  const distributionData = useMemo(() => {
    const counts = {}
    monthlyEntries.forEach((entry) => {
      const key = entry.emotion
      counts[key] = (counts[key] || 0) + 1
    })

    return Object.entries(counts)
      .map(([id, count]) => ({
        id,
        count,
        label: moodMap[id]?.label || id,
      }))
      .sort((a, b) => b.count - a.count)
  }, [monthlyEntries, moodMap])

  const activeDays = useMemo(() => {
    const days = new Set(
      monthlyEntries
        .map((entry) => parseDateKey(entry.date || entry.dateKey)?.day)
        .filter(Boolean)
    )
    return days.size
  }, [monthlyEntries])

  const topMood = distributionData[0]?.label || 'N/A'
  const hasData = monthlyEntries.length > 0

  return (
    <div className={`calendar-page analytics-page ${isSidebarOpen ? 'calendar-page--with-sidebar' : ''}`}>
      <Navbar
        defaultOpen={false}
        open={isSidebarOpen}
        onOpenChange={setIsSidebarOpen}
        hideToggleButton
        ariaLabel="Calendar analytics navigation"
      />

      <button
        className={`analytics-nav-btn ${isSidebarOpen ? 'analytics-nav-btn--hidden' : ''}`}
        aria-label="Open menu"
        type="button"
        onClick={() => setIsSidebarOpen(true)}
      >
        <svg width="25" height="25" viewBox="0 0 25 25" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path fillRule="evenodd" clipRule="evenodd" d="M11.9465 2.57188C11.8737 2.64445 11.816 2.73066 11.7766 2.82557C11.7372 2.92049 11.7169 3.02224 11.7169 3.125C11.7169 3.22776 11.7372 3.32951 11.7766 3.42443C11.816 3.51934 11.8737 3.60555 11.9465 3.67813L20.7699 12.5L11.9465 21.3219C11.7998 21.4686 11.7173 21.6675 11.7173 21.875C11.7173 22.0825 11.7998 22.2814 11.9465 22.4281C12.0932 22.5748 12.2921 22.6572 12.4996 22.6572C12.707 22.6572 12.906 22.5748 13.0527 22.4281L22.4277 13.0531C22.5005 12.9806 22.5582 12.8943 22.5976 12.7994C22.637 12.7045 22.6572 12.6028 22.6572 12.5C22.6572 12.3972 22.637 12.2955 22.5976 12.2006C22.5582 12.1057 22.5005 12.0194 22.4277 11.9469L13.0527 2.57188C12.9801 2.49912 12.8939 2.4414 12.799 2.40201C12.7041 2.36263 12.6023 2.34235 12.4996 2.34235C12.3968 2.34235 12.2951 2.36263 12.2002 2.40201C12.1052 2.4414 12.019 2.49912 11.9465 2.57188Z" fill="currentColor" />
          <path fillRule="evenodd" clipRule="evenodd" d="M5.69646 2.57188C5.6237 2.64445 5.56598 2.73066 5.52659 2.82557C5.48721 2.92049 5.46693 3.02224 5.46693 3.125C5.46693 3.22776 5.48721 3.32951 5.52659 3.42443C5.56598 3.51934 5.6237 3.60555 5.69646 3.67813L14.5199 12.5L5.69646 21.3219C5.62382 21.3945 5.5662 21.4807 5.52689 21.5757C5.48758 21.6706 5.46734 21.7723 5.46734 21.875C5.46734 21.9777 5.48758 22.0794 5.52689 22.1743C5.5662 22.2693 5.62382 22.3555 5.69646 22.4281C5.76909 22.5008 5.85533 22.5584 5.95023 22.5977C6.04514 22.637 6.14686 22.6572 6.24958 22.6572C6.35231 22.6572 6.45402 22.637 6.54893 22.5977C6.64384 22.5584 6.73007 22.5008 6.80271 22.4281L16.1777 13.0531C16.2505 12.9806 16.3082 12.8943 16.3476 12.7994C16.387 12.7045 16.4072 12.6028 16.4072 12.5C16.4072 12.3972 16.387 12.2955 16.3476 12.2006C16.3082 12.1057 16.2505 12.0194 16.1777 11.9469L6.80271 2.57188C6.73013 2.49912 6.64392 2.4414 6.54901 2.40201C6.45409 2.36263 6.35234 2.34235 6.24958 2.34235C6.14682 2.34235 6.04507 2.36263 5.95015 2.40201C5.85524 2.4414 5.76903 2.49912 5.69646 2.57188Z" fill="currentColor" />
        </svg>
      </button>

      <main className="analytics-main">
        <header className="analytics-header">
          <h1 className="analytics-title">Calendar Analytics</h1>
          <div className="analytics-filter">
            <label htmlFor="month-filter" className="analytics-filter-label">Month</label>
            <select
              id="month-filter"
              className="analytics-filter-select"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              disabled={availableMonths.length === 0}
            >
              {availableMonths.length === 0 ? (
                <option value="">No data</option>
              ) : (
                availableMonths.map((monthKey) => <option key={monthKey} value={monthKey}>{monthKey}</option>)
              )}
            </select>
          </div>
        </header>

        {loading ? (
          <p className="analytics-empty">Loading analytics...</p>
        ) : !hasData ? (
          <p className="analytics-empty">No mood entries found for this month.</p>
        ) : (
          <>
            <MoodSummaryCard
              totalEntries={monthlyEntries.length}
              activeDays={activeDays}
              topMood={topMood}
            />
            <section className="analytics-charts-grid">
              <MoodChart data={distributionData} />
            </section>
          </>
        )}
      </main>
    </div>
  )
}

export default CalendarAnalyticsPage
