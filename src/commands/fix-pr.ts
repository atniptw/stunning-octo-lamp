import chalk from 'chalk';
import ora from 'ora';
import { GitHubAppService } from '../services/github-app.js';
import { GitHubService } from '../services/github.js';

interface ActionItem {
  id: string;
  type: 'status_check' | 'review_change' | 'comment_response' | 'conflict';
  priority: number;
  title: string;
  description: string;
  details?: string;
  url?: string;
  commentId?: number;
  userId?: string;
}

export async function fixPRCommand(prNumber: string) {
  const spinner = ora('Analyzing PR issues and priorities...').start();

  try {
    const prNum = parseInt(prNumber);
    if (isNaN(prNum)) {
      throw new Error('Invalid PR number');
    }

    // Determine which service to use
    const useGitHubApp = process.env.GITHUB_APP_ID && process.env.GITHUB_APP_PRIVATE_KEY_PATH;
    const service = useGitHubApp ? new GitHubAppService() : new GitHubService();

    // Get PR information
    spinner.text = 'Gathering PR status and feedback...';
    const [prDetails, status, comments] = await Promise.all([
      (service as GitHubAppService).getPullRequestDetails(prNum),
      (service as GitHubAppService).checkPullRequestStatus(prNum),
      (service as GitHubAppService).getPullRequestComments(prNum)
    ]);

    spinner.succeed('PR analysis complete');

    // Generate prioritized action items
    const actionItems = generateActionItems(prDetails, status, comments);

    if (actionItems.length === 0) {
      console.log('\n' + chalk.green('🎉 No action items found! PR looks good to merge.'));
      console.log('\n' + chalk.bold('Next Steps:'));
      console.log(chalk.yellow('  workflow check-pr'), prNum, chalk.dim('- Double-check status'));
      console.log(chalk.blue('  Web:'), prDetails.html_url);
      return;
    }

    // Display header
    console.log('\n' + chalk.bold.red('🚨 ACTION ITEMS TO FIX'));
    console.log(chalk.dim('=' .repeat(60)));
    console.log(chalk.yellow(`PR #${prNum}: ${prDetails.title}`));
    console.log(chalk.dim(`${actionItems.length} items need attention (ordered by priority)`));

    // Display action items by priority
    actionItems.forEach((item, index) => {
      const priority = getPriorityDisplay(item.priority);
      const typeIcon = getTypeIcon(item.type);
      
      console.log(`\n${chalk.bold(`${index + 1}.`)} ${typeIcon} ${priority} ${chalk.bold(item.title)}`);
      console.log(chalk.dim(`   ${item.description}`));
      
      if (item.details) {
        console.log(chalk.gray(`   Details: ${item.details}`));
      }
      
      if (item.url) {
        console.log(chalk.blue(`   Link: ${item.url}`));
      }

      // Show suggested workflow
      console.log(chalk.yellow('   Fix workflow:'));
      if (item.type === 'status_check') {
        console.log(chalk.dim('     1. Fix the issue locally'));
        console.log(chalk.dim('     2. git add . && git commit -m "Fix: <description>"'));
        console.log(chalk.dim('     3. git push'));
        console.log(chalk.dim('     4. workflow check-pr ' + prNum + ' (verify fix)'));
      } else if (item.type === 'comment_response') {
        console.log(chalk.dim('     1. Address the feedback locally'));
        console.log(chalk.dim('     2. git add . && git commit -m "Address comment: <description>"'));
        console.log(chalk.dim('     3. git push'));
        console.log(chalk.dim(`     4. workflow reply-comment ${prNum} ${item.commentId} "<commit-hash>"`));
      } else if (item.type === 'review_change') {
        console.log(chalk.dim('     1. Make the requested changes'));
        console.log(chalk.dim('     2. git add . && git commit -m "Address review: <description>"'));
        console.log(chalk.dim('     3. git push'));
        console.log(chalk.dim('     4. Request re-review on GitHub'));
      } else if (item.type === 'conflict') {
        console.log(chalk.dim('     1. git fetch origin'));
        console.log(chalk.dim('     2. git merge origin/main (or rebase)'));
        console.log(chalk.dim('     3. Resolve conflicts'));
        console.log(chalk.dim('     4. git add . && git commit'));
        console.log(chalk.dim('     5. git push'));
      }
    });

    // Show summary and next actions
    console.log('\n' + chalk.bold('📋 Summary:'));
    const criticalCount = actionItems.filter(i => i.priority >= 3).length;
    const totalCount = actionItems.length;
    
    if (criticalCount > 0) {
      console.log(chalk.red(`  🚨 ${criticalCount} critical issue(s) blocking merge`));
    }
    console.log(chalk.yellow(`  📝 ${totalCount} total item(s) to address`));

    console.log('\n' + chalk.bold('🎯 Recommended Approach:'));
    console.log(chalk.dim('  1. Start with the highest priority items first'));
    console.log(chalk.dim('  2. Fix one issue at a time with focused commits'));
    console.log(chalk.dim('  3. Push after each fix and verify status'));
    console.log(chalk.dim('  4. Reply to comments with commit hashes'));
    console.log(chalk.dim('  5. Re-run this command to see remaining items'));

    console.log('\n' + chalk.bold('🔧 Available Commands:'));
    console.log(chalk.yellow('  workflow fix-pr'), prNum, chalk.dim('- Refresh action items'));
    console.log(chalk.yellow('  workflow check-pr'), prNum, chalk.dim('- View detailed status'));
    console.log(chalk.yellow('  workflow comment-pr'), prNum, '"message"', chalk.dim('- Add general comment'));
    console.log(chalk.yellow('  workflow push-changes'), chalk.dim('- Commit and push current changes'));

    console.log('\n' + chalk.dim('=' .repeat(60)));

  } catch (error: any) {
    spinner.fail('Failed to analyze PR');
    console.error(chalk.red('\nError:'), error.message);
    process.exit(1);
  }
}

