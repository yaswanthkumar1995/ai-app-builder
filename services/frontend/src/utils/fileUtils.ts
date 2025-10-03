// Utility functions for file structure operations

export interface FileNode {
  id: string;
  name: string;
  type: 'file' | 'folder';
  path: string;
  children?: FileNode[];
  content?: string;
  language?: string;
  lastModified?: Date;
}

// Convert flat file list to hierarchical structure
export function buildFileTree(files: FileNode[]): FileNode[] {
  console.log('🌲 buildFileTree called with', files.length, 'files');
  console.log('📋 Sample files:', files.slice(0, 3));
  
  const tree: FileNode[] = [];
  const pathMap = new Map<string, FileNode>();

  // Sort files by path to ensure proper order
  const sortedFiles = [...files].sort((a, b) => a.path.localeCompare(b.path));

  for (const file of sortedFiles) {
    // Handle root level files and normalize paths
    let normalizedPath = file.path;
    if (!normalizedPath.startsWith('/')) {
      normalizedPath = '/' + normalizedPath;
    }
    
    const pathParts = normalizedPath.split('/').filter(part => part !== '');
    
    // If no path parts, it's a root file
    if (pathParts.length === 0) continue;
    
    let currentPath = '';
    let currentLevel = tree;

    for (let i = 0; i < pathParts.length; i++) {
      const part = pathParts[i];
      currentPath += '/' + part;
      
      if (i === pathParts.length - 1) {
        // This is the file itself
        const fileNode: FileNode = {
          ...file,
          name: part,
          path: currentPath,
          // Ensure files don't have children
          children: file.type === 'folder' ? [] : undefined,
        };
        currentLevel.push(fileNode);
        pathMap.set(currentPath, fileNode);
        
        // If this is a folder, set up children array
        if (file.type === 'folder' && !fileNode.children) {
          fileNode.children = [];
        }
      } else {
        // This is a directory in the path
        let folderNode = pathMap.get(currentPath);
        
        if (!folderNode) {
          folderNode = {
            id: `folder-${Date.now()}-${Math.random()}`,
            name: part,
            type: 'folder',
            path: currentPath,
            children: [],
            lastModified: new Date(),
          };
          currentLevel.push(folderNode);
          pathMap.set(currentPath, folderNode);
        }
        
        currentLevel = folderNode.children!;
      }
    }
  }

  // Sort the tree: folders first, then files, both alphabetically
  const sortedTree = sortFileTree(tree);
  console.log('🌲 buildFileTree result:', sortedTree.length, 'root items');
  return sortedTree;
}

// Sort file tree with folders first, then files (like VS Code)
function sortFileTree(nodes: FileNode[]): FileNode[] {
  return nodes
    .sort((a, b) => {
      // Folders come first
      if (a.type === 'folder' && b.type === 'file') return -1;
      if (a.type === 'file' && b.type === 'folder') return 1;
      
      // Within same type, sort alphabetically
      return a.name.localeCompare(b.name);
    })
    .map(node => ({
      ...node,
      children: node.children ? sortFileTree(node.children) : undefined,
    }));
}

// Get language from file extension
export function getLanguageFromExtension(filename: string): string {
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
    'dockerfile': 'dockerfile',
    'gitignore': 'text',
  };
  return languageMap[ext || ''] || 'text';
}

// Flatten tree structure back to array (for storage)
export function flattenFileTree(tree: FileNode[]): FileNode[] {
  const result: FileNode[] = [];

  function traverse(nodes: FileNode[]) {
    for (const node of nodes) {
      if (node.type === 'file') {
        result.push({
          ...node,
          children: undefined, // Remove children for files
        });
      } else if (node.children) {
        // Add folder if it's not empty
        result.push({
          ...node,
          children: undefined, // Don't store children in flat structure
        });
        traverse(node.children);
      }
    }
  }

  traverse(tree);
  return result;
}