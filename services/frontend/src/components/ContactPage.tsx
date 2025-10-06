import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { config } from '../config';

const ContactPage: React.FC = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    subject: '',
    message: ''
  });

  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch(`${config.apiGatewayUrl}/api/contact`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        const message = (Array.isArray(data?.errors) && data.errors[0]?.msg) || data?.error || 'Failed to send message. Please try again later.';
        throw new Error(message);
      }

      setSubmitted(true);
      setFormData({ name: '', email: '', phone: '', subject: '', message: '' });

      setTimeout(() => {
        setSubmitted(false);
      }, 5000);
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : 'Failed to send message. Please try again later.';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background-light via-surface-subtle to-surface-light text-ink dark:from-background-dark dark:via-background-dark-deep dark:to-surface-dark dark:text-ink-light transition-colors">
      {/* Navigation Bar */}
      <nav className="bg-surface-light/95 dark:bg-surface-dark/95 border-b border-border-subtle dark:border-border-dark transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link to="/" className="text-2xl font-bold text-ink dark:text-ink-light hover:text-primary-400 transition-colors">
              AI Code Platform
            </Link>
            <div className="hidden md:flex items-center space-x-8">
              <Link to="/pricing" className="text-ink-muted dark:text-ink-soft hover:text-ink dark:hover:text-ink-light px-3 py-2 rounded-md text-sm font-medium transition-colors">Pricing</Link>
              <Link to="/careers" className="text-ink-muted dark:text-ink-soft hover:text-ink dark:hover:text-ink-light px-3 py-2 rounded-md text-sm font-medium transition-colors">Careers</Link>
              <Link to="/contact" className="text-primary-500 px-3 py-2 rounded-md text-sm font-medium">Contact</Link>
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
            Get In Touch
            <span className="text-primary-400 dark:text-primary-300 block">With Our Team</span>
          </h1>
          <p className="text-xl text-ink-muted dark:text-ink-soft mb-12 max-w-3xl mx-auto">
            Have questions about our AI-powered development platform? We'd love to hear from you.
            Send us a message and we'll get back to you as soon as possible.
          </p>
        </div>
      </div>

      {/* Contact Section */}
      <div className="pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Contact Information */}
            <div>
              <h2 className="text-3xl font-bold text-ink dark:text-ink-light mb-8">
                Let's Start a Conversation
              </h2>

              <div className="space-y-6">
                <div className="flex items-start">
                  <div className="bg-primary-600 p-3 rounded-lg text-white">
                    <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="ml-4">
                    <h3 className="text-lg font-semibold text-ink dark:text-ink-light">Email Us</h3>
                    <p className="text-ink-muted dark:text-ink-soft">hello@aicodeplatform.com</p>
                    <p className="text-ink-muted dark:text-ink-soft">support@aicodeplatform.com</p>
                  </div>
                </div>

                <div className="flex items-start">
                  <div className="bg-primary-600 p-3 rounded-lg text-white">
                    <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                  </div>
                  <div className="ml-4">
                    <h3 className="text-lg font-semibold text-ink dark:text-ink-light">Call Us</h3>
                    <p className="text-ink-muted dark:text-ink-soft">+1 (555) 123-4567</p>
                    <p className="text-ink-muted dark:text-ink-soft">Mon-Fri 9AM-6PM EST</p>
                  </div>
                </div>

                <div className="flex items-start">
                  <div className="bg-primary-600 p-3 rounded-lg text-white">
                    <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div className="ml-4">
                    <h3 className="text-lg font-semibold text-ink dark:text-ink-light">Visit Us</h3>
                    <p className="text-ink-muted dark:text-ink-soft">123 AI Street</p>
                    <p className="text-ink-muted dark:text-ink-soft">San Francisco, CA 94105</p>
                  </div>
                </div>
              </div>

              {/* Social Links */}
              <div className="mt-8">
                <h3 className="text-lg font-semibold text-ink dark:text-ink-light mb-4">Follow Us</h3>
                <div className="flex space-x-4">
                  <a href="#" className="bg-surface-subtle dark:bg-surface-dark-muted hover:bg-primary-600 hover:text-white dark:hover:bg-primary-600 p-3 rounded-lg transition-colors text-ink dark:text-ink-light">
                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z"/>
                    </svg>
                  </a>
                  <a href="#" className="bg-surface-subtle dark:bg-surface-dark-muted hover:bg-primary-600 hover:text-white dark:hover:bg-primary-600 p-3 rounded-lg transition-colors text-ink dark:text-ink-light">
                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M22.46 6c-.77.35-1.6.58-2.46.69.88-.53 1.56-1.37 1.88-2.38-.83.5-1.75.85-2.72 1.05C18.37 4.5 17.26 4 16 4c-2.35 0-4.27 1.92-4.27 4.29 0 .34.04.67.11.98C8.28 9.09 5.11 7.38 3 4.79c-.37.63-.58 1.37-.58 2.15 0 1.49.75 2.81 1.91 3.56-.71 0-1.37-.2-1.95-.5v.03c0 2.08 1.48 3.82 3.44 4.21a4.22 4.22 0 0 1-1.93.07 4.28 4.28 0 0 0 4 3c-1.54 1.22-3.48 1.95-5.59 1.95-.36 0-.72-.02-1.08-.08C5.14 20.34 7.7 21 10.55 21c11.38 0 17.74-9.49 16.84-17.79.92-.67 1.72-1.51 2.35-2.47z"/>
                    </svg>
                  </a>
                  <a href="#" className="bg-surface-subtle dark:bg-surface-dark-muted hover:bg-primary-600 hover:text-white dark:hover:bg-primary-600 p-3 rounded-lg transition-colors text-ink dark:text-ink-light">
                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                    </svg>
                  </a>
                </div>
              </div>
            </div>

            {/* Contact Form */}
            <div className="bg-surface-light dark:bg-surface-dark rounded-xl p-8 border border-border-subtle dark:border-border-dark transition-colors">
              <h3 className="text-2xl font-bold text-ink dark:text-ink-light mb-6">Send us a Message</h3>

              {submitted ? (
                <div className="text-center py-12">
                  <div className="bg-success-500 text-white p-4 rounded-lg mb-4">
                    <svg className="h-8 w-8 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <p className="font-semibold">Message sent successfully!</p>
                    <p className="text-sm mt-1">We'll get back to you soon.</p>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label htmlFor="name" className="block text-sm font-medium text-ink-muted dark:text-ink-soft mb-2">
                        Full Name *
                      </label>
                      <input
                        type="text"
                        id="name"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        required
                        className="w-full bg-surface-subtle dark:bg-surface-dark-muted border border-border-subtle dark:border-border-dark rounded-lg px-4 py-3 text-ink dark:text-ink-light placeholder:text-ink-muted dark:placeholder:text-ink-soft focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent"
                        placeholder="Enter your full name"
                      />
                    </div>
                    <div>
                      <label htmlFor="email" className="block text-sm font-medium text-ink-muted dark:text-ink-soft mb-2">
                        Email Address *
                      </label>
                      <input
                        type="email"
                        id="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        required
                        className="w-full bg-surface-subtle dark:bg-surface-dark-muted border border-border-subtle dark:border-border-dark rounded-lg px-4 py-3 text-ink dark:text-ink-light placeholder:text-ink-muted dark:placeholder:text-ink-soft focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent"
                        placeholder="Enter your email"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label htmlFor="phone" className="block text-sm font-medium text-ink-muted dark:text-ink-soft mb-2">
                        Mobile Number (optional)
                      </label>
                      <input
                        type="tel"
                        id="phone"
                        name="phone"
                        value={formData.phone}
                        onChange={handleChange}
                        className="w-full bg-surface-subtle dark:bg-surface-dark-muted border border-border-subtle dark:border-border-dark rounded-lg px-4 py-3 text-ink dark:text-ink-light placeholder:text-ink-muted dark:placeholder:text-ink-soft focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent"
                        placeholder="Include your mobile number for quicker follow-up"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="subject" className="block text-sm font-medium text-ink-muted dark:text-ink-soft mb-2">
                      Subject *
                    </label>
                    <input
                      type="text"
                      id="subject"
                      name="subject"
                      value={formData.subject}
                      onChange={handleChange}
                      required
                      className="w-full bg-surface-subtle dark:bg-surface-dark-muted border border-border-subtle dark:border-border-dark rounded-lg px-4 py-3 text-ink dark:text-ink-light placeholder:text-ink-muted dark:placeholder:text-ink-soft focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent"
                      placeholder="What's this about?"
                    />
                  </div>

                  <div>
                    <label htmlFor="message" className="block text-sm font-medium text-ink-muted dark:text-ink-soft mb-2">
                      Message *
                    </label>
                    <textarea
                      id="message"
                      name="message"
                      value={formData.message}
                      onChange={handleChange}
                      required
                      rows={5}
                      className="w-full bg-surface-subtle dark:bg-surface-dark-muted border border-border-subtle dark:border-border-dark rounded-lg px-4 py-3 text-ink dark:text-ink-light placeholder:text-ink-muted dark:placeholder:text-ink-soft focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent resize-none"
                      placeholder="Tell us how we can help you..."
                    />
                  </div>

                  {error && (
                    <div className="bg-error-500/10 border border-error-500/30 text-error-500 rounded-lg px-4 py-3 text-sm">
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className={`w-full font-medium py-3 px-6 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-primary-400 focus:ring-offset-2 focus:ring-offset-surface-light dark:focus:ring-offset-surface-dark ${
                      isSubmitting
                        ? 'bg-primary-600/60 text-ink-light cursor-not-allowed'
                        : 'bg-primary-600 hover:bg-primary-500 text-ink-light'
                    }`}
                  >
                    {isSubmitting ? 'Sending…' : 'Send Message'}
                  </button>
                </form>
              )}
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

export default ContactPage;
