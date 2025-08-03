import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

export class GitHubMCPService {
  private client: Client;
  private connected: boolean = false;

  constructor() {
    this.client = new Client({
      name: "ai-workflow-tool",
      version: "1.0.0",
    });
  }

  async connect(): Promise<void> {
    if (this.connected) return;

    const transport = new StdioClientTransport({
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-github"],
      env: {
        ...process.env,
        GITHUB_TOKEN: process.env.GITHUB_TOKEN || "",
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
      throw new Error("GITHUB_REPO not configured");
    }

    // Parse owner and repo from the format "owner/repo"
    const [owner, repoName] = repo.split("/");
    if (!owner || !repoName) {
      throw new Error("GITHUB_REPO must be in format: owner/repo");
    }

    const result = await this.client.callTool({
      name: "create_pull_request",
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
      throw new Error(
        `MCP error ${(result.error as any).code}: ${(result.error as any).message}`,
      );
    }

    // Extract the content from the MCP response
    const content = (result.content as any)[0];
    if (content.type === "text") {
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

    throw new Error("Unexpected response format from MCP server");
  }

  async fetchIssue(repo: string, issueNumber: number): Promise<any> {
    await this.connect();

    const result = await this.client.callTool({
      name: "get_issue",
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

  async pushBranch(branch: string): Promise<void> {
    await this.connect();

    const repo = process.env.GITHUB_REPO;
    if (!repo) {
      throw new Error("GITHUB_REPO not configured");
    }

    const [owner, repoName] = repo.split("/");

    // Get the current commit SHA
    const { stdout: currentSha } = await import("child_process").then(
      (cp) =>
        new Promise<{ stdout: string }>((resolve, reject) => {
          cp.exec("git rev-parse HEAD", (err, stdout) => {
            if (err) reject(err);
            else resolve({ stdout: stdout.trim() });
          });
        }),
    );

    // The MCP server doesn't have a direct "push" command, but we can create/update a branch ref
    const result = await this.client.callTool({
      name: "create_or_update_reference",
      arguments: {
        owner,
        repo: repoName,
        ref: `refs/heads/${branch}`,
        sha: currentSha,
      },
    });

    if (result.error) {
      throw new Error(
        `Failed to push branch: ${(result.error as any).message}`,
      );
    }
  }

  async ensureBranchExists(branch: string): Promise<void> {
    await this.connect();

    const repo = process.env.GITHUB_REPO;
    if (!repo) {
      throw new Error("GITHUB_REPO not configured");
    }

    const [owner, repoName] = repo.split("/");

    // First, try to get the branch
    const getBranchResult = await this.client.callTool({
      name: "get_branch",
      arguments: {
        owner,
        repo: repoName,
        branch,
      },
    });

    // If branch doesn't exist, we need to create it
    if (
      getBranchResult.error &&
      (getBranchResult.error as any).message.includes("Not Found")
    ) {
      // Get the default branch SHA to branch from
      const getRepoResult = await this.client.callTool({
        name: "get_repository",
        arguments: {
          owner,
          repo: repoName,
        },
      });

      if (getRepoResult.error) {
        throw new Error(
          `Failed to get repository info: ${(getRepoResult.error as any).message}`,
        );
      }

      // Parse the default branch
      const repoData = JSON.parse((getRepoResult.content as any)[0].text);
      const defaultBranch = repoData.default_branch;

      // Get the SHA of the default branch
      const getDefaultBranchResult = await this.client.callTool({
        name: "get_branch",
        arguments: {
          owner,
          repo: repoName,
          branch: defaultBranch,
        },
      });

      if (getDefaultBranchResult.error) {
        throw new Error(
          `Failed to get default branch: ${(getDefaultBranchResult.error as any).message}`,
        );
      }

      const defaultBranchData = JSON.parse(
        (getDefaultBranchResult.content as any)[0].text,
      );
      const baseSha = defaultBranchData.commit.sha;

      // Create the new branch
      const createBranchResult = await this.client.callTool({
        name: "create_reference",
        arguments: {
          owner,
          repo: repoName,
          ref: `refs/heads/${branch}`,
          sha: baseSha,
        },
      });

      if (createBranchResult.error) {
        throw new Error(
          `Failed to create branch: ${(createBranchResult.error as any).message}`,
        );
      }
    }
  }

  async disconnect(): Promise<void> {
    if (this.connected) {
      await this.client.close();
      this.connected = false;
    }
  }
}
