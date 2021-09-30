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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PageInsights = void 0;
const Util_1 = __importDefault(require("applicationinsights/out/Library/Util"));
class PageInsights {
    constructor(telemetryClient, page, operationId, parentSpanId, options) {
        this.instrumented = false;
        this.isPageViewReported = false;
        this.telemetryClient = telemetryClient;
        this.page = page;
        this.operationId = operationId;
        this.pageViewSpanId = Util_1.default.w3cSpanId();
        this.parentSpanId = parentSpanId;
        this.openedAt = new Date();
        if (options) {
            this.options = options;
        }
        else {
            this.options = {
                log: () => { },
                error: console.error,
            };
        }
        if (page[PageInsights.pageInsightsAttachedPropertyName]) {
            throw "Unexpected: Page is already instrumented";
        }
        // attach this object to the page
        page[PageInsights.pageInsightsAttachedPropertyName] = this;
        let pageUrl = page.url();
        if (pageUrl && pageUrl.length > 0) {
            this.host = new URL(pageUrl).host;
        }
        page.route("**/*", (r) => this.pageRoute(r));
        page.on("framenavigated", (frame) => this.frameNavigatedEvent(frame));
        page.on("requestfinished", (req) => this.pageRequestFinished(req));
        page.on("requestfailed", (req) => this.pageRequestFailed(req));
        let pageClose = page.close;
        let _self = this;
        page.close = function close(params) {
            return __awaiter(this, void 0, void 0, function* () {
                console.log("page closing", page.url());
                yield _self.closePage();
                yield pageClose.apply(page);
            });
        };
        this.instrumented = true;
    }
    closePage() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.instrumented) {
                console.log("Page closing", this.host);
                // TODO: removeListeners here
                this.instrumented = false;
                this.trackPageView();
            }
        });
    }
    failTest(errorMessage) {
        this.isSuccess = false;
        this.errorMessage = errorMessage;
    }
    pageRoute(route) {
        var _a;
        const request = route.request();
        if (this.urlIsApplicationInsights(request.url())) {
            return route.continue();
        }
        let headers = request.headers();
        if (!headers[PageInsights.traceparentHeaderName] && !headers[PageInsights.requestIdHeaderName]) {
            // if the request had no trace context - add the availability test's context in w3c format
            let dependencySpanId = Util_1.default.w3cSpanId();
            headers[PageInsights.traceparentHeaderName] = `00-${this.operationId}-${dependencySpanId}-01`;
            (_a = this.options) === null || _a === void 0 ? void 0 : _a.log("Added 'traceparent' header:", headers[PageInsights.traceparentHeaderName]);
            return route.continue({ headers });
        }
        return route.continue();
    }
    pageRequestFinished(request) {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function* () {
            if (this.urlIsApplicationInsights(request.url())) {
                return;
            }
            try {
                let response = yield request.response();
                const traceparent = this.getTraceParentHeaderValue(request);
                this.trackPageDependency(request.method(), request.url(), (response === null || response === void 0 ? void 0 : response.status()) || 899, request.timing(), traceparent, (_a = request.failure()) === null || _a === void 0 ? void 0 : _a.errorText);
            }
            catch (r) {
                (_b = this.options) === null || _b === void 0 ? void 0 : _b.error("Failed dependency tracking", r);
            }
        });
    }
    pageRequestFailed(request) {
        var _a, _b;
        if (this.urlIsApplicationInsights(request.url())) {
            return;
        }
        (_a = this.options) === null || _a === void 0 ? void 0 : _a.log("Request failed", request.url(), request.failure(), request.timing());
        const traceparent = this.getTraceParentHeaderValue(request);
        this.trackPageDependency(request.method(), request.url(), 999, request.timing(), traceparent, (_b = request.failure()) === null || _b === void 0 ? void 0 : _b.errorText);
    }
    trackPageDependency(method, dependencyUrl, resultCode, timing, traceparent, errorMessage) {
        var _a;
        if (this.urlIsApplicationInsights(dependencyUrl)) {
            return;
        }
        let depUrl = new URL(dependencyUrl);
        let pageOperationId = undefined;
        let dependencySpanId = undefined;
        // if there's traceparent header - take the operation/span ids from it; in most cases it would have been added during page.route(...) handling
        if (traceparent && traceparent.length > 53) {
            pageOperationId = traceparent === null || traceparent === void 0 ? void 0 : traceparent.substr(3, 32);
            dependencySpanId = traceparent === null || traceparent === void 0 ? void 0 : traceparent.substr(36, 16);
        }
        let customDimensions = undefined;
        if ((pageOperationId && dependencySpanId && pageOperationId != this.operationId) || errorMessage) {
            customDimensions = {};
            if (pageOperationId && dependencySpanId && pageOperationId != this.operationId) {
                // if the request has a different operation.id - add it as a link to the emitted dependency telemetry
                customDimensions["_MS.links"] = [
                    {
                        operation_Id: pageOperationId,
                        id: dependencySpanId,
                    },
                ];
            }
            if (errorMessage) {
                customDimensions["errorMessage"] = errorMessage;
            }
        }
        if (!dependencySpanId || pageOperationId != this.operationId) {
            dependencySpanId = Util_1.default.w3cSpanId();
        }
        this.telemetryClient.trackDependency({
            name: `${method} ${depUrl.pathname}`,
            id: dependencySpanId,
            resultCode: resultCode,
            dependencyTypeName: "HTTP",
            success: resultCode >= 100 && resultCode < 400,
            data: dependencyUrl.toString(),
            time: timing.startTime > 0 ? new Date(timing.startTime) : new Date(),
            duration: Math.max(1, timing.domainLookupStart, timing.domainLookupEnd, timing.connectStart, timing.connectEnd, timing.secureConnectionStart, timing.requestStart, timing.responseStart, timing.responseEnd),
            target: depUrl.host.toString(),
            properties: customDimensions,
            tagOverrides: {
                "ai.operation.id": this.operationId,
                "ai.operation.parentId": this.pageViewSpanId,
            },
        });
        (_a = this.options) === null || _a === void 0 ? void 0 : _a.log(`Dependency reported:`, `id: ${dependencySpanId} operation.id: ${this.operationId} parentId: ${this.pageViewSpanId}`, dependencyUrl);
    }
    trackPageView() {
        var _a;
        if (!this.isPageViewReported) {
            this.isPageViewReported = true;
            let dependencyTelemetry = {
                id: this.pageViewSpanId,
                name: "PAGE: " + this.host,
                data: this.page.url(),
                time: this.openedAt,
                duration: new Date().getTime() - this.openedAt.getTime(),
                success: this.isSuccess || true,
                resultCode: 200,
                dependencyTypeName: "InProc",
                target: this.host,
                tagOverrides: {
                    "ai.operation.id": this.operationId,
                    "ai.operation.parentId": this.parentSpanId,
                },
            };
            if (this.errorMessage) {
                dependencyTelemetry.properties = {
                    errorMessage: this.errorMessage,
                };
            }
            this.telemetryClient.trackDependency(dependencyTelemetry);
            (_a = this.options) === null || _a === void 0 ? void 0 : _a.log(`Page view reported:`, `id: ${this.pageViewSpanId} operation.id: ${this.operationId} parentId: ${this.parentSpanId}`, this.page.url());
        }
    }
    frameNavigatedEvent(frame) {
        var _a;
        try {
            this.host = undefined;
            let pageUrl = this.page.url();
            if (pageUrl && pageUrl.length > 0) {
                let nowHost = new URL(pageUrl).host;
                if (nowHost != this.host) {
                    this.host = nowHost;
                }
            }
        }
        catch (e) {
            (_a = this.options) === null || _a === void 0 ? void 0 : _a.error("Failed to update page URL:", e);
        }
    }
    getTraceParentHeaderValue(request) {
        var _a;
        const headers = request.headers();
        let traceparent = undefined;
        if (headers[PageInsights.traceparentHeaderName]) {
            traceparent = headers[PageInsights.traceparentHeaderName];
        }
        else if (PageInsights.requestIdHeaderName) {
            ((_a = headers[PageInsights.requestIdHeaderName]) === null || _a === void 0 ? void 0 : _a.replace("|", "00-").replace(".", "-")) + "-01";
        }
        return traceparent;
    }
    urlIsApplicationInsights(url) {
        if (url.indexOf("in.applicationinsights") > 0 || url.indexOf("dc.services.visualstudio") > 0) {
            // don't track AppInsights as a dependency
            return true;
        }
        return false;
    }
    static getPageContext(page, telemetryClient, operationId, parentSpanId, options) {
        let pcObj = page[PageInsights.pageInsightsAttachedPropertyName];
        if (pcObj) {
            var pic = page[PageInsights.pageInsightsAttachedPropertyName];
            if (pic) {
                return pic;
            }
        }
        if (telemetryClient && page.url && operationId && parentSpanId) {
            let pageOptions = undefined;
            if (options) {
                pageOptions = {
                    log: options.log,
                    error: options.error,
                };
            }
            let newPageContext = new PageInsights(telemetryClient, page, operationId, parentSpanId, pageOptions);
            return newPageContext;
        }
        return undefined;
    }
}
exports.PageInsights = PageInsights;
PageInsights.pageInsightsAttachedPropertyName = "_pageInsights";
PageInsights.traceparentHeaderName = "traceparent";
PageInsights.requestIdHeaderName = "Request-Id";
//# sourceMappingURL=PageInsights.js.map