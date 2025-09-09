import React, { useState } from 'react';

const SimpleProjectManager: React.FC = () => {
  const [projects] = useState([
    {
      id: '1',
      name: 'My First Project',
      description: 'A sample project built with AI assistance',
      files: 5,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: '2',
      name: 'React App',
      description: 'A React application with modern features',
      files: 12,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]);

  return (
    <div className="p-6 bg-gray-900 min-h-full">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Project Manager</h1>
            <p className="text-gray-400">Manage your AI-powered coding projects</p>
          </div>
          <button className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500">
            + New Project
          </button>
        </div>

        {/* Projects Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => (
            <div
              key={project.id}
              className="bg-gray-800 rounded-lg p-6 border border-gray-700 hover:border-gray-600 transition-all duration-200"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center">
                  <div className="text-2xl mr-3">📁</div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">{project.name}</h3>
                    <p className="text-sm text-gray-400 mt-1">{project.description}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2 text-sm text-gray-400">
                <div className="flex justify-between">
                  <span>Files:</span>
                  <span className="text-white">{project.files}</span>
                </div>
                <div className="flex justify-between">
                  <span>Created:</span>
                  <span>{project.createdAt.toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Updated:</span>
                  <span>{project.updatedAt.toLocaleDateString()}</span>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-700">
                <button className="w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
                  Load Project
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SimpleProjectManager;
