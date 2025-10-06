# Test Suite

This directory contains automated tests for the LSP Toy server.

## Test Files

### `stdio.test.js`
Basic smoke test that verifies:
- Server can start and initialize via stdio
- Documents can be opened
- Diagnostics are published
- Server shuts down cleanly

**Run:**
```bash
npm run test:stdio
```

### `completion.test.js`
Tests completion item localization:
- Verifies completion items are returned
- Checks that labels, details, and documentation are translated
- Can be run with different locales via `LSP_LOCALE` env var

**Run:**
```bash
npm run test:completion              # English
LSP_LOCALE=es-ES npm run test:completion  # Spanish
LSP_LOCALE=fr-FR npm run test:completion  # French
```

### `i18n.test.js`
Comprehensive i18n test suite:
- Runs completion tests for all supported locales (en, es, fr)
- Verifies translations are working correctly
- Reports overall pass/fail status

**Run:**
```bash
npm run test:i18n
```

## Running Tests

### Run All Tests
```bash
npm test
# or
npm run test:all
```

### Run Individual Tests
```bash
npm run test:stdio       # Basic smoke test
npm run test:completion  # Completion localization
npm run test:i18n       # Full i18n suite
```

### Quiet Mode
Disable debug logging for cleaner output:
```bash
npm run test:quiet
```

## Environment Variables

### `LSP_TOY_DEBUG`
Controls debug logging output:
- `true` or `1` - Enable verbose debug logs (default for tests)
- `false` or `0` - Disable debug logs

```bash
LSP_TOY_DEBUG=false npm test
```

### `LSP_LOCALE`
Sets the client locale for testing localization:
- `en-US` - English (default)
- `es-ES` - Spanish
- `fr-FR` - French

```bash
LSP_LOCALE=es-ES npm run test:completion
```

## Test Output

### Successful Test
```
[test-completion] Testing completion localization with locale: es-ES
[test-completion] ✓ Link completion item:
[test-completion]   Label: "Enlace"
[test-completion]   Detail: "Enlace Markdown"
[test-completion]   Documentation: "Insertar un [enlace](url)"
[test-completion] ✓ Spanish translation verified!
[test-completion] ✓ Test passed!
```

### Failed Test
```
[test-completion] ✗ Test failed: Link completion item not found
```

## Adding New Tests

1. Create a new test file in this directory: `your-feature.test.js`
2. Follow the existing pattern (see `completion.test.js` as example)
3. Add a script to `package.json`:
   ```json
   "test:your-feature": "node test/your-feature.test.js"
   ```
4. Update `test:all` to include your test
5. Document it in this README

## Test Prerequisites

Tests require the server to be compiled first:
```bash
npm run compile
```

The test runner will check for this and exit with an error if the build is missing.

## CI/CD Integration

These tests are designed to be CI-friendly:
- Exit with code 0 on success, non-zero on failure
- Support quiet mode for cleaner logs
- Can run without VS Code installed
- Use stdio transport (no socket dependencies)

Example GitHub Actions:
```yaml
- name: Run tests
  run: |
    npm run compile
    npm test
```

## Troubleshooting

### "Missing server build" error
Run `npm run compile` before testing.

### Timeout errors
Increase `TEST_TIMEOUT_MS` in the test file if tests are timing out.

### Translation not working
1. Check that translation files exist in `server/locales/[lang]/translation.json`
2. Verify the language is registered in `server/src/server.ts`
3. Ensure `LSP_LOCALE` is set correctly

## Related Documentation

- [LOCALE_SUPPORT.md](../LOCALE_SUPPORT.md) - Technical i18n implementation
- [TRANSLATION_GUIDE.md](../TRANSLATION_GUIDE.md) - How to add translations
- [DEBUG.md](../DEBUG.md) - Debug logging guide
