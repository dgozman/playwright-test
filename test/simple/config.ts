/**
 * Copyright Microsoft Corporation. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { test, PlaywrightOptions, setConfig } from '../../out';

// Global Folio configuration.
setConfig({
  testDir: __dirname,
  timeout: 30000,
});

// Playwright-specific options.
const options: PlaywrightOptions = {
  launchOptions: {
    headless: true,
  },
  contextOptions: {
    viewport: { width: 1280, height: 720 },
  },
};

// Run tests in three browsers.
test.runWith({ options: { ...options, browserName: 'chromium' }, tag: 'chromium' });
test.runWith({ options: { ...options, browserName: 'webkit' }, tag: 'webkit' });
test.runWith({
  options: {
    ...options,
    contextOptions: {
      viewport: { width: 200, height: 200 },
    },
    video: 'retain-on-failure',
    browserName: 'firefox',
  },
  tag: 'firefox',
  retries: 1
});
