import React from 'react';
import { Link } from 'react-router-dom';

const CareersPage: React.FC = () => {
  const jobOpenings = [
    {
      title: 'Senior Full-Stack Developer',
      location: 'Remote',
      type: 'Full-time',
      description: 'Build and maintain our AI-powered code generation platform using React, Node.js, and modern cloud technologies.',
      requirements: ['5+ years experience', 'React/Node.js', 'AWS/GCP', 'AI/ML knowledge preferred']
    },
    {
      title: 'AI/ML Engineer',
      location: 'San Francisco, CA',
      type: 'Full-time',
      description: 'Develop cutting-edge AI models for code generation and optimization using Python, TensorFlow, and PyTorch.',
      requirements: ['3+ years ML experience', 'Python', 'TensorFlow/PyTorch', 'NLP knowledge']
    },
    {
      title: 'Product Manager',
      location: 'New York, NY',
      type: 'Full-time',
      description: 'Lead product strategy for our AI development platform, working closely with engineering and design teams.',
      requirements: ['4+ years PM experience', 'Technical background', 'AI/DevTools knowledge']
    },
    {
      title: 'DevOps Engineer',
      location: 'Remote',
      type: 'Full-time',
      description: 'Manage our cloud infrastructure and CI/CD pipelines to ensure high availability and performance.',
      requirements: ['3+ years DevOps', 'Kubernetes', 'Docker', 'AWS/Azure']
    },
    {
      title: 'UX/UI Designer',
      location: 'Remote',
      type: 'Full-time',
      description: 'Design intuitive interfaces for our AI-powered development tools and user experiences.',
      requirements: ['3+ years UX/UI experience', 'Figma/Sketch', 'Prototyping skills']
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background-light via-surface-subtle to-surface-light text-ink dark:from-background-dark dark:via-background-dark-deep dark:to-surface-dark dark:text-ink-light transition-colors">
      {/* Navigation Bar */}
      <nav className="bg-surface-light/95 dark:bg-surface-dark/95 border-b border-border-subtle dark:border-border-dark transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link to="/" className="text-2xl font-bold text-ink dark:text-ink-light hover:text-primary-500 dark:hover:text-primary-300 transition-colors">
              AI Code Platform
            </Link>
            <div className="hidden md:flex items-center space-x-8">
              <Link to="/pricing" className="text-ink-muted dark:text-ink-soft hover:text-ink dark:hover:text-ink-light px-3 py-2 rounded-md text-sm font-medium transition-colors">Pricing</Link>
              <Link to="/careers" className="text-primary-500 px-3 py-2 rounded-md text-sm font-medium">Careers</Link>
              <Link to="/contact" className="text-ink-muted dark:text-ink-soft hover:text-ink dark:hover:text-ink-light px-3 py-2 rounded-md text-sm font-medium transition-colors">Contact</Link>
              <Link to="/login" className="text-ink-muted dark:text-ink-soft hover:text-ink dark:hover:text-ink-light px-3 py-2 rounded-md text-sm font-medium transition-colors">Login</Link>
              <Link to="/signup" className="bg-primary-600 hover:bg-primary-500 text-ink-light px-4 py-2 rounded-md text-sm font-medium transition-colors">Sign Up</Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-6xl font-bold text-ink dark:text-ink-light mb-8">
            Join Our Mission to
            <span className="text-primary-400 dark:text-primary-300 block">Revolutionize Code</span>
          </h1>
          <p className="text-xl text-ink-muted dark:text-ink-soft mb-12 max-w-3xl mx-auto">
            Help us build the future of software development using AI. We're looking for passionate,
            talented individuals who want to make a meaningful impact.
          </p>
        </div>
      </div>

      {/* Why Join Us Section */}
      <div className="bg-surface-dark dark:bg-surface-dark py-20 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-ink-light mb-4">
              Why Join AI Code Platform?
            </h2>
            <p className="text-ink-soft text-lg">
              Work on cutting-edge AI technology while making a real difference
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-surface-dark-muted p-6 rounded-lg border border-border-dark/40">
              <div className="text-primary-300 text-4xl mb-4">🚀</div>
              <h3 className="text-xl font-semibold text-ink-light mb-3">
                Innovative Technology
              </h3>
              <p className="text-ink-soft">
                Work with the latest AI and ML technologies to build tools that
                reshape how developers work worldwide.
              </p>
            </div>

            <div className="bg-surface-dark-muted p-6 rounded-lg border border-border-dark/40">
              <div className="text-primary-300 text-4xl mb-4">👥</div>
              <h3 className="text-xl font-semibold text-ink-light mb-3">
                Collaborative Culture
              </h3>
              <p className="text-ink-soft">
                Join a diverse team of engineers, designers, and product experts
                who value collaboration and innovation.
              </p>
            </div>

            <div className="bg-surface-dark-muted p-6 rounded-lg border border-border-dark/40">
              <div className="text-primary-300 text-4xl mb-4">📈</div>
              <h3 className="text-xl font-semibold text-ink-light mb-3">
                Growth Opportunities
              </h3>
              <p className="text-ink-soft">
                We invest in your professional development with conferences,
                training, and opportunities for advancement.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Job Openings */}
      <div className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-ink dark:text-ink-light mb-4">
              Open Positions
            </h2>
            <p className="text-ink-muted dark:text-ink-soft text-lg">
              Join our team and help build the future of AI-powered development
            </p>
          </div>

          <div className="space-y-6">
            {jobOpenings.map((job, index) => (
              <div
                key={index}
                className="bg-surface-light dark:bg-surface-dark rounded-xl p-8 border border-border-subtle dark:border-border-dark hover:border-primary-400 dark:hover:border-primary-400 transition-colors"
              >
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex-1">
                    <h3 className="text-2xl font-bold text-ink dark:text-ink-light mb-2">
                      {job.title}
                    </h3>
                    <div className="flex flex-wrap gap-4 mb-4">
                      <span className="bg-primary-600 text-ink-light px-3 py-1 rounded-full text-sm">
                        {job.location}
                      </span>
                      <span className="bg-success-500 text-ink-light px-3 py-1 rounded-full text-sm">
                        {job.type}
                      </span>
                    </div>
                    <p className="text-ink-muted dark:text-ink-soft mb-4">{job.description}</p>
                    <div className="flex flex-wrap gap-2">
                      {job.requirements.map((req, reqIndex) => (
                        <span
                          key={reqIndex}
                          className="bg-surface-subtle dark:bg-surface-dark-muted text-ink dark:text-ink-light px-3 py-1 rounded-full text-sm"
                        >
                          {req}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="mt-6 lg:mt-0 lg:ml-8">
                    <button className="bg-primary-600 hover:bg-primary-500 text-ink-light px-6 py-3 rounded-lg font-medium transition-colors">
                      Apply Now
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center mt-12">
            <p className="text-ink-muted dark:text-ink-soft mb-6">
              Don't see a perfect fit? We're always looking for talented individuals.
            </p>
            <button className="bg-surface-subtle dark:bg-surface-dark-muted hover:bg-primary-500/20 dark:hover:bg-primary-500/20 text-ink dark:text-ink-light px-8 py-3 rounded-lg font-medium transition-colors border border-border-subtle dark:border-border-dark">
              Send Us Your Resume
            </button>
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

export default CareersPage;
