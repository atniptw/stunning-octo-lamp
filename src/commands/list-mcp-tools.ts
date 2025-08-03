import chalk from 'chalk';
import { GitHubMCPService } from '../services/github-mcp.js';

export async function listMCPToolsCommand() {
  const mcpService = new GitHubMCPService();
  
  try {
    await mcpService.connect();
    
    // List available tools
    const client = (mcpService as any).client;
    const tools = await client.listTools();
    
    console.log(chalk.bold('\nAvailable GitHub MCP Tools:'));
    console.log(chalk.dim('─'.repeat(60)));
    
    for (const tool of tools.tools) {
      console.log(chalk.blue(`\n${tool.name}`));
      console.log(chalk.dim(`  ${tool.description}`));
      
      if (tool.inputSchema && tool.inputSchema.properties) {
        console.log(chalk.dim('\n  Parameters:'));
        for (const [param, schema] of Object.entries(tool.inputSchema.properties)) {
          const required = tool.inputSchema.required?.includes(param) ? '*' : '';
          console.log(chalk.dim(`    - ${param}${required}: ${(schema as any).description || (schema as any).type}`));
        }
      }
    }
    
    console.log(chalk.dim('\n─'.repeat(60)));
    
  } catch (error: any) {
    console.error(chalk.red('Error:'), error.message);
  } finally {
    await mcpService.disconnect();
  }
}