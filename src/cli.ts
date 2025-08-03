#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { config } from 'dotenv';
// Removed unused imports

// Load environment variables
config();

const program = new Command();

program
  .name('workflow')
  .description('AI Workflow Orchestration Tool - Tech Lead Workflow')
  .version('0.1.0');

// Tech Lead Commands
program
  .command('analyze-feature <featureId>')
  .description('Analyze a feature requirement')
  .option('-s, --source <source>', 'Source (github, jira, etc)', 'github')
  .action(async (featureId: string, options: { source: string }) => {
    const { analyzeFeatureCommand } = await import('./commands/analyze-feature.js');
    await analyzeFeatureCommand(featureId, options);
  });

program
  .command('create-stories <featureId>')
  .description('Create stories from a feature analysis')
  .option('-s, --source <source>', 'Source (github, jira, etc)', 'github')
  .action(async (featureId: string, options: { source: string }) => {
    const { createStoriesCommand } = await import('./commands/create-stories.js');
    await createStoriesCommand(featureId, options);
  });

// Simple version for testing
program
  .command('create-stories-simple <featureId>')
  .description('Create stories from suggestions (simple version)')
  .action(async (featureId: string) => {
    const { createStoriesSimpleCommand } = await import('./commands/create-stories-simple.js');
    await createStoriesSimpleCommand(featureId);
  });

// Developer Commands
program
  .command('show-story <storyId>')
  .description('Show detailed story information')
  .action(async (storyId: string) => {
    const { showStoryCommand } = await import('./commands/show-story.js');
    await showStoryCommand(storyId);
  });

program
  .command('add-tasks <storyId>')
  .description('Add task breakdown to a story')
  .action(async (storyId: string) => {
    const { addTasksCommand } = await import('./commands/add-tasks.js');
    await addTasksCommand(storyId);
  });

program
  .command('update-task <storyId> <taskId>')
  .description('Update a task (complete, add PR, edit)')
  .action(async (storyId: string, taskId: string) => {
    const { updateTaskCommand } = await import('./commands/update-task.js');
    await updateTaskCommand(storyId, taskId);
  });

program
  .command('create-pr <storyId>')
  .description('Create a pull request for a completed story')
  .action(async (storyId: string) => {
    const { createPRCommand } = await import('./commands/create-pr.js');
    await createPRCommand(storyId);
  });

program
  .command('create-pr-mcp <storyId>')
  .description('Create a pull request via GitHub MCP server (requires branch on remote)')
  .action(async (storyId: string) => {
    const { createPRMCPCommand } = await import('./commands/create-pr-mcp.js');
    await createPRMCPCommand(storyId);
  });

program
  .command('check-pr <prNumber>')
  .description('Check pull request status, comments, and reviews')
  .action(async (prNumber: string) => {
    const { checkPRCommand } = await import('./commands/check-pr.js');
    await checkPRCommand(prNumber);
  });

program
  .command('comment-pr <prNumber> <message>')
  .description('Add a comment to a pull request')
  .action(async (prNumber: string, message: string) => {
    const { commentPRCommand } = await import('./commands/comment-pr.js');
    await commentPRCommand(prNumber, message);
  });

program
  .command('fix-pr <prNumber>')
  .description('Show prioritized action items to fix PR issues')
  .action(async (prNumber: string) => {
    const { fixPRCommand } = await import('./commands/fix-pr.js');
    await fixPRCommand(prNumber);
  });

program
  .command('review-issue <issueNumber>')
  .description('Conduct guided tech lead review of a GitHub issue')
  .action(async (issueNumber: string) => {
    const { reviewIssueCommand } = await import('./commands/review-issue.js');
    await reviewIssueCommand(issueNumber);
  });

program
  .command('push-changes [message]')
  .description('Commit and push current changes with smart commit message')
  .action(async (message?: string) => {
    const { pushChangesCommand } = await import('./commands/push-changes.js');
    await pushChangesCommand(message);
  });

program
  .command('reply-comment <prNumber> <commentId> [commitHash]')
  .description('Reply to a PR comment with commit reference')
  .action(async (prNumber: string, commentId: string, commitHash?: string) => {
    const { replyCommentCommand } = await import('./commands/reply-comment.js');
    await replyCommentCommand(prNumber, commentId, commitHash);
  });

// MCP tools command
program
  .command('list-mcp-tools')
  .description('List available GitHub MCP server tools')
  .action(async () => {
    const { listMCPToolsCommand } = await import('./commands/list-mcp-tools.js');
    await listMCPToolsCommand();
  });

// List commands
program
  .command('list-features')
  .description('List available features')
  .action(async () => {
    const { listFeaturesCommand } = await import('./commands/list-features.js');
    await listFeaturesCommand();
  });

program
  .command('list-stories')
  .description('List available stories')
  .action(async () => {
    const { listStoriesCommand } = await import('./commands/list-stories.js');
    await listStoriesCommand();
  });

// Legacy support (keeping old commands for now)
program
  .command('analyze <id>')
  .description('Analyze a feature (legacy command)')
  .action(async (id: string) => {
    const { analyzeFeatureCommand } = await import('./commands/analyze-feature.js');
    await analyzeFeatureCommand(id, { source: 'github' });
  });

program
  .command('list')
  .description('List features (legacy command)')
  .action(async () => {
    const { listFeaturesCommand } = await import('./commands/list-features.js');
    await listFeaturesCommand();
  });

// Config command
program
  .command('config <key> [value]')
  .description('Get or set configuration values')
  .action((key: string, value?: string) => {
    if (value === undefined) {
      console.log(chalk.blue(`${key}: ${process.env[key.toUpperCase().replace('.', '_')] || 'not set'}`));
    } else {
      console.log(chalk.yellow('Config setting not yet implemented'));
    }
  });

// Error handling
program.exitOverride();

try {
  program.parse(process.argv);
} catch (error: unknown) {
  if (error instanceof Error && 'code' in error && error.code === 'commander.unknownCommand') {
    console.error(chalk.red('Unknown command'));
    program.outputHelp();
  } else {
    console.error(chalk.red('Error:'), error instanceof Error ? error.message : String(error));
  }
  process.exit(1);
}