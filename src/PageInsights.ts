import * as PW from "playwright";
import aiUtil from "applicationinsights/out/Library/Util";
import * as AppInsights from "applicationinsights";
import { SharedOptions } from "./SharedOptions";

export interface PageInsightsOptions extends SharedOptions {}

export class PageInsights {
  public page: PW.Page;
  public operationId: string; // "Operation" or "Trace" ID, representing the entire availability test
  public parentSpanId: string; // Span ID grouping a set of page tests
  public pageViewSpanId: string; // Span ID grouping this page's activities
  public openedAt: Date;
  public errorMessage?: string;
  public isSuccess?: boolean;
  public instrumented = false;
  public host?: string;
  public isPageViewReported = false;

  private telemetryClient: AppInsights.TelemetryClient;
  private options: PageInsightsOptions;
  static readonly pageInsightsAttachedPropertyName = "_pageInsights";
  static readonly traceparentHeaderName = "traceparent";
  static readonly requestIdHeaderName = "Request-Id";

  private constructor(telemetryClient: AppInsights.TelemetryClient, page: PW.Page, operationId: string, parentSpanId: string, options?: PageInsightsOptions) {
    this.telemetryClient = telemetryClient;
    this.page = page;
    this.operationId = operationId;
    this.pageViewSpanId = aiUtil.w3cSpanId();
    this.parentSpanId = parentSpanId;
    this.openedAt = new Date();

    if (options) {
      this.options = options;
    } else {
      this.options = {
        log: () => {},
        error: console.error,
      };
    }

    if ((<any>page)[PageInsights.pageInsightsAttachedPropertyName]) {
      throw "Unexpected: Page is already instrumented";
    }
    // attach this object to the page
    (<any>page)[PageInsights.pageInsightsAttachedPropertyName] = this;

    let pageUrl = page.url();
    if (pageUrl && pageUrl.length > 0) {
      this.host = new URL(pageUrl).host;
    }

    page.route("**/*", (r) => this.pageRoute(r));
    page.on("framenavigated", (frame: PW.Frame) => this.frameNavigatedEvent(frame));
    page.on("requestfinished", (req) => this.pageRequestFinished(req));
    page.on("requestfailed", (req) => this.pageRequestFailed(req));

    let pageClose = page.close;
    let _self = this;
    page.close = async function close(params: any) {
      console.log("page closing", page.url());
      await _self.closePage();
      await pageClose.apply(page);
    };

    this.instrumented = true;
  }

  async closePage(): Promise<void> {
    if (this.instrumented) {
      console.log("Page closing", this.host);
      // TODO: removeListeners here
      this.instrumented = false;
      this.trackPageView();
    }
  }

  failTest(errorMessage: string) {
    this.isSuccess = false;
    this.errorMessage = errorMessage;
  }

  private pageRoute(route: PW.Route): Promise<void> {
    const request = route.request();
    if (this.urlIsApplicationInsights(request.url())) {
      return route.continue();
    }

    let headers = request.headers();
    if (!headers[PageInsights.traceparentHeaderName] && !headers[PageInsights.requestIdHeaderName]) {
      // if the request had no trace context - add the availability test's context in w3c format
      let dependencySpanId = aiUtil.w3cSpanId();
      headers[PageInsights.traceparentHeaderName] = `00-${this.operationId}-${dependencySpanId}-01`;
      this.options?.log("Added 'traceparent' header:", headers[PageInsights.traceparentHeaderName]);
      return route.continue({ headers });
    }
    return route.continue();
  }

  private async pageRequestFinished(request: PW.Request) {
    if (this.urlIsApplicationInsights(request.url())) {
      return;
    }

    try {
      let statusCode = 898;
      try {
        let response = await request.response();
        statusCode = response?.status() || 899;
      } catch {}

      const traceparent = this.getTraceParentHeaderValue(request);

      this.trackPageDependency(request.method(), request.url(), statusCode, request.timing(), traceparent, request.failure()?.errorText);
    } catch (r) {
      this.options?.error("Failed dependency tracking", r);
    }
  }

  private pageRequestFailed(request: PW.Request) {
    if (this.urlIsApplicationInsights(request.url())) {
      return;
    }
    this.options?.log("Request failed", request.url(), request.failure(), request.timing());
    const traceparent = this.getTraceParentHeaderValue(request);
    this.trackPageDependency(request.method(), request.url(), 999, request.timing(), traceparent, request.failure()?.errorText);
  }