function generateActionItems(prDetails: any, status: any, comments: any[]): ActionItem[] {
  const items: ActionItem[] = [];

  // 1. Status check failures (highest priority)
  const failedChecks = status.checks.filter((c: any) => c.conclusion === 'failure');
  failedChecks.forEach((check: any, index: number) => {
    items.push({
      id: `status_${index}`,
      type: 'status_check',
      priority: 4, // Critical
      title: `Fix failing check: ${check.name}`,
      description: 'Status check is failing and blocking merge',
      details: check.details_url,
      url: check.html_url
    });
  });

  // 2. Merge conflicts (critical)
  if (status.mergeable === false || status.mergeable_state === 'dirty') {
    items.push({
      id: 'conflict',
      type: 'conflict',
      priority: 4,
      title: 'Resolve merge conflicts',
      description: 'Branch has conflicts that prevent merging',
      details: 'Update your branch with latest changes from main'
    });
  }

  // 3. Requested changes from reviews (high priority)
  const changeRequests = status.reviews.filter((r: any) => r.state === 'CHANGES_REQUESTED');
  changeRequests.forEach((review: any, index: number) => {
    items.push({
      id: `review_${index}`,
      type: 'review_change',
      priority: 3,
      title: `Address review from ${review.user}`,
      description: 'Reviewer requested changes before approval',
      details: 'Check the review comments for specific feedback'
    });
  });

  // 4. Code review comments (medium priority)
  const reviewComments = comments.filter(c => c.is_review_comment);
  reviewComments.forEach((comment, index) => {
    // Skip bot comments and very old comments
    if (comment.user.includes('bot') || isOldComment(comment.created_at)) {
      return;
    }

    items.push({
      id: `comment_${comment.id}`,
      type: 'comment_response',
      priority: 2,
      title: `Respond to code comment from ${comment.user}`,
      description: comment.body.length > 100 
        ? comment.body.substring(0, 100) + '...'
        : comment.body,
      url: comment.html_url,
      commentId: comment.id,
      userId: comment.user
    });
  });

  // 5. Pending status checks (lower priority but worth noting)
  const pendingChecks = status.checks.filter((c: any) => 
    c.status === 'in_progress' || c.status === 'queued'
  );
  if (pendingChecks.length > 0) {
    items.push({
      id: 'pending_checks',
      type: 'status_check',
      priority: 1,
      title: `Wait for ${pendingChecks.length} pending check(s) to complete`,
      description: 'Some status checks are still running',
      details: pendingChecks.map((c: any) => c.name).join(', ')
    });
  }

  // Sort by priority (highest first), then by type
  return items.sort((a, b) => {
    if (a.priority !== b.priority) {
      return b.priority - a.priority;
    }
    return a.type.localeCompare(b.type);
  });
}

function getPriorityDisplay(priority: number): string {
  switch (priority) {
    case 4: return chalk.red.bold('🚨 CRITICAL');
    case 3: return chalk.yellow.bold('⚠️  HIGH');
    case 2: return chalk.blue.bold('📝 MEDIUM');
    case 1: return chalk.gray.bold('⏳ LOW');
    default: return chalk.gray('❓ UNKNOWN');
  }
}

function getTypeIcon(type: string): string {
  switch (type) {
    case 'status_check': return '🔍';
    case 'review_change': return '👥';
    case 'comment_response': return '💬';
    case 'conflict': return '⚔️';
    default: return '❓';
  }
}

function isOldComment(dateStr: string): boolean {
  const commentDate = new Date(dateStr);
  const now = new Date();
  const daysDiff = (now.getTime() - commentDate.getTime()) / (1000 * 60 * 60 * 24);
  return daysDiff > 7; // Consider comments older than 7 days as less relevant
}