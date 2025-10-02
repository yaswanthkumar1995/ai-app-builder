import React, { useState, useEffect } from 'react';
import { config } from '../config';
import { useAuthStore } from '../stores/authStore';
import { useProjectStore } from '../stores/projectStore';
import { 
  MagnifyingGlassIcon, 
  StarIcon, 
  CodeBracketIcon, 
  EyeIcon,
  ClockIcon,
  DocumentIcon
} from '@heroicons/react/24/outline';
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

const GitHubProjectImporter: React.FC = () => {
  const { token } = useAuthStore();
  const { createProject } = useProjectStore();
  const [username, setUsername] = useState('');
  const [repositories, setRepositories] = useState<GitHubRepo[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepo | null>(null);
  const [importingRepo, setImportingRepo] = useState<string | null>(null);

  const searchRepositories = async () => {
    if (!username.trim()) {
      toast.error('Please enter a GitHub username');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${config.apiGatewayUrl}/api/github/repos/${username}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'x-user-id': 'user-id-from-token', // This should be extracted from JWT
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch repositories');
      }

      const data = await response.json();
      setRepositories(data.repositories || []);
      
      if (data.repositories.length === 0) {
        toast.error('No repositories found for this user');
      }
    } catch (error) {
      console.error('Error fetching repositories:', error);
      toast.error('Failed to fetch repositories');
      setRepositories([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchRepoContents = async (repo: GitHubRepo, path = ''): Promise<GitHubFile[]> => {
    const [owner, repoName] = repo.fullName.split('/');
    const response = await fetch(
      `${config.apiGatewayUrl}/api/github/repos/${owner}/${repoName}/contents?path=${path}&ref=${repo.defaultBranch}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'x-user-id': 'user-id-from-token',
        },
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch repository contents');
    }

    return await response.json();
  };

  const downloadFileContent = async (downloadUrl: string): Promise<string> => {
    const response = await fetch(downloadUrl);
    if (!response.ok) {
      throw new Error('Failed to download file content');
    }
    return await response.text();
  };

  const importRepository = async (repo: GitHubRepo) => {
    setImportingRepo(repo.fullName);
    
    try {
      // Create project first
      const projectName = repo.name;
      const projectDescription = repo.description || `Imported from ${repo.fullName}`;
      
      // Fetch repository structure
      const files = await fetchRepositoryFiles(repo);
      
      // Create project using the store with GitHub data
      createProject(projectName, projectDescription, {
        repo: repo.cloneUrl,
        branch: repo.defaultBranch,
        files: files
      });
      
      toast.success(`Successfully imported ${repo.name} from GitHub!`);
      setSelectedRepo(null);
    } catch (error) {
      console.error('Error importing repository:', error);
      toast.error('Failed to import repository');
    } finally {
      setImportingRepo(null);
    }
  };

  const fetchRepositoryFiles = async (repo: GitHubRepo, currentPath = ''): Promise<any[]> => {
    const contents = await fetchRepoContents(repo, currentPath);
    const files: any[] = [];

    for (const item of contents) {
      if (item.type === 'file') {
        try {
          const content = item.download_url ? await downloadFileContent(item.download_url) : '';
          files.push({
            id: Date.now() + Math.random(),
            name: item.name,
            type: 'file',
            path: `/${item.path}`,
            content: content,
            language: getLanguageFromExtension(item.name),
            lastModified: new Date(),
          });
        } catch (error) {
          console.warn(`Failed to download content for ${item.path}`);
          files.push({
            id: Date.now() + Math.random(),
            name: item.name,
            type: 'file',
            path: `/${item.path}`,
            content: `// Failed to load content for ${item.name}`,
            language: getLanguageFromExtension(item.name),
            lastModified: new Date(),
          });
        }
      } else if (item.type === 'dir') {
        // Recursively fetch directory contents (limit depth to avoid too many API calls)
        const depth = currentPath.split('/').length;
        if (depth < 3) {
          const subFiles = await fetchRepositoryFiles(repo, item.path);
          files.push(...subFiles);
        }
      }
    }

    return files;
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

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-white mb-2">Import from GitHub</h2>
        <p className="text-gray-400">
          Import your existing GitHub repositories as new projects
        </p>
      </div>

      {/* Search Form */}
      <div className="mb-8">
        <div className="flex gap-4">
          <div className="flex-1">
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter GitHub username..."
              className="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
      </div>

      {/* Repositories Grid */}
      {repositories.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {repositories.map((repo) => (
            <div
              key={repo.id}
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
                <p className="text-sm text-gray-400 mb-3 line-clamp-2">
                  {repo.description || 'No description available'}
                </p>
              </div>

              <div className="space-y-2 text-sm text-gray-400 mb-4">
                <div className="flex items-center justify-between">
                  <span className="flex items-center">
                    <StarIcon className="h-4 w-4 mr-1" />
                    {formatNumber(repo.stargazersCount)}
                  </span>
                  <span className="flex items-center">
                    <EyeIcon className="h-4 w-4 mr-1" />
                    {formatNumber(repo.forksCount)} forks
                  </span>
                </div>
                
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
                  className="flex-1 py-2 px-3 text-center bg-gray-700 text-gray-300 rounded-md hover:bg-gray-600 hover:text-white transition-colors text-sm"
                >
                  <DocumentIcon className="h-4 w-4 inline mr-1" />
                  View
                </a>
                <button
                  onClick={() => importRepository(repo)}
                  disabled={importingRepo === repo.fullName}
                  className="flex-1 py-2 px-3 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  {importingRepo === repo.fullName ? (
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-1"></div>
                      Importing...
                    </div>
                  ) : (
                    'Import'
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

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
  );
};

export default GitHubProjectImporter;