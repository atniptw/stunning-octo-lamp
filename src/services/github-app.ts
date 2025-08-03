import { createAppAuth } from "@octokit/auth-app";
import { Octokit } from "@octokit/rest";
import { readFileSync } from "fs";
// IssueData type not needed for GitHub App service

export class GitHubAppService {
  private octokit: Octokit;
  private owner: string;
  private repo: string;
  private appName: string;

  constructor() {
    // Validate required environment variables
    const appId = process.env.GITHUB_APP_ID;
    const privateKeyPath = process.env.GITHUB_APP_PRIVATE_KEY_PATH;
    const installationId = process.env.GITHUB_APP_INSTALLATION_ID;
    const repoConfig = process.env.GITHUB_REPO;

    if (!appId || !privateKeyPath || !installationId) {
      throw new Error(
        "GitHub App configuration missing. Set GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY_PATH, and GITHUB_APP_INSTALLATION_ID",
      );
    }

    if (!repoConfig) {
      throw new Error(
        "GITHUB_REPO environment variable is not set (format: owner/repo)",
      );
    }

    // Parse repository
    const [owner, repo] = repoConfig.split("/");
    if (!owner || !repo) {
      throw new Error("GITHUB_REPO must be in format: owner/repo");
    }

    this.owner = owner;
    this.repo = repo;
    this.appName = process.env.GITHUB_APP_NAME || "AI Workflow Tool";

    // Read private key
    let privateKey: string;
    try {
      privateKey = readFileSync(privateKeyPath, "utf8");
    } catch (error) {
      throw new Error(
        `Failed to read private key from ${privateKeyPath}: ${error}`,
      );
    }

    // Create authenticated Octokit instance
    this.octokit = new Octokit({
      authStrategy: createAppAuth,
      auth: {
        appId: parseInt(appId),
        privateKey,
        installationId: parseInt(installationId),
      },
    });
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
          "GitHub App authentication failed. Check your app configuration",
        );
      }
      throw new Error(`Failed to fetch issue: ${error.message}`);
    }
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
      // Add app attribution to PR body
      const bodyWithAttribution = `${params.body}

---
*Created by ${this.appName}[bot] via AI Workflow Tool*`;

      const { data } = await this.octokit.pulls.create({
        owner: this.owner,
        repo: this.repo,
        title: params.title,
        body: bodyWithAttribution,
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
          "GitHub App authentication failed. Check your app configuration",
        );
      } else if (error.status === 403) {
        throw new Error(
          'GitHub App lacks permission. Ensure it has "Pull requests: Write" permission',
        );
      } else if (error.status === 422) {
        throw new Error(
          `Cannot create PR: ${error.message}. Make sure the branch exists and has commits.`,
        );
      }
      throw new Error(`Failed to create pull request: ${error.message}`);
    }
  }

  async createCommit(params: {
    message: string;
    tree: string;
    parents: string[];
  }): Promise<{ sha: string }> {
    try {
      // GitHub Apps create commits with [bot] suffix automatically
      const { data } = await this.octokit.git.createCommit({
        owner: this.owner,
        repo: this.repo,
        message: params.message,
        tree: params.tree,
        parents: params.parents,
      });

      return { sha: data.sha };
    } catch (error: any) {
      throw new Error(`Failed to create commit: ${error.message}`);
    }
  }

  async updateIssueStatus(issueId: string, status: "in-progress" | "ready") {
    const issueNumber = parseInt(issueId.replace(/[^0-9]/g, ""));

    await this.octokit.issues.createComment({
      owner: this.owner,
      repo: this.repo,
      issue_number: issueNumber,
      body: `🤖 **${this.appName}**: Workflow status updated to **${status}**`,
    });
  }

  async getPullRequestDetails(prNumber: number): Promise<{
    number: number;
    title: string;
    state: string;
    mergeable: boolean | null;
    mergeable_state: string;
    html_url: string;
    head: { sha: string; ref: string };
    base: { ref: string };
    user: { login: string };
    created_at: string;
    updated_at: string;
  }> {
    try {
      const { data: pr } = await this.octokit.pulls.get({
        owner: this.owner,
        repo: this.repo,
        pull_number: prNumber,
      });

      return {
        number: pr.number,
        title: pr.title,
        state: pr.state,
        mergeable: pr.mergeable,
        mergeable_state: pr.mergeable_state,
        html_url: pr.html_url,
        head: { sha: pr.head.sha, ref: pr.head.ref },
        base: { ref: pr.base.ref },
        user: { login: pr.user?.login || "unknown" },
        created_at: pr.created_at,
        updated_at: pr.updated_at,
      };
    } catch (error: any) {
      throw new Error(`Failed to get PR details: ${error.message}`);
    }
  }

  async checkPullRequestStatus(prNumber: number): Promise<{
    mergeable: boolean | null;
    mergeable_state: string;
    checks: Array<{
      name: string;
      status: string;
      conclusion: string | null;
      html_url: string;
      details_url?: string;
    }>;
    reviews: Array<{
      user: string;
      state: string;
      submitted_at: string;
    }>;
  }> {
    try {
      // Get PR details
      const { data: pr } = await this.octokit.pulls.get({
        owner: this.owner,
        repo: this.repo,
        pull_number: prNumber,
      });

      // Get status checks
      const { data: checks } = await this.octokit.checks.listForRef({
        owner: this.owner,
        repo: this.repo,
        ref: pr.head.sha,
      });

      // Get reviews
      const { data: reviews } = await this.octokit.pulls.listReviews({
        owner: this.owner,
        repo: this.repo,
        pull_number: prNumber,
      });

      return {
        mergeable: pr.mergeable,
        mergeable_state: pr.mergeable_state,
        checks: checks.check_runs.map((check) => ({
          name: check.name,
          status: check.status,
          conclusion: check.conclusion,
          html_url: check.html_url || "",
          details_url: check.details_url || undefined,
        })),
        reviews: reviews.map((review) => ({
          user: review.user?.login || "unknown",
          state: review.state,
          submitted_at: review.submitted_at || "",
        })),
      };
    } catch (error: any) {
      throw new Error(`Failed to check PR status: ${error.message}`);
    }
  }

  async getPullRequestComments(prNumber: number): Promise<
    Array<{
      id: number;
      user: string;
      body: string;
      created_at: string;
      html_url: string;
      is_review_comment: boolean;
    }>
  > {
    try {
      // Get issue comments (general PR comments)
      const { data: issueComments } = await this.octokit.issues.listComments({
        owner: this.owner,
        repo: this.repo,
        issue_number: prNumber,
      });

      // Get review comments (code-specific comments)
      const { data: reviewComments } =
        await this.octokit.pulls.listReviewComments({
          owner: this.owner,
          repo: this.repo,
          pull_number: prNumber,
        });

      const allComments = [
        ...issueComments.map((comment) => ({
          id: comment.id,
          user: comment.user?.login || "unknown",
          body: comment.body || "",
          created_at: comment.created_at,
          html_url: comment.html_url,
          is_review_comment: false,
        })),
        ...reviewComments.map((comment) => ({
          id: comment.id,
          user: comment.user?.login || "unknown",
          body: comment.body || "",
          created_at: comment.created_at,
          html_url: comment.html_url,
          is_review_comment: true,
        })),
      ];

      // Sort by creation date
      return allComments.sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      );
    } catch (error: any) {
      throw new Error(`Failed to get PR comments: ${error.message}`);
    }
  }

  async mergePullRequest(
    prNumber: number,
    mergeMethod: "merge" | "squash" | "rebase" = "squash",
  ): Promise<void> {
    try {
      await this.octokit.pulls.merge({
        owner: this.owner,
        repo: this.repo,
        pull_number: prNumber,
        merge_method: mergeMethod,
      });
    } catch (error: any) {
      if (error.status === 405) {
        throw new Error(
          "Pull request is not mergeable. Check status checks and conflicts.",
        );
      }
      throw new Error(`Failed to merge PR: ${error.message}`);
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
