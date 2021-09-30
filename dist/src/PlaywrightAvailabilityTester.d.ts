import * as PW from "playwright";
import * as AppInsights from "applicationinsights";
import { SharedOptions } from "./SharedOptions";
import { StorageClient } from "./StorageClient";
export interface PlaywrightAvailabilityTesterOptions extends SharedOptions {
    telemetryClient?: AppInsights.TelemetryClient;
    telemetryClientConnectionString?: string;
    logDebugToTelemetryClient?: boolean;
    storageClient?: StorageClient;
    storageClientConnectionString?: string;
    disableTrace?: boolean;
    disableHar?: boolean;
}
export declare class PlaywrightAvailabilityTester {
    availabilityTestSpanId: string;
    availabilityTestOperationId: string;
    testName: string;
    runLocation: string;
    telemetryClient?: AppInsights.TelemetryClient;
    private storageClient?;
    private options?;
    constructor(options?: PlaywrightAvailabilityTesterOptions);
    traceFilePath(): string;
    harFilePath(): string;
    initBrowser(browser: PW.Browser): void;
    initBrowserContext(browserContext: PW.BrowserContext, page?: PW.Page): void;
    static failPageTest(page: PW.Page, errorMessage: string): void;
    static failAvailabilityTest(browserContext: PW.BrowserContext, errorMessage: string): void;
}
