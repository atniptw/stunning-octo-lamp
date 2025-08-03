# Story: 3 - Implement AI Story Generation Command

## Objective
Implement the `workflow generate-story <issueId>` command that generates AI-ready story specifications from analyzed GitHub issues using Claude Code integration.

## Context
- **Current State**: The Tech Lead workflow has a working `analyze` command and a placeholder `generate-story` command that displays "not yet implemented"
- **Desired State**: Tech Leads can run `workflow generate-story 123` to generate a complete, AI-ready story specification with clear boundaries and constraints
- **Business Reason**: Manual story creation is time-consuming and often misses critical constraints needed for AI tools to work effectively

## Technical Specification

### Allowed Scope
- Files to modify:
  - `src/commands/generate-story.ts` - Replace placeholder with full implementation
  - `src/services/story-generator.ts` - Create new service for prompt generation and codebase scanning
  - `src/types/story.ts` - Add any new interfaces for story generation workflow

### Forbidden Scope
- Do NOT modify:
  - `src/commands/analyze.ts` - Analysis logic is already working
  - `src/services/github.ts` or `src/services/local-github.ts` - Issue fetching is already implemented
  - Any files in `node_modules/`
  - Configuration files like `tsconfig.json`, `package.json`
  - Documentation files in `docs/`

### Implementation Requirements
1. Follow existing pattern in `src/commands/analyze.ts` for CLI command structure
2. Use existing GitHubService/LocalGitHubService and AnalysisService classes
3. Use chalk for colored output, ora for spinners, @inquirer/prompts for user interaction
4. Create StoryGeneratorService class following the pattern in `src/services/analysis.ts`
5. Implement codebase scanning to provide file structure context in prompts

### Edge Cases to Handle
- [ ] User cancels the prompt interaction (handle gracefully)
- [ ] Output directory doesn't exist (create it automatically)
- [ ] User provides empty or invalid story response (validate input)
- [ ] Codebase scanning fails due to permissions (provide fallback context)
- [ ] Issue ID doesn't exist in local or GitHub (reuse existing error handling)

## Acceptance Criteria
- [ ] Command fetches issue data using existing services
- [ ] Command runs analysis using existing AnalysisService
- [ ] Command generates comprehensive prompt including codebase context
- [ ] Command displays prompt clearly with copy/paste instructions
- [ ] Command accepts Claude's response via user input prompt
- [ ] Generated stories are saved to `stories/story-{issueId}.md` by default
- [ ] Command supports `--output <filename>` option for custom file paths
- [ ] All existing commands continue to work unchanged

## Test Cases
1. **Given** a valid issue ID, **when** running `workflow generate-story 3`, **then** display comprehensive prompt with codebase context
2. **Given** user has Claude's response, **when** pasting it into the prompt, **then** save the story to `stories/story-3.md`
3. **Given** `--output custom.md` option, **when** saving story, **then** save to the specified file path
4. **Given** user cancels at any prompt, **when** command exits, **then** no files are created and exit gracefully
5. **Given** invalid issue ID, **when** running command, **then** display helpful error message

## Validation Commands
```bash
npm run type-check
npm run dev -- generate-story 3
npm run dev -- list
npm run dev -- analyze 3
```

## Definition of Done
- [ ] All acceptance criteria met
- [ ] TypeScript compiles without errors
- [ ] Command integrates seamlessly with existing CLI structure
- [ ] Error handling follows existing patterns
- [ ] User experience is intuitive with clear instructions
- [ ] Generated prompts include all necessary context for AI tools