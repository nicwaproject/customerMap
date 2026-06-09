import { BrowserRouter, Route, Routes } from 'react-router-dom'
import ProtectedApp from './components/ProtectedApp'
import Login from './pages/Login'
import RootDashboard from './pages/RootDashboard'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<ProtectedApp />}>
          <Route path="/" element={<RootDashboard />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
