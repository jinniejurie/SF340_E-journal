import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import LoginImg from '../assets/LoginImg.svg'
import '../styles/Auth.css'
import { login } from '../services/authService'

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')

    if (!email || !password) {
      setError('Please enter email and password.')
      return
    }

    setLoading(true)
    try {
      await login(email, password)
      navigate('/calendar')
    } catch (err) {
      setError(err.message || 'Login failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-illustration" aria-hidden="true">
          <img src={LoginImg} alt="" className="auth-image" />
        </div>
        <section className="auth-panel" aria-label="Login">
          <h1 className="auth-title">Login To Account</h1>
          <p className="auth-subtitle">Enter your personal data to login</p>

          <form className="auth-form" onSubmit={handleSubmit}>
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

            {error && <p className="auth-error">{error}</p>}

            <button type="submit" className="auth-submit" disabled={loading}>
              {loading ? 'Logging in…' : 'Login'}
            </button>
          </form>

          <p className="auth-footer">
            Don&apos;t have an account yet? <Link to="/signup">Sign Up</Link>
          </p>
        </section>
      </div>
    </div>
  )
}

export default Login
