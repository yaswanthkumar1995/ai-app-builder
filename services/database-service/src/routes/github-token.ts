import express from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { providerSettings } from '../db/schema.js';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const router = express.Router();

// GitHub repositories route
router.get('/repos/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const userId = req.headers['x-user-id'] as string;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Get user's GitHub token
    const settings = await db.select()
      .from(providerSettings)
      .where(eq(providerSettings.userId, userId))
      .limit(1);

    const githubToken = settings[0]?.githubToken;

    if (!githubToken) {
      return res.status(400).json({ 
        error: 'GitHub token not configured. Please add your GitHub token in Settings.' 
      });
    }

    // Fetch repos from GitHub API
    const headers: Record<string, string> = {
      'User-Agent': 'AI-Code-Platform',
      'Authorization': `token ${githubToken}`
    };

    const response = await fetch(`https://api.github.com/users/${username}/repos?sort=updated&per_page=50`, {
      headers
    });

    if (!response.ok) {
      if (response.status === 401) {
        return res.status(401).json({ 
          error: 'GitHub token is invalid or expired. Please update your token in Settings.' 
        });
      } else if (response.status === 404) {
        return res.status(404).json({ 
          error: 'GitHub user not found. Please check the username.' 
        });
      } else {
        throw new Error(`GitHub API error: ${response.status}`);
      }
    }

    const repos = await response.json() as any[];
    
    const formattedRepos = repos.map((repo: any) => ({
      id: repo.id,
      name: repo.name,
      fullName: repo.full_name,
      description: repo.description,
      private: repo.private,
      htmlUrl: repo.html_url,
      cloneUrl: repo.clone_url,
      language: repo.language,
      stargazersCount: repo.stargazers_count,
      forksCount: repo.forks_count,
      size: repo.size,
      defaultBranch: repo.default_branch,
      updatedAt: repo.updated_at,
      createdAt: repo.created_at,
      topics: repo.topics || []
    }));

    res.json({ repositories: formattedRepos });
  } catch (error) {
    console.error('Error fetching GitHub repos:', error);
    res.status(500).json({ error: 'Failed to fetch repositories' });
  }
});

// GitHub repository contents route
router.get('/repos/:owner/:repo/contents', async (req, res) => {
  try {
    const { owner, repo } = req.params;
    const { path = '', ref = 'main' } = req.query;
    const userId = req.headers['x-user-id'] as string;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Get user's GitHub token
    const settings = await db.select()
      .from(providerSettings)
      .where(eq(providerSettings.userId, userId))
      .limit(1);

    const githubToken = settings[0]?.githubToken;

    if (!githubToken) {
      return res.status(400).json({ 
        error: 'GitHub token not configured. Please add your GitHub token in Settings.' 
      });
    }

    const headers: Record<string, string> = {
      'User-Agent': 'AI-Code-Platform',
      'Accept': 'application/vnd.github.v3+json',
      'Authorization': `token ${githubToken}`
    };

    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${ref}`;
    const response = await fetch(url, { headers });

    if (!response.ok) {
      if (response.status === 401) {
        return res.status(401).json({ 
          error: 'GitHub token is invalid or expired. Please update your token in Settings.' 
        });
      } else if (response.status === 404) {
        return res.status(404).json({ 
          error: 'Repository or path not found.' 
        });
      } else {
        throw new Error(`GitHub API error: ${response.status}`);
      }
    }

    const contents = await response.json();
    res.json(contents);
  } catch (error) {
    console.error('Error fetching repository contents:', error);
    res.status(500).json({ error: 'Failed to fetch repository contents' });
  }
});

// GitHub repository branches route
router.get('/repos/:owner/:repo/branches', async (req, res) => {
  try {
    const { owner, repo } = req.params;
    const userId = req.headers['x-user-id'] as string;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Get user's GitHub token
    const settings = await db.select()
      .from(providerSettings)
      .where(eq(providerSettings.userId, userId))
      .limit(1);

    const githubToken = settings[0]?.githubToken;

    if (!githubToken) {
      return res.status(400).json({ 
        error: 'GitHub token not configured. Please add your GitHub token in Settings.' 
      });
    }

    const headers: Record<string, string> = {
      'User-Agent': 'AI-Code-Platform',
      'Accept': 'application/vnd.github.v3+json',
      'Authorization': `token ${githubToken}`
    };

    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/branches`, {
      headers
    });

    if (!response.ok) {
      if (response.status === 401) {
        return res.status(401).json({ 
          error: 'GitHub token is invalid or expired. Please update your token in Settings.' 
        });
      } else if (response.status === 404) {
        return res.status(404).json({ 
          error: 'Repository not found.' 
        });
      } else {
        throw new Error(`GitHub API error: ${response.status}`);
      }
    }

    const branches = await response.json();
    res.json(branches);
  } catch (error) {
    console.error('Error fetching repository branches:', error);
    res.status(500).json({ error: 'Failed to fetch repository branches' });
  }
});

