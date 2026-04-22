import { BrowserRouter, Routes, Route } from 'react-router-dom'
import AppLayout from './components/Layout/AppLayout'
import Dashboard from './pages/Dashboard'
import Assignments from './pages/Assignments'
import Pomodoro from './pages/Pomodoro'
import Resources from './pages/Resources'
import Schedule from './pages/Schedule'
import Settings from './pages/Settings'

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
          <Route index element={<Dashboard />} />
          <Route path="assignments" element={<Assignments />} />
          <Route path="pomodoro" element={<Pomodoro />} />
          <Route path="resources" element={<Resources />} />
          <Route path="resources/:resourceName" element={<Resources />} />
          <Route path="schedule" element={<Schedule />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
