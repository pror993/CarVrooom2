import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { HiChartBar, HiLogout, HiUser, HiTruck, HiLocationMarker } from 'react-icons/hi'

function FleetOwnerDashboard() {
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
                    <h1 className="text-2xl font-bold">CarVrooom Fleet Management</h1>
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
                    <h2 className="text-3xl font-bold mb-2">Fleet Owner Dashboard</h2>
                    <p className="text-gray-400">Manage your entire fleet, {user?.profile?.name || user?.email}!</p>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                    <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-blue-900/20 rounded-lg">
                                <HiTruck className="text-3xl text-blue-400" />
                            </div>
                            <div>
                                <p className="text-gray-400 text-sm">Total Vehicles</p>
                                <p className="text-2xl font-bold">0</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-green-900/20 rounded-lg">
                                <HiChartBar className="text-3xl text-green-400" />
                            </div>
                            <div>
                                <p className="text-gray-400 text-sm">Active Vehicles</p>
                                <p className="text-2xl font-bold">0</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-yellow-900/20 rounded-lg">
                                <HiLocationMarker className="text-3xl text-yellow-400" />
                            </div>
                            <div>
                                <p className="text-gray-400 text-sm">In Maintenance</p>
                                <p className="text-2xl font-bold">0</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-red-900/20 rounded-lg">
                                <HiUser className="text-3xl text-red-400" />
                            </div>
                            <div>
                                <p className="text-gray-400 text-sm">Critical Alerts</p>
                                <p className="text-2xl font-bold">0</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Fleet Info */}
                <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
                    <h3 className="text-xl font-bold mb-4">Company Information</h3>
                    <div className="space-y-3">
                        <div className="flex justify-between">
                            <span className="text-gray-400">Company Name:</span>
                            <span className="font-medium">{user?.profile?.companyName || 'Not set'}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-400">GST Number:</span>
                            <span className="font-medium">{user?.profile?.gstNumber || 'Not set'}</span>
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
                            <span className="text-gray-400">Role:</span>
                            <span className="font-medium capitalize">{user?.role?.replace('_', ' ')}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default FleetOwnerDashboard
