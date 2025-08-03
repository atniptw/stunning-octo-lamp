import { Octokit } from "@octokit/rest";
// IssueData type removed - using inline type definition

export class GitHubService {
  private octokit: Octokit;
  private owner: string;
  private repo: string;

  constructor() {
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      throw new Error("GITHUB_TOKEN environment variable is not set");
    }

    this.octokit = new Octokit({ auth: token });

    // Parse repo from environment or git remote
    const repoConfig = process.env.GITHUB_REPO || "";
    if (!repoConfig) {
      throw new Error(
        "GITHUB_REPO environment variable is not set (format: owner/repo)",
      );
    }

    const [owner, repo] = repoConfig.split("/");
    if (!owner || !repo) {
      throw new Error("GITHUB_REPO must be in format: owner/repo");
    }

    this.owner = owner;
    this.repo = repo;
  }

  async fetchIssue(issueId: string): Promise<{
    id: string;
    title: string;
    description: string;
    url: string;
    labels: string[];
    assignee?: string;
  }> {
    try {
      const issueNumber = parseInt(issueId.replace(/[^0-9]/g, ""));

      const { data } = await this.octokit.issues.get({
        owner: this.owner,
        repo: this.repo,
        issue_number: issueNumber,
      });

      return {
        id: String(data.number),
        title: data.title,
        description: data.body || "",
        url: data.html_url,
        labels: data.labels.map((label) =>
          typeof label === "string" ? label : label.name || "",
        ),
        assignee: data.assignee?.login,
      };
    } catch (error: any) {
      if (error.status === 404) {
        throw new Error(
          `Issue #${issueId} not found in ${this.owner}/${this.repo}`,
        );
      } else if (error.status === 401) {
        throw new Error(
          "GitHub authentication failed. Check your GITHUB_TOKEN",
        );
      }
      throw new Error(`Failed to fetch issue: ${error.message}`);
    }
  }

  async fetchFeature(featureId: string): Promise<{
    id: string;
    title: string;
    description: string;
    url: string;
    labels: string[];
  }> {
    // For GitHub integration, features are stored as issues
    const issueData = await this.fetchIssue(featureId);
    return {
      id: issueData.id,
      title: issueData.title,
      description: issueData.description,
      url: issueData.url,
      labels: issueData.labels,
    };
  }

  async updateIssueStatus(issueId: string, status: "in-progress" | "ready") {
    // This would update labels or project board status
    // For MVP, we'll just add a comment
    const issueNumber = parseInt(issueId.replace(/[^0-9]/g, ""));

    await this.octokit.issues.createComment({
      owner: this.owner,
      repo: this.repo,
      issue_number: issueNumber,
      body: `🤖 Workflow update: Issue is now **${status}**`,
    });
  }

  async createPullRequest(params: {
    title: string;
    body: string;
    head: string;
    base: string;
  }): Promise<{
    number: number;
    title: string;
    html_url: string;
    state: string;
  }> {
    try {
      const { data } = await this.octokit.pulls.create({
        owner: this.owner,
        repo: this.repo,
        title: params.title,
        body: params.body,
        head: params.head,
        base: params.base,
      });

      return {
        number: data.number,
        title: data.title,
        html_url: data.html_url,
        state: data.state,
      };
    } catch (error: any) {
      if (error.status === 401) {
        throw new Error(
          "GitHub authentication failed. Check your GITHUB_TOKEN",
        );
      } else if (error.status === 422) {
        throw new Error(
          `Cannot create PR: ${error.message}. Make sure the branch exists and has commits.`,
        );
      }
      throw new Error(`Failed to create pull request: ${error.message}`);
    }
  }

  async createIssue(params: {
    title: string;
    body: string;
    labels?: string[];
    assignees?: string[];
    milestone?: number;
  }): Promise<{ number: number; html_url: string }> {
    try {
      const { data } = await this.octokit.issues.create({
        owner: this.owner,
        repo: this.repo,
        title: params.title,
        body: params.body,
        labels: params.labels,
        assignees: params.assignees,
        milestone: params.milestone,
      });

      return {
        number: data.number,
        html_url: data.html_url,
      };
    } catch (error: any) {
      throw new Error(`Failed to create issue: ${error.message}`);
    }
  }
}
