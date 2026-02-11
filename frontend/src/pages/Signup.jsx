import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { HiMail, HiLockClosed, HiUser, HiPhone, HiArrowRight, HiArrowLeft } from 'react-icons/hi'
import StaticGrid from '../components/StaticGrid'
import { useAuth } from '../context/AuthContext'

function Signup() {
  const [step, setStep] = useState(1)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    role: ''
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { user, signup } = useAuth()
  const navigate = useNavigate()

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      navigate('/dashboard')
    }
  }, [user, navigate])

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleRoleSelect = (role) => {
    setFormData({ ...formData, role })
    setStep(2)
  }

  const handleBack = () => {
    setStep(1)
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    setLoading(true)

    const { confirmPassword, ...signupData } = formData
    const result = await signup(signupData)

    if (result.success) {
      navigate('/dashboard')
    } else {
      setError(result.error || 'Signup failed')
      setLoading(false)
    }
  }

  const roles = [
    {
      value: 'vehicle_owner',
      title: 'Vehicle Owner',
      description: 'I own a personal vehicle and want to track maintenance'
    },
    {
      value: 'fleet_owner',
      title: 'Fleet Owner',
      description: 'I manage a fleet of vehicles for my business'
    },
    {
      value: 'service_center',
      title: 'Service Center',
      description: 'I run a service center and manage customer vehicles'
    },
    {
      value: 'technician',
      title: 'Technician',
      description: 'I work as a technician and service vehicles'
    }
  ]

  return (
    <div className="min-h-screen bg-black text-white relative">
      <StaticGrid />

      <nav className="border-b border-gray-800 relative z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <Link to="/" className="text-2xl font-bold">
            AfterCare AI™
          </Link>
        </div>
      </nav>

      <div className="flex items-center justify-center px-6 relative z-10 py-12">
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold mb-2">
              {step === 1 ? 'Choose your role' : 'Create your account'}
            </h2>
            <p className="text-gray-400">
              {step === 1 ? 'Select the option that best describes you' : 'Fill in your details to get started'}
            </p>
          </div>

          {error && (
            <div className="mb-4 p-4 bg-red-900/20 border border-red-800 rounded-lg text-red-400">
              {error}
            </div>
          )}

          <div className="bg-gray-950/50 backdrop-blur-sm border border-gray-800 rounded-lg p-8">
            {step === 1 ? (
              /* Step 1: Role Selection */
              <div className="space-y-3">
                {roles.map((role) => (
                  <button
                    key={role.value}
                    onClick={() => handleRoleSelect(role.value)}
                    className="w-full text-left p-4 bg-black/50 border border-gray-800 rounded-lg hover:border-purple-500 hover:bg-purple-500/5 transition-all group h-22"
                  >
                    <div className="flex items-center justify-between h-full">
                      <div className="flex-1">
                        <h3 className="font-semibold text-white mb-1 group-hover:text-purple-300 transition-colors">
                          {role.title}
                        </h3>
                        <p className="text-sm text-gray-400 line-clamp-2">{role.description}</p>
                      </div>
                      <HiArrowRight className="text-gray-600 group-hover:text-purple-400 transition-colors shrink-0 ml-4" />
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              /* Step 2: Details Form */
              <form onSubmit={handleSubmit} className="space-y-4">
                <button
                  type="button"
                  onClick={handleBack}
                  className="flex items-center gap-2 text-sm text-gray-400 hover:text-purple-400 transition-colors mb-4"
                >
                  <HiArrowLeft />
                  Change role
                </button>

                <div>
                  <label htmlFor="name" className="block text-sm font-medium mb-2">Full Name</label>
                  <div className="relative">
                    <HiUser className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <input id="name" type="text" name="name" value={formData.name} onChange={handleChange} className="w-full bg-black/50 border border-gray-800 rounded-md pl-10 pr-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-colors" placeholder="John Doe" required disabled={loading} />
                  </div>
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium mb-2">Email</label>
                  <div className="relative">
                    <HiMail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <input id="email" type="email" name="email" value={formData.email} onChange={handleChange} className="w-full bg-black/50 border border-gray-800 rounded-md pl-10 pr-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-colors" placeholder="you@example.com" required disabled={loading} />
                  </div>
                </div>

                <div>
                  <label htmlFor="phone" className="block text-sm font-medium mb-2">Phone</label>
                  <div className="relative">
                    <HiPhone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <input id="phone" type="tel" name="phone" value={formData.phone} onChange={handleChange} className="w-full bg-black/50 border border-gray-800 rounded-md pl-10 pr-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-colors" placeholder="1234567890" disabled={loading} />
                  </div>
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-medium mb-2">Password</label>
                  <div className="relative">
                    <HiLockClosed className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <input id="password" type="password" name="password" value={formData.password} onChange={handleChange} className="w-full bg-black/50 border border-gray-800 rounded-md pl-10 pr-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-colors" placeholder="••••••••" required disabled={loading} />
                  </div>
                </div>

                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium mb-2">Confirm Password</label>
                  <div className="relative">
                    <HiLockClosed className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <input id="confirmPassword" type="password" name="confirmPassword" value={formData.confirmPassword} onChange={handleChange} className="w-full bg-black/50 border border-gray-800 rounded-md pl-10 pr-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-colors" placeholder="••••••••" required disabled={loading} />
                  </div>
                </div>

                <button type="submit" disabled={loading} className="w-full bg-white text-black font-semibold py-3 rounded-md hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                  {loading ? 'Creating account...' : 'Create account'}
                </button>
              </form>
            )}

            <div className="mt-6 text-center text-sm text-gray-400">
              Already have an account? <Link to="/login" className="text-purple-400 hover:text-purple-300 hover:underline">Sign in</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Signup