// GitHub repository clone route with progress tracking
router.post('/clone', async (req, res) => {
  try {
    const { repoUrl, branch, projectName, projectDescription } = req.body;
    const userId = req.headers['x-user-id'] as string;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    if (!repoUrl || !branch) {
      return res.status(400).json({ error: 'Repository URL and branch are required' });
    }

    // Get user's GitHub token
    const settings = await db.select()
      .from(providerSettings)
      .where(eq(providerSettings.userId, userId))
      .limit(1);

    const githubToken = settings[0]?.githubToken;

    if (!githubToken) {
      return res.status(400).json({ 
        error: 'GitHub token not configured. Please add your GitHub token in Settings.' 
      });
    }

    // Extract owner and repo name from URL
    const urlParts = repoUrl.replace('.git', '').split('/');
    const owner = urlParts[urlParts.length - 2];
    const repoName = urlParts[urlParts.length - 1];

    if (!owner || !repoName) {
      return res.status(400).json({ error: 'Invalid repository URL' });
    }

    // Set response headers for Server-Sent Events
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    // Send initial progress
    res.write(`data: ${JSON.stringify({ 
      status: 'starting', 
      message: 'Initializing repository clone...',
      progress: 0 
    })}\n\n`);

    try {
      // Clone repository with progress tracking
      const result = await cloneRepositoryWithProgress(
        owner, 
        repoName, 
        branch, 
        githubToken, 
        userId, 
        projectName || repoName,
        (progress) => {
          res.write(`data: ${JSON.stringify(progress)}\n\n`);
        }
      );

      // Send final success response
      res.write(`data: ${JSON.stringify({
        status: 'completed',
        message: 'Repository cloned successfully',
        progress: 100,
        success: true,
        files: result.files,
        projectName,
        projectDescription,
        branch,
        workspacePath: result.workspacePath
      })}\n\n`);

    } catch (error) {
      console.error('Error cloning repository:', error);
      res.write(`data: ${JSON.stringify({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to clone repository',
        progress: 0,
        error: true
      })}\n\n`);
    }

    res.end();
  } catch (error) {
    console.error('Error in clone endpoint:', error);
    res.status(500).json({ error: 'Failed to initialize clone operation' });
  }
});

// Fallback clone route for non-SSE clients
router.post('/clone-simple', async (req, res) => {
  try {
    const { repoUrl, branch, projectName, projectDescription } = req.body;
    const userId = req.headers['x-user-id'] as string;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    if (!repoUrl || !branch) {
      return res.status(400).json({ error: 'Repository URL and branch are required' });
    }

    // Get user's GitHub token
    const settings = await db.select()
      .from(providerSettings)
      .where(eq(providerSettings.userId, userId))
      .limit(1);

    const githubToken = settings[0]?.githubToken;

    if (!githubToken) {
      return res.status(400).json({ 
        error: 'GitHub token not configured. Please add your GitHub token in Settings.' 
      });
    }

    // Extract owner and repo name from URL
    const urlParts = repoUrl.replace('.git', '').split('/');
    const owner = urlParts[urlParts.length - 2];
    const repoName = urlParts[urlParts.length - 1];

    if (!owner || !repoName) {
      return res.status(400).json({ error: 'Invalid repository URL' });
    }

    // Clone repository to workspace directory and fetch file structure
    const result = await cloneRepositoryToWorkspace(owner, repoName, branch, githubToken, userId, projectName || repoName);

    res.json({
      success: true,
      message: 'Repository cloned successfully',
      files: result.files,
      projectName,
      projectDescription,
      branch,
      workspacePath: result.workspacePath
    });
  } catch (error) {
    console.error('Error cloning repository:', error);
    res.status(500).json({ error: 'Failed to clone repository' });
  }
});

