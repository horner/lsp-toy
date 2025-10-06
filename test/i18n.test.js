#!/usr/bin/env node

/**
 * Test localization across all three supported languages
 * Runs multiple test scenarios to verify i18n is working correctly
 */

const { spawn } = require('node:child_process');

const TEST_LOCALES = [
  { code: 'en-US', lang: 'English', linkWord: 'Link' },
  { code: 'es-ES', lang: 'Spanish', linkWord: 'Enlace' },
  { code: 'fr-FR', lang: 'French', linkWord: 'Lien' },
  { code: 'pl-PL', lang: 'Polish', linkWord: 'Link' }
];

let allPassed = true;

function runTest(locale) {
  return new Promise((resolve, reject) => {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Testing ${locale.lang} (${locale.code})`);
    console.log('='.repeat(60));
    
    const testProcess = spawn('node', ['test/completion.test.js'], {
      stdio: 'inherit',
      env: { ...process.env, LSP_LOCALE: locale.code }
    });

    testProcess.on('exit', (code) => {
      if (code !== 0) {
        console.error(`✗ ${locale.lang} test failed with exit code ${code}`);
        allPassed = false;
      }
      resolve(code);
    });

    testProcess.on('error', (error) => {
      console.error(`✗ ${locale.lang} test error:`, error.message);
      allPassed = false;
      reject(error);
    });
  });
}

async function main() {
  console.log('🌍 Running i18n test suite...\n');

  for (const locale of TEST_LOCALES) {
    try {
      await runTest(locale);
    } catch (error) {
      console.error(`Failed to run test for ${locale.lang}:`, error.message);
      allPassed = false;
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  if (allPassed) {
    console.log('✓ All localization tests passed!');
    console.log('='.repeat(60));
    process.exit(0);
  } else {
    console.error('✗ Some localization tests failed');
    console.log('='.repeat(60));
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Test suite error:', error.message);
  process.exit(1);
});
