import * as PW from "playwright";
import * as AppInsights from "applicationinsights";
import { SharedOptions } from "./SharedOptions";
export interface PageInsightsOptions extends SharedOptions {
}
export declare class PageInsights {
    page: PW.Page;
    operationId: string;
    parentSpanId: string;
    pageViewSpanId: string;
    openedAt: Date;
    errorMessage?: string;
    isSuccess?: boolean;
    instrumented: boolean;
    host?: string;
    isPageViewReported: boolean;
    private telemetryClient;
    private options;
    static readonly pageInsightsAttachedPropertyName = "_pageInsights";
    static readonly traceparentHeaderName = "traceparent";
    static readonly requestIdHeaderName = "Request-Id";
    private constructor();
    closePage(): Promise<void>;
    failTest(errorMessage: string): void;
    private pageRoute;
    private pageRequestFinished;
    private pageRequestFailed;
    private trackPageDependency;
    trackPageView(): void;
    private frameNavigatedEvent;
    private getTraceParentHeaderValue;
    private urlIsApplicationInsights;
    static getPageContext(page: PW.Page, telemetryClient?: AppInsights.TelemetryClient, operationId?: string, parentSpanId?: string, options?: SharedOptions): PageInsights | undefined;
}
