"use strict";
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
exports.appInsightsAvailabilityTesterTag = exports.expect = exports.test = void 0;
const test_1 = require("@playwright/test");
Object.defineProperty(exports, "expect", { enumerable: true, get: function () { return test_1.expect; } });
const PlaywrightAvailabilityTester_1 = require("./PlaywrightAvailabilityTester");
const appInsightsAvailabilityTesterTag = "[AVTESTRUN]";
exports.appInsightsAvailabilityTesterTag = appInsightsAvailabilityTesterTag;
const test = test_1.test.extend({
    page: ({ page }, use, testInfo) => __awaiter(void 0, void 0, void 0, function* () {
        console.log(appInsightsAvailabilityTesterTag, testInfo.title);
        // use env vars to init reporting
        let pwTesterOptions = {
            logDebugToTelemetryClient: true,
            log: console.log,
            error: console.error,
        };
        var pwat = new PlaywrightAvailabilityTester_1.PlaywrightAvailabilityTester(pwTesterOptions);
        let browserContext = page.context();
        if (browserContext) {
            pwat.initBrowserContext(browserContext, page);
            yield use(page); // test runs here
            if (testInfo.status == "failed" || testInfo.status == "timedOut") {
                PlaywrightAvailabilityTester_1.PlaywrightAvailabilityTester.failPageTest(page, `Test ${testInfo.title} failed with status ${testInfo.status} in ${testInfo.duration}ms. Error: ${testInfo.error}`);
            }
            //console.log("Finished test", testInfo.title, "Status:", testInfo.status);
            try {
                yield page.close();
            }
            catch (_a) { }
            try {
                yield browserContext.close();
            }
            catch (_b) { }
        }
    }),
});
exports.test = test;
//# sourceMappingURL=AppInsightsAvailabilityFixture.js.map