import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import heroBanner from '../assets/hero_banner1.png'
import { HiArrowRight, HiLogin, HiLogout, HiViewGrid, HiChevronDown } from 'react-icons/hi'

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
    <div className="relative overflow-hidden min-h-screen flex flex-col">
      {/* Navigation */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${isScrolled ? 'py-2' : 'py-4 border-b border-gray-800'
        }`}>
        <div className={`transition-all duration-300 ${isScrolled
            ? 'max-w-6xl mx-auto px-4 sm:px-6 py-3 bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 shadow-lg'
            : 'max-w-7xl mx-auto px-4 sm:px-6'
          } flex items-center justify-between`}>
          <div className="flex items-center space-x-8">
            <Link to="/" className="text-xl sm:text-2xl font-bold text-white">
              AfterCare AI™
            </Link>
          </div>
          <div className="flex items-center space-x-2 sm:space-x-4">
            {user ? (
              <>
                <Link to="/dashboard" className="flex items-center gap-2 text-xs sm:text-sm text-gray-400 hover:text-white transition-colors">
                  <HiViewGrid className="text-base" />
                  <span className="hidden sm:inline">Dashboard</span>
                </Link>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 bg-gray-800 text-white px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm hover:bg-gray-700 transition-colors"
                >
                  <HiLogout className="text-base" />
                  <span className="hidden sm:inline">Logout</span>
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="flex items-center gap-2 text-xs sm:text-sm text-gray-400 hover:text-white transition-colors backdrop-blur-sm">
                  <HiLogin className="text-base" />
                  <span>Login</span>
                </Link>
                <Link to="/signup" className="flex items-center gap-2 bg-white/90 backdrop-blur-md text-black px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm hover:bg-white transition-colors">
                  <span>Test Demo</span>
                  <HiArrowRight className="text-base" />
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="flex-1 flex items-center justify-center w-full overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 w-full">
          <div className="w-full grid grid-cols-1 lg:grid-cols-5 gap-4 lg:gap-6 items-center py-20">
            {/* Left: Text Content */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              className="text-center lg:text-left order-2 lg:order-1 lg:col-span-2"
            >
              <h1
                className="text-4xl sm:text-5xl md:text-6xl lg:text-5xl xl:text-6xl font-bold mb-6 leading-tight text-white"
              >
                Predict Failures Before They
                <br />
                <span className="bg-linear-to-r from-purple-300 via-purple-400 to-purple-500 bg-clip-text text-transparent">
                  <span className="inline-block" style={{ textShadow: '0 0 20px rgba(168, 85, 247, 0.6), 0 0 40px rgba(168, 85, 247, 0.4)' }}>
                    Derail
                  </span> Your Fleet
                </span>
              </h1>

              <p
                className="text-base sm:text-lg md:text-xl lg:text-lg text-gray-400 mb-8 sm:mb-12"
              >
                AI-powered aftersales intelligence that detects <span className="text-purple-300 font-semibold">BS6</span> degradation early,
                explains the cause, and automates preventive service.
              </p>

              <div
                className="flex flex-col sm:flex-row items-center lg:items-start justify-center lg:justify-start gap-4"
              >
                <a
                  href="#how-it-works"
                  className="flex items-center gap-2 bg-white text-black px-6 sm:px-8 py-3 sm:py-4 rounded-md text-sm sm:text-base font-medium hover:bg-gray-100 transition-colors w-full sm:w-auto justify-center"
                >
                  <span>See How It Works</span>
                  <HiChevronDown className="text-lg" />
                </a>
                <Link
                  to="/login"
                  className="flex items-center gap-2 border border-gray-700 text-white px-6 sm:px-8 py-3 sm:py-4 rounded-md text-sm sm:text-base font-medium hover:border-purple-500 hover:text-purple-400 transition-all w-full sm:w-auto justify-center backdrop-blur-sm bg-black/20"
                >
                  <span>Login / Test Demo</span>
                  <HiArrowRight className="text-lg" />
                </Link>
              </div>
            </motion.div>

            {/* Right: Hero Image */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="relative order-1 lg:order-2 lg:col-span-3 ml-22 sm:ml-12 lg:ml-0"
            >
              <div className="relative lg:translate-x-32 scale-120 lg:scale-110 lg:origin-left">
                <img
                  src={heroBanner}
                  alt="Fleet Management Dashboard"
                  className="w-full h-auto object-cover rounded-xl"
                />
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Hero
