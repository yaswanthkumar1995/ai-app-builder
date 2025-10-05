import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

// Clear localStorage if it's getting too full or has issues
try {
  const checkLocalStorageQuota = () => {
    try {
      const testKey = '__storage_test__';
      const testData = 'x'.repeat(1024 * 1024); // 1MB test
      localStorage.setItem(testKey, testData);
      localStorage.removeItem(testKey);
      return true;
    } catch (e) {
      return false;
    }
  };

  // If localStorage is full or has errors, clear old project data
  if (!checkLocalStorageQuota()) {
    console.warn('LocalStorage quota exceeded, clearing project store...');
    localStorage.removeItem('project-store');
    localStorage.removeItem('ai-app-builder:code-editor-preferences');
  }

  // Also check current size
  const currentSize = new Blob(Object.values(localStorage)).size;
  const maxSize = 5 * 1024 * 1024; // 5MB limit (conservative)
  
  if (currentSize > maxSize * 0.8) {
    console.warn(`LocalStorage is ${Math.round(currentSize / maxSize * 100)}% full, clearing project store...`);
    localStorage.removeItem('project-store');
  }
} catch (error) {
  console.error('Error checking localStorage:', error);
  // If there's any error, try to clear problematic items
  try {
    localStorage.removeItem('project-store');
  } catch (e) {
    console.error('Could not clear localStorage:', e);
  }
}

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