// Helper function to recursively fetch repository tree
async function fetchRepositoryTree(owner: string, repo: string, branch: string, token: string, path = ''): Promise<any[]> {
  const files: any[] = [];
  
  try {
    // Fetch directory contents
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents${path ? '/' + path : ''}?ref=${branch}`,
      {
        headers: {
          'Authorization': `token ${token}`,
          'User-Agent': 'AI-Code-Platform',
          'Accept': 'application/vnd.github.v3+json'
        }
      }
    );

    if (!response.ok) {
      console.error(`Failed to fetch ${path}: ${response.status}`);
      return files;
    }

    const contents = await response.json() as Array<{
      name: string;
      path: string;
      type: 'file' | 'dir';
      size?: number;
      download_url?: string;
    }>;
    
    for (const item of contents) {
      if (item.type === 'file') {
        // Download file content
        let fileContent = '';
        try {
          if (item.download_url) {
            const contentResponse = await fetch(item.download_url);
            if (contentResponse.ok) {
              // Handle different file types
              if (isTextFile(item.name)) {
                fileContent = await contentResponse.text();
              } else if (isBinaryFile(item.name)) {
                fileContent = `// Binary file: ${item.name}\n// Size: ${item.size} bytes\n// This file cannot be displayed as text.`;
              } else {
                fileContent = await contentResponse.text();
              }
            } else {
              fileContent = `// Failed to load content for ${item.name}`;
            }
          }
        } catch (error) {
          console.warn(`Failed to download ${item.name}:`, error);
          fileContent = `// Failed to load content for ${item.name}`;
        }

        files.push({
          id: `${Date.now()}-${Math.random()}`,
          name: item.name,
          type: 'file',
          path: `/${item.path}`,
          content: fileContent,
          language: getLanguageFromFileName(item.name),
          lastModified: new Date(),
        });
      } else if (item.type === 'dir') {
        // Recursively fetch subdirectory (limit depth to prevent infinite recursion)
        const currentDepth = path.split('/').filter(p => p).length;
        if (currentDepth < 10) { // Limit to 10 levels deep
          const subFiles = await fetchRepositoryTree(owner, repo, branch, token, item.path);
          files.push(...subFiles);
        }
      }
    }
  } catch (error) {
    console.error(`Error fetching tree for ${path}:`, error);
  }

  return files;
}

// Helper function to determine if file is text-based
function isTextFile(filename: string): boolean {
  const textExtensions = [
    'txt', 'md', 'json', 'js', 'jsx', 'ts', 'tsx', 'html', 'css', 'scss', 'sass', 'less',
    'py', 'java', 'cpp', 'c', 'h', 'cs', 'php', 'rb', 'go', 'rs', 'swift', 'kt', 'scala',
    'xml', 'yaml', 'yml', 'toml', 'ini', 'cfg', 'conf', 'sh', 'bat', 'ps1', 'sql',
    'dockerfile', 'gitignore', 'gitattributes', 'editorconfig', 'eslintrc', 'prettierrc',
    'babelrc', 'npmrc', 'yarnrc', 'nvmrc', 'env', 'example', 'sample', 'template'
  ];
  
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const name = filename.toLowerCase();
  
  return textExtensions.includes(ext) || 
         name.includes('readme') || 
         name.includes('license') || 
         name.includes('changelog') ||
         name.includes('makefile') ||
         name.startsWith('.');
}

// Helper function to determine if file is binary
function isBinaryFile(filename: string): boolean {
  const binaryExtensions = [
    'png', 'jpg', 'jpeg', 'gif', 'bmp', 'ico', 'svg', 'webp',
    'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
    'zip', 'rar', '7z', 'tar', 'gz', 'bz2',
    'exe', 'dll', 'so', 'dylib', 'bin',
    'mp3', 'mp4', 'avi', 'mov', 'wmv', 'flv',
    'ttf', 'otf', 'woff', 'woff2', 'eot'
  ];
  
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  return binaryExtensions.includes(ext);
}

// Helper function to get language from filename
function getLanguageFromFileName(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const name = filename.toLowerCase();
  
  const languageMap: { [key: string]: string } = {
    'js': 'javascript',
    'jsx': 'javascript',
    'ts': 'typescript',
    'tsx': 'typescript',
    'py': 'python',
    'java': 'java',
    'cpp': 'cpp',
    'c': 'c',
    'h': 'c',
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
    'toml': 'toml',
    'ini': 'ini',
    'md': 'markdown',
    'sh': 'bash',
    'bat': 'batch',
    'ps1': 'powershell',
    'sql': 'sql',
    'dockerfile': 'dockerfile',
  };

  if (languageMap[ext]) {
    return languageMap[ext];
  }

  // Special filename cases
  if (name === 'dockerfile' || name.startsWith('dockerfile.')) return 'dockerfile';
  if (name === 'makefile' || name.startsWith('makefile.')) return 'makefile';
  if (name.includes('readme')) return 'markdown';
  if (name.includes('license')) return 'text';
  if (name.startsWith('.')) return 'text';

  return 'text';
}

