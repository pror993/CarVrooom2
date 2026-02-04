import { HiChartBar, HiCog, HiLocationMarker, HiDeviceMobile, HiLightningBolt, HiShieldCheck } from 'react-icons/hi'

function Features() {
  const features = [
    {
      icon: HiChartBar,
      title: "Real-Time Analytics",
      description: "Monitor your fleet performance with live data visualization and insights."
    },
    {
      icon: HiCog,
      title: "Predictive Maintenance",
      description: "AI-powered alerts help you prevent breakdowns before they happen."
    },
    {
      icon: HiLocationMarker,
      title: "Fleet Tracking",
      description: "Track all your vehicles in real-time with GPS integration."
    },
    {
      icon: HiDeviceMobile,
      title: "Mobile Access",
      description: "Manage your fleet from anywhere with our mobile-first platform."
    },
    {
      icon: HiLightningBolt,
      title: "Quick Setup",
      description: "Get started in minutes with our intuitive onboarding process."
    },
    {
      icon: HiShieldCheck,
      title: "Secure & Reliable",
      description: "Enterprise-grade security with 99.9% uptime guarantee."
    }
  ]

  return (
    <div id="features" className="bg-black py-24 border-t border-gray-800">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-4 text-white">
            Everything you need
          </h2>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Powerful features to help you manage your vehicle fleet efficiently
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => {
            const Icon = feature.icon
            return (
              <div
                key={index}
                className="bg-gray-950 p-8 rounded-lg border border-gray-800 hover:border-gray-700 transition-all hover:shadow-sm"
              >
                <Icon className="text-4xl mb-4 text-white" />
                <h3 className="text-xl font-semibold mb-2 text-white">{feature.title}</h3>
                <p className="text-gray-400">{feature.description}</p>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default Features
