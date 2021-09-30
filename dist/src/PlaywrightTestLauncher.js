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
exports.PlaywrightTestLauncher = void 0;
const child_process_1 = require("child_process");
const AppInsightsAvailabilityFixture_1 = require("./AppInsightsAvailabilityFixture");
class PlaywrightTestLauncher {
    static Run(options) {
        return __awaiter(this, void 0, void 0, function* () {
            let responseMessage = "start";
            if (!options) {
                options = {
                    log: console.log,
                    error: console.error,
                };
            }
            try {
                if (process.env.AZURE_FUNCTIONS_ENVIRONMENT != "Development") {
                    if (!process.env.PLAYWRIGHT_BROWSERS_PATH || !process.env.PLAYWRIGHT_BROWSERS_PATH.startsWith("/home")) {
                        options.error("PLAYWRIGHT_BROWSERS_PATH value not as expected:", process.env.PLAYWRIGHT_BROWSERS_PATH, "tests may not run");
                    }
                    if (!process.env.APPINSIGHTS_INSTRUMENTATIONKEY && !process.env.APPLICATIONINSIGHTS_CONNECTION_STRING) {
                        options.error("AppInsights ikey and connection string not as set, telemetry will not be emitted");
                    }
                    if (!process.env.AzureWebJobsStorage) {
                        options.error("AzureWebJobsStorage not set, test data will not be persisted in Azure Storage");
                    }
                }
                let cmd = `${process.cwd()}/node_modules/.bin/playwright test`;
                if (options.addParameters && (options === null || options === void 0 ? void 0 : options.addParameters.length) > 0) {
                    cmd += " " + options.addParameters;
                }
                options.log("Launching Playwright tests:", cmd);
                let output = yield new Promise((resolve, reject) => {
                    const p = child_process_1.exec(cmd, (error, stdout, stderr) => {
                        resolve({ error, stdout, stderr });
                    });
                });
                responseMessage = "done";
                if (output.error) {
                    options.error(output.error);
                    responseMessage += "\r\nError running tests: " + JSON.stringify(output.error, null, 2);
                }
                responseMessage += "\r\nSTDOUT: " + output.stdout;
                if (output.stderr) {
                    responseMessage += "\r\nSTDERR: " + output.stderr;
                }
                if (responseMessage.indexOf(AppInsightsAvailabilityFixture_1.appInsightsAvailabilityTesterTag) < 0) {
                    options.error("AppInsights Availability Fixture tag not found, check test's `require` statement");
                }
            }
            catch (x) {
                options.error("Error runnning Playwright tests", x);
                responseMessage += "\r\n" + JSON.stringify(x, null, 2);
            }
            return responseMessage;
        });
    }
}
exports.PlaywrightTestLauncher = PlaywrightTestLauncher;
//# sourceMappingURL=PlaywrightTestLauncher.js.map