import React, { useState, useEffect } from 'react';
import { useProjectStore } from '../stores/projectStore';
import { useAuthStore } from '../stores/authStore';
import { 
  PlusIcon, 
  FolderIcon, 
  DocumentIcon, 
  TrashIcon, 
  PencilIcon,
  MagnifyingGlassIcon, 
  CodeBracketIcon, 
  ClockIcon,
  ArrowDownTrayIcon,
  EyeIcon
} from '@heroicons/react/24/outline';
import { config } from '../config';
import toast from 'react-hot-toast';

interface GitHubRepo {
  id: number;
  name: string;
  fullName: string;
  description: string;
  private: boolean;
  htmlUrl: string;
  cloneUrl: string;
  language: string;
  stargazersCount: number;
  forksCount: number;
  size: number;
  defaultBranch: string;
  updatedAt: string;
  createdAt: string;
  topics: string[];
}

interface GitHubFile {
  name: string;
  path: string;
  type: 'file' | 'dir';
  download_url?: string;
  content?: string;
}

const ProjectManager: React.FC = () => {
  const {
    projects,
    currentProject,
    createProject,
    loadProject,
    deleteProject,
    exportProject,
    importProject,
  } = useProjectStore();

  const { token } = useAuthStore();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');
  const [importData, setImportData] = useState('');
  
  // GitHub related state
  const [username, setUsername] = useState('');
  const [repositories, setRepositories] = useState<GitHubRepo[]>([]);
  const [loading, setLoading] = useState(false);
  const [importingRepo, setImportingRepo] = useState<string | null>(null);
  const [githubEnabled, setGithubEnabled] = useState(false);
  const [githubToken, setGithubToken] = useState('');
  const [showBranchModal, setShowBranchModal] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepo | null>(null);
  const [branches, setBranches] = useState<string[]>([]);
  const [selectedBranch, setSelectedBranch] = useState('main');
  const [loadingBranches, setLoadingBranches] = useState(false);

  // Check GitHub configuration on component mount
  useEffect(() => {
    checkGitHubConfiguration();
  }, []);

  const checkGitHubConfiguration = async () => {
    if (!token) return;

    try {
      const response = await fetch(`${config.apiGatewayUrl}/api/settings/providers`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const settings = await response.json();
        setGithubEnabled(settings.github?.enabled || false);
        setGithubToken(settings.github?.apiKey || '');
      }
    } catch (error) {
      console.error('Failed to check GitHub configuration:', error);
    }
  };

  const handleCreateProject = () => {
    if (!newProjectName.trim()) {
      toast.error('Project name is required');
      return;
    }

    createProject(newProjectName.trim(), newProjectDescription.trim() || undefined);
    setNewProjectName('');
    setNewProjectDescription('');
    setShowCreateModal(false);
    toast.success('Project created successfully!');
  };

  const handleDeleteProject = (projectId: string) => {
    if (window.confirm('Are you sure you want to delete this project? This action cannot be undone.')) {
      deleteProject(projectId);
      toast.success('Project deleted successfully!');
    }
  };

  const handleImportProject = () => {
    if (!importData.trim()) {
      toast.error('Please paste project data');
      return;
    }

    try {
      importProject(importData);
      setImportData('');
      setShowImportModal(false);
      toast.success('Project imported successfully!');
    } catch (error) {
      toast.error('Failed to import project. Please check the data format.');
    }
  };

  // GitHub functions
  const searchRepositories = async () => {
    if (!username.trim()) {
      toast.error('Please enter a GitHub username');
      return;
    }

    // Validate GitHub configuration
    if (!githubEnabled || !githubToken) {
      toast.error('GitHub integration not configured. Please add your GitHub token in Settings.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${config.apiGatewayUrl}/api/github/repos/${username}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'x-user-id': 'user-id-from-token',
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          toast.error('GitHub token is invalid or expired. Please check your settings.');
        } else if (response.status === 404) {
          toast.error('GitHub user not found. Please check the username.');
        } else {
          throw new Error('Failed to fetch repositories');
        }
        return;
      }

      const data = await response.json();
      setRepositories(data.repositories || []);
      
      if (data.repositories.length === 0) {
        toast.error('No repositories found for this user');
      } else {
        toast.success(`Found ${data.repositories.length} repositories for ${username}`);
      }
    } catch (error) {
      console.error('Error fetching repositories:', error);
      toast.error('Failed to fetch repositories. Please check your GitHub token in Settings.');
      setRepositories([]);
    } finally {
      setLoading(false);
    }
  };



  const importRepository = async () => {
    if (!selectedRepo) return;
    
    setImportingRepo(selectedRepo.fullName);
    setShowBranchModal(false);
    
    try {
      const projectName = selectedRepo.name;
      const projectDescription = selectedRepo.description || `Imported from ${selectedRepo.fullName}`;
      
      // Clone the repository using Server-Sent Events for progress tracking
      await new Promise<void>((resolve, reject) => {
        fetch(`${config.apiGatewayUrl}/api/github/clone`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'x-user-id': 'user-id-from-token',
            'Accept': 'text/event-stream',
          },
          body: JSON.stringify({
            repoUrl: selectedRepo.cloneUrl,
            branch: selectedBranch,
            projectName: projectName,
            projectDescription: projectDescription,
          }),
        }).then(async (response) => {
          if (!response.ok) {
            throw new Error('Failed to start clone operation');
          }

          const reader = response.body?.getReader();
          if (!reader) {
            throw new Error('No response stream available');
          }

          const decoder = new TextDecoder();
          let buffer = '';

          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split('\n');
              buffer = lines.pop() || '';

              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  try {
                    const data = JSON.parse(line.slice(6));
                    console.log('Clone progress:', data);

                    if (data.error) {
                      toast.error(data.message || 'Clone failed');
                      reject(new Error(data.message || 'Clone failed'));
                      return;
                    }

                    if (data.status === 'completed' && data.success) {
                      // Create project with the cloned files
                      createProject(projectName, projectDescription, {
                        repo: selectedRepo.cloneUrl,
                        branch: selectedBranch,
                        files: data.files || [],
                        workspacePath: data.workspacePath
                      });

                      console.log(`Successfully imported ${data.files?.length || 0} files from ${selectedRepo.name}`);
                      console.log(`Repository cloned to workspace: ${data.workspacePath}`);
                      
                      toast.success(`Successfully imported ${selectedRepo.name} from branch ${selectedBranch}!`);
                      resolve();
                      return;
                    }

                    // Update progress status
                    if (data.message) {
                      toast.loading(data.message, { id: selectedRepo.fullName });
                    }
                  } catch (parseError) {
                    console.error('Failed to parse progress data:', parseError);
                  }
                }
              }
            }
          } finally {
            reader.releaseLock();
          }
        }).catch((error) => {
          console.error('Stream error:', error);
          reject(error);
        });
      });
    } catch (error) {
      console.error('Error importing repository:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to import repository');
    } finally {
      toast.dismiss(selectedRepo.fullName);
      setImportingRepo(null);
      setSelectedRepo(null);
      setShowBranchModal(false);
    }
  };



  const getLanguageFromExtension = (filename: string): string => {
    const ext = filename.split('.').pop()?.toLowerCase();
    const languageMap: { [key: string]: string } = {
      'js': 'javascript',
      'jsx': 'javascript',
      'ts': 'typescript',
      'tsx': 'typescript',
      'py': 'python',
      'java': 'java',
      'cpp': 'cpp',
      'c': 'c',
      'cs': 'csharp',
      'php': 'php',
      'rb': 'ruby',
      'go': 'go',
      'rs': 'rust',
      'swift': 'swift',
      'kt': 'kotlin',
      'scala': 'scala',
      'html': 'html',
      'css': 'css',
      'scss': 'scss',
      'sass': 'sass',
      'less': 'less',
      'json': 'json',
      'xml': 'xml',
      'yaml': 'yaml',
      'yml': 'yaml',
      'md': 'markdown',
      'sh': 'bash',
      'sql': 'sql',
    };
    return languageMap[ext || ''] || 'text';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const formatNumber = (num: number) => {
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'k';
    }
    return num.toString();
  };

  const testGitHubConnection = async () => {
    if (!githubEnabled || !githubToken) {
      toast.error('GitHub integration not configured');
      return;
    }

    setLoading(true);
    try {
      // Test with a simple API call to get the authenticated user
      const response = await fetch(`${config.apiGatewayUrl}/api/github/repos/octocat`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'x-user-id': 'user-id-from-token',
        },
      });

      if (response.ok) {
        toast.success('GitHub token is valid and working!');
      } else if (response.status === 401) {
        toast.error('GitHub token is invalid or expired. Please update your token in Settings.');
      } else {
        toast.error('Failed to validate GitHub connection');
      }
    } catch (error) {
      console.error('Error testing GitHub connection:', error);
      toast.error('Failed to test GitHub connection');
    } finally {
      setLoading(false);
    }
  };

  const fetchBranches = async (repo: GitHubRepo) => {
    setLoadingBranches(true);
    try {
      const response = await fetch(`${config.apiGatewayUrl}/api/github/repos/${repo.fullName}/branches`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'x-user-id': 'user-id-from-token',
        },
      });

      if (response.ok) {
        const branchData = await response.json();
        const branchNames = branchData.map((branch: any) => branch.name);
        setBranches(branchNames);
        setSelectedBranch(repo.defaultBranch || branchNames[0] || 'main');
      } else {
        toast.error('Failed to fetch branches');
        setBranches([repo.defaultBranch || 'main']);
        setSelectedBranch(repo.defaultBranch || 'main');
      }
    } catch (error) {
      console.error('Error fetching branches:', error);
      setBranches([repo.defaultBranch || 'main']);
      setSelectedBranch(repo.defaultBranch || 'main');
    } finally {
      setLoadingBranches(false);
    }
  };

  const handleImportClick = async (repo: GitHubRepo) => {
    // Fetch branches for the selected repository
    await fetchBranches(repo);
    setSelectedRepo(repo);
    setShowBranchModal(true);
  };

  const handleExportProject = () => {
    if (!currentProject) {
      toast.error('No project selected');
      return;
    }

    const data = exportProject();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentProject.name.replace(/\s+/g, '-').toLowerCase()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Project exported successfully!');
  };

  return (
    <div className="p-6 bg-gray-900 h-full overflow-auto">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Project Manager</h1>
            <p className="text-gray-400">Manage your AI-powered coding projects</p>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={() => setShowImportModal(true)}
              className="px-4 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500"
            >
              Import Project
            </button>
            <button
              onClick={handleExportProject}
              disabled={!currentProject}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Export Project
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <PlusIcon className="h-5 w-5 mr-2 inline" />
              New Project
            </button>
          </div>
        </div>

        {/* GitHub Import Section */}
        <div className="mb-8">
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white">Import from GitHub</h2>
              <div className="flex items-center text-sm">
                {githubEnabled && githubToken ? (
                  <span className="flex items-center text-green-400">
                    <div className="w-2 h-2 bg-green-400 rounded-full mr-2"></div>
                    GitHub Connected
                  </span>
                ) : (
                  <span className="flex items-center text-red-400">
                    <div className="w-2 h-2 bg-red-400 rounded-full mr-2"></div>
                    GitHub Not Configured
                  </span>
                )}
              </div>
            </div>
            
            {!githubEnabled || !githubToken ? (
              <div className="bg-yellow-900/50 border border-yellow-600 rounded-lg p-4 mb-4">
                <div className="flex items-start">
                  <div className="text-yellow-400 text-xl mr-3">⚠️</div>
                  <div>
                    <h3 className="text-yellow-400 font-semibold mb-2">GitHub Integration Not Configured</h3>
                    <p className="text-yellow-100 text-sm mb-3">
                      To import repositories from GitHub, you need to configure your GitHub token in Settings.
                    </p>
                    <div className="flex gap-3">
                      <a
                        href="/settings"
                        className="inline-block px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                      >
                        Configure GitHub Token
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="mb-3">
                  <button
                    onClick={testGitHubConnection}
                    disabled={loading}
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    Test GitHub Connection
                  </button>
                </div>
                <div className="flex gap-4">
                  <div className="flex-1">
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Enter GitHub username..."
                      className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      onKeyPress={(e) => e.key === 'Enter' && searchRepositories()}
                    />
                  </div>
                  <button
                    onClick={searchRepositories}
                    disabled={loading}
                    className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <div className="flex items-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Searching...
                      </div>
                    ) : (
                      <div className="flex items-center">
                        <MagnifyingGlassIcon className="h-4 w-4 mr-2" />
                        Search
                      </div>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Combined Projects Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Existing Projects */}
          {projects.filter(project => !project.isGithubProject || repositories.length === 0).map((project) => (
            <div
              key={project.id}
              className={`bg-gray-800 rounded-lg p-6 border transition-all duration-200 hover:border-gray-600 ${
                currentProject?.id === project.id
                  ? 'border-blue-500 bg-blue-900/20'
                  : 'border-gray-700'
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center">
                  <FolderIcon className="h-8 w-8 text-blue-400 mr-3" />
                  <div>
                    <h3 className="text-lg font-semibold text-white">{project.name}</h3>
                    {project.description && (
                      <p className="text-sm text-gray-400 mt-1">{project.description}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => loadProject(project.id)}
                    className="p-1 text-gray-400 hover:text-white hover:bg-gray-700 rounded"
                    title="Load project"
                  >
                    <PencilIcon className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteProject(project.id)}
                    className="p-1 text-gray-400 hover:text-red-400 hover:bg-gray-700 rounded"
                    title="Delete project"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-2 text-sm text-gray-400">
                <div className="flex justify-between">
                  <span>Files:</span>
                  <span className="text-white">{project.files.length}</span>
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
                <button
                  onClick={() => loadProject(project.id)}
                  className={`w-full py-2 px-4 rounded-md font-medium transition-colors ${
                    currentProject?.id === project.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white'
                  }`}
                >
                  {currentProject?.id === project.id ? 'Current Project' : 'Load Project'}
                </button>
              </div>
            </div>
          ))}

          {/* GitHub Repositories */}
          {repositories.map((repo) => (
            <div
              key={`github-${repo.id}`}
              className="bg-gray-800 rounded-lg p-6 border border-gray-700 hover:border-gray-600 transition-all duration-200"
            >
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-white mb-2 flex items-center">
                  <CodeBracketIcon className="h-5 w-5 mr-2 text-blue-400" />
                  {repo.name}
                  {repo.private && (
                    <span className="ml-2 px-2 py-1 text-xs bg-yellow-600 text-yellow-100 rounded">
                      Private
                    </span>
                  )}
                </h3>
                <p className="text-sm text-gray-400 mb-3 overflow-hidden" style={{
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                }}>
                  {repo.description || 'No description available'}
                </p>
              </div>

              <div className="space-y-2 text-sm text-gray-400 mb-4">
                {repo.language && (
                  <div className="flex items-center">
                    <div className="w-3 h-3 rounded-full bg-blue-400 mr-2"></div>
                    <span>{repo.language}</span>
                  </div>
                )}

                <div className="flex items-center">
                  <ClockIcon className="h-4 w-4 mr-1" />
                  Updated {formatDate(repo.updatedAt)}
                </div>
              </div>

              {repo.topics.length > 0 && (
                <div className="mb-4">
                  <div className="flex flex-wrap gap-1">
                    {repo.topics.slice(0, 3).map((topic) => (
                      <span
                        key={topic}
                        className="px-2 py-1 text-xs bg-gray-700 text-gray-300 rounded"
                      >
                        {topic}
                      </span>
                    ))}
                    {repo.topics.length > 3 && (
                      <span className="px-2 py-1 text-xs bg-gray-700 text-gray-300 rounded">
                        +{repo.topics.length - 3} more
                      </span>
                    )}
                  </div>
                </div>
              )}

              <div className="flex space-x-2">
                <a
                  href={repo.htmlUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-2 px-3 flex items-center justify-center bg-gray-700 text-gray-300 rounded-md hover:bg-gray-600 hover:text-white transition-colors"
                  title="View on GitHub"
                >
                  <EyeIcon className="h-4 w-4" />
                </a>
                <button
                  onClick={() => handleImportClick(repo)}
                  disabled={importingRepo === repo.fullName}
                  className="flex-1 py-2 px-3 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                  title="Import repository"
                >
                  {importingRepo === repo.fullName ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <ArrowDownTrayIcon className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Empty State */}
        {projects.filter(project => !project.isGithubProject).length === 0 && repositories.length === 0 && !loading && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📁</div>
            <h3 className="text-xl font-semibold text-white mb-2">No projects yet</h3>
            <p className="text-gray-400 mb-6">Create your first project or import from GitHub to start building with AI assistance</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-6 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <PlusIcon className="h-5 w-5 mr-2 inline" />
              Create Your First Project
            </button>
          </div>
        )}

        {/* GitHub Search Results Empty State */}
        {!loading && repositories.length === 0 && username && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🔍</div>
            <h3 className="text-xl font-semibold text-white mb-2">No repositories found</h3>
            <p className="text-gray-400">
              Try searching for a different GitHub username or make sure the user has public repositories.
            </p>
          </div>
        )}
      </div>

      {/* Create Project Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-white mb-4">Create New Project</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Project Name *
                </label>
                <input
                  type="text"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-600 bg-gray-700 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter project name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Description
                </label>
                <textarea
                  value={newProjectDescription}
                  onChange={(e) => setNewProjectDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-600 bg-gray-700 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter project description (optional)"
                  rows={3}
                />
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateProject}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                Create Project
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Project Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-2xl">
            <h3 className="text-lg font-semibold text-white mb-4">Import Project</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Project Data (JSON)
                </label>
                <textarea
                  value={importData}
                  onChange={(e) => setImportData(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-600 bg-gray-700 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                  placeholder="Paste your project JSON data here..."
                  rows={10}
                />
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowImportModal(false)}
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                Cancel
              </button>
              <button
                onClick={handleImportProject}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Import Project
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Branch Selection Modal */}
      {showBranchModal && selectedRepo && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-white mb-4">Select Branch to Import</h3>
            <div className="mb-4">
              <p className="text-gray-300 text-sm mb-2">
                Repository: <span className="font-medium text-white">{selectedRepo.name}</span>
              </p>
              <p className="text-gray-400 text-xs mb-4">
                {selectedRepo.description || 'No description available'}
              </p>
            </div>
            
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Branch *
              </label>
              {loadingBranches ? (
                <div className="flex items-center text-gray-400 text-sm">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Loading branches...
                </div>
              ) : (
                <select
                  value={selectedBranch}
                  onChange={(e) => setSelectedBranch(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-600 bg-gray-700 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {branches.map((branch) => (
                    <option key={branch} value={branch}>
                      {branch} {branch === selectedRepo.defaultBranch ? '(default)' : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowBranchModal(false);
                  setSelectedRepo(null);
                }}
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                Cancel
              </button>
              <button
                onClick={importRepository}
                disabled={loadingBranches}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Import Repository
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectManager;
