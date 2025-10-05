import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { buildFileTree, flattenFileTree, getLanguageFromExtension } from '../utils/fileUtils';

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

export interface Project {
  id: string;
  name: string;
  description?: string;
  files: FileNode[];
  createdAt: Date;
  updatedAt: Date;
  githubRepo?: string;
  githubBranch?: string;
  isGithubProject?: boolean;
  workspacePath?: string;
}

interface ProjectState {
  currentProject: Project | null;
  projects: Project[];
  selectedFile: FileNode | null;
  openTabs: string[];
  isLoading: boolean;
  
  // Actions
  createProject: (name: string, description?: string, githubData?: { repo: string; branch: string; files?: any[]; workspacePath?: string }) => void;
  loadProject: (projectId: string) => void;
  saveProject: () => void;
  deleteProject: (projectId: string) => void;
  
  // File operations
  selectFile: (file: FileNode) => void;
  createFile: (parentPath: string, name: string, type: 'file' | 'folder', content?: string) => void;
  updateFile: (filePath: string, content: string) => void;
  deleteFile: (filePath: string) => void;
  renameFile: (filePath: string, newName: string) => void;
  moveFile: (filePath: string, newParentPath: string) => void;
  closeTab: (filePath: string) => void;
  
  // Utility functions
  getFileByPath: (path: string) => FileNode | null;
  getProjectStructure: () => string;
  exportProject: () => string;
  importProject: (projectData: string) => void;
  restructureCurrentProject: () => void;
}

const defaultProject: Project = {
  id: 'default',
  name: 'My AI Project',
  description: 'A project built with AI assistance',
  files: [
    {
      id: '1',
      name: 'src',
      type: 'folder',
      path: '/src',
      children: [
        {
          id: '2',
          name: 'App.js',
          type: 'file',
          path: '/src/App.js',
          content: `// Welcome to AI Code Platform
// Start coding with AI assistance

import React from 'react';

function App() {
  return (
    <div className="app">
      <h1>Hello, World!</h1>
      <p>Start building amazing applications with AI assistance.</p>
    </div>
  );
}

export default App;`,
          language: 'javascript',
          lastModified: new Date(),
        },
        {
          id: '3',
          name: 'index.js',
          type: 'file',
          path: '/src/index.js',
          content: `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);`,
          language: 'javascript',
          lastModified: new Date(),
        },
      ],
    },
    {
      id: '4',
      name: 'package.json',
      type: 'file',
      path: '/package.json',
      content: `{
  "name": "ai-code-project",
  "version": "1.0.0",
  "description": "A project built with AI assistance",
  "main": "src/index.js",
  "scripts": {
    "start": "react-scripts start",
    "build": "react-scripts build",
    "test": "react-scripts test"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-scripts": "5.0.1"
  }
}`,
      language: 'json',
      lastModified: new Date(),
    },
  ],
  createdAt: new Date(),
  updatedAt: new Date(),
};

