import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { doc, serverTimestamp, setDoc } from 'firebase/firestore'

import LoginImg from '../assets/LoginImg.svg'
import '../styles/Auth.css'
import { signup, signOut } from '../services/authService'
import { db } from '../services/firebase'

function Signup() {
  const [username, setUsername] = useState('')
  const [birthDay, setBirthDay] = useState('')
  const [birthMonth, setBirthMonth] = useState('')
  const [birthYear, setBirthYear] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showSuccessPopup, setShowSuccessPopup] = useState(false)

  const navigate = useNavigate()

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')

    if (!username || !email || !password || !confirmPassword) {
      setError('Please fill in all required fields.')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)

    try {
      // 1. Create auth user
      const userCredential = await signup(email, password)
      const user = userCredential.user

      // 2. Create USER document in Firestore
      await setDoc(doc(db, 'USER', user.uid), {
        userId: user.uid,
        email,
        username,
        profileImage: '',
        createdAt: serverTimestamp(),
        birthday: {
          day: birthDay,
          month: birthMonth,
          year: birthYear,
        },
      })

      // 3. Sign out so user is not auto-logged in
      await signOut()
      setShowSuccessPopup(true)
    } catch (err) {
      setError(err.message || 'Failed to sign up. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const closeSuccessPopup = () => {
    setShowSuccessPopup(false)
    navigate('/login')
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-illustration" aria-hidden="true">
          <img src={LoginImg} alt="" className="auth-image" />
        </div>
        <section className="auth-panel" aria-label="Sign up">
          <h1 className="auth-title">Sign Up Account</h1>
          <p className="auth-subtitle">Enter your personal data to create your account.</p>

          <form className="auth-form" onSubmit={handleSubmit}>
            <label className="auth-field">
              <span className="auth-label">Username</span>
              <input
                type="text"
                placeholder="eg. kakeguruiMASHOOOO"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </label>

            <label className="auth-field">
              <span className="auth-label">Birthday</span>
              <div className="auth-birthday">
                <input
                  type="text"
                  placeholder="Day"
                  value={birthDay}
                  onChange={(e) => setBirthDay(e.target.value)}
                />
                <input
                  type="text"
                  placeholder="Month"
                  value={birthMonth}
                  onChange={(e) => setBirthMonth(e.target.value)}
                />
                <input
                  type="text"
                  placeholder="Year"
                  value={birthYear}
                  onChange={(e) => setBirthYear(e.target.value)}
                />
              </div>
            </label>

            <label className="auth-field">
              <span className="auth-label">Email</span>
              <input
                type="email"
                placeholder="eg. johnfrans@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>

            <label className="auth-field">
              <span className="auth-label">Password</span>
              <input
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>

            <label className="auth-field">
              <span className="auth-label">Confirm Password</span>
              <input
                type="password"
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </label>

            {error && <p className="auth-error">{error}</p>}

            <button type="submit" className="auth-submit" disabled={loading}>
              {loading ? 'Signing Up...' : 'Sign Up'}
            </button>
          </form>

          <p className="auth-footer">
            Already have an account? <Link to="/login">Log in</Link>
          </p>
        </section>
      </div>

      {showSuccessPopup && (
        <div className="auth-popup-overlay" role="dialog" aria-modal="true" aria-labelledby="auth-popup-title">
          <div className="auth-popup">
            <h2 id="auth-popup-title" className="auth-popup-title">Account created</h2>
            <p className="auth-popup-text">You can now log in with your email and password.</p>
            <button type="button" className="auth-popup-btn" onClick={closeSuccessPopup}>
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default Signup

