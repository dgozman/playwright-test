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

import { Browser, BrowserContext, BrowserContextOptions, Page, LaunchOptions } from 'playwright';
import * as folio from 'folio';
import * as fs from 'fs';
import * as util from 'util';

export * from 'folio';
export { BrowserContextOptions, LaunchOptions } from 'playwright';

/**
 * The name of the browser supported by Playwright.
 */
export type BrowserName = 'chromium' | 'firefox' | 'webkit';

/**
 * Playwright options configure browser, pages and more.
 */
export type PlaywrightOptions = {
  /**
   * Name of the browser (chromium, firefox, webkit) to use. Defaults to 'chromium'.
   */
  browserName?: BrowserName;

  /**
   * Options used to launch the browser.
   */
  launchOptions?: LaunchOptions;

  /**
   * Options used to create a new context.
   */
  contextOptions?: BrowserContextOptions;

  /**
   * Whether to capture a screenshot after each test, off by default.
   * - off: Do not capture screenshots.
   * - on: Capture screenshot after each test.
   * - only-on-failure: Capture screenshot after each test failure.
   */
  screenshot?: 'off' | 'on' | 'only-on-failure';

  /**
   * Whether to record video for each test, off by default.
   * - off: Do not record video.
   * - on: Record video for each test.
   * - retain-on-failure: Record video for each test,
   *     but remove all videos from successful test runs.
   * - retry-with-video: Record video only when retrying a test.
   */
  video?: 'off' | 'on' | 'retain-on-failure' | 'retry-with-video';
};

/**
 * Arguments available to the test function.
 */
export type PlaywrightTestArgs = {
  /**
   * The Playwright instance.
   */
  playwright: typeof import('playwright');

  /**
   * Name of the browser (chromium, firefox, webkit) that runs this test.
   */
  browserName: BrowserName;

  /**
   * Browser instance, shared between many tests.
   */
  browser: Browser;

  /**
   * BrowserContext instance, created fresh for each test.
   */
  context: BrowserContext;

  /**
   * Page instance, created fresh for each test.
   */
  page: Page;
};

class PlaywrightEnv {
  private _playwright: typeof import('playwright') | undefined;
  private _options: PlaywrightOptions | undefined;
  private _browserName: BrowserName | undefined;
  private _browser: Browser | undefined;
  private _context: BrowserContext | undefined;
  private _page: Page | undefined;
  private _allPages: Page[] = [];

  testOptionsType(): BrowserContextOptions {
    return {};
  }

  optionsType(): PlaywrightOptions {
    return {};
  }

  async beforeAll(options: PlaywrightOptions, workerInfo: folio.WorkerInfo) {
    this._options = options || {};
    this._browserName = this._options.browserName || 'chromium';
    this._playwright = require('playwright');
    const launchOptions: LaunchOptions = { ...this._options.launchOptions };
    launchOptions.handleSIGINT = false;
    this._browser = await this._playwright![this._browserName].launch(launchOptions);
    return {
      playwright: this._playwright!,
      browserName: this._browserName,
      browser: this._browser,
    };
  }

  async beforeEach(options: BrowserContextOptions, testInfo: folio.TestInfo): Promise<PlaywrightTestArgs> {
    testInfo.snapshotPathSegment = this._browserName! + '-' + process.platform;
    const recordVideo = this._options!.video === 'on' || this._options!.video === 'retain-on-failure' ||
        (this._options!.video === 'retry-with-video' && !!testInfo.retry);
    this._context = await this._browser!.newContext({
      recordVideo: recordVideo ? { dir: testInfo.outputPath('') } : undefined,
      storageState: process.env.PLAYWRIGHT_TEST_STORAGE_STATE ? JSON.parse(process.env.PLAYWRIGHT_TEST_STORAGE_STATE) : undefined,
      ...this._options!.contextOptions,
      ...options,
    });
    this._allPages = [];
    this._context.on('page', page => this._allPages.push(page));
    this._page = await this._context.newPage();
    return {
      playwright: this._playwright!,
      browserName: this._browserName!,
      browser: this._browser!,
      context: this._context!,
      page: this._page!,
    };
  }

  async afterEach({}, testInfo: folio.TestInfo) {
    const testFailed = testInfo.status !== testInfo.expectedStatus;
    if (this._context) {
      if (this._options!.screenshot === 'on' || (this._options!.screenshot === 'only-on-failure' && testFailed)) {
        await Promise.all(this._context.pages().map((page, index) => {
          const screenshotPath = testInfo.outputPath(`test-${testFailed ? 'failed' : 'finished'}-${++index}.png`);
          return page.screenshot({ timeout: 5000, path: screenshotPath }).catch(e => {});
        }));
      }
      await this._context.close();
    }
    const deleteVideos = this._options!.video === 'retain-on-failure' && !testFailed;
    if (deleteVideos) {
      await Promise.all(this._allPages.map(async page => {
        const video = page.video();
        if (!video)
          return;
        const videoPath = await video.path();
        await util.promisify(fs.unlink)(videoPath).catch(e => {});
      }));
    }
    this._allPages = [];
    this._context = undefined;
    this._page = undefined;
  }

  async afterAll({}) {
    if (this._browser)
      await this._browser.close();
    this._browser = undefined;
  }
}

/**
 * These tests are executed with Playwright environment that launches the browser
 * and provides a fresh page to each test.
 */
export const test = folio.test.extend(new PlaywrightEnv());

type StorageState = Exclude<Parameters<Browser['newContext']>[0], undefined>['storageState'];
/**
 * Sets the storage stage that is used by all tests with Playwright.
 * Useful for authenticating once and running tests already authenticated.
 *
 * Use with `globalSetup`:
 * ```js
 * globalSetup(async () => {
 *   const browser = await playwright.chromium.launch();
 *   const page = await browser.newPage();
 *   await page.goto(LOGIN_URL);
 *   // perform login actions
 *   await setStorageState(await page.context().storageState());
 *   await browser.close();
 * });
 * ```
 *
 * To exclude some tests, override `storageState` with `test.useOptions`:
 * ```js
 * test.useOptions({ storageState: {} });
 * test('start without authentication', async ({ page }) => {
 *   // Test goes here.
 * });
 * ```
 */
export async function setStorageState(storageState: StorageState) {
  process.env.PLAYWRIGHT_TEST_STORAGE_STATE = JSON.stringify(storageState);
}