export const useProjectStore = create<ProjectState>()(
  persist(
    (set, get) => ({
      currentProject: null,
      projects: [],
      selectedFile: null,
      openTabs: [],
      isLoading: false,

      createProject: (name: string, description?: string, githubData?: { repo: string; branch: string; files?: any[]; workspacePath?: string }) => {
        // If we have files from GitHub, build proper tree structure
        let files: FileNode[] = [];
        if (githubData?.files && githubData.files.length > 0) {
          files = buildFileTree(githubData.files);
        }

        const newProject: Project = {
          id: Date.now().toString(),
          name,
          description,
          files,
          createdAt: new Date(),
          updatedAt: new Date(),
          githubRepo: githubData?.repo,
          githubBranch: githubData?.branch,
          isGithubProject: !!githubData,
          workspacePath: githubData?.workspacePath,
        };

        set((state) => ({
          projects: [...state.projects, newProject],
          currentProject: newProject,
          selectedFile: null,
          openTabs: [],
        }));
      },

      loadProject: (projectId: string) => {
        const project = get().projects.find(p => p.id === projectId);
        if (project) {
          set({
            currentProject: project,
            selectedFile: null,
            openTabs: [],
          });
        }
      },

      saveProject: () => {
        const { currentProject } = get();
        if (!currentProject) return;

        const updatedProject = {
          ...currentProject,
          updatedAt: new Date(),
        };

        set((state) => ({
          currentProject: updatedProject,
          projects: state.projects.map(p => 
            p.id === updatedProject.id ? updatedProject : p
          ),
        }));
      },

      deleteProject: (projectId: string) => {
        set((state) => ({
          projects: state.projects.filter(p => p.id !== projectId),
          currentProject: state.currentProject?.id === projectId ? null : state.currentProject,
          selectedFile: state.currentProject?.id === projectId ? null : state.selectedFile,
          openTabs: state.currentProject?.id === projectId ? [] : state.openTabs,
        }));
      },

      selectFile: (file: FileNode) => {
        set((state) => {
          const alreadyOpen = state.openTabs.includes(file.path);
          const openTabs = alreadyOpen ? state.openTabs : [...state.openTabs, file.path];

          return {
            selectedFile: file,
            openTabs,
          };
        });
      },

      // Convert flat file structure to hierarchical structure for existing projects
      restructureCurrentProject: () => {
        const { currentProject } = get();
        if (!currentProject) return;

        // Check if already structured (has folders with children)
        const hasStructuredFolders = currentProject.files.some(
          file => file.type === 'folder' && file.children && file.children.length > 0
        );

        if (hasStructuredFolders) return; // Already structured

        // Convert flat structure to hierarchical
        const structuredFiles = buildFileTree(currentProject.files);

        const updatedProject = {
          ...currentProject,
          files: structuredFiles,
          updatedAt: new Date(),
        };

        set((state) => ({
          currentProject: updatedProject,
          projects: state.projects.map(p => 
            p.id === updatedProject.id ? updatedProject : p
          ),
        }));
      },

      createFile: (parentPath: string, name: string, type: 'file' | 'folder', content?: string) => {
        const { currentProject } = get();
        if (!currentProject) return;

        const normalizeParentPath = (path: string) => {
          if (!path || path === '/') {
            return '';
          }
          const trimmed = path.trim();
          const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
          return withLeadingSlash.replace(/\/+/g, '/').replace(/\/+$/, '');
        };

        const normalizedParent = normalizeParentPath(parentPath);
        const trimmedName = name?.trim() || (type === 'file' ? 'untitled.ts' : 'untitled-folder');
        let sanitizedName = trimmedName.replace(/[\\/]+/g, '-');
        if (sanitizedName.length === 0) {
          sanitizedName = type === 'file' ? 'untitled.ts' : 'untitled-folder';
        }

        const buildPath = () => {
          const base = normalizedParent ? normalizedParent.replace(/\/+$/, '') : '';
          const combined = `${base ? base + '/' : ''}${sanitizedName}`;
          const normalized = combined.replace(/\/+/g, '/');
          return normalized.startsWith('/') ? normalized : `/${normalized}`;
        };

        const newPath = buildPath();

        const newFile: FileNode = {
          id: Date.now().toString(),
          name: sanitizedName,
          type,
          path: newPath,
          children: type === 'folder' ? [] : undefined,
          content: type === 'file' ? (content ?? '') : undefined,
          language: type === 'file' ? getLanguageFromExtension(sanitizedName) : undefined,
          lastModified: new Date(),
        };

        let updatedFiles: FileNode[] = [];

        if (!normalizedParent) {
          updatedFiles = [...currentProject.files, newFile];
        } else {
          let parentFound = false;

          const attachNode = (nodes: FileNode[]): FileNode[] => {
            return nodes.map(node => {
              if (node.path === normalizedParent) {
                parentFound = true;
                return {
                  ...node,
                  children: [...(node.children || []), newFile],
                };
              }
              if (node.children) {
                return {
                  ...node,
                  children: attachNode(node.children),
                };
              }
              return node;
            });
          };

          const treeWithNewNode = attachNode(currentProject.files);
          updatedFiles = parentFound ? treeWithNewNode : [...currentProject.files, newFile];
        }

        set((state) => {
          const updatedProject = {
            ...state.currentProject!,
            files: updatedFiles,
            updatedAt: new Date(),
          };

          const shouldAddTab = type === 'file' && !state.openTabs.includes(newPath);

          return {
            currentProject: updatedProject,
            selectedFile: type === 'file' ? newFile : state.selectedFile,
            openTabs: shouldAddTab ? [...state.openTabs, newPath] : state.openTabs,
          };
        });

        get().saveProject();
      },

      updateFile: (filePath: string, content: string) => {
        const { currentProject } = get();
        if (!currentProject) return;

        const updateFileContent = (nodes: FileNode[]): FileNode[] => {
          return nodes.map(node => {
            if (node.path === filePath) {
              return { 
                ...node, 
                content,
                lastModified: new Date(),
              };
            }
            if (node.children) {
              return {
                ...node,
                children: updateFileContent(node.children),
              };
            }
            return node;
          });
        };

        const updatedFiles = updateFileContent(currentProject.files);

        set((state) => ({
          currentProject: {
            ...state.currentProject!,
            files: updatedFiles,
            updatedAt: new Date(),
          },
          selectedFile: state.selectedFile?.path === filePath 
            ? { ...state.selectedFile, content, lastModified: new Date() }
            : state.selectedFile,
        }));

        get().saveProject();
      },

      deleteFile: (filePath: string) => {
        const { currentProject } = get();
        if (!currentProject) return;

        const updateFiles = (nodes: FileNode[]): FileNode[] => {
          return nodes.filter(node => {
            if (node.path === filePath) {
              return false;
            }
            if (node.children) {
              node.children = updateFiles(node.children);
            }
            return true;
          });
        };

        const updatedFiles = updateFiles(currentProject.files);

        const previousTabs = get().openTabs;
        const closingIndex = previousTabs.indexOf(filePath);
        const updatedOpenTabs = previousTabs.filter(path => !(path === filePath || path.startsWith(`${filePath}/`)));
        const fallbackIndex = closingIndex >= 0 ? Math.min(closingIndex, Math.max(updatedOpenTabs.length - 1, 0)) : Math.max(updatedOpenTabs.length - 1, 0);
        const fallbackPath = updatedOpenTabs.length > 0 ? updatedOpenTabs[fallbackIndex] : null;
        const nextSelected = updatedOpenTabs.includes(get().selectedFile?.path || '')
          ? get().selectedFile
          : fallbackPath
            ? ((): FileNode | null => {
                const findFile = (nodes: FileNode[]): FileNode | null => {
                  for (const node of nodes) {
                    if (node.path === fallbackPath) return node;
                    if (node.children) {
                      const found = findFile(node.children);
                      if (found) return found;
                    }
                  }
                  return null;
                };
                return findFile(updatedFiles);
              })()
            : null;

        set((state) => ({
          currentProject: {
            ...state.currentProject!,
            files: updatedFiles,
            updatedAt: new Date(),
          },
          openTabs: updatedOpenTabs,
          selectedFile: nextSelected,
        }));

        get().saveProject();
      },

      renameFile: (filePath: string, newName: string) => {
        const { currentProject } = get();
        if (!currentProject) return;

        const originalNode = get().getFileByPath(filePath);
        const isFolder = originalNode?.type === 'folder';

        const updateFiles = (nodes: FileNode[]): FileNode[] => {
          return nodes.map(node => {
            if (node.path === filePath) {
              const newPath = node.path.split('/').slice(0, -1).join('/') + '/' + newName;
              return {
                ...node,
                name: newName,
                path: newPath,
                lastModified: new Date(),
              };
            }
            if (node.children) {
              return {
                ...node,
                children: updateFiles(node.children),
              };
            }
            return node;
          });
        };

        const updatedFiles = updateFiles(currentProject.files);

        const parentPath = filePath.split('/').slice(0, -1).join('/');
        const normalizedParent = parentPath === '' ? '' : parentPath;
        const newPath = `${normalizedParent}/${newName}`.replace('//', '/');
        const oldPrefix = isFolder ? `${filePath}/` : null;

        const updatedOpenTabs = get().openTabs.map(path => {
          if (path === filePath) {
            return newPath;
          }
          if (oldPrefix && path.startsWith(oldPrefix)) {
            return `${newPath}/${path.slice(oldPrefix.length)}`.replace('//', '/');
          }
          return path;
        });

        const previousSelected = get().selectedFile;
        let nextSelectedPath = previousSelected?.path || null;

        if (previousSelected) {
          if (previousSelected.path === filePath) {
            nextSelectedPath = newPath;
          } else if (oldPrefix && previousSelected.path.startsWith(oldPrefix)) {
            nextSelectedPath = `${newPath}/${previousSelected.path.slice(oldPrefix.length)}`.replace('//', '/');
          }
        }

        if (nextSelectedPath && !updatedOpenTabs.includes(nextSelectedPath)) {
          nextSelectedPath = updatedOpenTabs[0] || null;
        }

        const findInUpdated = (nodes: FileNode[], path: string): FileNode | null => {
          for (const node of nodes) {
            if (node.path === path) {
              return node;
            }
            if (node.children) {
              const found = findInUpdated(node.children, path);
              if (found) {
                return found;
              }
            }
          }
          return null;
        };

        const nextSelectedNode = nextSelectedPath ? findInUpdated(updatedFiles, nextSelectedPath) : null;

        const updatedProject = {
          ...currentProject,
          files: updatedFiles,
          updatedAt: new Date(),
        };

        set({
          currentProject: updatedProject,
          openTabs: updatedOpenTabs,
          selectedFile: nextSelectedNode,
        });

        get().saveProject();
      },

      moveFile: (filePath: string, newParentPath: string) => {
        // TODO: Implement file moving functionality
        console.log('Move file:', filePath, 'to:', newParentPath);
      },

      closeTab: (filePath: string) => {
        set((state) => {
          const tabIndex = state.openTabs.indexOf(filePath);
          if (tabIndex === -1) {
            return state;
          }

          const updatedTabs = state.openTabs.filter(path => path !== filePath);
          let nextSelected: FileNode | null = state.selectedFile;

          if (state.selectedFile?.path === filePath) {
            const fallbackPath = updatedTabs.length > 0
              ? updatedTabs[Math.min(tabIndex, updatedTabs.length - 1)]
              : null;
            nextSelected = fallbackPath ? get().getFileByPath(fallbackPath) : null;
          }

          return {
            openTabs: updatedTabs,
            selectedFile: nextSelected,
          };
        });
      },

      getFileByPath: (path: string): FileNode | null => {
        const { currentProject } = get();
        if (!currentProject) return null;

        const findFile = (nodes: FileNode[]): FileNode | null => {
          for (const node of nodes) {
            if (node.path === path) {
              return node;
            }
            if (node.children) {
              const found = findFile(node.children);
              if (found) return found;
            }
          }
          return null;
        };

        return findFile(currentProject.files);
      },

      getProjectStructure: (): string => {
        const { currentProject } = get();
        if (!currentProject) return '';

        const formatStructure = (nodes: FileNode[], indent: string = ''): string => {
          let result = '';
          for (const node of nodes) {
            result += `${indent}${node.type === 'folder' ? '📁' : '📄'} ${node.name}\n`;
            if (node.children) {
              result += formatStructure(node.children, indent + '  ');
            }
          }
          return result;
        };

        return formatStructure(currentProject.files);
      },

      exportProject: (): string => {
        const { currentProject } = get();
        if (!currentProject) return '';

        return JSON.stringify(currentProject, null, 2);
      },

      importProject: (projectData: string) => {
        try {
          const project: Project = JSON.parse(projectData);
          project.id = Date.now().toString();
          project.createdAt = new Date();
          project.updatedAt = new Date();

          set((state) => ({
            projects: [...state.projects, project],
            currentProject: project,
            selectedFile: null,
          }));
        } catch (error) {
          console.error('Failed to import project:', error);
        }
      },
    }),
    {
      name: 'project-store',
      partialize: (state) => {
        // Helper function to remove file contents to save space
        const stripFileContents = (files: FileNode[]): any[] => {
          return files.map(file => {
            if (file.type === 'folder' && file.children) {
              return {
                ...file,
                content: undefined, // Remove content
                children: stripFileContents(file.children),
                lastModified: file.lastModified?.toISOString(),
              };
            }
            return {
              ...file,
              content: undefined, // Remove content to save space
              lastModified: file.lastModified?.toISOString(),
            };
          });
        };

        return {
          openTabs: state.openTabs,
          // Don't persist projects to localStorage - they can be too large
          projects: [],
          currentProject: state.currentProject ? {
            id: state.currentProject.id,
            name: state.currentProject.name,
            description: state.currentProject.description,
            githubRepo: state.currentProject.githubRepo,
            githubBranch: state.currentProject.githubBranch,
            isGithubProject: state.currentProject.isGithubProject,
            workspacePath: state.currentProject.workspacePath,
            createdAt: state.currentProject.createdAt.toISOString(),
            updatedAt: state.currentProject.updatedAt.toISOString(),
            files: stripFileContents(state.currentProject.files),
          } : null,
        };
      },
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.openTabs = state.openTabs || [];
          // Convert ISO strings back to Date objects
          state.projects = state.projects.map(project => ({
            ...project,
            createdAt: new Date(project.createdAt),
            updatedAt: new Date(project.updatedAt),
            files: project.files.map(file => ({
              ...file,
              lastModified: file.lastModified ? new Date(file.lastModified) : undefined,
            })),
          }));
          
          if (state.currentProject) {
            state.currentProject = {
              ...state.currentProject,
              createdAt: new Date(state.currentProject.createdAt),
              updatedAt: new Date(state.currentProject.updatedAt),
              files: state.currentProject.files.map(file => ({
                ...file,
                lastModified: file.lastModified ? new Date(file.lastModified) : undefined,
              })),
            };
          }
        }
      },
    }
  )
);
