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
exports.BrowserContextInsights = void 0;
const Util_1 = __importDefault(require("applicationinsights/out/Library/Util"));
const PageInsights_1 = require("./PageInsights");
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const fs = __importStar(require("fs"));
class BrowserContextInsights {
    constructor(telemetryClient, browserContext, options) {
        this.telemetryClient = telemetryClient;
        this.browserContext = browserContext;
        this.testName = "playwright-availability-test";
        this.runLocation = "runLocation"; // TODO: get that from IMDS?
        this.isAvailabilityResultReported = false;
        this.traceFileName = undefined;
        this.harFilePath = undefined;
        this.options = options;
        this.storageClient = options === null || options === void 0 ? void 0 : options.storageClient;
        this.traceFileName = options === null || options === void 0 ? void 0 : options.traceFileName;
        this.harFilePath = options === null || options === void 0 ? void 0 : options.harFilePath;
        this.availabilityTestSpanId = (options === null || options === void 0 ? void 0 : options.spanId) || Util_1.default.w3cSpanId();
        this.availabilityTestOperationId = (options === null || options === void 0 ? void 0 : options.operationId) || Util_1.default.w3cTraceId();
        this.startedAt = new Date();
        browserContext.on("page", (page) => {
            this.attachToPage(page);
        });
        if (options === null || options === void 0 ? void 0 : options.page) {
            this.attachToPage(options === null || options === void 0 ? void 0 : options.page);
        }
        let _self = this;
        let tempContextClose = browserContext.close;
        browserContext.close = () => __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                yield Promise.all(browserContext.pages().map((pg) => {
                    var pin = PageInsights_1.PageInsights.getPageContext(pg);
                    pin === null || pin === void 0 ? void 0 : pin.trackPageView();
                }));
            }
            catch (x) {
                (_a = _self.options) === null || _a === void 0 ? void 0 : _a.error("Failed to close pages on BrowserContext.close()", x);
            }
            yield _self.trackAvailabilityResult();
            yield tempContextClose.apply(browserContext);
        });
    }
    attachToPage(page) {
        let pgi = PageInsights_1.PageInsights.getPageContext(page);
        if (pgi == undefined) {
            pgi = PageInsights_1.PageInsights.getPageContext(page, this.telemetryClient, this.availabilityTestOperationId, this.availabilityTestSpanId, this.options);
        }
    }
    failPageTest(page, errorMessage) {
        this.errorMessage = ((this.errorMessage != undefined ? this.errorMessage : "") + "\n" + (page === null || page === void 0 ? void 0 : page.url()) + ": " + errorMessage).trim();
        if (page) {
            let pageContext = PageInsights_1.PageInsights.getPageContext(page);
            pageContext === null || pageContext === void 0 ? void 0 : pageContext.failTest(errorMessage);
        }
    }
    trackAvailabilityResult() {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.isAvailabilityResultReported) {
                this.isAvailabilityResultReported = true;
                let spanId = this.availabilityTestSpanId;
                let traceFileLink;
                let harFileLink;
                if (this.traceFileName) {
                    let traceFilePath = path.join(os.tmpdir(), this.traceFileName);
                    try {
                        yield this.browserContext.tracing.stop({ path: traceFilePath });
                    }
                    catch (tx) {
                        (_a = this.options) === null || _a === void 0 ? void 0 : _a.error("Trace file could not be obtained", tx);
                    }
                }
                if (this.storageClient) {
                    try {
                        const blobContainerName = "playwright-insights";
                        try {
                            (_b = this.options) === null || _b === void 0 ? void 0 : _b.log("Creating Storage container", blobContainerName);
                            yield this.storageClient.ensureContainerExists(blobContainerName);
                        }
                        catch (cx) {
                            (_c = this.options) === null || _c === void 0 ? void 0 : _c.error("Failed to ensure storage container exists", blobContainerName, cx);
                        }
                        let uploads = [];
                        if (this.traceFileName) {
                            let traceFilePath = path.join(os.tmpdir(), this.traceFileName);
                            if (fs.existsSync(traceFilePath)) {
                                uploads.push(this.storageClient.uploadLocalFile(blobContainerName, this.traceFileName, traceFilePath).then((link) => (traceFileLink = link)));
                            }
                        }
                        else {
                            (_d = this.options) === null || _d === void 0 ? void 0 : _d.log("Trace file name not set");
                        }
                        if (this.harFilePath && fs.existsSync(this.harFilePath)) {
                            uploads.push(this.storageClient.uploadLocalFile(blobContainerName, path.basename(this.harFilePath), this.harFilePath).then((link) => (harFileLink = link)));
                        }
                        else {
                            (_e = this.options) === null || _e === void 0 ? void 0 : _e.log("HAR file name not set");
                        }
                        if ((uploads === null || uploads === void 0 ? void 0 : uploads.length) > 0) {
                            (_f = this.options) === null || _f === void 0 ? void 0 : _f.log("Uploading", uploads.length, uploads.length > 1 ? "files" : "file");
                            let uploadResults = yield Promise.all(uploads);
                            (_g = this.options) === null || _g === void 0 ? void 0 : _g.log("Uploaded", ...uploadResults);
                        }
                    }
                    catch (sx) {
                        (_h = this.options) === null || _h === void 0 ? void 0 : _h.error("Trace/HAR file storage error", sx);
                    }
                }
                this.telemetryClient.trackAvailability({
                    id: spanId,
                    name: this.testName,
                    message: this.errorMessage || "OK",
                    time: this.startedAt,
                    duration: new Date().getTime() - this.startedAt.getTime(),
                    success: !this.errorMessage,
                    runLocation: this.runLocation,
                    tagOverrides: {
                        "ai.operation.id": this.availabilityTestOperationId,
                        "ai.operation.parentId": this.availabilityTestSpanId,
                    },
                    properties: {
                        traceFileLink: traceFileLink,
                        harFileLink: harFileLink,
                    },
                });
                (_j = this.options) === null || _j === void 0 ? void 0 : _j.log("Flushing telemetry");
                yield new Promise((resolve, reject) => {
                    this.telemetryClient.flush({
                        callback: (v) => {
                            resolve(v);
                        },
                    });
                });
                process.once("beforeExit", () => __awaiter(this, void 0, void 0, function* () { return yield new Promise((resolve) => setTimeout(resolve, 200)); }));
                (_k = this.options) === null || _k === void 0 ? void 0 : _k.log(`Availability result reported:`, `id: ${spanId} operation.id: ${this.availabilityTestOperationId} parentId: ${this.availabilityTestSpanId}`, this.testName, this.errorMessage || "OK");
            }
        });
    }
}
exports.BrowserContextInsights = BrowserContextInsights;
BrowserContextInsights.browserContextInsightsAttachedPropertyName = "_browserContextInsights";
//# sourceMappingURL=BrowserContextInsights.js.map