# WASM Fetch Script

## Overview

The `fetch-wasm.js` script automates downloading prebuilt WASM files from the official `tree-sitter-grammars/tree-sitter-markdown` repository.

## Usage

### Quick Commands

```bash
# Download/update to latest version
npm run fetch:wasm
# or
npm run update:wasm

# Download a specific version
node scripts/fetch-wasm.js v0.5.1

# Check what would be downloaded (reads from GitHub API)
node scripts/fetch-wasm.js latest
```

### What It Does

1. **Fetches Release Info**: Queries GitHub API for the specified version (or latest)
2. **Downloads WASM Files**: Gets both `tree-sitter-markdown.wasm` and `tree-sitter-markdown_inline.wasm`
3. **Verifies Integrity**: Checks WASM magic numbers and version
4. **Skips Duplicates**: Won't re-download if files are already up-to-date
5. **Updates Documentation**: Automatically updates version in `GRAMMAR_NOTES.md`

### Example Output

```
============================================================
Fetching WASM files from tree-sitter-grammars/tree-sitter-markdown
============================================================

Fetching latest release info...
Found release: v0.5.1

  Downloading tree-sitter-markdown.wasm...
  ✓ Saved tree-sitter-markdown.wasm (412 KB)
  ✓ Verified tree-sitter-markdown.wasm is valid WASM
  Downloading tree-sitter-markdown_inline.wasm...
  ✓ Saved tree-sitter-markdown_inline.wasm (416 KB)
  ✓ Verified tree-sitter-markdown_inline.wasm is valid WASM

============================================================
Total WASM size: 828 KB

  ✓ Updated GRAMMAR_NOTES.md with version v0.5.1

✓ Done! WASM files are ready.
============================================================
```

## Why This Script?

### Problem
The original `ikatyang/tree-sitter-markdown` grammar cannot compile to WASM due to complex C++ scanner code that uses symbols unavailable in WebAssembly environments.

### Solution
The `tree-sitter-grammars` organization maintains WASM-compatible forks with prebuilt binaries for each release. This script makes it easy to:
- Download the correct WASM files
- Update to newer versions
- Verify file integrity
- Keep documentation in sync

## Script Features

### Smart Download
- Only downloads if files are missing or sizes differ
- Shows `⊙` symbol for already-current files
- Shows `✓` symbol for newly downloaded files

### Version Management
- Supports "latest" keyword for newest release
- Accepts specific version tags like "v0.5.1"
- Updates `GRAMMAR_NOTES.md` automatically with version info

### Error Handling
- Validates HTTP responses
- Follows redirects automatically
- Checks WASM file format (magic number: `\\0asm`)
- Warns if WASM version is unexpected
- Provides clear error messages

### No Dependencies
- Uses only Node.js built-in modules (`https`, `fs`, `path`)
- No need to install additional packages
- Works with Node.js 14+

## File Verification

The script verifies WASM files by checking:

1. **Magic Number**: First 4 bytes must be `0x00 0x61 0x73 0x6D` (`\\0asm`)
2. **WASM Version**: Next 4 bytes should be `0x01 0x00 0x00 0x00` (version 1)
3. **File Size**: Compares with GitHub asset size

If verification fails, the script exits with an error.

## Integration with npm

The script is integrated into `package.json`:

```json
{
  "scripts": {
    "fetch:wasm": "node scripts/fetch-wasm.js",
    "update:wasm": "node scripts/fetch-wasm.js latest"
  }
}
```

## Updating to a New Version

When a new version of the grammar is released:

1. Run the fetch script:
   ```bash
   npm run update:wasm
   ```

2. Test the new WASM files:
   ```bash
   npm run compile
   npm test
   ```

3. Check if node types changed:
   - Look at test output
   - Review `GRAMMAR_NOTES.md` for node type differences
   - Update server code if needed (e.g., if `inline` changes to something else)

4. Commit the changes:
   ```bash
   git add wasm/*.wasm GRAMMAR_NOTES.md
   git commit -m "Update tree-sitter-markdown WASM to vX.Y.Z"
   ```

## Troubleshooting

### Rate Limiting

If you see rate limit errors from GitHub API:
```
✗ Error: HTTP 403: rate limit exceeded
```

Solution: Wait a few minutes or provide a GitHub token:
```bash
export GITHUB_TOKEN="your_personal_access_token"
node scripts/fetch-wasm.js
```

(Note: The script doesn't currently support tokens, but you can add this by modifying the `httpsGet` function headers)

### Network Issues

If downloads fail due to network issues:
```
✗ Error: ECONNREFUSED
```

Solution: Check your internet connection and try again. The script will show which file failed.

### Invalid WASM

If verification fails:
```
✗ Error: Invalid WASM magic number in tree-sitter-markdown.wasm
```

Solution: Delete the file and run the script again:
```bash
rm wasm/tree-sitter-markdown.wasm
npm run fetch:wasm
```

## Future Enhancements

Possible improvements:
- [ ] Add `--force` flag to re-download even if files exist
- [ ] Add `--check` flag to only check versions without downloading
- [ ] Support GitHub API tokens for higher rate limits
- [ ] Show file checksums (SHA256) for verification
- [ ] Cache downloaded files in a temp directory
- [ ] Add progress bars for large downloads
- [ ] Support downloading from local file system for offline development
