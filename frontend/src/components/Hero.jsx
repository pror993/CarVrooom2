import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useState, useEffect } from 'react'
import heroBanner from '../assets/hero_banner.jpg'

function Hero() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [isScrolled, setIsScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const handleLogout = async () => {
    await logout()
    navigate('/')
  }

  return (
    <div className="relative overflow-hidden">
      {/* Navigation */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${isScrolled
          ? 'py-2'
          : 'py-4 border-b border-gray-800'
        }`}>
        <div className={`transition-all duration-300 ${isScrolled
            ? 'max-w-6xl mx-auto px-6 py-3 bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 shadow-lg'
            : 'max-w-7xl mx-auto px-6'
          } flex items-center justify-between`}>
          <div className="flex items-center space-x-8">
            <Link to="/" className="text-2xl font-bold text-white">
              CarVrooom
            </Link>
            <div className="hidden md:flex space-x-6 text-sm">
              <a href="#features" className="text-gray-400 hover:text-white transition-colors">
                Features
              </a>
              <a href="#about" className="text-gray-400 hover:text-white transition-colors">
                About
              </a>
              <a href="#contact" className="text-gray-400 hover:text-white transition-colors">
                Contact
              </a>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            {user ? (
              <>
                <Link to="/dashboard" className="text-sm text-gray-400 hover:text-white transition-colors">
                  Dashboard
                </Link>
                <button
                  onClick={handleLogout}
                  className="bg-gray-800 text-white px-4 py-2 rounded-md text-sm hover:bg-gray-700 transition-colors"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="text-sm text-gray-400 hover:text-white transition-colors">
                  Sign In
                </Link>
                <Link to="/signup" className="bg-white text-black px-4 py-2 rounded-md text-sm hover:bg-gray-100 transition-colors">
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-6 pt-40 pb-32 md:pt-48 md:pb-40">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Content */}
          <div className="text-left">
            <div className="inline-flex items-center space-x-2 bg-purple-950/30 border border-purple-500/30 rounded-full px-4 py-2 mb-8">
              <span className="text-xs font-medium text-purple-200">Introducing CarVrooom</span>
              <span className="text-purple-400">→</span>
            </div>

            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold mb-6 leading-tight text-white">
              Smart Vehicle
              <br />
              <span className="bg-linear-to-r from-purple-300 via-purple-400 to-purple-500 bg-clip-text text-transparent">
                Management
              </span>
            </h1>

            <p className="text-lg md:text-xl text-gray-400 max-w-xl mb-12">
              Revolutionize your fleet management with AI-powered analytics,
              predictive maintenance, and real-time monitoring.
            </p>

            {!user && (
              <div className="flex flex-col sm:flex-row items-start gap-4">
                <Link to="/signup" className="bg-white text-black px-8 py-4 rounded-md text-base font-medium hover:bg-gray-100 transition-colors w-full sm:w-auto text-center">
                  Start Free Trial
                </Link>
                <Link to="/signup" className="border border-gray-700 text-white px-8 py-4 rounded-md text-base font-medium hover:border-purple-500 hover:text-purple-400 transition-all w-full sm:w-auto text-center">
                  Schedule Demo
                </Link>
              </div>
            )}
          </div>

          {/* Right Image */}
          <div className="relative">
            <div className="absolute -inset-1 bg-purple-600/10 rounded-2xl blur-xl"></div>
            <img
              src={heroBanner}
              alt="CarVrooom Dashboard"
              className="relative w-full h-auto rounded-2xl shadow-2xl border border-gray-800"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default Hero
