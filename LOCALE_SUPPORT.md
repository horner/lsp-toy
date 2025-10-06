# Locale Support

## Overview

The LSP server uses **i18next** for comprehensive internationalization. It automatically loads translations from JSON files and respects the client's locale preferences from the `initialize` request.

## Architecture

### Translation Files

Translations are stored in JSON files under `server/locales/`:

```
server/locales/
  ├── en/
  │   └── translation.json
  ├── es/
  │   └── translation.json
  └── fr/
      └── translation.json
```

Each translation file contains organized namespaces:

```json
{
  "diagnostics": {
    "todo": {
      "message": "Found TODO item.",
      "message_plural": "Found {{count}} TODO items."
    }
  },
  "completion": {
    "heading": {
      "label": "Heading",
      "detail": "Markdown heading",
      "documentation": "Insert a markdown heading"
    }
  },
  "hover": {
    "todo": "TODO item - remember to complete this task",
    "heading": "This is a level {{level}} heading"
  }
}
```

### Runtime Initialization

The server:
1. Captures the `locale` from initialize params
2. Loads all available translation files
3. Initializes i18next with the appropriate language
4. Uses the `t()` function throughout the codebase

```typescript
// In server.ts
await initializeI18n(clientLocale);

// Usage
const message = t('diagnostics.todo.message');
const withParams = t('hover.heading', { level: 2 });
```

## Supported Locales

Currently implemented translations:

| Locale | Language | Coverage |
|--------|----------|----------|
| `en-US`, `en-*` | English | ✓ Complete |
| `es-ES`, `es-*` | Spanish | ✓ Complete |
| `fr-FR`, `fr-*` | French | ✓ Complete |
| `pl-PL`, `pl-*` | Polish | ✓ Complete |

### Translated Content

**Diagnostics:**
- TODO items (with native language keywords)
- Broken links
- (Plural forms supported)

**Native TODO Keywords:**
- English: TODO, FIXME, BUG, HACK, NOTE, WARNING
- Spanish: PENDIENTE, ARREGLAR, CORREGIR, NOTA, ADVERTENCIA
- French: AFAIRE, À FAIRE, CORRIGER, RÉPARER, NOTE, ATTENTION
- Polish: ZROBIĆ, NAPRAWIĆ, POPRAWIĆ, UWAGA, NOTATKA

**Completion Items:**
- Headings
- Bold/Italic formatting
- Links
- TODO comments

**Hover Text:**
- TODO explanations
- Heading information
- Link details

## Testing Localization

### Command Line

Use the `LSP_LOCALE` environment variable:

```bash
# Run all tests with English (default)
npm test

# Test i18n across all languages
npm run test:i18n

# Test specific locale
LSP_LOCALE=es-ES npm run test:completion
LSP_LOCALE=fr-FR npm run test:completion
LSP_LOCALE=pl-PL npm run test:completion
```

See [`test/README.md`](./test/README.md) for complete test documentation.

### Expected Output

**English (`en-US`):**
```
[LSP-TOY SERVER] Initializing i18n for locale: en-US (language: en)
[LSP-TOY SERVER]   ✓ Loaded translations for: en
[LSP-TOY SERVER]   ✓ Loaded translations for: es
[LSP-TOY SERVER]   ✓ Loaded translations for: fr
[LSP-TOY SERVER]   i18n initialized with language: en
[LSP-TOY SERVER] Client locale: en-US
[LSP-TOY SERVER]     - todo : Found TODO item. at line 8
```

**Spanish (`es-ES`):**
```
[LSP-TOY SERVER] Initializing i18n for locale: es-ES (language: es)
[LSP-TOY SERVER]   i18n initialized with language: es
[LSP-TOY SERVER]     - todo : Elemento TODO encontrado. at line 8
```

**French (`fr-FR`):**
```
[LSP-TOY SERVER] Initializing i18n for locale: fr-FR (language: fr)
[LSP-TOY SERVER]   i18n initialized with language: fr
[LSP-TOY SERVER]     - todo : Élément TODO trouvé. at line 8
```

## Adding New Translations

### Method 1: Add New Language

1. **Create translation file:**

```bash
mkdir -p server/locales/de
```

2. **Create `server/locales/de/translation.json`:**

