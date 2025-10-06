# Translation Guide

## 🌍 Contributing Translations

Thank you for helping make LSP-Toy accessible to more people! This guide will help you add or improve translations.

## Quick Start

### Adding a New Language

1. **Create language directory:**
   ```bash
   mkdir -p server/locales/[language-code]
   ```

2. **Copy English template:**
   ```bash
   cp server/locales/en/translation.json server/locales/[language-code]/translation.json
   ```

3. **Translate the content** (see Translation Keys below)

4. **Register the language** in `server/src/server.ts`:
   ```typescript
   const supportedLanguages = ['en', 'es', 'fr', 'your-lang'];
   ```

5. **Test it:**
   ```bash
   LSP_LOCALE=[language-code] npm test
   ```

## Translation File Structure

```json
{
  "diagnostics": {
    "todo": {
      "message": "Single TODO item message",
      "message_plural": "Multiple TODO items with {{count}}"
    },
    "brokenLink": {
      "message": "Single broken link",
      "message_plural": "Multiple broken links with {{count}}"
    }
  },
  "completion": {
    "heading": {
      "label": "Item label shown in completion list",
      "detail": "Short description",
      "documentation": "Longer help text"
    },
    "bold": { /* ... */ },
    "italic": { /* ... */ },
    "link": { /* ... */ },
    "todo": { /* ... */ }
  },
  "hover": {
    "heading": "Text with {{level}} parameter",
    "todo": "Hover tooltip text",
    "link": "Text with {{url}} parameter"
  }
}
```

## Translation Keys Reference

### Diagnostics

These appear as problems in the editor's Problems panel.

| Key | Context | Variables | Example |
|-----|---------|-----------|---------|
| `diagnostics.todo.message` | Single TODO found | none | "Found TODO item." |
| `diagnostics.todo.message_plural` | Multiple TODOs | `{{count}}` | "Found {{count}} TODO items." |
| `diagnostics.brokenLink.message` | Single broken link | none | "Broken link" |
| `diagnostics.brokenLink.message_plural` | Multiple links | `{{count}}` | "{{count}} broken links" |

### Completion Items

These appear in the autocomplete dropdown (Ctrl+Space).

| Key | Context | Notes |
|-----|---------|-------|
| `completion.heading.label` | Completion item name | Keep short (1-2 words) |
| `completion.heading.detail` | Type/category | E.g., "Markdown heading" |
| `completion.heading.documentation` | Full description | Can be longer, explain usage |
| `completion.bold.*` | Bold formatting | Same structure |
| `completion.italic.*` | Italic formatting | Same structure |
| `completion.link.*` | Markdown links | Same structure |
| `completion.todo.*` | TODO comments | Same structure |

### Hover Text

These appear when hovering over specific elements.

| Key | Context | Variables | When Shown |
|-----|---------|-----------|------------|
| `hover.heading` | Heading level info | `{{level}}` | Hover over # heading |
| `hover.todo` | TODO explanation | none | Hover over "todo" word |
| `hover.link` | Link destination | `{{url}}` | Hover over link |

## Translation Tips

### 1. Placeholder Variables

Keep variable names unchanged:
```json
// ✅ Correct
"heading": "Este es un encabezado de nivel {{level}}"

// ❌ Wrong
"heading": "Este es un encabezado de nivel {{nivel}}"
```

### 2. Plural Forms

i18next supports automatic plural handling. For English:
- `message` - used when count=1
- `message_plural` - used when count≠1

Some languages have different plural rules:
```json
// English (2 forms)
{
  "message": "{{count}} item",
  "message_plural": "{{count}} items"
}

// Russian (3 forms)
{
  "message_0": "{{count}} предмет",
  "message_1": "{{count}} предмета",
  "message_2": "{{count}} предметов"
}
```

