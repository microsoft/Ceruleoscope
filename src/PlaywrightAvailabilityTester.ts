import * as PW from "playwright";
import aiUtil from "applicationinsights/out/Library/Util";
import * as AppInsights from "applicationinsights";
import { SharedOptions } from "./SharedOptions";
import { BrowserContextInsights, BrowserContextInsightsOptions } from "./BrowserContextInsights";
import { StorageClient, StorageClientOptions } from "./StorageClient";
import * as path from "path";
import * as os from "os";

export interface PlaywrightAvailabilityTesterOptions extends SharedOptions {
  // telemetry client priority: telemetryClient -> telemetryClientConnectionString -> appInsights.defaultClient -> new telemetryClient() using env var
  telemetryClient?: AppInsights.TelemetryClient;
  telemetryClientConnectionString?: string;
  logDebugToTelemetryClient?: boolean;

  // storageClient used if present, otherwise constructed; if storageClientConnectionString is empty, use env var AzureWebJobsStorage
  storageClient?: StorageClient;
  storageClientConnectionString?: string;
  disableTrace?: boolean;
  disableHar?: boolean;
}

// Hooks into Playwright's Browser, so that all BrowserContext and Page objects are instrumented to emit telemetry
// Call `.initBrowser(browser)` to instrument the Browser object
// Call `.failPageTest(page, errorMessage)` to indicate a failed availability test, as it is assumed to be successful
// Call `.failAvailabilityTest(browserContext, errorMessage)` to fail the availability test for reasons unrelated to page behavior (unexpected exceptions etc)

export class PlaywrightAvailabilityTester {
  public availabilityTestSpanId: string;
  public availabilityTestOperationId: string;

  public testName: string = "";
  public runLocation: string = "";
  public telemetryClient?: AppInsights.TelemetryClient;
  private storageClient?: StorageClient;

  private options?: PlaywrightAvailabilityTesterOptions;

  constructor(options?: PlaywrightAvailabilityTesterOptions) {
    this.options = options;

    if (options?.logDebugToTelemetryClient) {
      options.log = (...args: any[]) =>
        this.telemetryClient?.trackTrace({
          message: args.join(" "),
          properties: {
            emittedBy: "PWAFAT",
          },
          tagOverrides: {
            "ai.operation.id": this.availabilityTestOperationId,
            "ai.operation.parentId": this.availabilityTestSpanId,
          },
        });

      options.error = (...args: any[]) => {
        console.error(...args);
        let err = new Error(args.join(" "));
        this.telemetryClient?.trackException({
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

    if (options?.telemetryClient) {
      this.telemetryClient = options.telemetryClient;
    } else if (options?.telemetryClientConnectionString) {
      this.telemetryClient = new AppInsights.TelemetryClient(options?.telemetryClientConnectionString);
    } else if (AppInsights.defaultClient) {
      this.telemetryClient = AppInsights.defaultClient;
    } else {
      // using environment variable APPINSIGHTS_INSTRUMENTATIONKEY if the value in options is undefined
      this.telemetryClient = new AppInsights.TelemetryClient();
    }

    if (options?.disableTrace != true || options?.disableHar != true) {
      if (options?.storageClient) {
        this.storageClient = options.storageClient;
      } else if (options?.storageClientConnectionString || process.env.AzureWebJobsStorage) {
        let storageClientOptions: StorageClientOptions = {
          connectionString: (options?.storageClientConnectionString ? options.storageClientConnectionString : process.env.AzureWebJobsStorage)!,
          log: options?.log ? options.log : () => {},
          error: options?.error ? options.error : console.error,
        };

        this.storageClient = new StorageClient(storageClientOptions);
      }
    }

    this.availabilityTestOperationId = aiUtil.w3cTraceId();
    this.availabilityTestSpanId = aiUtil.w3cSpanId();

    options?.log("Telemetry:", this.telemetryClient?.config.endpointUrl, "Storage:", this.storageClient?.hostName());
  }

  public traceFilePath() {
    return `PlaywrightTrace.${this.availabilityTestSpanId}.zip`;
  }

  public harFilePath() {
    return path.join(os.tmpdir(), `PlaywrightHAR.${this.availabilityTestSpanId}.har`);
  }

  public initBrowser(browser: PW.Browser): void {
    // check if this browser object is already instrumented
    if ((<any>browser)["_pwafat_attached"]) {
      return;
    }
    (<any>browser)["_pwafat_attached"] = true;

    const tester = this;
    let harFilePath = this.harFilePath();

    // replace the Browser.newContext function
    // TODO: see if it can be done to Browser.prototype
    let tempNewContext = browser.newContext;
    browser.newContext = async function (options?: PW.BrowserContextOptions) {
      // create the context
      if (tester.options?.disableHar != true) {
        if (options) {
          if (options.recordHar) {
            options.recordHar.path = harFilePath;
          } else {
            options.recordHar = {
              path: harFilePath,
            };
          }
        } else {
          options = { recordHar: { path: harFilePath } };
        }
      }
      let attachContext = await tempNewContext.apply(this, [options]);

      // attach BrowserContextInsights to the new context
      tester.initBrowserContext(attachContext);

      return attachContext;
    };
  }

  public initBrowserContext(browserContext: PW.BrowserContext, page?: PW.Page) {
    if (!(<any>browserContext)[BrowserContextInsights.browserContextInsightsAttachedPropertyName]) {
      let bciOpt: BrowserContextInsightsOptions = {
        operationId: this.availabilityTestOperationId,
        spanId: this.availabilityTestSpanId,
        page: page,
        storageClient: this.options?.disableHar != true || this.options?.disableTrace != true ? this.storageClient : undefined,
        harFilePath: this.options?.disableHar != true ? this.harFilePath() : undefined,
        traceFileName: this.options?.disableTrace != true ? this.traceFilePath() : undefined,
        log: this.options?.log ? this.options?.log : () => {},
        error: this.options?.error ? this.options?.error : console.error,
      };

      let bci = new BrowserContextInsights(this.telemetryClient!, browserContext, bciOpt);

      if (this.options?.disableTrace != true) {
        if (this.storageClient) {
          browserContext.tracing.start({
            screenshots: true,
            snapshots: true,
            name: this.traceFilePath(),
          });
          this.options?.log("Started Playwright Trace");
        } else {
          this.options?.log("Playwright Trace will not be started");
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
        testName = process.env.APPSETTING_TESTNAME || process.env.APPSETTING_WEBSITE_SITE_NAME || "NO_TESTNAME";
      }
      bci.testName = testName;

      (<any>browserContext)[BrowserContextInsights.browserContextInsightsAttachedPropertyName] = bci;
    }
  }

  static failPageTest(page: PW.Page, errorMessage: string) {
    const browserContext = page.context();
    if ((<any>browserContext)[BrowserContextInsights.browserContextInsightsAttachedPropertyName]) {
      let browserContextInsights = <BrowserContextInsights>(<any>browserContext)[BrowserContextInsights.browserContextInsightsAttachedPropertyName];
      browserContextInsights?.failPageTest(page, errorMessage);
    }
  }

  // TODO: Review this method before publishing
  // It's odd to ask for a BrowserContext here
  static failAvailabilityTest(browserContext: PW.BrowserContext, errorMessage: string) {
    if ((<any>browserContext)[BrowserContextInsights.browserContextInsightsAttachedPropertyName]) {
      let browserContextInsights = <BrowserContextInsights>(<any>browserContext)[BrowserContextInsights.browserContextInsightsAttachedPropertyName];
      browserContextInsights?.failPageTest(null, errorMessage);
    }
  }
}
