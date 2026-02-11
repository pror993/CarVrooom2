import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'

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
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled ? 'py-2' : 'py-4 border-b border-gray-800'
      }`}>
        <div className={`transition-all duration-300 ${
          isScrolled
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
                <Link to="/dashboard" className="text-xs sm:text-sm text-gray-400 hover:text-white transition-colors">
                  Dashboard
                </Link>
                <button
                  onClick={handleLogout}
                  className="bg-gray-800 text-white px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm hover:bg-gray-700 transition-colors"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="text-xs sm:text-sm text-gray-400 hover:text-white transition-colors">
                  Login
                </Link>
                <Link to="/signup" className="bg-white text-black px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm hover:bg-gray-100 transition-colors">
                  Test Demo
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="flex-1 flex items-center justify-center max-w-7xl mx-auto px-4 sm:px-6 w-full">
        <div className="max-w-4xl mx-auto text-center py-20">
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold mb-6 leading-tight text-white"
          >
            Predict Failures Before They
            <br />
            <span className="bg-linear-to-r from-purple-300 via-purple-400 to-purple-500 bg-clip-text text-transparent">
              Derail Your Fleet
            </span>
          </motion.h1>

          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-base sm:text-lg md:text-xl text-gray-400 max-w-3xl mx-auto mb-8 sm:mb-12 px-4"
          >
            AI-powered aftersales intelligence that detects <span className="text-purple-300 font-semibold">BS6</span> degradation early,
            explains the cause, and automates preventive service.
          </motion.p>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 px-4"
          >
            <a
              href="#how-it-works"
              className="bg-white text-black px-6 sm:px-8 py-3 sm:py-4 rounded-md text-sm sm:text-base font-medium hover:bg-gray-100 transition-colors w-full sm:w-auto text-center"
            >
              See How It Works
            </a>
            <Link
              to="/login"
              className="border border-gray-700 text-white px-6 sm:px-8 py-3 sm:py-4 rounded-md text-sm sm:text-base font-medium hover:border-purple-500 hover:text-purple-400 transition-all w-full sm:w-auto text-center"
            >
              Login / Test Demo
            </Link>
          </motion.div>
        </div>
      </div>
    </div>
  )
}

export default Hero
