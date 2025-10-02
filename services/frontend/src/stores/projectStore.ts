import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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
}

interface ProjectState {
  currentProject: Project | null;
  projects: Project[];
  selectedFile: FileNode | null;
  isLoading: boolean;
  
  // Actions
  createProject: (name: string, description?: string, githubData?: { repo: string; branch: string; files?: any[] }) => void;
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
  
  // Utility functions
  getFileByPath: (path: string) => FileNode | null;
  getProjectStructure: () => string;
  exportProject: () => string;
  importProject: (projectData: string) => void;
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
      currentProject: defaultProject,
      projects: [defaultProject],
      selectedFile: null,
      isLoading: false,

      createProject: (name: string, description?: string, githubData?: { repo: string; branch: string; files?: any[] }) => {
        const newProject: Project = {
          id: Date.now().toString(),
          name,
          description,
          files: githubData?.files || [],
          createdAt: new Date(),
          updatedAt: new Date(),
          githubRepo: githubData?.repo,
          githubBranch: githubData?.branch,
          isGithubProject: !!githubData,
        };

        set((state) => ({
          projects: [...state.projects, newProject],
          currentProject: newProject,
          selectedFile: null,
        }));
      },

      loadProject: (projectId: string) => {
        const project = get().projects.find(p => p.id === projectId);
        if (project) {
          set({
            currentProject: project,
            selectedFile: null,
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
        }));
      },

      selectFile: (file: FileNode) => {
        set({ selectedFile: file });
      },

      createFile: (parentPath: string, name: string, type: 'file' | 'folder', content?: string) => {
        const { currentProject } = get();
        if (!currentProject) return;

        const newFile: FileNode = {
          id: Date.now().toString(),
          name,
          type,
          path: `${parentPath}/${name}`,
          content: type === 'file' ? (content || '') : undefined,
          language: type === 'file' ? 'javascript' : undefined,
          lastModified: new Date(),
        };

        const updateFiles = (nodes: FileNode[]): FileNode[] => {
          return nodes.map(node => {
            if (node.path === parentPath) {
              return {
                ...node,
                children: [...(node.children || []), newFile],
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

        set((state) => ({
          currentProject: {
            ...state.currentProject!,
            files: updatedFiles,
            updatedAt: new Date(),
          },
        }));

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

        set((state) => ({
          currentProject: {
            ...state.currentProject!,
            files: updatedFiles,
            updatedAt: new Date(),
          },
          selectedFile: state.selectedFile?.path === filePath ? null : state.selectedFile,
        }));

        get().saveProject();
      },

      renameFile: (filePath: string, newName: string) => {
        const { currentProject } = get();
        if (!currentProject) return;

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

        set((state) => ({
          currentProject: {
            ...state.currentProject!,
            files: updatedFiles,
            updatedAt: new Date(),
          },
          selectedFile: state.selectedFile?.path === filePath 
            ? { ...state.selectedFile, name: newName, lastModified: new Date() }
            : state.selectedFile,
        }));

        get().saveProject();
      },

      moveFile: (filePath: string, newParentPath: string) => {
        // TODO: Implement file moving functionality
        console.log('Move file:', filePath, 'to:', newParentPath);
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
      partialize: (state) => ({
        projects: state.projects.map(project => ({
          ...project,
          createdAt: project.createdAt.toISOString(),
          updatedAt: project.updatedAt.toISOString(),
          files: project.files.map(file => ({
            ...file,
            lastModified: file.lastModified?.toISOString(),
          })),
        })),
        currentProject: state.currentProject ? {
          ...state.currentProject,
          createdAt: state.currentProject.createdAt.toISOString(),
          updatedAt: state.currentProject.updatedAt.toISOString(),
          files: state.currentProject.files.map(file => ({
            ...file,
            lastModified: file.lastModified?.toISOString(),
          })),
        } : null,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
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