  private trackPageDependency(method: string, dependencyUrl: string, resultCode: number, timing: TimingData, traceparent?: string, errorMessage?: string) {
    if (this.urlIsApplicationInsights(dependencyUrl)) {
      return;
    }

    let depUrl = new URL(dependencyUrl);
    let pageOperationId: string | undefined = undefined;
    let dependencySpanId: string | undefined = undefined;

    // if there's traceparent header - take the operation/span ids from it; in most cases it would have been added during page.route(...) handling
    if (traceparent && traceparent.length > 53) {
      pageOperationId = traceparent?.substr(3, 32);
      dependencySpanId = traceparent?.substr(36, 16);
    }

    let customDimensions: { [key: string]: any } | undefined = undefined;
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
      dependencySpanId = aiUtil.w3cSpanId();
    }

    this.telemetryClient.trackDependency({
      name: `${method} ${depUrl.pathname}`,
      id: dependencySpanId,
      resultCode: resultCode,
      dependencyTypeName: "HTTP",
      success: resultCode >= 100 && resultCode < 400,
      data: dependencyUrl.toString(),
      time: timing.startTime > 0 ? new Date(timing.startTime) : new Date(),
      duration: Math.max(
        1,
        timing.domainLookupStart,
        timing.domainLookupEnd,
        timing.connectStart,
        timing.connectEnd,
        timing.secureConnectionStart,
        timing.requestStart,
        timing.responseStart,
        timing.responseEnd
      ),
      target: depUrl.host.toString(),
      properties: customDimensions,
      tagOverrides: {
        "ai.operation.id": this.operationId,
        "ai.operation.parentId": this.pageViewSpanId,
      },
    });

    this.options?.log(`Dependency reported:`, `id: ${dependencySpanId} operation.id: ${this.operationId} parentId: ${this.pageViewSpanId}`, dependencyUrl);
  }

  trackPageView() {
    if (!this.isPageViewReported) {
      this.isPageViewReported = true;

      let dependencyTelemetry: AppInsights.Contracts.DependencyTelemetry & AppInsights.Contracts.Identified = {
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

      this.options?.log(`Page view reported:`, `id: ${this.pageViewSpanId} operation.id: ${this.operationId} parentId: ${this.parentSpanId}`, this.page.url());
    }
  }

  private frameNavigatedEvent(frame: PW.Frame) {
    try {
      this.host = undefined;
      let pageUrl = this.page.url();
      if (pageUrl && pageUrl.length > 0) {
        let nowHost = new URL(pageUrl).host;
        if (nowHost != this.host) {
          this.host = nowHost;
        }
      }
    } catch (e) {
      this.options?.error("Failed to update page URL:", e);
    }
  }

  private getTraceParentHeaderValue(request: PW.Request): string | undefined {
    const headers = request.headers();
    let traceparent: string | undefined = undefined;
    if (headers[PageInsights.traceparentHeaderName]) {
      traceparent = headers[PageInsights.traceparentHeaderName];
    } else if (PageInsights.requestIdHeaderName) {
      headers[PageInsights.requestIdHeaderName]?.replace("|", "00-").replace(".", "-") + "-01";
    }
    return traceparent;
  }

  private urlIsApplicationInsights(url: string): boolean {
    if (url.indexOf("in.applicationinsights") > 0 || url.indexOf("dc.services.visualstudio") > 0) {
      // don't track AppInsights as a dependency
      return true;
    }
    return false;
  }

  static getPageContext(
    page: PW.Page,
    telemetryClient?: AppInsights.TelemetryClient,
    operationId?: string,
    parentSpanId?: string,
    options?: SharedOptions
  ): PageInsights | undefined {
    let pcObj = (<any>page)[PageInsights.pageInsightsAttachedPropertyName];
    if (pcObj) {
      var pic = <PageInsights>(<any>page)[PageInsights.pageInsightsAttachedPropertyName];
      if (pic) {
        return pic;
      }
    }

    if (telemetryClient && page.url && operationId && parentSpanId) {
      let pageOptions: PageInsightsOptions | undefined = undefined;
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

interface TimingData {
  startTime: number;
  domainLookupStart: number;
  domainLookupEnd: number;
  connectStart: number;
  secureConnectionStart: number;
  connectEnd: number;
  requestStart: number;
  responseStart: number;
  responseEnd: number;
}
