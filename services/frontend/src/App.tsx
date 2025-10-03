import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
// Removed ProjectDashboard & ProjectManager
import CodeEditor from './components/CodeEditor';
import Settings from './components/Settings';
import AuthGuard from './components/AuthGuard';
import ErrorBoundary from './components/ErrorBoundary';
import HomePage from './components/HomePage';
import LoginForm from './components/LoginForm';
import PricingPage from './components/PricingPage';
import CareersPage from './components/CareersPage';
import ContactPage from './components/ContactPage';
import VerifyEmailPage from './components/VerifyEmailPage';
import { useAuthStore } from './stores/authStore';

function App() {
  const { isAuthenticated } = useAuthStore();

  return (
    <Router>
      <div className="h-screen bg-white dark:bg-gray-900 overflow-hidden">
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<HomePage />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/careers" element={<CareersPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/login" element={<LoginForm />} />
          <Route path="/signup" element={<LoginForm />} />
          
          {/* Protected Routes */}
          <Route path="/dashboard/*" element={
            <ErrorBoundary>
              <AuthGuard>
                <div className="flex h-screen">
                  <Sidebar />
                  <div className="flex-1 flex flex-col overflow-hidden">
                    <Header />
                    <main className="flex-1 overflow-auto">
                      <ErrorBoundary>
                        <Routes>
                          <Route path="/" element={<CodeEditor />} />
                          <Route path="/editor" element={<CodeEditor />} />
                          <Route path="/settings" element={<Settings />} />
                        </Routes>
                      </ErrorBoundary>
                    </main>
                  </div>
                </div>
              </AuthGuard>
            </ErrorBoundary>
          } />
        </Routes>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#363636',
              color: '#fff',
            },
          }}
        />
      </div>
    </Router>
  );
}

export default App;
