import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { StoryData } from '../types/story.js';

export class GitHubMCPService {
  private client: Client;
  private connected: boolean = false;

  constructor() {
    this.client = new Client({
      name: 'ai-workflow-tool',
      version: '1.0.0',
    });
  }

  async connect(): Promise<void> {
    if (this.connected) return;

    const transport = new StdioClientTransport({
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-github'],
      env: {
        ...process.env,
        GITHUB_TOKEN: process.env.GITHUB_TOKEN || '',
      },
    });

    await this.client.connect(transport);
    this.connected = true;
  }

  async createPullRequest(params: {
    title: string;
    body: string;
    head: string;
    base: string;
    repo?: string;
  }): Promise<{
    number: number;
    title: string;
    html_url: string;
    state: string;
  }> {
    await this.connect();

    const repo = params.repo || process.env.GITHUB_REPO;
    if (!repo) {
      throw new Error('GITHUB_REPO not configured');
    }

    const result = await this.client.callTool({
      name: 'create_pull_request',
      arguments: {
        repo,
        title: params.title,
        body: params.body,
        head: params.head,
        base: params.base,
      },
    });

    if (result.error) {
      throw new Error(`Failed to create PR: ${result.error}`);
    }

    return result.content as any;
  }

  async fetchIssue(repo: string, issueNumber: number): Promise<any> {
    await this.connect();

    const result = await this.client.callTool({
      name: 'get_issue',
      arguments: {
        repo,
        issue_number: issueNumber,
      },
    });

    if (result.error) {
      throw new Error(`Failed to fetch issue: ${result.error}`);
    }

    return result.content;
  }

  async disconnect(): Promise<void> {
    if (this.connected) {
      await this.client.close();
      this.connected = false;
    }
  }
}