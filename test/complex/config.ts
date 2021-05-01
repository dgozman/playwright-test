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

import * as pwt from '../../out';
import * as playwright from 'playwright';

// Global Folio configuration.
pwt.setConfig({
  testDir: __dirname,
  timeout: 30000,
});

const BASE_URL = 'https://example.com';

// Login once and provide storageState for all tests.
pwt.globalSetup(async () => {
  const browser = await playwright.chromium.launch();
  const page = await browser.newPage();
  await page.route('**/*', route => route.fulfill({ body: 'hi' }))
  await page.goto(BASE_URL);
  await page.evaluate(() => localStorage.foo = 'bar');
  await pwt.setStorageState(await page.context().storageState());
  await browser.close();
});

// Extend test with custom environment that provides a number.
export const test = pwt.test.extend({
  beforeEach() {
    return { a: 42, url: BASE_URL };
  }
});
export { expect } from '../../out';

// // Playwright-specific options for browser environments.
// const options: pwt.PlaywrightOptions = {
//   launchOptions: {
//     headless: true,
//   },
//   viewport: { width: 1280, height: 720 },
// };

// // Run tests in three browsers.
// test.runWith({ tag: 'chromium' }, new pwt.ChromiumEnv(options));
// test.runWith({ tag: 'firefox' }, new pwt.FirefoxEnv(options));
// test.runWith({ tag: 'webkit' }, new pwt.WebKitEnv(options));
