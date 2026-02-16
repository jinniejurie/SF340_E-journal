import { useState, useEffect } from 'react'
import { doc, getDoc, updateDoc } from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'

import '../styles/Calendar.css'
import '../styles/Account.css'
import { auth, db } from '../services/firebase'
import { updateUserEmail, reauthenticateWithPassword } from '../services/authService'
import Navbar from '../components/Navbar.jsx'

const defaultBirthday = { day: '', month: '', year: '' }

function accountDataFromDoc(data) {
  if (!data) return null
  const birthday = data.birthday && typeof data.birthday === 'object'
    ? {
        day: String(data.birthday.day ?? ''),
        month: String(data.birthday.month ?? ''),
        year: String(data.birthday.year ?? ''),
      }
    : defaultBirthday
  return {
    username: String(data.username ?? ''),
    email: String(data.email ?? ''),
    profileImage: String(data.profileImage ?? ''),
    birthday,
  }
}

function Account() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const [isEditMode, setIsEditMode] = useState(false)
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    profileImage: '',
    birthday: { ...defaultBirthday },
  })
  const [tempFormData, setTempFormData] = useState({ ...formData })
  const [passwordForEmailChange, setPasswordForEmailChange] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState({ text: '', type: '' }) // type: 'success' | 'error'

  // Auth state and fetch USER document
  useEffect(() => {
    if (!auth || !db) {
      setLoadError('Firebase is not configured.')
      setLoading(false)
      return
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setLoading(false)
        return
      }
      setUser(firebaseUser)
      setLoadError('')
      try {
        const userDoc = await getDoc(doc(db, 'USER', firebaseUser.uid))
        const data = accountDataFromDoc(userDoc.exists() ? userDoc.data() : null)
        const initial = data || {
          username: '',
          email: firebaseUser.email ?? '',
          profileImage: '',
          birthday: { ...defaultBirthday },
        }
        setFormData(initial)
        setTempFormData(initial)
      } catch (err) {
        setLoadError(err.message || 'Failed to load profile.')
      } finally {
        setLoading(false)
      }
    })

    return () => unsubscribe()
  }, [])

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setTempFormData(prev => ({ ...prev, profileImage: reader.result }))
      }
      reader.readAsDataURL(file)
    }
  }

  const handleEditClick = () => {
    setIsEditMode(true)
    setTempFormData({
      ...formData,
      birthday: { ...formData.birthday },
    })
    setPasswordForEmailChange('')
    setMessage({ text: '', type: '' })
  }

  const handleInputChange = (field, value) => {
    setTempFormData(prev => ({
      ...prev,
      [field]: value,
    }))
  }

  const handleBirthdayChange = (part, value) => {
    setTempFormData(prev => ({
      ...prev,
      birthday: { ...prev.birthday, [part]: value },
    }))
  }

  const validate = () => {
    const u = tempFormData.username?.trim()
    if (!u) {
      setMessage({ text: 'Username cannot be empty.', type: 'error' })
      return false
    }
    const email = tempFormData.email?.trim()
    if (!email) {
      setMessage({ text: 'Email cannot be empty.', type: 'error' })
      return false
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      setMessage({ text: 'Please enter a valid email address.', type: 'error' })
      return false
    }
    const { day, month, year } = tempFormData.birthday || defaultBirthday
    if (!day?.trim() || !month?.trim() || !year?.trim()) {
      setMessage({ text: 'Please fill in day, month, and year for birthday.', type: 'error' })
      return false
    }
    const emailChanged = email !== formData.email
    if (emailChanged && !passwordForEmailChange?.trim()) {
      setMessage({ text: 'Please enter your current password to change your email.', type: 'error' })
      return false
    }
    return true
  }

  const handleSave = async () => {
    setMessage({ text: '', type: '' })
    if (!validate()) return
    if (!user || !auth || !db) return

    setSaving(true)
    const emailChanged = tempFormData.email?.trim() !== formData.email
    const newEmail = tempFormData.email?.trim()
    const newUsername = tempFormData.username?.trim()
    const newBirthday = {
      day: String(tempFormData.birthday?.day ?? '').trim(),
      month: String(tempFormData.birthday?.month ?? '').trim(),
      year: String(tempFormData.birthday?.year ?? '').trim(),
    }
    const newProfileImage = tempFormData.profileImage ?? ''

    try {
      if (emailChanged) {
        await reauthenticateWithPassword(user, formData.email, passwordForEmailChange)
        await updateUserEmail(user, newEmail)
      }

      await updateDoc(doc(db, 'USER', user.uid), {
        username: newUsername,
        email: newEmail,
        profileImage: newProfileImage,
        birthday: newBirthday,
      })

      const updated = {
        username: newUsername,
        email: newEmail,
        profileImage: newProfileImage,
        birthday: { ...newBirthday },
      }
      setFormData(updated)
      setTempFormData(updated)
      setPasswordForEmailChange('')
      setIsEditMode(false)
      setMessage({ text: 'Profile updated successfully.', type: 'success' })
    } catch (err) {
      const msg = err.message || 'Failed to update profile.'
      const code = err.code || ''
      if (code === 'auth/invalid-credential' || code === 'auth/wrong-password') {
        setMessage({ text: 'Current password is incorrect.', type: 'error' })
      } else if (code === 'auth/email-already-in-use') {
        setMessage({ text: 'This email is already in use by another account.', type: 'error' })
      } else if (code === 'auth/requires-recent-login') {
        setMessage({ text: 'Please enter your current password to change your email.', type: 'error' })
      } else {
        setMessage({ text: msg, type: 'error' })
      }
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setIsEditMode(false)
    setTempFormData({
      ...formData,
      birthday: { ...formData.birthday },
    })
    setPasswordForEmailChange('')
    setMessage({ text: '', type: '' })
  }

  const birthdayDisplay = formData.birthday?.day && formData.birthday?.month && formData.birthday?.year
    ? `${formData.birthday.day}/${formData.birthday.month}/${formData.birthday.year}`
    : '—'

  if (loading) {
    return (
      <div className="calendar-page">
        <main className="account-main">
          <p className="account-message account-loading">Loading profile…</p>
        </main>
      </div>
    )
  }

  if (loadError || !user) {
    return (
      <div className="calendar-page">
        <main className="account-main">
          <p className="account-message account-error">{loadError || 'You must be logged in to view this page.'}</p>
        </main>
      </div>
    )
  }

  return (
    <div className={`calendar-page ${isSidebarOpen ? 'calendar-page--with-sidebar' : ''}`}>
      <Navbar
        onOpenChange={setIsSidebarOpen}
        ariaLabel="Account navigation"
      />

      <main className="account-main">
        <div className="account-header">
          <h1 className="account-title">Profile</h1>
          {!isEditMode && (
            <button className="account-edit-btn" onClick={handleEditClick} type="button">✏️</button>
          )}
        </div>

        {message.text && (
          <p className={`account-message account-message--${message.type}`} role="alert">
            {message.text}
          </p>
        )}

        {!isEditMode ? (
          <div className="account-body">
            <div className="account-avatar">
              <img
                src={formData.profileImage || 'https://dummyimage.com/160x160/cccccc/ffffff&text=Profile'}
                alt="Profile"
              />
            </div>
            <div className="account-info">
              <p><span>Username:</span> {formData.username || '—'}</p>
              <p><span>Birthday:</span> {birthdayDisplay}</p>
              <p><span>Email:</span> {formData.email || '—'}</p>
            </div>
          </div>
        ) : (
          <div className="account-edit-form">
            <div className="form-section">
              <h3>Profile Picture</h3>
              <div className="profile-image-upload">
                <img
                  src={tempFormData.profileImage || 'https://dummyimage.com/160x160/cccccc/ffffff&text=Profile'}
                  alt="Profile preview"
                  className="profile-preview"
                />
                <label className="upload-btn">
                  📤 Upload Image
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    style={{ display: 'none' }}
                  />
                </label>
              </div>
            </div>

            <div className="form-section">
              <h3>Personal Information</h3>
              <div className="form-group">
                <label>Username</label>
                <input
                  type="text"
                  value={tempFormData.username}
                  onChange={(e) => handleInputChange('username', e.target.value)}
                  placeholder="Enter username"
                />
              </div>

              <div className="form-group">
                <label>Birthday</label>
                <div className="account-birthday-fields">
                  <input
                    type="text"
                    value={tempFormData.birthday?.day ?? ''}
                    onChange={(e) => handleBirthdayChange('day', e.target.value)}
                    placeholder="Day"
                    aria-label="Birthday day"
                  />
                  <input
                    type="text"
                    value={tempFormData.birthday?.month ?? ''}
                    onChange={(e) => handleBirthdayChange('month', e.target.value)}
                    placeholder="Month"
                    aria-label="Birthday month"
                  />
                  <input
                    type="text"
                    value={tempFormData.birthday?.year ?? ''}
                    onChange={(e) => handleBirthdayChange('year', e.target.value)}
                    placeholder="Year"
                    aria-label="Birthday year"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  value={tempFormData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  placeholder="Enter email"
                />
              </div>

              {tempFormData.email?.trim() !== formData.email && (
                <div className="form-group">
                  <label>Current password (required to change email)</label>
                  <input
                    type="password"
                    value={passwordForEmailChange}
                    onChange={(e) => setPasswordForEmailChange(e.target.value)}
                    placeholder="Enter your current password"
                    autoComplete="current-password"
                  />
                </div>
              )}
            </div>

            <div className="form-actions">
              <button type="button" className="btn-save" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : '💾 Save'}
              </button>
              <button type="button" className="btn-cancel" onClick={handleCancel} disabled={saving}>
                ❌ Cancel
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default Account
