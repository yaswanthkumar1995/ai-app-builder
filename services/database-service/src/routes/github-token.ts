import express from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { providerSettings } from '../db/schema.js';

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

    // Fetch repos from GitHub API
    const headers: Record<string, string> = {
      'User-Agent': 'AI-Code-Platform'
    };

    if (githubToken) {
      headers['Authorization'] = `token ${githubToken}`;
    }

    const response = await fetch(`https://api.github.com/users/${username}/repos?sort=updated&per_page=50`, {
      headers
    });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
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

    const headers: Record<string, string> = {
      'User-Agent': 'AI-Code-Platform',
      'Accept': 'application/vnd.github.v3+json'
    };

    if (githubToken) {
      headers['Authorization'] = `token ${githubToken}`;
    }

    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${ref}`;
    const response = await fetch(url, { headers });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }

    const contents = await response.json();
    res.json(contents);
  } catch (error) {
    console.error('Error fetching repository contents:', error);
    res.status(500).json({ error: 'Failed to fetch repository contents' });
  }
});

export default router;
