import React from 'react';

const ProjectDashboard: React.FC = () => {
  return (
    <div className="p-6 bg-gray-900 h-full">
      <h2 className="text-2xl font-bold text-white mb-6">Project Dashboard</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-2">Recent Projects</h3>
          <p className="text-gray-300">No projects yet. Start by creating your first AI-powered application!</p>
        </div>
        <div className="bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-2">AI Conversations</h3>
          <p className="text-gray-300">Your chat history will appear here.</p>
        </div>
        <div className="bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-2">Code Generation</h3>
          <p className="text-gray-300">Generate code with AI assistance.</p>
        </div>
      </div>
    </div>
  );
};

export default ProjectDashboard;
