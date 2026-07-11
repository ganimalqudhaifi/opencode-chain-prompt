---
name: bulk-generate
description: Generate, validate, and commit multiple React components sequentially
default_model: anthropic/claude-sonnet-4-6
loop: 22
steps:
  - id: generate
    agent: build
    prompt: |
      Generate a React {input} component with Tailwind CSS.
      Use TypeScript. Create the file in src/components/.
      This is iteration {iteration} of {loop}.

  - id: validate
    agent: code-reviewer
    prompt: |
      Review the generated component for best practices,
      accessibility, performance, and TypeScript correctness.
      Fix any issues found.
      {lastResult}

  - id: commit
    agent: build
    condition: on_success
    prompt: |
      Stage and commit the changes.
      Use a conventional commit message.
      Component: {input} (iteration {iteration})
      Files changed: review git status.
---
