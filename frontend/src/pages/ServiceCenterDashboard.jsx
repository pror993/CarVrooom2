import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { HiCog, HiLogout, HiUser, HiCalendar, HiLocationMarker } from 'react-icons/hi'

function ServiceCenterDashboard() {
    const { user, logout } = useAuth()
    const navigate = useNavigate()

    const handleLogout = async () => {
        await logout()
        navigate('/')
    }

    return (
        <div className="min-h-screen bg-black text-white">
            {/* Header */}
            <nav className="border-b border-gray-800">
                <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
                    <h1 className="text-2xl font-bold">AfterCare AI™ Service Center</h1>
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-md transition-colors"
                    >
                        <HiLogout />
                        Logout
                    </button>
                </div>
            </nav>

            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-6 py-8">
                <div className="mb-8">
                    <h2 className="text-3xl font-bold mb-2">Service Center Dashboard</h2>
                    <p className="text-gray-400">Manage service requests, {user?.profile?.name || user?.email}!</p>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                    <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-blue-900/20 rounded-lg">
                                <HiCalendar className="text-3xl text-blue-400" />
                            </div>
                            <div>
                                <p className="text-gray-400 text-sm">Today's Jobs</p>
                                <p className="text-2xl font-bold">0</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-yellow-900/20 rounded-lg">
                                <HiCog className="text-3xl text-yellow-400" />
                            </div>
                            <div>
                                <p className="text-gray-400 text-sm">In Progress</p>
                                <p className="text-2xl font-bold">0</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-green-900/20 rounded-lg">
                                <HiUser className="text-3xl text-green-400" />
                            </div>
                            <div>
                                <p className="text-gray-400 text-sm">Technicians</p>
                                <p className="text-2xl font-bold">0</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-purple-900/20 rounded-lg">
                                <HiLocationMarker className="text-3xl text-purple-400" />
                            </div>
                            <div>
                                <p className="text-gray-400 text-sm">Pending Requests</p>
                                <p className="text-2xl font-bold">0</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Center Info */}
                <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
                    <h3 className="text-xl font-bold mb-4">Service Center Information</h3>
                    <div className="space-y-3">
                        <div className="flex justify-between">
                            <span className="text-gray-400">Center Name:</span>
                            <span className="font-medium">{user?.profile?.centerName || 'Not set'}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-400">Email:</span>
                            <span className="font-medium">{user?.email}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-400">Phone:</span>
                            <span className="font-medium">{user?.profile?.phone || 'Not set'}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-400">Certifications:</span>
                            <span className="font-medium">
                                {user?.profile?.certifications?.length > 0
                                    ? user.profile.certifications.join(', ')
                                    : 'Not set'}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-400">Role:</span>
                            <span className="font-medium capitalize">{user?.role?.replace('_', ' ')}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ServiceCenterDashboard
