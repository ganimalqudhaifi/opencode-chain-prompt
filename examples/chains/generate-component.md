---
name: generate-component
description: Generate a React component, validate it, then commit with conventional message
default_model: anthropic/claude-sonnet-4-6
loop: 1
steps:
  - id: generate
    agent: build
    prompt: |
      Generate a React {input} component with Tailwind CSS.
      Use TypeScript. Create the file in src/components/.
      Follow existing project conventions.

  - id: validate
    agent: code-reviewer
    prompt: |
      Review the generated component for:
      - Best practices and code quality
      - Accessibility (ARIA labels, keyboard navigation)
      - Performance (unnecessary re-renders)
      - TypeScript correctness
      Fix any issues found.

  - id: commit
    agent: build
    condition: on_success
    prompt: |
      Stage and commit the changes with a conventional commit message.
      Format: "feat(components): add {input} component"
      Include the component name in the commit body.
---
