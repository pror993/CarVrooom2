import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import GridBackground from './components/GridBackground'
import ProtectedRoute from './components/ProtectedRoute'
import Home from './pages/Home'
import Login from './pages/Login'
import Signup from './pages/Signup'
import VehicleOwnerDashboard from './pages/VehicleOwnerDashboard'
import FleetOwnerDashboard from './pages/FleetOwnerDashboard'
import VehicleDetailPage from './pages/VehicleDetailPage'
import ServiceCenterDashboard from './pages/ServiceCenterDashboard'
import TechnicianDashboard from './pages/TechnicianDashboard'

// Component to handle role-based redirect after login
function DashboardRedirect() {
  const { user } = useAuth()

  const routes = {
    vehicle_owner: '/dashboard/vehicle-owner',
    fleet_owner: '/dashboard/fleet-owner',
    service_center: '/dashboard/service-center',
    technician: '/dashboard/technician',
  }

  return <Navigate to={routes[user?.role] || '/'} replace />
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <GridBackground>
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />

            {/* Protected dashboard routes */}
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <DashboardRedirect />
              </ProtectedRoute>
            } />

            <Route path="/dashboard/vehicle-owner" element={
              <ProtectedRoute allowedRoles={['vehicle_owner']}>
                <VehicleOwnerDashboard />
              </ProtectedRoute>
            } />

            <Route path="/dashboard/fleet-owner" element={
              <ProtectedRoute allowedRoles={['fleet_owner']}>
                <FleetOwnerDashboard />
              </ProtectedRoute>
            } />

            <Route path="/vehicle/:vehicleId" element={
              <ProtectedRoute allowedRoles={['fleet_owner', 'vehicle_owner']}>
                <VehicleDetailPage />
              </ProtectedRoute>
            } />

            <Route path="/dashboard/service-center" element={
              <ProtectedRoute allowedRoles={['service_center']}>
                <ServiceCenterDashboard />
              </ProtectedRoute>
            } />

            <Route path="/dashboard/technician" element={
              <ProtectedRoute allowedRoles={['technician']}>
                <TechnicianDashboard />
              </ProtectedRoute>
            } />
          </Routes>
        </GridBackground>
      </Router>
    </AuthProvider>
  )
}

export default App
