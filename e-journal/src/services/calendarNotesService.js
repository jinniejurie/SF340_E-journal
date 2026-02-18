import { db, auth } from './firebase'
import { collection, doc, getDocs, setDoc, deleteDoc, onSnapshot, serverTimestamp } from 'firebase/firestore'

/**
 * Firestore path: USER / {uid} / CALENDAR_NOTES / {noteId}
 * Stores the calendar list: which note/todo appears on which date.
 * Document: { id, type, name, dateKey, tag, emotion, completed, createdAt, updatedAt }
 */

export async function getCalendarNotesFromFirestore() {
  if (!db || !auth?.currentUser) return {}
  const uid = auth.currentUser.uid
  const ref = collection(db, 'USER', uid, 'CALENDAR_NOTES')

  try {
    const snap = await getDocs(ref)
    const notes = {}

    snap.docs.forEach((docSnap) => {
      const data = docSnap.data()
      const dateKey = data.dateKey || data.date || ''
      if (!dateKey) return

      if (!notes[dateKey]) notes[dateKey] = []

      notes[dateKey].push({
        id: data.id ?? docSnap.id,
        type: data.type || 'note',
        name: data.name || '',
        tag: data.tag || null,
        emotion: data.emotion || null,
        date: dateKey,
        completed: data.completed !== undefined ? data.completed : false,
        color: data.color || null,
        createdAt: data.createdAt ? (data.createdAt?.toDate?.()?.toISOString?.() || data.createdAt) : new Date().toISOString()
      })
    })

    Object.keys(notes).forEach((dateKey) => {
      notes[dateKey].sort((a, b) => {
        const aTime = new Date(a.createdAt || 0).getTime()
        const bTime = new Date(b.createdAt || 0).getTime()
        return aTime - bTime
      })
    })

    return notes
  } catch (err) {
    console.error('Error loading calendar notes from Firestore:', err)
    return {}
  }
}

export async function saveCalendarNoteToFirestore(note) {
  if (!db || !auth?.currentUser) return
  const uid = auth.currentUser.uid
  const noteId = String(note.id)
  const ref = doc(db, 'USER', uid, 'CALENDAR_NOTES', noteId)

  try {
    await setDoc(
      ref,
      {
        id: note.id,
        type: note.type || 'note',
        name: note.name || '',
        dateKey: note.date || note.dateKey || '',
        tag: note.tag || null,
        emotion: note.emotion || null,
        completed: note.completed !== undefined ? note.completed : false,
        color: note.color || null,
        createdAt: note.createdAt || serverTimestamp(),
        updatedAt: serverTimestamp()
      },
      { merge: true }
    )
  } catch (err) {
    console.error('Error saving calendar note to Firestore:', err)
  }
}

export async function deleteCalendarNoteFromFirestore(noteId) {
  if (!db || !auth?.currentUser) return
  const uid = auth.currentUser.uid
  const ref = doc(db, 'USER', uid, 'CALENDAR_NOTES', String(noteId))

  try {
    await deleteDoc(ref)
  } catch (err) {
    console.error('Error deleting calendar note from Firestore:', err)
  }
}

export function subscribeToCalendarNotes(callback) {
  if (!db || !auth?.currentUser) {
    callback({})
    return () => {}
  }

  const uid = auth.currentUser.uid
  const ref = collection(db, 'USER', uid, 'CALENDAR_NOTES')

  return onSnapshot(
    ref,
    (snap) => {
      const notes = {}

      snap.docs.forEach((docSnap) => {
        const data = docSnap.data()
        const dateKey = data.dateKey || data.date || ''
        if (!dateKey) return

        if (!notes[dateKey]) notes[dateKey] = []

        notes[dateKey].push({
          id: data.id ?? docSnap.id,
          type: data.type || 'note',
          name: data.name || '',
          tag: data.tag || null,
          emotion: data.emotion || null,
          date: dateKey,
          completed: data.completed !== undefined ? data.completed : false,
          color: data.color || null,
          createdAt: data.createdAt ? (data.createdAt?.toDate?.()?.toISOString?.() || data.createdAt) : new Date().toISOString()
        })
      })

      Object.keys(notes).forEach((dateKey) => {
        notes[dateKey].sort((a, b) => {
          const aTime = new Date(a.createdAt || 0).getTime()
          const bTime = new Date(b.createdAt || 0).getTime()
          return aTime - bTime
        })
      })

      callback(notes)
    },
    (err) => {
      console.error('Error subscribing to calendar notes:', err)
      callback({})
    }
  )
}
