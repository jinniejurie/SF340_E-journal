import './App.css'
import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home.jsx'
import Login from './pages/Login.jsx'
import Signup from './pages/Signup.jsx'
import Account from './pages/Account.jsx'
import Calendar from './pages/Calendar.jsx'
import ToDoList from './pages/ToDoList.jsx'
import Note from './pages/Note.jsx'
import Search from './pages/Search.jsx'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/account" element={<Account />} />
      <Route path="/calendar" element={<Calendar />} />
      <Route path="/calendar/search" element={<Search />} />
      <Route path="/calendar/toDoList" element={<ToDoList />} />
      <Route path="/calendar/note" element={<Note />} />
    </Routes>
  )
}

export default App
