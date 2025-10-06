import React from 'react';
import { useAuthStore } from '../stores/authStore';

const Header: React.FC = () => {
  const { user, logout } = useAuthStore();

  return (
    <header className="bg-surface-light dark:bg-surface-dark shadow-sm shadow-primary-500/5 border-b border-border-subtle dark:border-border-dark transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <h1 className="text-xl font-semibold text-ink dark:text-ink-light">AI Code Platform</h1>
          </div>

          <div className="flex items-center space-x-4">
            <span className="text-sm text-ink-muted dark:text-ink-soft">Welcome, {user?.name}</span>
            <button
              onClick={logout}
              className="text-sm text-ink-muted hover:text-ink dark:text-ink-soft dark:hover:text-ink-light transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
