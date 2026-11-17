import { BrowserRouter, Routes, Route } from 'react-router-dom'
import AppLayout from './components/Layout/AppLayout'
import Dashboard from './pages/Dashboard'
import Assignments from './pages/Assignments'
import Pomodoro from './pages/Pomodoro'
import Resources from './pages/Resources'
import Schedule from './pages/Schedule'
import Settings from './pages/Settings'
import Home from './pages/Home'
import Blackboard from './pages/Blackboard'

function App() {
  return (
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route index element={<Home />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="assignments" element={<Assignments />} />
          <Route path="pomodoro" element={<Pomodoro />} />
          <Route path="resources" element={<Resources />} />
          <Route path="resources/:resourceName" element={<Resources />} />
          <Route path="blackboard" element={<Blackboard />} />
          <Route path="schedule" element={<Schedule />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
