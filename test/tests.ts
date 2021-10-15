import * as pw from "playwright";
import { PlaywrightAvailabilityTester, PlaywrightAvailabilityTesterOptions } from "../src/PlaywrightAvailabilityTester";
import * as os from "os";
import * as fs from "fs";
import * as path from "path";
import { StorageClient } from "../src/StorageClient";

// TODO: Unit testing frameworks: MOCHA, JEST?

let aiLogs: any[] = [];

/* INIT -------------------------------------------------------------------------------------------- */
(async () => {
  let appInsights = require("applicationinsights");
  appInsights
    .setup("12341234-1234-dd4e-1234-123412341234") // fake ikey
    .setDistributedTracingMode(appInsights.DistributedTracingModes.AI_AND_W3C)
    .setUseDiskRetryCaching(false);

  // don't send any telemetry remotely
  appInsights.defaultClient.channel.send = function () {};

  // capture appInsights logs for inspection
  appInsights.defaultClient.track = function (...args: any) {
    // console.log("APPINSIGHTS", ...args);
    if (args && args.length) {
      aiLogs.push(args[0]);
    }
  };

  let testStorageClient = new StorageClient({
    connectionString: "",
    log: console.log,
    error: console.error,
  });

  testStorageClient.uploadLocalFile = async (containerName: string, blobName: string, localFileName: string) => {
    console.log("Creating blob:", blobName, "in container", containerName, "from", localFileName);
    return blobName;
  };

  testStorageClient.ensureContainerExists = async (containerName: string) => {
    console.log("Creating container:", containerName);
    return "/" + containerName;
  };

  testStorageClient.hostName = () => "test";

  let playwrightAvtest = new PlaywrightAvailabilityTester({
    telemetryClient: appInsights.defaultClient,
    storageClient: testStorageClient,
    log: console.log,
    error: console.error,
  });

  const browser = await pw.chromium.launch();
  playwrightAvtest.initBrowser(browser);

  await storageClientUploadTest();
  await noBrowserContextTest(browser);
  await openSinglePageTest(browser);
  //await bingSearchPageTest(browser);
  //await openSinglePageWithTracingTest(browser);
  //await failSinglePageTest(browser);
  //await zakiClickPageTest(browser);

  appInsights.defaultClient.flush();
  console.log("Tests done");
})();

/* -------------------------------------------------------------------------------------------- */
// create a page directly from `browser`, expect it to report its view
async function noBrowserContextTest(browser: pw.Browser) {
  let page = await browser.newPage();
  let response = await page.goto("https://bing.com");
  if (!response?.ok()) throw `Not today: ${response?.status}`;
}

/* -------------------------------------------------------------------------------------------- */
// open a single page via BrowserContext, expect it to report it's been viewed
async function openSinglePageTest(browser: pw.Browser) {
  const browserContext = await browser.newContext();

  let page = await browserContext.newPage();
  let response = await page.goto("https://bing.com");
  if (!response?.ok()) throw `Not today: ${response?.status}`;
  await page.waitForLoadState("domcontentloaded");

  await browserContext.close();

  assetPageViewIsReported(page);
}

async function storageClientUploadTest() {
  let storageConnectionString = process.env.AzureWebJobsStorage;
  if (storageConnectionString && storageConnectionString.length > 0) {
    let storageClient = new StorageClient({
      connectionString: storageConnectionString,
      error: console.error,
      log: console.log,
    });
    try {
      let containerName = "storagecontainercest";
      if (!storageClient.hostName()) {
        console.error("Storage account host is not valid");
      }
      await storageClient.ensureContainerExists(containerName);
      let link = await storageClient.uploadLocalFile(containerName, "readme.md", "readme.md");
      if (!link) {
        console.error("Did not get link");
      } else {
        console.log("OK", link);
      }
    } catch (sx) {
      console.error(sx);
    }
  } else {
    console.error("No storage connection string found");
  }
}

function assetPageViewIsReported(page: pw.Page) {
  if ((<any>page)["_pageInsights"]?.isPageViewReported != true) {
    throw `Page view not reported ${page.url()}`;
  }
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