```json
{
  "diagnostics": {
    "todo": {
      "message": "TODO-Element gefunden.",
      "message_plural": "{{count}} TODO-Elemente gefunden."
    },
    "brokenLink": {
      "message": "Defekter Link",
      "message_plural": "{{count}} defekte Links"
    }
  },
  "completion": {
    "heading": {
      "label": "Überschrift",
      "detail": "Markdown-Überschrift",
      "documentation": "Eine Markdown-Überschrift einfügen"
    },
    "bold": {
      "label": "Fett",
      "detail": "Fetter Text",
      "documentation": "Text **fett** machen"
    },
    "link": {
      "label": "Link",
      "detail": "Markdown-Link",
      "documentation": "Einen [Link](url) einfügen"
    }
  },
  "hover": {
    "heading": "Dies ist eine Überschrift der Ebene {{level}}",
    "todo": "TODO-Element - vergessen Sie nicht, diese Aufgabe zu erledigen"
  }
}
```

3. **Update supported languages in `server/src/server.ts`:**

```typescript
const supportedLanguages = ['en', 'es', 'fr', 'de'];
```

4. **Test:**
```bash
LSP_LOCALE=de-DE npm test
```

### Method 2: Add New Message Keys

1. **Update all translation files** (`en/translation.json`, `es/translation.json`, `fr/translation.json`):

```json
{
  "diagnostics": {
    "newFeature": {
      "message": "New feature message",
      "message_plural": "{{count}} new features"
    }
  }
}
```

2. **Use in code:**

```typescript
const message = t('diagnostics.newFeature.message');
const plural = t('diagnostics.newFeature.message', { count: 5 });
```

### Translation Features

**Interpolation:**
```typescript
t('hover.heading', { level: 2 })
// → "This is a level 2 heading"
```

**Pluralization:**
```typescript
t('diagnostics.todo.message', { count: 1 })
// → "Found TODO item."

t('diagnostics.todo.message', { count: 5 })
// → "Found 5 TODO items."
```

**Nesting:**
```json
{
  "common": {
    "item": "item",
    "items": "items"
  },
  "diagnostics": {
    "todo": "Found {{count}} TODO $t(common.item)"
  }
}
```

## Implementation Details

### i18next Integration

The server uses **i18next** for robust internationalization:

```typescript
import i18next from 'i18next';

// Initialize with locale
await i18next.init({
  lng: 'es',
  fallbackLng: 'en',
  resources: {
    en: { translation: enTranslations },
    es: { translation: esTranslations },
    fr: { translation: frTranslations }
  }
});

// Use anywhere in code
const message = t('diagnostics.todo.message');
```

### Translation Loading

At server initialization:
1. Reads all `*.json` files from `server/locales/*/translation.json`
2. Parses JSON content
3. Registers with i18next
4. Sets language based on client locale

### Helper Function

```typescript
function t(key: string, options?: { count?: number; [key: string]: unknown }): string {
  return i18next.t(key, options);
}
```

Use throughout the codebase:
- `t('diagnostics.todo.message')` - Simple message
- `t('hover.heading', { level: 2 })` - With parameters
- `t('diagnostics.todo.message', { count: 5 })` - With pluralization

### Locale Matching

The implementation extracts language code from locale:
- `en-US`, `en-GB` → `en`
- `es-ES`, `es-MX` → `es`
- `fr-FR`, `fr-CA` → `fr`

Falls back to English if language not supported.

## Future Enhancements

Possible improvements:

- [x] Use a proper i18n library (i18next) ✅
- [x] Load translations from JSON files ✅
- [x] Support plural forms and message formatting ✅
- [x] Translate completion items and hover text ✅
- [ ] Add more languages (German, Japanese, Chinese, etc.)
- [ ] Locale-specific date/time formatting
- [ ] Right-to-left (RTL) language support
- [ ] Translation validation/linting
- [ ] Hot-reload translations during development
- [ ] Context-aware translations
- [ ] Translation memory/glossary management

## VS Code Integration

VS Code automatically sends the user's locale preference in the initialize request. The locale comes from:
- VS Code's display language setting (View → Command Palette → "Configure Display Language")
- System locale (if VS Code uses system default)

Users can change their locale in VS Code settings:
```json
{
  "locale": "es"  // Forces Spanish
}
```

## References

- [LSP Specification - Initialize Request](https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/#initialize)
- [VS Code Locale Documentation](https://code.visualstudio.com/docs/getstarted/locales)