// Helper function to clone repository with progress tracking
async function cloneRepositoryWithProgress(
  owner: string,
  repo: string,
  branch: string,
  token: string,
  userId: string,
  projectName: string,
  onProgress: (progress: { status: string; message: string; progress: number }) => void
): Promise<{ files: any[], workspacePath: string }> {
  // Create user-specific workspace directory
  const userWorkspaceDir = `/workspaces/${userId}`;
  const projectPath = path.join(userWorkspaceDir, projectName);
  
  try {
    onProgress({ status: 'preparing', message: 'Preparing workspace...', progress: 10 });
    
    // Ensure user workspace directory exists
    if (!fs.existsSync(userWorkspaceDir)) {
      fs.mkdirSync(userWorkspaceDir, { recursive: true });
    }
    
    // Remove existing project directory if it exists
    if (fs.existsSync(projectPath)) {
      onProgress({ status: 'cleaning', message: 'Cleaning existing directory...', progress: 20 });
      await new Promise<void>((resolve, reject) => {
        exec(`rm -rf "${projectPath}"`, (error) => {
          if (error) reject(error);
          else resolve();
        });
      });
    }
    
    onProgress({ status: 'cloning', message: 'Cloning repository...', progress: 30 });
    
    // Construct authenticated clone URL
    const authenticatedUrl = `https://${token}:x-oauth-basic@github.com/${owner}/${repo}.git`;
    
    // Clone the repository with progress tracking
    await new Promise<void>((resolve, reject) => {
      const cloneProcess = spawn('git', [
        'clone', 
        '--progress',
        '--depth', '1',
        '--branch', branch,
        authenticatedUrl,
        projectPath
      ], {
        stdio: ['ignore', 'pipe', 'pipe'],
        cwd: userWorkspaceDir
      });

      let progressCount = 30;
      
      cloneProcess.stderr.on('data', (data) => {
        const output = data.toString();
        console.log('Git clone progress:', output);
        
        // Parse git progress output
        if (output.includes('Receiving objects:')) {
          progressCount = Math.min(progressCount + 5, 70);
          onProgress({ 
            status: 'downloading', 
            message: 'Downloading objects...', 
            progress: progressCount 
          });
        } else if (output.includes('Resolving deltas:')) {
          progressCount = Math.min(progressCount + 10, 80);
          onProgress({ 
            status: 'processing', 
            message: 'Processing files...', 
            progress: progressCount 
          });
        } else if (output.includes('Checking out files:')) {
          progressCount = Math.min(progressCount + 10, 90);
          onProgress({ 
            status: 'checkout', 
            message: 'Checking out files...', 
            progress: progressCount 
          });
        }
      });

      cloneProcess.on('close', (code) => {
        if (code === 0) {
          onProgress({ status: 'cleanup', message: 'Cleaning up...', progress: 90 });
          resolve();
        } else {
          reject(new Error(`Git clone failed with code ${code}`));
        }
      });

      cloneProcess.on('error', (error) => {
        reject(new Error(`Git clone error: ${error.message}`));
      });

      // Timeout after 5 minutes
      setTimeout(() => {
        cloneProcess.kill();
        reject(new Error('Clone operation timed out after 5 minutes'));
      }, 300000);
    });
    
    onProgress({ status: 'securing', message: 'Securing workspace...', progress: 95 });
    
    // Remove .git directory for security and space
    const gitDir = path.join(projectPath, '.git');
    if (fs.existsSync(gitDir)) {
      await new Promise<void>((resolve, reject) => {
        exec(`rm -rf "${gitDir}"`, (error) => {
          if (error) reject(error);
          else resolve();
        });
      });
    }
    
    onProgress({ status: 'reading', message: 'Reading file structure...', progress: 98 });
    
    // Read the cloned files and build file structure
    const files = await buildFileStructureFromDirectory(projectPath, projectPath);
    
    // Set proper permissions for the workspace
    try {
      await new Promise<void>((resolve, reject) => {
        exec(`chown -R 1000:1000 "${projectPath}"`, (error) => {
          if (error) console.warn('Failed to set ownership:', error);
          resolve();
        });
      });
      
      await new Promise<void>((resolve, reject) => {
        exec(`chmod -R 755 "${projectPath}"`, (error) => {
          if (error) console.warn('Failed to set permissions:', error);
          resolve();
        });
      });
    } catch (error) {
      console.warn('Permission setting failed:', error);
    }
    
    return {
      files,
      workspacePath: projectPath
    };
    
  } catch (error) {
    console.error(`Failed to clone repository ${owner}/${repo}:`, error);
    
    // Cleanup on failure
    if (fs.existsSync(projectPath)) {
      try {
        await new Promise<void>((resolve) => {
          exec(`rm -rf "${projectPath}"`, () => resolve());
        });
      } catch (cleanupError) {
        console.error('Failed to cleanup failed clone:', cleanupError);
      }
    }
    
    throw new Error(`Failed to clone repository: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Helper function to clone repository to workspace directory (fallback)
async function cloneRepositoryToWorkspace(
  owner: string,
  repo: string,
  branch: string,
  token: string,
  userId: string,
  projectName: string
): Promise<{ files: any[], workspacePath: string }> {
  const execAsync = promisify(exec);
  
  // Create user-specific workspace directory
  const userWorkspaceDir = `/workspaces/${userId}`;
  const projectPath = path.join(userWorkspaceDir, projectName);
  
  try {
    // Ensure user workspace directory exists
    if (!fs.existsSync(userWorkspaceDir)) {
      fs.mkdirSync(userWorkspaceDir, { recursive: true });
    }
    
    // Remove existing project directory if it exists
    if (fs.existsSync(projectPath)) {
      await execAsync(`rm -rf "${projectPath}"`);
    }
    
    // Construct authenticated clone URL
    const authenticatedUrl = `https://${token}:x-oauth-basic@github.com/${owner}/${repo}.git`;
    
    // Clone the repository
    const cloneCommand = `git clone --depth 1 --branch ${branch} "${authenticatedUrl}" "${projectPath}"`;
    console.log(`Cloning repository: ${owner}/${repo} (branch: ${branch}) to ${projectPath}`);
    
    await execAsync(cloneCommand, { cwd: userWorkspaceDir });
    
    // Remove .git directory for security and space
    const gitDir = path.join(projectPath, '.git');
    if (fs.existsSync(gitDir)) {
      await execAsync(`rm -rf "${gitDir}"`);
    }
    
    // Read the cloned files and build file structure
    const files = await buildFileStructureFromDirectory(projectPath, projectPath);
    
    // Set proper permissions for the workspace
    await execAsync(`chown -R 1000:1000 "${projectPath}"`);
    await execAsync(`chmod -R 755 "${projectPath}"`);
    
    return {
      files,
      workspacePath: projectPath
    };
    
  } catch (error) {
    console.error(`Failed to clone repository ${owner}/${repo}:`, error);
    
    // Cleanup on failure
    if (fs.existsSync(projectPath)) {
      try {
        await execAsync(`rm -rf "${projectPath}"`);
      } catch (cleanupError) {
        console.error('Failed to cleanup failed clone:', cleanupError);
      }
    }
    
    throw new Error(`Failed to clone repository: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Helper function to build file structure from cloned directory
async function buildFileStructureFromDirectory(dirPath: string, basePath: string): Promise<any[]> {
  const files: any[] = [];
  
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      const relativePath = path.relative(basePath, fullPath);
      
      if (entry.isDirectory()) {
        // Recursively process subdirectories
        const subFiles = await buildFileStructureFromDirectory(fullPath, basePath);
        files.push(...subFiles);
      } else if (entry.isFile()) {
        // Read file content
        let content = '';
        try {
          const stats = fs.statSync(fullPath);
          
          // Skip very large files (> 1MB)
          if (stats.size > 1024 * 1024) {
            content = `// File too large to display (${Math.round(stats.size / 1024)}KB)\n// File location: ${relativePath}`;
          } else if (isTextFile(entry.name)) {
            content = fs.readFileSync(fullPath, 'utf8');
          } else if (isBinaryFile(entry.name)) {
            content = `// Binary file: ${entry.name}\n// Size: ${stats.size} bytes\n// This file cannot be displayed as text.\n// File location: ${relativePath}`;
          } else {
            // Try to read as text, fallback to binary message
            try {
              content = fs.readFileSync(fullPath, 'utf8');
            } catch {
              content = `// Binary file: ${entry.name}\n// This file cannot be displayed as text.\n// File location: ${relativePath}`;
            }
          }
        } catch (error) {
          console.warn(`Failed to read file ${fullPath}:`, error);
          content = `// Failed to load content for ${entry.name}\n// File location: ${relativePath}`;
        }
        
        files.push({
          id: `${Date.now()}-${Math.random()}`,
          name: entry.name,
          type: 'file',
          path: `/${relativePath.replace(/\\/g, '/')}`,
          content: content,
          language: getLanguageFromFileName(entry.name),
          lastModified: new Date(),
        });
      }
    }
  } catch (error) {
    console.error(`Failed to read directory ${dirPath}:`, error);
  }
  
  return files;
}

export default router;
