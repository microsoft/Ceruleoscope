import { test as baseTest, expect } from "@playwright/test";
import { PlaywrightAvailabilityTester } from "./PlaywrightAvailabilityTester";
import * as PW from "playwright";

const appInsightsAvailabilityTesterTag = "[AVTESTRUN]";

const test = baseTest.extend({
  page: async ({ page }, use, testInfo) => {
    console.log(appInsightsAvailabilityTesterTag, testInfo.title);

    var pwat = new PlaywrightAvailabilityTester();

    let browserContext = page.context();
    if (browserContext) {
      pwat.initBrowserContext(browserContext as PW.BrowserContext, page);

      await use(page); // test runs here

      if (testInfo.status == "failed" || testInfo.status == "timedOut") {
        PlaywrightAvailabilityTester.failPageTest(
          page as PW.Page,
          `Test ${testInfo.title} failed with status ${testInfo.status} in ${testInfo.duration}ms. Error: ${testInfo.error}`
        );
      }

      //console.log("Finished test", testInfo.title, "Status:", testInfo.status);

      try {
        await page.close();
      } catch {}
      try {
        await browserContext.close();
      } catch {}
    }
  },
});

export { test, expect, appInsightsAvailabilityTesterTag };