See [i18next plurals](https://www.i18next.com/translation-function/plurals) for your language's rules.

### 3. Markdown Formatting

Keep markdown syntax unchanged:
```json
// ✅ Correct
"bold": {
  "documentation": "Hacer texto **negrita**"
}

// ❌ Wrong (removes markdown)
"bold": {
  "documentation": "Hacer texto negrita"
}
```

### 4. Context Matters

When translating technical terms, consider:
- **LSP terminology** - Keep standard LSP terms (e.g., "diagnostic" → "diagnóstico")
- **Markdown syntax** - Don't translate syntax characters (keep #, *, [, ])
- **User interface** - Match VS Code's official translations for your language

### 5. Tone

Use clear, concise, helpful language:
- ✅ "Insertar un encabezado markdown"
- ❌ "Por favor, considere la posibilidad de insertar..."

## Language Codes

Use [ISO 639-1](https://en.wikipedia.org/wiki/List_of_ISO_639-1_codes) language codes:

| Language | Code | Example Locale |
|----------|------|----------------|
| German | `de` | `de-DE`, `de-AT` |
| Japanese | `ja` | `ja-JP` |
| Chinese (Simplified) | `zh` | `zh-CN` |
| Chinese (Traditional) | `zh-TW` | `zh-TW` |
| Portuguese | `pt` | `pt-BR`, `pt-PT` |
| Russian | `ru` | `ru-RU` |
| Korean | `ko` | `ko-KR` |
| Italian | `it` | `it-IT` |
| Dutch | `nl` | `nl-NL` |
| Polish | `pl` | `pl-PL` |

## Testing Your Translation

### 1. Quick Test
```bash
LSP_LOCALE=de-DE npm test
```

### 2. Check Debug Output
Enable debug logging to see i18n initialization:
```bash
LSP_TOY_DEBUG=true LSP_LOCALE=de-DE npm test
```

Look for:
```
[LSP-TOY SERVER] Initializing i18n for locale: de-DE (language: de)
[LSP-TOY SERVER]   ✓ Loaded translations for: de
[LSP-TOY SERVER]   i18n initialized with language: de
```

### 3. Manual Testing
1. Press F5 in VS Code to launch the extension
2. Change VS Code language: `Ctrl+Shift+P` → "Configure Display Language"
3. Restart VS Code
4. Open a `.lsptoy` file
5. Verify:
   - Diagnostic messages (Problems panel)
   - Completion items (Ctrl+Space)
   - Hover text (hover over TODO/links)

## Translation Checklist

Before submitting:

- [ ] All keys from `en/translation.json` are present
- [ ] Variable names ({{count}}, {{level}}, etc.) are unchanged
- [ ] Plural forms follow your language's rules
- [ ] Markdown syntax is preserved
- [ ] Language code is registered in `server.ts`
- [ ] Tests pass: `LSP_LOCALE=xx npm test`
- [ ] Manual testing in VS Code completed
- [ ] No typos or grammatical errors
- [ ] Tone is clear and helpful

## Examples

### German (de)

```json
{
  "diagnostics": {
    "todo": {
      "message": "TODO-Element gefunden.",
      "message_plural": "{{count}} TODO-Elemente gefunden."
    }
  },
  "completion": {
    "heading": {
      "label": "Überschrift",
      "detail": "Markdown-Überschrift",
      "documentation": "Eine Markdown-Überschrift einfügen (# bis ######)"
    }
  },
  "hover": {
    "todo": "TODO-Element - vergessen Sie nicht, diese Aufgabe zu erledigen"
  }
}
```

### Japanese (ja)

```json
{
  "diagnostics": {
    "todo": {
      "message": "TODOアイテムが見つかりました。",
      "message_plural": "{{count}}個のTODOアイテムが見つかりました。"
    }
  },
  "completion": {
    "heading": {
      "label": "見出し",
      "detail": "Markdown見出し",
      "documentation": "Markdown見出しを挿入（#から######まで）"
    }
  },
  "hover": {
    "todo": "TODOアイテム - このタスクを完了することを忘れないでください"
  }
}
```

## Getting Help

- Questions? Open an issue on GitHub
- Unsure about a translation? Check VS Code's official translations
- Need context? Look at how the text appears in the extension

## Resources

- [i18next Documentation](https://www.i18next.com/)
- [VS Code Language Packs](https://code.visualstudio.com/docs/getstarted/locales)
- [LSP Specification](https://microsoft.github.io/language-server-protocol/)

Thank you for contributing! 🙏
