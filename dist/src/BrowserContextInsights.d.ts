import * as PW from "playwright";
import * as AppInsights from "applicationinsights";
import { SharedOptions } from "./SharedOptions";
import { StorageClient } from "./StorageClient";
export interface BrowserContextInsightsOptions extends SharedOptions {
    operationId?: string;
    spanId?: string;
    page?: PW.Page;
    storageClient?: StorageClient;
    traceFileName?: string;
    harFilePath?: string;
}
export declare class BrowserContextInsights {
    private telemetryClient;
    browserContext: PW.BrowserContext;
    static readonly browserContextInsightsAttachedPropertyName = "_browserContextInsights";
    errorMessage: string | undefined;
    availabilityTestSpanId: string;
    availabilityTestOperationId: string;
    startedAt: Date;
    testName: string;
    runLocation: string;
    isAvailabilityResultReported: boolean;
    private traceFileName?;
    private harFilePath?;
    private storageClient?;
    private options?;
    constructor(telemetryClient: AppInsights.TelemetryClient, browserContext: PW.BrowserContext, options?: BrowserContextInsightsOptions);
    attachToPage(page: PW.Page): void;
    failPageTest(page: PW.Page | null, errorMessage: string): void;
    trackAvailabilityResult(): Promise<void>;
}
