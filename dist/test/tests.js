"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const pw = __importStar(require("playwright"));
const PlaywrightAvailabilityTester_1 = require("../src/PlaywrightAvailabilityTester");
const StorageClient_1 = require("../src/StorageClient");
// TODO: Unit testing frameworks: MOCHA, JEST?
let aiLogs = [];
/* INIT -------------------------------------------------------------------------------------------- */
(() => __awaiter(void 0, void 0, void 0, function* () {
    let appInsights = require("applicationinsights");
    appInsights
        .setup("12341234-1234-dd4e-1234-123412341234") // fake ikey
        .setDistributedTracingMode(appInsights.DistributedTracingModes.AI_AND_W3C)
        .setUseDiskRetryCaching(false)
        .start();
    // don't send any telemetry remotely
    appInsights.defaultClient.channel.send = function () { };
    // capture appInsights logs for inspection
    appInsights.defaultClient.track = function (...args) {
        // console.log("APPINSIGHTS", ...args);
        if (args && args.length) {
            aiLogs.push(args[0]);
        }
    };
    let testStorageClient = new StorageClient_1.StorageClient({
        connectionString: "",
        log: console.log,
        error: console.error,
    });
    testStorageClient.uploadLocalFile = (containerName, blobName, localFileName) => __awaiter(void 0, void 0, void 0, function* () {
        console.log("Creating blob:", blobName, "in container", containerName, "from", localFileName);
        return blobName;
    });
    testStorageClient.ensureContainerExists = (containerName) => __awaiter(void 0, void 0, void 0, function* () {
        console.log("Creating container:", containerName);
        return "/" + containerName;
    });
    testStorageClient.hostName = () => "test";
    let playwrightAvtest = new PlaywrightAvailabilityTester_1.PlaywrightAvailabilityTester({
        telemetryClient: appInsights.defaultClient,
        storageClient: testStorageClient,
        log: console.log,
        error: console.error,
    });
    const browser = yield pw.chromium.launch();
    playwrightAvtest.initBrowser(browser);
    yield storageClientUploadTest();
    yield noBrowserContextTest(browser);
    yield openSinglePageTest(browser);
    //await bingSearchPageTest(browser);
    //await openSinglePageWithTracingTest(browser);
    //await failSinglePageTest(browser);
    //await zakiClickPageTest(browser);
    appInsights.defaultClient.flush();
    console.log("Tests done");
}))();
/* -------------------------------------------------------------------------------------------- */
// create a page directly from `browser`, expect it to report its view
function noBrowserContextTest(browser) {
    return __awaiter(this, void 0, void 0, function* () {
        let page = yield browser.newPage();
        let response = yield page.goto("https://bing.com");
        if (!(response === null || response === void 0 ? void 0 : response.ok()))
            throw `Not today: ${response === null || response === void 0 ? void 0 : response.status}`;
    });
}
/* -------------------------------------------------------------------------------------------- */
// open a single page via BrowserContext, expect it to report it's been viewed
function openSinglePageTest(browser) {
    return __awaiter(this, void 0, void 0, function* () {
        const browserContext = yield browser.newContext();
        let page = yield browserContext.newPage();
        let response = yield page.goto("https://bing.com");
        if (!(response === null || response === void 0 ? void 0 : response.ok()))
            throw `Not today: ${response === null || response === void 0 ? void 0 : response.status}`;
        yield page.waitForLoadState("domcontentloaded");
        yield browserContext.close();
        assetPageViewIsReported(page);
    });
}
function storageClientUploadTest() {
    return __awaiter(this, void 0, void 0, function* () {
        let storageConnectionString = process.env.AzureWebJobsStorage;
        if (storageConnectionString && storageConnectionString.length > 0) {
            let storageClient = new StorageClient_1.StorageClient({
                connectionString: storageConnectionString,
                error: console.error,
                log: console.log,
            });
            try {
                let containerName = "storagecontainercest";
                if (!storageClient.hostName()) {
                    console.error("Storage account host is not valid");
                }
                yield storageClient.ensureContainerExists(containerName);
                let link = yield storageClient.uploadLocalFile(containerName, "readme.md", "readme.md");
                if (!link) {
                    console.error("Did not get link");
                }
                else {
                    console.log("OK", link);
                }
            }
            catch (sx) {
                console.error(sx);
            }
        }
        else {
            console.error("No storage connection string found");
        }
    });
}
function assetPageViewIsReported(page) {
    var _a;
    if (((_a = page["_pageInsights"]) === null || _a === void 0 ? void 0 : _a.isPageViewReported) != true) {
        throw `Page view not reported ${page.url()}`;
    }
}
function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
//# sourceMappingURL=tests.js.map