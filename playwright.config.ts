import { defineConfig } from '@playwright/test'

/**
 * Pinned to 1.56.1 deliberately: that is the release whose Chromium revision
 * (1194) matches the one already in this image, so no browser download is
 * needed and no launch has to name an executablePath. Bumping Playwright means
 * checking the revision still lines up, or the first launch fails with
 * "Executable doesn't exist".
 */
export default defineConfig({
  testDir: './e2e',
  use: { baseURL: 'http://127.0.0.1:4173' },
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: true,
    timeout: 120_000,
  },
})
