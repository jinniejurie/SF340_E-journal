/**
 * ล้างข้อมูล ejournal ทั้งหมดใน localStorage (เรียกตอน logout)
 * เพื่อไม่ให้บัญชีถัดไปเห็นโน้ต/รายการของบัญชีเดิม
 */
export function clearEjournalLocalStorage() {
  try {
    const fixedKeys = [
      'ejournal-theme',
      'ejournal-tags',
      'ejournal-notes',
      'ejournal-profile',
    ]
    fixedKeys.forEach((key) => localStorage.removeItem(key))

    const keysToRemove = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && (key.startsWith('ejournal-todo-') || key.startsWith('ejournal-note-'))) {
        keysToRemove.push(key)
      }
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key))
  } catch (e) {
    // ignore
  }
}
