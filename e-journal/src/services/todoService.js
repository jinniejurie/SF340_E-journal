import { db, auth } from './firebase'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'

/**
 * Firestore path: USER / {uid} / TODOS / {todoId}
 * Document: { dateKey, title, items: [{ id, text, completed }], paperColor, textColor, updatedAt }
 */

export async function getTodoFromFirestore(todoId) {
  if (!db || !auth?.currentUser) return null
  const uid = auth.currentUser.uid
  const ref = doc(db, 'USER', uid, 'TODOS', String(todoId))
  const snap = await getDoc(ref)
  if (!snap.exists()) return null
  const data = snap.data()
  return {
    title: data.title ?? '',
    items: Array.isArray(data.items) ? data.items : [],
    paperColor: data.paperColor ?? '#F7F7F7',
    textColor: data.textColor ?? '#3A3030',
    dateKey: data.dateKey ?? null
  }
}

export async function saveTodoToFirestore(todoId, payload) {
  if (!db || !auth?.currentUser) return
  const uid = auth.currentUser.uid
  const ref = doc(db, 'USER', uid, 'TODOS', String(todoId))
  await setDoc(ref, {
    ...payload,
    updatedAt: serverTimestamp()
  }, { merge: true })
}
