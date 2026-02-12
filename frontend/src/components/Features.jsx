import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { 
  HiClock, 
  HiCurrencyRupee, 
  HiRefresh, 
  HiShieldExclamation,
  HiLightningBolt,
  HiChartBar,
  HiCog,
  HiTrendingUp,
  HiBeaker,
  HiLightBulb,
  HiCheckCircle,
  HiDatabase,
  HiChip,
  HiExclamationCircle,
  HiCalendar,
  HiRefresh as HiLoop
} from 'react-icons/hi'

// Animation variants
const fadeInUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0 }
}

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
}

const scaleIn = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: { 
    opacity: 1, 
    scale: 1,
    transition: { duration: 0.5 }
  }
}

function Features() {
  return (
    <div className="bg-black">
      {/* PROBLEM SECTION */}
      <div className="bg-black py-16 sm:py-20 md:py-24 border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeInUp}
            transition={{ duration: 0.6 }}
            className="text-center mb-12 sm:mb-16"
          >
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 sm:mb-6 text-white px-4">
              Breakdowns Aren't Sudden. They're Missed Signals.
            </h2>
            <p className="text-base sm:text-lg text-gray-400 max-w-3xl mx-auto mb-6 sm:mb-8 px-4">
              <span className="text-purple-300 font-semibold">BS6</span> after-treatment failures are detected too late — usually after derate.
              <br className="hidden sm:block" />
              The result:
            </p>
          </motion.div>

          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={staggerContainer}
            className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 md:gap-6 mb-12 sm:mb-16 max-w-5xl mx-auto"
          >
            {[
              { label: 'High', sublabel: 'Downtime', icon: HiClock },
              { label: '₹1–5L', sublabel: 'Per Incident', icon: HiCurrencyRupee },
              { label: 'Reactive', sublabel: 'Servicing', icon: HiRefresh },
              { label: 'Warranty', sublabel: 'Leakage', icon: HiShieldExclamation }
            ].map((item, index) => (
              <motion.div
                key={index}
                variants={scaleIn}
                whileHover={{ scale: 1.05, borderColor: 'rgba(239, 68, 68, 0.5)' }}
                className="bg-gray-950 p-4 sm:p-6 rounded-lg border border-red-500/30 text-center"
              >
                <item.icon className="text-3xl sm:text-4xl text-red-500 mx-auto mb-2" />
                <div className="text-2xl sm:text-3xl font-bold text-red-500 mb-2">{item.label}</div>
                <div className="text-xs sm:text-sm text-gray-400">{item.sublabel}</div>
              </motion.div>
            ))}
          </motion.div>

          {/* Visual Timeline */}
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeInUp}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="max-w-4xl mx-auto"
          >
            <div className="flex flex-col sm:flex-row items-center justify-between bg-gray-950 p-4 sm:p-6 md:p-8 rounded-lg border border-gray-800 gap-2 sm:gap-4">
              <div className="flex-1 text-center w-full sm:w-auto">
                <div className="text-base sm:text-lg md:text-xl font-bold text-gray-300 mb-2">Degradation</div>
              </div>
              <div className="text-gray-600 text-2xl sm:text-3xl rotate-90 sm:rotate-0">→</div>
              <div className="flex-1 text-center w-full sm:w-auto">
                <div className="text-base sm:text-lg md:text-xl font-bold text-gray-300 mb-2">Missed Window</div>
              </div>
              <div className="text-gray-600 text-2xl sm:text-3xl rotate-90 sm:rotate-0">→</div>
              <div className="flex-1 text-center w-full sm:w-auto">
                <div className="text-base sm:text-lg md:text-xl font-bold text-red-500 mb-2">Breakdown</div>
              </div>
              <div className="text-gray-600 text-2xl sm:text-3xl rotate-90 sm:rotate-0">→</div>
              <div className="flex-1 text-center w-full sm:w-auto">
                <div className="text-base sm:text-lg md:text-xl font-bold text-red-600 mb-2">High Cost</div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* SOLUTION SECTION */}
      <div className="bg-black py-16 sm:py-20 md:py-24 border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeInUp}
            transition={{ duration: 0.6 }}
            className="text-center mb-12 sm:mb-16"
          >
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 sm:mb-6 text-white px-4">
              AfterCare AI™
            </h2>
            <p className="text-base sm:text-lg text-gray-400 max-w-3xl mx-auto px-4">
              An Agentic AI platform that converts vehicle sensor data into actionable intervention windows.
            </p>
          </motion.div>

          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={staggerContainer}
            className="grid sm:grid-cols-2 md:grid-cols-3 gap-6 sm:gap-8 max-w-6xl mx-auto"
          >
            {[
              { 
                letter: 'P', 
                title: 'Predict',
                icon: HiLightningBolt,
                desc: 'Time-to-intervention forecasting for DPF, SCR & DEF systems.' 
              },
              { 
                letter: 'E', 
                title: 'Explain',
                icon: HiLightBulb,
                desc: 'Causal RCA engine for warranty and defect intelligence.' 
              },
              { 
                letter: 'O', 
                title: 'Orchestrate',
                icon: HiCog,
                desc: 'Automated service scheduling with dealer optimization.' 
              }
            ].map((feature, index) => (
              <motion.div
                key={index}
                variants={scaleIn}
                whileHover={{ scale: 1.05, borderColor: 'rgba(168, 85, 247, 0.5)' }}
                className="bg-gray-950 p-6 sm:p-8 rounded-lg border border-gray-800 hover:border-purple-500/50 transition-all"
              >
                <div className="w-12 h-12 sm:w-14 sm:h-14 bg-purple-500/10 rounded-lg flex items-center justify-center mb-4">
                  <feature.icon className="text-2xl sm:text-3xl text-purple-400" />
                </div>
                <h3 className="text-xl sm:text-2xl font-semibold mb-3 sm:mb-4 text-white">{feature.title}</h3>
                <p className="text-sm sm:text-base text-gray-400">
                  {feature.desc}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>

      {/* HOW IT WORKS SECTION */}
      <div id="how-it-works" className="bg-black py-16 sm:py-20 md:py-24 border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeInUp}
            transition={{ duration: 0.6 }}
            className="text-center mb-12 sm:mb-16"
          >
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-6 text-white px-4">
              From Sensor Data to Smart Action
            </h2>
          </motion.div>

          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={staggerContainer}
            className="max-w-3xl mx-auto space-y-4 sm:space-y-6"
          >
            {[
              { step: '01', title: 'Vehicle telematics ingestion', icon: HiDatabase },
              { step: '02', title: 'Degradation forecasting models', icon: HiTrendingUp },
              { step: '03', title: 'Anomaly detection', icon: HiExclamationCircle },
              { step: '04', title: 'Causal RCA reasoning', icon: HiLightBulb },
              { step: '05', title: 'Optimized service scheduling', icon: HiCalendar },
              { step: '06', title: 'Continuous learning & CAPA feedback', icon: HiLoop }
            ].map((item, index) => (
              <motion.div
                key={index}
                variants={fadeInUp}
                whileHover={{ x: 10, borderColor: 'rgba(168, 85, 247, 0.5)' }}
                className="flex items-center bg-gray-950 p-4 sm:p-6 rounded-lg border border-gray-800 hover:border-purple-500/50 transition-all"
              >
                <div className="text-2xl sm:text-3xl font-bold text-purple-400 mr-4 sm:mr-6 w-12 sm:w-16">{item.step}</div>
                <item.icon className="text-2xl sm:text-3xl text-purple-400 mr-3 sm:mr-4" />
                <div className="text-sm sm:text-base md:text-lg text-gray-300 font-medium">{item.title}</div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>

      {/* ML FOCUS STRIP */}
      <div className="bg-linear-to-r from-purple-950/30 to-gray-950 py-16 sm:py-20 border-t border-purple-900/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeInUp}
            transition={{ duration: 0.6 }}
            className="text-center mb-8 sm:mb-12"
          >
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-6 text-white px-4">
              Hybrid Predictive Intelligence
            </h2>
          </motion.div>

          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={staggerContainer}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8 sm:mb-12"
          >
            {[
              { title: 'Time-series forecasting', subtitle: 'for progressive degradation', icon: HiChartBar },
              { title: 'Anomaly detection', subtitle: 'for sudden subsystem faults', icon: HiExclamationCircle },
              { title: 'Causal reasoning', subtitle: 'for explainable decisions', icon: HiBeaker },
              { title: 'Optimization engine', subtitle: 'for scheduling', icon: HiChip }
            ].map((item, index) => (
              <motion.div
                key={index}
                variants={scaleIn}
                whileHover={{ scale: 1.05 }}
                className="bg-black/40 p-4 sm:p-6 rounded-lg border border-purple-900/30"
              >
                <item.icon className="text-3xl sm:text-4xl text-purple-400 mb-3" />
                <div className="text-sm text-purple-300 font-medium mb-2">{item.title}</div>
                <div className="text-xs text-gray-400">{item.subtitle}</div>
              </motion.div>
            ))}
          </motion.div>

          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeInUp}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="text-center px-4"
          >
            <p className="text-base sm:text-lg text-gray-300 font-medium">
              No dashboards. No static thresholds.{' '}
              <span className="text-purple-300">Real decision intelligence.</span>
            </p>
          </motion.div>
        </div>
      </div>

      {/* FINAL SECTION */}
      <div className="bg-black py-20 sm:py-28 md:py-32 border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeInUp}
            transition={{ duration: 0.6 }}
            className="text-center"
          >
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-8 sm:mb-12 text-white px-4">
              Move From Reactive Repairs to Predictive Control
            </h2>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 px-4">
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
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}

export default Features
