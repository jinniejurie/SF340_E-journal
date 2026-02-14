import './App.css'
import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home.jsx'
import Login from './pages/Login.jsx'
import Signup from './pages/Signup.jsx'
import Calendar from './pages/Calendar.jsx'
import Note from './pages/Note.jsx'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/calendar" element={<Calendar />} />
      <Route path="/calendar/note" element={<Note />} />
    </Routes>
  )
}

export default App
