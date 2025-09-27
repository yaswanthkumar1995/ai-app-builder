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
    { path: '/dashboard/', label: 'Dashboard', icon: HomeIcon },
    { path: '/dashboard/projects', label: 'Projects', icon: FolderIcon },
    { path: '/dashboard/editor', label: 'Code Editor', icon: CodeBracketIcon },
    { path: '/dashboard/settings', label: 'Settings', icon: CogIcon },
  ];

  return (
    <div className={`bg-white dark:bg-gray-800 shadow-sm border-r border-gray-200 dark:border-gray-700 transition-all duration-300 relative ${
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
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'
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
        className="absolute bottom-4 -right-3 bg-gray-600 dark:bg-gray-700 text-white p-1 rounded-full shadow-md hover:bg-gray-500 dark:hover:bg-gray-600 z-10"
        title={isOpen ? 'Collapse sidebar' : 'Expand sidebar'}
      >
        {isOpen ? <ChevronLeftIcon className="h-4 w-4" /> : <ChevronRightIcon className="h-4 w-4" />}
      </button>
    </div>
  );
};

export default Sidebar;
