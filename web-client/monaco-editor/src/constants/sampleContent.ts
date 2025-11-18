export const SAMPLE_LSPTOY_CONTENT = `# LSP Toy Demo

> 🚀 **Try typing \`#\` to see heading completions!**

## Summary

This is a demo of LSP Toy's features:
- Completions for headings and links
- Embedded TypeScript support
- Internationalized diagnostics

TODO: Explore the features below

## Code Example

Try typing inside this code fence to get TypeScript completions:

\`\`\`typescript
interface User {
  id: number;
  name: string;
  email: string;
}

function greet(user: User): string {
  return \`Hello, \${user.name}!\`;
}

// Type 'user.' below to see completions
const user = { id: 1, name: "Jane", email: "jane@example.com" };
\`\`\`

## Internationalization

The LSP server supports multiple languages for diagnostics:

- **English:** TODO: Complete this task
- **Spanish:** PENDIENTE: Completar esta tarea
- **French:** À FAIRE: Terminer cette tâche
- **Polish:** ZROBIĆ: Ukończyć to zadanie

## Broken Link Test

[Missing Document](./missing.md)
`;
