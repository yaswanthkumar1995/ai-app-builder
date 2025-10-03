import { config } from '../config';

interface GitOperation {
  type: 'clone' | 'checkout' | 'commit' | 'push' | 'status';
  repoUrl?: string;
  branch?: string;
  message?: string;
  userId?: string;
  projectName?: string;
  userEmail?: string;
  create?: boolean;
  files?: string[];
}

export class GitOperations {
  private token: string;
  private userId: string;

  constructor(token: string, userId: string) {
    this.token = token;
    this.userId = userId;
  }

  async executeGitOperation(operation: GitOperation): Promise<any> {
    const baseHeaders = {
      'Authorization': `Bearer ${this.token}`,
      'Content-Type': 'application/json',
    };

    switch (operation.type) {
      case 'clone':
        return await this.cloneRepository(operation);
      case 'checkout':
        return await this.checkoutBranch(operation);
      case 'status':
        return await this.getStatus();
      case 'commit':
        return await this.commitChanges(operation);
      case 'push':
        return await this.pushChanges(operation);
      default:
        throw new Error(`Unsupported git operation: ${operation.type}`);
    }
  }

  private async cloneRepository(operation: GitOperation) {
    const userId = operation.userId || this.userId;
    if (!userId) {
      throw new Error('A user ID is required to clone repositories');
    }

    const response = await fetch(`${config.apiGatewayUrl}/api/git/clone`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        repoUrl: operation.repoUrl,
        branch: operation.branch,
        message: operation.message,
        userId,
        projectName: operation.projectName,
        userEmail: operation.userEmail
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to clone repository');
    }

    return await response.json();
  }

  private async checkoutBranch(operation: GitOperation) {
    const response = await fetch(`${config.apiGatewayUrl}/api/git/checkout`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        branch: operation.branch,
        userId: this.userId,
        create: operation.create
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to checkout branch');
    }

    return await response.json();
  }

  private async getStatus() {
    const response = await fetch(`${config.apiGatewayUrl}/api/git/status/${this.userId}`, {
      headers: {
        'Authorization': `Bearer ${this.token}`,
      }
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to get git status');
    }

    return await response.json();
  }

  private async commitChanges(operation: GitOperation) {
    const response = await fetch(`${config.apiGatewayUrl}/api/git/commit`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: this.userId,
        message: operation.message,
        files: operation.files
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to commit changes');
    }

    return await response.json();
  }

  private async pushChanges(operation: GitOperation) {
    const response = await fetch(`${config.apiGatewayUrl}/api/git/push`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: this.userId,
        branch: operation.branch
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to push changes');
    }

    return await response.json();
  }

  // Helper method to check if user has a terminal session
  async ensureTerminalSession(projectId?: string, userEmail?: string) {
    const response = await fetch(`${config.apiGatewayUrl}/api/terminal/create-session`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: this.userId,
        projectId: projectId,
        userEmail: userEmail
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to create terminal session');
    }

    return await response.json();
  }

  // Get user's workspace state
  async getWorkspaceState() {
    const response = await fetch(`${config.apiGatewayUrl}/api/workspace/state/${this.userId}`, {
      headers: {
        'Authorization': `Bearer ${this.token}`,
      }
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to get workspace state');
    }

    return await response.json();
  }

  // Update user's workspace state
  async updateWorkspaceState(updates: any) {
    const response = await fetch(`${config.apiGatewayUrl}/api/workspace/state/${this.userId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to update workspace state');
    }

    return await response.json();
  }

  // Get workspace files
  async getWorkspaceFiles() {
    const response = await fetch(`${config.apiGatewayUrl}/api/workspace/files/${this.userId}`, {
      headers: {
        'Authorization': `Bearer ${this.token}`,
      }
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to get workspace files');
    }

    const data = await response.json();
    return data.files || [];
  }

  // Get file content
  async getFileContent(filePath: string) {
    const response = await fetch(`${config.apiGatewayUrl}/api/workspace/file/${this.userId}/${filePath}`, {
      headers: {
        'Authorization': `Bearer ${this.token}`,
      }
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to get file content');
    }

    const data = await response.json();
    return data.content || '';
  }
}