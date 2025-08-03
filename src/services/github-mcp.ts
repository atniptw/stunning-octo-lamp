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

    // Parse owner and repo from the format "owner/repo"
    const [owner, repoName] = repo.split('/');
    if (!owner || !repoName) {
      throw new Error('GITHUB_REPO must be in format: owner/repo');
    }

    const result = await this.client.callTool({
      name: 'create_pull_request',
      arguments: {
        owner,
        repo: repoName,
        title: params.title,
        body: params.body,
        head: params.head,
        base: params.base,
      },
    });

    if (result.error) {
      throw new Error(`MCP error ${result.error.code}: ${result.error.message}`);
    }

    // Extract the content from the MCP response
    const content = result.content[0];
    if (content.type === 'text') {
      // Parse the JSON response from the text content
      try {
        const prData = JSON.parse(content.text);
        return {
          number: prData.number,
          title: prData.title,
          html_url: prData.html_url,
          state: prData.state,
        };
      } catch (e) {
        throw new Error(`Failed to parse PR response: ${content.text}`);
      }
    }

    throw new Error('Unexpected response format from MCP server');
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