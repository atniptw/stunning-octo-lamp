import chalk from 'chalk';
import ora from 'ora';
import { LocalGitHubService } from '../services/local-github.js';
import { GitHubService } from '../services/github.js';
import { GitHubAppService } from '../services/github-app.js';
import { GitHubMCPService } from '../services/github-mcp.js';
import type { StoryData } from '../types/story.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function createPRCommand(storyId: string) {
  const spinner = ora('Checking story and git status...').start();

  try {
    // Load story data
    const localService = new LocalGitHubService();
    const storyData = await localService.fetchStory(storyId);
    
    spinner.text = 'Validating git status...';
    
    // Check if we have commits to push
    const { stdout: status } = await execAsync('git status --porcelain');
    if (status.trim()) {
      spinner.warn('Warning: You have uncommitted changes');
      console.log(chalk.yellow('\nUncommitted files:'));
      console.log(chalk.dim(status));
      console.log(chalk.yellow('\nConsider committing your changes before creating a PR\n'));
    }

    // Check if current branch has commits ahead of main
    try {
      const { stdout: currentBranch } = await execAsync('git rev-parse --abbrev-ref HEAD');
      const branch = currentBranch.trim();
      
      if (branch === 'main' || branch === 'master') {
        spinner.fail('Cannot create PR from main branch');
        console.log(chalk.red('\nPlease create a feature branch first:'));
        console.log(chalk.dim(`  git checkout -b story-${storyId}`));
        process.exit(1);
      }

      const { stdout: ahead } = await execAsync(`git rev-list --count origin/main..HEAD`);
      if (parseInt(ahead.trim()) === 0) {
        spinner.fail('No commits to create PR');
        console.log(chalk.red('\nCurrent branch has no new commits.'));
        console.log(chalk.dim('Make some changes and commit them first.'));
        process.exit(1);
      }
    } catch (error) {
      // Git commands might fail if remote isn't set up
      spinner.info('Could not verify git status - continuing anyway');
    }

    spinner.text = 'Creating pull request...';

    // Generate PR content
    const prTitle = generatePRTitle(storyData);
    const prBody = generatePRBody(storyData);

    // Determine which GitHub service to use
    const githubToken = process.env.GITHUB_TOKEN;
    const githubRepo = process.env.GITHUB_REPO;
    const useGitHubApp = process.env.GITHUB_APP_ID && process.env.GITHUB_APP_PRIVATE_KEY_PATH;
    const useMCP = process.env.USE_GITHUB_MCP === 'true';

    if (!githubRepo || (!githubToken && !useGitHubApp) || githubToken === 'test_token') {
      // Mock mode - create local PR file
      spinner.text = 'Creating local pull request (mock mode)...';
      const prNumber = await localService.createPullRequest(storyId, prTitle, prBody);
      
      spinner.succeed('Pull request created (mock mode)');
      console.log('\n' + chalk.bold('Pull Request Details:'));
      console.log(chalk.blue('Number:'), `#${prNumber}`);
      console.log(chalk.blue('Title:'), prTitle);
      console.log(chalk.blue('File:'), chalk.dim(`.github/pulls/${prNumber}.md`));
      console.log('\n' + chalk.yellow('Note: This is a mock PR. Configure GitHub authentication to create real PRs.'));
    } else {
      // Real GitHub mode - choose service based on configuration
      let pr: { number: number; title: string; html_url: string; state: string };
      
      if (useMCP) {
        // Use MCP server
        spinner.text = 'Creating pull request via GitHub MCP...';
        const mcpService = new GitHubMCPService();
        try {
          pr = await mcpService.createPullRequest({
            title: prTitle,
            body: prBody,
            head: await getCurrentBranch(),
            base: 'main'
          });
        } finally {
          await mcpService.disconnect();
        }
      } else if (useGitHubApp) {
        // Use GitHub App
        spinner.text = 'Creating pull request via GitHub App...';
        const appService = new GitHubAppService();
        pr = await appService.createPullRequest({
          title: prTitle,
          body: prBody,
          head: await getCurrentBranch(),
          base: 'main'
        });
      } else {
        // Use personal access token
        spinner.text = 'Creating pull request via GitHub API...';
        const githubService = new GitHubService();
        pr = await githubService.createPullRequest({
          title: prTitle,
          body: prBody,
          head: await getCurrentBranch(),
          base: 'main'
        });
      }

      spinner.succeed('Pull request created successfully!');
      console.log('\n' + chalk.bold('Pull Request Details:'));
      console.log(chalk.blue('Number:'), `#${pr.number}`);
      console.log(chalk.blue('Title:'), pr.title);
      console.log(chalk.blue('URL:'), chalk.green(pr.html_url));
      console.log(chalk.blue('Method:'), chalk.dim(
        useMCP ? 'GitHub MCP Server' : 
        useGitHubApp ? 'GitHub App' : 
        'Personal Access Token'
      ));
      console.log('\n' + chalk.dim('Open the URL above to view your pull request'));
    }

  } catch (error: any) {
    spinner.fail('Failed to create pull request');
    
    if (error.message.includes('GITHUB_TOKEN')) {
      console.error(chalk.red('\nError: GitHub token required. Set GITHUB_TOKEN environment variable'));
      console.log(chalk.dim('\nTo create a token:'));
      console.log(chalk.dim('1. Go to https://github.com/settings/tokens'));
      console.log(chalk.dim('2. Generate a new token with "repo" scope'));
      console.log(chalk.dim('3. export GITHUB_TOKEN=your_token_here'));
    } else if (error.message.includes('Story not found')) {
      console.error(chalk.red('\nError:'), error.message);
      
      // Suggest available stories
      try {
        const localService = new LocalGitHubService();
        const stories = await localService.listStories();
        if (stories.length > 0) {
          console.log('\n' + chalk.dim('Available stories:'));
          stories.forEach(story => {
            console.log(chalk.dim(`  ${story.id}: ${story.title}`));
          });
        }
      } catch {
        // Ignore error when listing stories
      }
    } else {
      console.error(chalk.red('\nError:'), error.message);
    }
    
    process.exit(1);
  }
}

function generatePRTitle(story: StoryData): string {
  return `${story.type === 'bug' ? 'Fix' : 'Add'}: ${story.title} (#${story.id})`;
}

function generatePRBody(story: any): string {
  let body = `## 📋 Story: ${story.title}\n\n`;
  body += `**Type:** ${story.type}\n`;
  body += `**Feature:** #${story.featureId}\n`;
  body += `**Story ID:** ${story.id}\n\n`;

  if (story.description) {
    body += `### Description\n\n${story.description}\n\n`;
  }

  if (story.tasks && story.tasks.length > 0) {
    body += `### Tasks Completed\n\n`;
    story.tasks.forEach((task: any) => {
      const status = task.completed ? '✅' : '⬜';
      body += `${status} ${task.description}`;
      if (task.prNumber) {
        body += ` (#${task.prNumber})`;
      }
      body += '\n';
    });
    
    const completed = story.tasks.filter((t: any) => t.completed).length;
    const total = story.tasks.length;
    body += `\n**Progress:** ${completed}/${total} tasks completed\n`;
  }

  body += `\n---\n`;
  body += `*Created by AI Workflow Tool*`;

  return body;
}

async function getCurrentBranch(): Promise<string> {
  try {
    const { stdout } = await execAsync('git rev-parse --abbrev-ref HEAD');
    return stdout.trim();
  } catch (error) {
    throw new Error('Failed to get current git branch');
  }
}