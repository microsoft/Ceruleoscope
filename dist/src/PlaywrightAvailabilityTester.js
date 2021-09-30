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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlaywrightAvailabilityTester = void 0;
const Util_1 = __importDefault(require("applicationinsights/out/Library/Util"));
const AppInsights = __importStar(require("applicationinsights"));
const BrowserContextInsights_1 = require("./BrowserContextInsights");
const StorageClient_1 = require("./StorageClient");
const path = __importStar(require("path"));
const os = __importStar(require("os"));
// Hooks into Playwright's Browser, so that all BrowserContext and Page objects are instrumented to emit telemetry
// Call `.initBrowser(browser)` to instrument the Browser object
// Call `.failPageTest(page, errorMessage)` to indicate a failed availability test, as it is assumed to be successful
// Call `.failAvailabilityTest(browserContext, errorMessage)` to fail the availability test for reasons unrelated to page behavior (unexpected exceptions etc)
class PlaywrightAvailabilityTester {
    constructor(options) {
        var _a, _b;
        this.testName = "";
        this.runLocation = "";
        this.options = options;
        if (options === null || options === void 0 ? void 0 : options.logDebugToTelemetryClient) {
            options.log = (...args) => {
                var _a;
                return (_a = this.telemetryClient) === null || _a === void 0 ? void 0 : _a.trackTrace({
                    message: args.join(" "),
                    properties: {
                        emittedBy: "PWAFAT",
                    },
                    tagOverrides: {
                        "ai.operation.id": this.availabilityTestOperationId,
                        "ai.operation.parentId": this.availabilityTestSpanId,
                    },
                });
            };
            options.error = (...args) => {
                var _a;
                console.error(...args);
                let err = new Error(args.join(" "));
                (_a = this.telemetryClient) === null || _a === void 0 ? void 0 : _a.trackException({
                    exception: err,
                    properties: {
                        emittedBy: "PWAFAT",
                    },
                    tagOverrides: {
                        "ai.operation.id": this.availabilityTestOperationId,
                        "ai.operation.parentId": this.availabilityTestSpanId,
                    },
                });
            };
        }
        if (options === null || options === void 0 ? void 0 : options.telemetryClient) {
            this.telemetryClient = options.telemetryClient;
        }
        else if (options === null || options === void 0 ? void 0 : options.telemetryClientConnectionString) {
            this.telemetryClient = new AppInsights.TelemetryClient(options === null || options === void 0 ? void 0 : options.telemetryClientConnectionString);
        }
        else if (AppInsights.defaultClient) {
            this.telemetryClient = AppInsights.defaultClient;
        }
        else {
            // using environment variable APPINSIGHTS_INSTRUMENTATIONKEY if the value in options is undefined
            this.telemetryClient = new AppInsights.TelemetryClient();
        }
        if ((options === null || options === void 0 ? void 0 : options.disableTrace) != true || (options === null || options === void 0 ? void 0 : options.disableHar) != true) {
            if (options === null || options === void 0 ? void 0 : options.storageClient) {
                this.storageClient = options.storageClient;
            }
            else if ((options === null || options === void 0 ? void 0 : options.storageClientConnectionString) || process.env.AzureWebJobsStorage) {
                let storageClientOptions = {
                    connectionString: ((options === null || options === void 0 ? void 0 : options.storageClientConnectionString) ? options.storageClientConnectionString : process.env.AzureWebJobsStorage),
                    log: (options === null || options === void 0 ? void 0 : options.log) ? options.log : () => { },
                    error: (options === null || options === void 0 ? void 0 : options.error) ? options.error : console.error,
                };
                this.storageClient = new StorageClient_1.StorageClient(storageClientOptions);
            }
        }
        this.availabilityTestOperationId = Util_1.default.w3cTraceId();
        this.availabilityTestSpanId = Util_1.default.w3cSpanId();
        options === null || options === void 0 ? void 0 : options.log("Telemetry:", (_a = this.telemetryClient) === null || _a === void 0 ? void 0 : _a.config.endpointUrl, "Storage:", (_b = this.storageClient) === null || _b === void 0 ? void 0 : _b.hostName());
    }
    traceFilePath() {
        return `PlaywrightTrace.${this.availabilityTestSpanId}.zip`;
    }
    harFilePath() {
        return path.join(os.tmpdir(), `PlaywrightHAR.${this.availabilityTestSpanId}.har`);
    }
    initBrowser(browser) {
        // check if this browser object is already instrumented
        if (browser["_pwafat_attached"]) {
            return;
        }
        browser["_pwafat_attached"] = true;
        const tester = this;
        let harFilePath = this.harFilePath();
        // replace the Browser.newContext function
        // TODO: see if it can be done to Browser.prototype
        let tempNewContext = browser.newContext;
        browser.newContext = function (options) {
            var _a;
            return __awaiter(this, void 0, void 0, function* () {
                // create the context
                if (((_a = tester.options) === null || _a === void 0 ? void 0 : _a.disableHar) != true) {
                    if (options) {
                        if (options.recordHar) {
                            options.recordHar.path = harFilePath;
                        }
                        else {
                            options.recordHar = {
                                path: harFilePath,
                            };
                        }
                    }
                    else {
                        options = { recordHar: { path: harFilePath } };
                    }
                }
                let attachContext = yield tempNewContext.apply(this, [options]);
                // attach BrowserContextInsights to the new context
                tester.initBrowserContext(attachContext);
                return attachContext;
            });
        };
    }
    initBrowserContext(browserContext, page) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
        if (!browserContext[BrowserContextInsights_1.BrowserContextInsights.browserContextInsightsAttachedPropertyName]) {
            let bciOpt = {
                operationId: this.availabilityTestOperationId,
                spanId: this.availabilityTestSpanId,
                page: page,
                storageClient: ((_a = this.options) === null || _a === void 0 ? void 0 : _a.disableHar) != true || ((_b = this.options) === null || _b === void 0 ? void 0 : _b.disableTrace) != true ? this.storageClient : undefined,
                harFilePath: ((_c = this.options) === null || _c === void 0 ? void 0 : _c.disableHar) != true ? this.harFilePath() : undefined,
                traceFileName: ((_d = this.options) === null || _d === void 0 ? void 0 : _d.disableTrace) != true ? this.traceFilePath() : undefined,
                log: ((_e = this.options) === null || _e === void 0 ? void 0 : _e.log) ? (_f = this.options) === null || _f === void 0 ? void 0 : _f.log : () => { },
                error: ((_g = this.options) === null || _g === void 0 ? void 0 : _g.error) ? (_h = this.options) === null || _h === void 0 ? void 0 : _h.error : console.error,
            };
            let bci = new BrowserContextInsights_1.BrowserContextInsights(this.telemetryClient, browserContext, bciOpt);
            if (((_j = this.options) === null || _j === void 0 ? void 0 : _j.disableTrace) != true) {
                if (this.storageClient) {
                    browserContext.tracing.start({
                        screenshots: true,
                        snapshots: true,
                        name: this.traceFilePath(),
                    });
                    (_k = this.options) === null || _k === void 0 ? void 0 : _k.log("Started Playwright Trace");
                }
                else {
                    (_l = this.options) === null || _l === void 0 ? void 0 : _l.log("Playwright Trace will not be started");
                }
            }
            // Azure Functions uses 'Location' environment variable to pass region name (IMDS is not accessible)
            // APPSETTING_LOCATION can be used to override that
            let location = this.runLocation;
            if (!location || location == "") {
                location = process.env.APPSETTING_LOCATION || process.env.Location || "NO_LOCATION";
            }
            bci.runLocation = location;
            // Azure Functions uses 'APPSETTING_WEBSITE_SITE_NAME' environment variable to pass the logic app name
            // APPSETTING_TESTNAME can be used to override that
            let testName = this.testName;
            if (!testName || testName == "") {
                location = process.env.APPSETTING_TESTNAME || process.env.APPSETTING_WEBSITE_SITE_NAME || "NO_TESTNAME";
            }
            bci.testName = testName;
            browserContext[BrowserContextInsights_1.BrowserContextInsights.browserContextInsightsAttachedPropertyName] = bci;
        }
    }
    static failPageTest(page, errorMessage) {
        const browserContext = page.context();
        if (browserContext[BrowserContextInsights_1.BrowserContextInsights.browserContextInsightsAttachedPropertyName]) {
            let browserContextInsights = browserContext[BrowserContextInsights_1.BrowserContextInsights.browserContextInsightsAttachedPropertyName];
            browserContextInsights === null || browserContextInsights === void 0 ? void 0 : browserContextInsights.failPageTest(page, errorMessage);
        }
    }
    // TODO: Review this method before publishing
    // It's odd to ask for a BrowserContext here
    static failAvailabilityTest(browserContext, errorMessage) {
        if (browserContext[BrowserContextInsights_1.BrowserContextInsights.browserContextInsightsAttachedPropertyName]) {
            let browserContextInsights = browserContext[BrowserContextInsights_1.BrowserContextInsights.browserContextInsightsAttachedPropertyName];
            browserContextInsights === null || browserContextInsights === void 0 ? void 0 : browserContextInsights.failPageTest(null, errorMessage);
        }
    }
}
exports.PlaywrightAvailabilityTester = PlaywrightAvailabilityTester;
//# sourceMappingURL=PlaywrightAvailabilityTester.js.map