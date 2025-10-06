import React from 'react';
import { Link } from 'react-router-dom';

const HomePage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-background-light to-surface-light text-ink dark:from-background-dark dark:via-background-dark-deep dark:to-surface-dark dark:text-ink-light transition-colors">
      {/* Navigation Bar */}
      <nav className="bg-surface-light/95 dark:bg-surface-dark/95 border-b border-border-subtle dark:border-border-dark transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <h1 className="text-2xl font-bold text-ink dark:text-ink-light">
                  AI Code Platform
                </h1>
              </div>
            </div>

            {/* Navigation Links */}
            <div className="hidden md:block">
              <div className="ml-10 flex items-baseline space-x-8">
              <Link
                  to="/"
                  className="text-ink-muted dark:text-ink-soft hover:text-ink dark:hover:text-ink-light px-3 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  Home
                </Link>
                <Link
                  to="/pricing"
                  className="text-ink-muted dark:text-ink-soft hover:text-ink dark:hover:text-ink-light px-3 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  Pricing
                </Link>
                <Link
                  to="/careers"
                  className="text-ink-muted dark:text-ink-soft hover:text-ink dark:hover:text-ink-light px-3 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  Careers
                </Link>
                <Link
                  to="/contact"
                  className="text-ink-muted dark:text-ink-soft hover:text-ink dark:hover:text-ink-light px-3 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  Contact
                </Link>
              </div>
            </div>

            {/* Auth Buttons */}
            <div className="flex items-center space-x-4">
              <Link
                to="/login"
                className="text-ink-muted dark:text-ink-soft hover:text-ink dark:hover:text-ink-light px-3 py-2 rounded-md text-sm font-medium transition-colors"
              >
                Login
              </Link>
              <Link
                to="/signup"
                className="bg-primary-600 hover:bg-primary-500 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
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
            <h1 className="text-4xl md:text-6xl font-bold text-ink dark:text-ink-light mb-8">
              Build Apps with
              <span className="text-primary-400 dark:text-primary-300 block">AI Power</span>
            </h1>
            <p className="text-xl text-ink-muted dark:text-ink-soft mb-12 max-w-3xl mx-auto">
              Create, deploy, and scale applications using cutting-edge AI technology. 
              From code generation to intelligent debugging, we've got you covered.
            </p>
            
            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/signup"
                className="bg-primary-600 hover:bg-primary-500 text-white px-8 py-3 rounded-lg text-lg font-medium transition-colors"
              >
                Get Started Free
              </Link>
              <Link
                to="/demo"
                className="border border-border-subtle dark:border-border-dark hover:border-primary-400 dark:hover:border-primary-400 text-ink dark:text-ink-light px-8 py-3 rounded-lg text-lg font-medium transition-colors"
              >
                View Demo
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="bg-surface-dark dark:bg-surface-dark py-20 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-ink-light mb-4">
              Why Choose AI Code Platform?
            </h2>
            <p className="text-ink-soft text-lg">
              Powerful features to accelerate your development workflow
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="bg-surface-dark-muted p-6 rounded-lg border border-border-dark/40">
              <div className="text-accent-300 text-4xl mb-4">🤖</div>
              <h3 className="text-xl font-semibold text-ink-light mb-3">
                AI Code Generation
              </h3>
              <p className="text-ink-soft">
                Generate high-quality code using advanced AI models. 
                From simple functions to complex applications.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-surface-dark-muted p-6 rounded-lg border border-border-dark/40">
              <div className="text-accent-300 text-4xl mb-4">⚡</div>
              <h3 className="text-xl font-semibold text-ink-light mb-3">
                Real-time Collaboration
              </h3>
              <p className="text-ink-soft">
                Work together with your team in real-time. 
                Share code, debug together, and build faster.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-surface-dark-muted p-6 rounded-lg border border-border-dark/40">
              <div className="text-accent-300 text-4xl mb-4">🚀</div>
              <h3 className="text-xl font-semibold text-ink-light mb-3">
                One-Click Deployment
              </h3>
              <p className="text-ink-soft">
                Deploy your applications instantly to the cloud. 
                No configuration needed, just click and go.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-surface-dark border-t border-border-dark py-12 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <h3 className="text-lg font-semibold text-ink-light mb-4">
                AI Code Platform
              </h3>
              <p className="text-ink-soft">
                Building the future of software development with AI.
              </p>
            </div>
            
            <div>
              <h4 className="text-ink-light font-medium mb-4">Product</h4>
              <ul className="space-y-2">
                <li><Link to="/features" className="text-ink-soft hover:text-ink-light">Features</Link></li>
                <li><Link to="/pricing" className="text-ink-soft hover:text-ink-light">Pricing</Link></li>
                <li><Link to="/docs" className="text-ink-soft hover:text-ink-light">Documentation</Link></li>
              </ul>
            </div>
            
            <div>
              <h4 className="text-ink-light font-medium mb-4">Company</h4>
              <ul className="space-y-2">
                <li><Link to="/about" className="text-ink-soft hover:text-ink-light">About</Link></li>
                <li><Link to="/careers" className="text-ink-soft hover:text-ink-light">Careers</Link></li>
                <li><Link to="/contact" className="text-ink-soft hover:text-ink-light">Contact</Link></li>
              </ul>
            </div>
            
            <div>
              <h4 className="text-ink-light font-medium mb-4">Support</h4>
              <ul className="space-y-2">
                <li><Link to="/help" className="text-ink-soft hover:text-ink-light">Help Center</Link></li>
                <li><Link to="/community" className="text-ink-soft hover:text-ink-light">Community</Link></li>
                <li><Link to="/status" className="text-ink-soft hover:text-ink-light">Status</Link></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-border-dark mt-8 pt-8 text-center">
            <p className="text-ink-soft">
              © 2024 AI Code Platform. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default HomePage;
