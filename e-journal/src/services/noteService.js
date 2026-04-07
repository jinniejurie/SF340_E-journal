import { db, auth } from './firebase'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'

/**
 * Firestore path: USER / {uid} / NOTES / {noteId}
 * Document: { dateKey, title, tagName, tagColor, textBoxes, shapes, images, stickers, maxZIndex, updatedAt }
 * textBoxes[] may include fontSize (number px); inline HTML must not carry font-size (stripped on save).
 */

export async function getNoteFromFirestore(noteId) {
  if (!db || !auth?.currentUser) return null
  const uid = auth.currentUser.uid
  const ref = doc(db, 'USER', uid, 'NOTES', String(noteId))
  const snap = await getDoc(ref)
  if (!snap.exists()) return null
  const data = snap.data()
  return {
    title: data.title ?? '',
    tagName: data.tagName ?? '',
    tagColor: data.tagColor ?? '#FF6B6B',
    textBoxes: Array.isArray(data.textBoxes) ? data.textBoxes : [],
    shapes: Array.isArray(data.shapes) ? data.shapes : [],
    images: Array.isArray(data.images) ? data.images : [],
    stickers: Array.isArray(data.stickers) ? data.stickers : [],
    maxZIndex: typeof data.maxZIndex === 'number' ? data.maxZIndex : 1,
    coverTitle: data.coverTitle ?? '',
    coverColor: data.coverColor ?? '',
    coverImage: data.coverImage ?? '',
    coverTitlePos: data.coverTitlePos ?? null
  }
}

export async function saveNoteToFirestore(noteId, payload) {
  if (!db || !auth?.currentUser) return
  const uid = auth.currentUser.uid
  const ref = doc(db, 'USER', uid, 'NOTES', String(noteId))
  await setDoc(ref, {
    ...payload,
    updatedAt: serverTimestamp()
  }, { merge: true })
}
