import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  HomeIcon, 
  FolderIcon, 
  CodeBracketIcon, 
  CogIcon,
  ChevronLeftIcon,
  ChevronRightIcon
} from '@heroicons/react/24/outline';

const Sidebar: React.FC = () => {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(true);

  const menuItems = [
    { path: '/dashboard/editor', label: 'Workspace', icon: CodeBracketIcon },
    { path: '/dashboard/settings', label: 'Settings', icon: CogIcon },
  ];

  return (
    <div className={`bg-surface-light dark:bg-surface-dark shadow-lg shadow-primary-500/10 border-r border-border-subtle dark:border-border-dark transition-all duration-300 relative ${
      isOpen ? "w-64" : "w-16"
    }`}>
      <div className="p-4">
        <nav className="space-y-2">
          {menuItems.map((item) => {
            const IconComponent = item.icon;
            
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center ${isOpen ? 'px-3' : 'px-0 justify-center'} py-2 rounded-md text-sm font-medium transition-colors ${
                  location.pathname === item.path
                    ? 'bg-primary-600 text-white shadow shadow-primary-500/30'
                    : 'text-ink-muted dark:text-ink-soft hover:bg-surface-subtle dark:hover:bg-surface-dark-muted hover:text-ink dark:hover:text-ink-light'
                }`}
                title={!isOpen ? item.label : ''}
              >
                <IconComponent className={`h-5 w-5 ${isOpen ? 'mr-3' : ''} flex-shrink-0`} />
                <span className={`${isOpen ? "block" : "hidden"} truncate`}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Small Toggle Button at Bottom Right */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="absolute bottom-4 -right-3 bg-primary-600 text-white p-1 rounded-full shadow-md shadow-primary-500/40 hover:bg-primary-500 z-10"
        title={isOpen ? 'Collapse sidebar' : 'Expand sidebar'}
      >
        {isOpen ? <ChevronLeftIcon className="h-4 w-4" /> : <ChevronRightIcon className="h-4 w-4" />}
      </button>
    </div>
  );
};

export default Sidebar;
