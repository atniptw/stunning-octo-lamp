# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI Workflow Orchestration Tool - A CLI tool that orchestrates AI assistants within structured workflows to automate software development tasks while preventing scope creep and maintaining quality standards.

## Key Documentation

- **Project Brief**: `/docs/PROJECT_BRIEF.md` - High-level overview and vision
- **Design Specification**: `/docs/DESIGN_SPECIFICATION.md` - Technical architecture and implementation details
- **Workflow Diagrams**: `/docs/WORKFLOW_DIAGRAMS.md` - Visual representation of Tech Lead and Developer workflows

## Project Structure

```
/
├── docs/                 # Project documentation
│   ├── PROJECT_BRIEF.md
│   ├── DESIGN_SPECIFICATION.md
│   └── WORKFLOW_DIAGRAMS.md
├── discovery/           # Discovery phase documents
├── design/             # Design phase documents
└── src/                # Source code (to be created)
```

## Development Commands

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build the project
npm run build

# Run tests
npm test

# Type checking
npm run type-check

# Linting
npm run lint
```

## CLI Commands

```bash
# Analyze a GitHub issue
npm run dev -- analyze <issue-number>

# Generate AI-ready story (in progress)
npm run dev -- generate-story <issue-number>

# Validate story (in progress)
npm run dev -- validate-story <story-file>

# View help
npm run dev -- --help
```

## Architecture Overview

The system consists of:
1. **Tech Lead Workflow**: Transforms vague requirements into AI-ready specifications
2. **Developer Workflow**: Executes well-defined tasks using AI within strict boundaries
3. **CLI Interface**: User interaction layer
4. **Workflow Engine**: State machine for workflow orchestration
5. **AI Orchestrator**: Manages AI interactions with boundaries

## Key Design Principles

- **Bounded AI Execution**: AI can only modify explicitly allowed files
- **Human Checkpoints**: Critical decisions require human approval
- **Automated Validation**: Tests and checks run automatically
- **State Persistence**: Workflows can be paused and resumed

## Current Status

- Phase: Design and Specification
- Next Step: Build Tech Lead workflow MVP
- Technology Stack: Node.js CLI application