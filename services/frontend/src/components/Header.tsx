import React from 'react';
import { useAuthStore } from '../stores/authStore';

const Header: React.FC = () => {
  const { user, logout } = useAuthStore();

  return (
    <header className="bg-gray-800 shadow-sm border-b border-gray-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <h1 className="text-xl font-semibold text-white">AI Code Platform</h1>
          </div>

          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-300">Welcome, {user?.name}</span>
            <button
              onClick={logout}
              className="text-sm text-gray-400 hover:text-gray-200"
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
