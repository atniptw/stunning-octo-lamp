# GitHub App Setup Guide

This guide explains how to set up a GitHub App for the AI Workflow Tool, allowing it to act as an independent bot user rather than using personal access tokens.

## Benefits of GitHub Apps

- **Independent Identity**: PRs and commits show as coming from your app, not a personal account
- **Fine-grained Permissions**: Only request the specific permissions needed
- **Higher Rate Limits**: 5,000 requests per hour vs 60 for unauthenticated
- **Installation Scoping**: Can be installed per-repository or organization-wide
- **Webhook Support**: Can receive real-time events from GitHub

## Creating the GitHub App

1. Go to your GitHub Settings:
   - Personal: https://github.com/settings/apps/new
   - Organization: https://github.com/organizations/{org}/settings/apps/new

2. Fill in the basic information:
   - **GitHub App name**: `AI Workflow Tool` (must be unique across GitHub)
   - **Homepage URL**: Your project repository URL
   - **Description**: "Orchestrates AI assistants within structured workflows for software development"

3. Configure Webhook (optional):
   - **Webhook URL**: Leave blank for now (can add later for real-time events)
   - **Webhook secret**: Generate a random string if using webhooks

4. Set Permissions:
   ```yaml
   Repository permissions:
     Contents: Read & Write  # For reading files and creating branches
     Issues: Read & Write    # For reading features/issues
     Pull requests: Write    # For creating and updating PRs
     Metadata: Read         # Always required
   ```

5. Where can this GitHub App be installed?
   - Choose "Any account" for public use
   - Choose "Only on this account" for private use

6. Click "Create GitHub App"

## Configuring Authentication

After creating the app, you'll need:

1. **App ID**: Found on the app's settings page
2. **Private Key**: Generate and download from the app settings
3. **Installation ID**: After installing the app on a repository

### Generate Private Key

1. In your GitHub App settings, scroll to "Private keys"
2. Click "Generate a private key"
3. Save the downloaded `.pem` file securely

### Install the App

1. Go to your app's public page: `https://github.com/apps/{your-app-name}`
2. Click "Install" or "Configure"
3. Select repositories where you want to use the app
4. Note the installation ID from the URL after installation:
   ```
   https://github.com/settings/installations/{installation_id}
   ```

## Environment Configuration

Update your `.env` file:

```bash
# GitHub App Configuration
GITHUB_APP_ID=123456
GITHUB_APP_PRIVATE_KEY_PATH=./private-key.pem
GITHUB_APP_INSTALLATION_ID=12345678

# Repository (still needed)
GITHUB_REPO=owner/repo

# Optional: Use MCP Server
USE_GITHUB_MCP=true
```

## Using App Authentication in Code

Create a service that uses App authentication:

```typescript
import { createAppAuth } from '@octokit/auth-app';
import { Octokit } from '@octokit/rest';
import { readFileSync } from 'fs';

export class GitHubAppService {
  private octokit: Octokit;

  constructor() {
    const privateKey = readFileSync(
      process.env.GITHUB_APP_PRIVATE_KEY_PATH || '',
      'utf8'
    );

    const auth = createAppAuth({
      appId: process.env.GITHUB_APP_ID!,
      privateKey,
      installationId: process.env.GITHUB_APP_INSTALLATION_ID!,
    });

    this.octokit = new Octokit({
      authStrategy: createAppAuth,
      auth: {
        appId: process.env.GITHUB_APP_ID!,
        privateKey,
        installationId: process.env.GITHUB_APP_INSTALLATION_ID!,
      },
    });
  }

  async createPullRequest(params: any) {
    const { data } = await this.octokit.pulls.create({
      owner: this.owner,
      repo: this.repo,
      ...params,
    });

    return data;
  }
}
```

## Bot User Appearance

When using a GitHub App, actions will appear as:
- **Commits**: `AI Workflow Tool[bot]`
- **Comments**: Show the app's avatar and name
- **PR Author**: Listed as created by the app

## Security Best Practices

1. **Never commit the private key** - Add `*.pem` to `.gitignore`
2. **Use environment variables** for all sensitive configuration
3. **Rotate keys periodically** through the GitHub App settings
4. **Limit permissions** to only what's needed
5. **Use webhook signatures** if implementing webhook endpoints

## Testing the App

1. Create a test repository
2. Install your GitHub App on that repository
3. Run the workflow tool with app authentication
4. Verify that PRs show as created by your app bot

## Troubleshooting

- **401 Unauthorized**: Check app ID, private key, and installation ID
- **403 Forbidden**: Verify the app has necessary permissions
- **404 Not Found**: Ensure the app is installed on the target repository

## Additional Resources

- [GitHub Apps Documentation](https://docs.github.com/en/developers/apps)
- [Octokit Authentication Strategies](https://github.com/octokit/auth-app.js)
- [GitHub App Permissions Reference](https://docs.github.com/en/developers/apps/building-github-apps/creating-a-github-app-using-url-parameters)