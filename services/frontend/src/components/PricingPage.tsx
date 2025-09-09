import React from 'react';
import { Link } from 'react-router-dom';

const PricingPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Navigation Bar */}
      <nav className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Link to="/" className="text-2xl font-bold text-white">
                  AI Code Platform
                </Link>
              </div>
            </div>

            {/* Navigation Links */}
            <div className="hidden md:block">
              <div className="ml-10 flex items-baseline space-x-8">
                <Link
                  to="/"
                  className="text-gray-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  Home
                </Link>
                <Link
                  to="/pricing"
                  className="text-white px-3 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  Pricing
                </Link>
                <Link
                  to="/careers"
                  className="text-gray-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  Careers
                </Link>
                <Link
                  to="/contact"
                  className="text-gray-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  Contact
                </Link>
              </div>
            </div>

            {/* Auth Buttons */}
            <div className="flex items-center space-x-4">
              <Link
                to="/login"
                className="text-gray-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium transition-colors"
              >
                Login
              </Link>
              <Link
                to="/signup"
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
              >
                Sign Up
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="text-center">
            <h1 className="text-4xl md:text-6xl font-bold text-white mb-8">
              Simple, Transparent
              <span className="text-blue-400 block">Pricing</span>
            </h1>
            <p className="text-xl text-gray-300 mb-12 max-w-3xl mx-auto">
              Choose the perfect plan for your development needs. 
              Start free and scale as you grow.
            </p>
          </div>
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="bg-gray-800 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Free Plan */}
            <div className="bg-gray-700 p-8 rounded-lg border border-gray-600">
              <div className="text-center">
                <h3 className="text-2xl font-bold text-white mb-4">Free</h3>
                <div className="text-4xl font-bold text-blue-400 mb-6">
                  $0
                  <span className="text-lg text-gray-300">/month</span>
                </div>
                <p className="text-gray-300 mb-8">
                  Perfect for getting started with AI-powered development
                </p>
                <ul className="text-left space-y-3 mb-8">
                  <li className="flex items-center text-gray-300">
                    <span className="text-green-400 mr-2">✓</span>
                    10 AI code generations per day
                  </li>
                  <li className="flex items-center text-gray-300">
                    <span className="text-green-400 mr-2">✓</span>
                    Basic code editor
                  </li>
                  <li className="flex items-center text-gray-300">
                    <span className="text-green-400 mr-2">✓</span>
                    Community support
                  </li>
                  <li className="flex items-center text-gray-300">
                    <span className="text-green-400 mr-2">✓</span>
                    1 project
                  </li>
                </ul>
                <Link
                  to="/signup"
                  className="w-full bg-gray-600 hover:bg-gray-500 text-white px-6 py-3 rounded-lg text-lg font-medium transition-colors block text-center"
                >
                  Get Started Free
                </Link>
              </div>
            </div>

            {/* Pro Plan */}
            <div className="bg-gray-700 p-8 rounded-lg border-2 border-blue-500 relative">
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                <span className="bg-blue-500 text-white px-4 py-1 rounded-full text-sm font-medium">
                  Most Popular
                </span>
              </div>
              <div className="text-center">
                <h3 className="text-2xl font-bold text-white mb-4">Pro</h3>
                <div className="text-4xl font-bold text-blue-400 mb-6">
                  $29
                  <span className="text-lg text-gray-300">/month</span>
                </div>
                <p className="text-gray-300 mb-8">
                  For professional developers and small teams
                </p>
                <ul className="text-left space-y-3 mb-8">
                  <li className="flex items-center text-gray-300">
                    <span className="text-green-400 mr-2">✓</span>
                    Unlimited AI code generations
                  </li>
                  <li className="flex items-center text-gray-300">
                    <span className="text-green-400 mr-2">✓</span>
                    Advanced code editor with AI assistance
                  </li>
                  <li className="flex items-center text-gray-300">
                    <span className="text-green-400 mr-2">✓</span>
                    Priority support
                  </li>
                  <li className="flex items-center text-gray-300">
                    <span className="text-green-400 mr-2">✓</span>
                    Up to 10 projects
                  </li>
                  <li className="flex items-center text-gray-300">
                    <span className="text-green-400 mr-2">✓</span>
                    Team collaboration
                  </li>
                  <li className="flex items-center text-gray-300">
                    <span className="text-green-400 mr-2">✓</span>
                    Custom AI models
                  </li>
                </ul>
                <Link
                  to="/signup"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg text-lg font-medium transition-colors block text-center"
                >
                  Start Pro Trial
                </Link>
              </div>
            </div>

            {/* Enterprise Plan */}
            <div className="bg-gray-700 p-8 rounded-lg border border-gray-600">
              <div className="text-center">
                <h3 className="text-2xl font-bold text-white mb-4">Enterprise</h3>
                <div className="text-4xl font-bold text-blue-400 mb-6">
                  Custom
                </div>
                <p className="text-gray-300 mb-8">
                  For large organizations with specific needs
                </p>
                <ul className="text-left space-y-3 mb-8">
                  <li className="flex items-center text-gray-300">
                    <span className="text-green-400 mr-2">✓</span>
                    Everything in Pro
                  </li>
                  <li className="flex items-center text-gray-300">
                    <span className="text-green-400 mr-2">✓</span>
                    Unlimited projects
                  </li>
                  <li className="flex items-center text-gray-300">
                    <span className="text-green-400 mr-2">✓</span>
                    Dedicated support
                  </li>
                  <li className="flex items-center text-gray-300">
                    <span className="text-green-400 mr-2">✓</span>
                    On-premise deployment
                  </li>
                  <li className="flex items-center text-gray-300">
                    <span className="text-green-400 mr-2">✓</span>
                    Custom integrations
                  </li>
                  <li className="flex items-center text-gray-300">
                    <span className="text-green-400 mr-2">✓</span>
                    SLA guarantee
                  </li>
                </ul>
                <Link
                  to="/contact"
                  className="w-full bg-gray-600 hover:bg-gray-500 text-white px-6 py-3 rounded-lg text-lg font-medium transition-colors block text-center"
                >
                  Contact Sales
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* FAQ Section */}
      <div className="bg-gray-900 py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-white mb-4">
              Frequently Asked Questions
            </h2>
            <p className="text-gray-300 text-lg">
              Everything you need to know about our pricing
            </p>
          </div>

          <div className="space-y-8">
            <div className="bg-gray-800 p-6 rounded-lg">
              <h3 className="text-xl font-semibold text-white mb-3">
                Can I change plans anytime?
              </h3>
              <p className="text-gray-300">
                Yes, you can upgrade or downgrade your plan at any time. 
                Changes take effect immediately, and we'll prorate any billing differences.
              </p>
            </div>

            <div className="bg-gray-800 p-6 rounded-lg">
              <h3 className="text-xl font-semibold text-white mb-3">
                What payment methods do you accept?
              </h3>
              <p className="text-gray-300">
                We accept all major credit cards, PayPal, and bank transfers for Enterprise plans.
              </p>
            </div>

            <div className="bg-gray-800 p-6 rounded-lg">
              <h3 className="text-xl font-semibold text-white mb-3">
                Is there a free trial?
              </h3>
              <p className="text-gray-300">
                Yes! All paid plans come with a 14-day free trial. No credit card required to start.
              </p>
            </div>

            <div className="bg-gray-800 p-6 rounded-lg">
              <h3 className="text-xl font-semibold text-white mb-3">
                What happens if I exceed my usage limits?
              </h3>
              <p className="text-gray-300">
                We'll notify you when you're approaching your limits. You can upgrade your plan 
                or purchase additional usage as needed.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-800 border-t border-gray-700 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">
                AI Code Platform
              </h3>
              <p className="text-gray-300">
                Building the future of software development with AI.
              </p>
            </div>
            
            <div>
              <h4 className="text-white font-medium mb-4">Product</h4>
              <ul className="space-y-2">
                <li><Link to="/features" className="text-gray-300 hover:text-white">Features</Link></li>
                <li><Link to="/pricing" className="text-gray-300 hover:text-white">Pricing</Link></li>
                <li><Link to="/docs" className="text-gray-300 hover:text-white">Documentation</Link></li>
              </ul>
            </div>
            
            <div>
              <h4 className="text-white font-medium mb-4">Company</h4>
              <ul className="space-y-2">
                <li><Link to="/about" className="text-gray-300 hover:text-white">About</Link></li>
                <li><Link to="/careers" className="text-gray-300 hover:text-white">Careers</Link></li>
                <li><Link to="/contact" className="text-gray-300 hover:text-white">Contact</Link></li>
              </ul>
            </div>
            
            <div>
              <h4 className="text-white font-medium mb-4">Support</h4>
              <ul className="space-y-2">
                <li><Link to="/help" className="text-gray-300 hover:text-white">Help Center</Link></li>
                <li><Link to="/community" className="text-gray-300 hover:text-white">Community</Link></li>
                <li><Link to="/status" className="text-gray-300 hover:text-white">Status</Link></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-gray-700 mt-8 pt-8 text-center">
            <p className="text-gray-300">
              © 2024 AI Code Platform. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default PricingPage;