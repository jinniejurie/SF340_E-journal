import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { doc, getDoc, updateDoc } from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'

import '../styles/Calendar.css'
import '../styles/Account.css'
import { auth, db } from '../services/firebase'
import { updateUserEmail, reauthenticateWithPassword } from '../services/authService'

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
  const navigate = useNavigate()
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

  const toggleSidebar = () => {
    setIsSidebarOpen(prev => !prev)
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
      <button
        className="calendar-nav-btn"
        aria-label="Toggle menu"
        type="button"
        onClick={toggleSidebar}
      >
        <svg width="25" height="25" viewBox="0 0 25 25" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path fillRule="evenodd" clipRule="evenodd" d="M11.9465 2.57188C11.8737 2.64445 11.816 2.73066 11.7766 2.82557C11.7372 2.92049 11.7169 3.02224 11.7169 3.125C11.7169 3.22776 11.7372 3.32951 11.7766 3.42443C11.816 3.51934 11.8737 3.60555 11.9465 3.67813L20.7699 12.5L11.9465 21.3219C11.7998 21.4686 11.7173 21.6675 11.7173 21.875C11.7173 22.0825 11.7998 22.2814 11.9465 22.4281C12.0932 22.5748 12.2921 22.6572 12.4996 22.6572C12.707 22.6572 12.906 22.5748 13.0527 22.4281L22.4277 13.0531C22.5005 12.9806 22.5582 12.8943 22.5976 12.7994C22.637 12.7045 22.6572 12.6028 22.6572 12.5C22.6572 12.3972 22.637 12.2955 22.5976 12.2006C22.5582 12.1057 22.5005 12.0194 22.4277 11.9469L13.0527 2.57188C12.9801 2.49912 12.8939 2.4414 12.799 2.40201C12.7041 2.36263 12.6023 2.34235 12.4996 2.34235C12.3968 2.34235 12.2951 2.36263 12.2002 2.40201C12.1052 2.4414 12.019 2.49912 11.9465 2.57188Z" fill="currentColor"/>
          <path fillRule="evenodd" clipRule="evenodd" d="M5.69646 2.57188C5.6237 2.64445 5.56598 2.73066 5.52659 2.82557C5.48721 2.92049 5.46693 3.02224 5.46693 3.125C5.46693 3.22776 5.48721 3.32951 5.52659 3.42443C5.56598 3.51934 5.6237 3.60555 5.69646 3.67813L14.5199 12.5L5.69646 21.3219C5.62382 21.3945 5.5662 21.4807 5.52689 21.5757C5.48758 21.6706 5.46734 21.7723 5.46734 21.875C5.46734 21.9777 5.48758 22.0794 5.52689 22.1743C5.5662 22.2693 5.62382 22.3555 5.69646 22.4281C5.76909 22.5008 5.85533 22.5584 5.95023 22.5977C6.04514 22.637 6.14686 22.6572 6.24958 22.6572C6.35231 22.6572 6.45402 22.637 6.54893 22.5977C6.64384 22.5584 6.73007 22.5008 6.80271 22.4281L16.1777 13.0531C16.2505 12.9806 16.3082 12.8943 16.3476 12.7994C16.387 12.7045 16.4072 12.6028 16.4072 12.5C16.4072 12.3972 16.387 12.2955 16.3476 12.2006C16.3082 12.1057 16.2505 12.0194 16.1777 11.9469L6.80271 2.57188C6.73013 2.49912 6.64392 2.4414 6.54901 2.40201C6.45409 2.36263 6.35234 2.34235 6.24958 2.34235C6.14682 2.34235 6.04507 2.36263 5.95015 2.40201C5.85524 2.4414 5.76903 2.49912 5.69646 2.57188Z" fill="currentColor"/>
        </svg>
      </button>

      <div className={`calendar-sidebar ${isSidebarOpen ? 'calendar-sidebar--open' : ''}`}>
        <button
          className="calendar-sidebar-close-btn"
          type="button"
          aria-label="Close menu"
          onClick={toggleSidebar}
        >
          «
        </button>
        <div className="calendar-sidebar-header">ejournal</div>
        <nav className="calendar-sidebar-nav" aria-label="Account navigation">
          <button type="button" className="calendar-sidebar-link calendar-sidebar-link--active">
            <span className="calendar-sidebar-link-icon">
              <svg width="22" height="22" viewBox="0 0 24 24">
                <path d="M12 12c1.66 0 3-1.34 3-3S13.66 6 12 6s-3 1.34-3 3 1.34 3 3 3Zm0 2c-2.33 0-7 1.17-7 3.5V19c0 1.1.9 2 2 2h10a2 2 0 0 0 2-2v-1.5C19 15.17 14.33 14 12 14Z" fill="currentColor" />
              </svg>
            </span>
            <span className="calendar-sidebar-link-label">Account</span>
          </button>
          <button
            type="button"
            className="calendar-sidebar-link"
            onClick={() => { navigate('/'); setIsSidebarOpen(false); }}
          >
            <span className="calendar-sidebar-link-icon">
              <svg width="22" height="22" viewBox="0 0 24 24">
                <path d="M12 3 3 10h2v8h5v-5h4v5h5v-8h2L12 3Z" fill="currentColor" />
              </svg>
            </span>
            <span className="calendar-sidebar-link-label">Home</span>
          </button>
          <button type="button" className="calendar-sidebar-link calendar-sidebar-link--accent">
            <span className="calendar-sidebar-link-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79L19 20.49 20.49 19 15.5 14Zm-6 0C8.01 14 6 11.99 6 9.5S8.01 5 10.5 5 15 7.01 15 9.5 12.99 14 10.5 14Z" fill="currentColor" />
              </svg>
            </span>
            <span className="calendar-sidebar-link-label">Search</span>
          </button>
          <button type="button" className="calendar-sidebar-link">
            <span className="calendar-sidebar-link-icon">
              <svg width="22" height="22" viewBox="0 0 24 24">
                <path d="M6 5h7v2H6v10h7v2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Zm9.59 3.59L18.17 11H11v2h7.17l-2.58 2.59L17 17l5-5-5-5-1.41 1.59Z" fill="currentColor" />
              </svg>
            </span>
            <span className="calendar-sidebar-link-label">Logout</span>
          </button>
        </nav>
      </div>

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
