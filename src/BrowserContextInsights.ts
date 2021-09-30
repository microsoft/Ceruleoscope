import * as PW from "playwright";
import aiUtil from "applicationinsights/out/Library/Util";
import * as AppInsights from "applicationinsights";
import { SharedOptions } from "./SharedOptions";
import { PageInsights } from "./PageInsights";
import { StorageClient } from "./StorageClient";
import * as path from "path";
import * as os from "os";
import * as fs from "fs";

export interface BrowserContextInsightsOptions extends SharedOptions {
  operationId?: string;
  spanId?: string;
  page?: PW.Page;
  storageClient?: StorageClient;
  traceFileName?: string;
  harFilePath?: string;
}

export class BrowserContextInsights {
  static readonly browserContextInsightsAttachedPropertyName = "_browserContextInsights";

  public errorMessage: string | undefined;

  public availabilityTestSpanId: string;
  public availabilityTestOperationId: string;

  public startedAt: Date;
  public testName: string = "playwright-availability-test";
  public runLocation: string = "runLocation"; // TODO: get that from IMDS?

  public isAvailabilityResultReported = false;

  private traceFileName?: string = undefined;
  private harFilePath?: string = undefined;

  private storageClient?: StorageClient;

  private options?: BrowserContextInsightsOptions;

  constructor(private telemetryClient: AppInsights.TelemetryClient, public browserContext: PW.BrowserContext, options?: BrowserContextInsightsOptions) {
    this.options = options;
    this.storageClient = options?.storageClient;
    this.traceFileName = options?.traceFileName;
    this.harFilePath = options?.harFilePath;
    this.availabilityTestSpanId = options?.spanId || aiUtil.w3cSpanId();
    this.availabilityTestOperationId = options?.operationId || aiUtil.w3cTraceId();
    this.startedAt = new Date();

    browserContext.on("page", (page) => {
      this.attachToPage(page);
    });

    if (options?.page) {
      this.attachToPage(options?.page);
    }

    let _self = this;
    let tempContextClose = browserContext.close;
    browserContext.close = async () => {
      try {
        await Promise.all(
          browserContext.pages().map((pg) => {
            var pin = PageInsights.getPageContext(pg);
            pin?.trackPageView();
          })
        );
      } catch (x) {
        _self.options?.error("Failed to close pages on BrowserContext.close()", x);
      }

      await _self.trackAvailabilityResult();
      await tempContextClose.apply(browserContext);
    };
  }

  attachToPage(page: PW.Page) {
    let pgi = PageInsights.getPageContext(page);
    if (pgi == undefined) {
      pgi = PageInsights.getPageContext(page, this.telemetryClient, this.availabilityTestOperationId, this.availabilityTestSpanId, this.options);
    }
  }

  failPageTest(page: PW.Page | null, errorMessage: string) {
    this.errorMessage = ((this.errorMessage != undefined ? this.errorMessage : "") + "\n" + page?.url() + ": " + errorMessage).trim();

    if (page) {
      let pageContext = PageInsights.getPageContext(page);
      pageContext?.failTest(errorMessage);
    }
  }

  async trackAvailabilityResult() {
    if (!this.isAvailabilityResultReported) {
      this.isAvailabilityResultReported = true;
      let spanId = this.availabilityTestSpanId;

      let traceFileLink: string | undefined;
      let harFileLink: string | undefined;

      if (this.traceFileName) {
        let traceFilePath = path.join(os.tmpdir(), this.traceFileName);
        try {
          await this.browserContext.tracing.stop({ path: traceFilePath });
        } catch (tx) {
          this.options?.error("Trace file could not be obtained", tx);
        }
      }

      if (this.storageClient) {
        try {
          const blobContainerName = "playwright-insights";
          try {
            this.options?.log("Creating Storage container", blobContainerName);
            await this.storageClient.ensureContainerExists(blobContainerName);
          } catch (cx) {
            this.options?.error("Failed to ensure storage container exists", blobContainerName, cx);
          }

          let uploads: Promise<string>[] = [];

          if (this.traceFileName) {
            let traceFilePath = path.join(os.tmpdir(), this.traceFileName);
            if (fs.existsSync(traceFilePath)) {
              uploads.push(this.storageClient.uploadLocalFile(blobContainerName, this.traceFileName!, traceFilePath).then((link) => (traceFileLink = link)));
            }
          } else {
            this.options?.log("Trace file name not set");
          }

          if (this.harFilePath && fs.existsSync(this.harFilePath)) {
            uploads.push(
              this.storageClient.uploadLocalFile(blobContainerName, path.basename(this.harFilePath!), this.harFilePath).then((link) => (harFileLink = link))
            );
          } else {
            this.options?.log("HAR file name not set");
          }

          if (uploads?.length > 0) {
            this.options?.log("Uploading", uploads.length, uploads.length > 1 ? "files" : "file");
            let uploadResults = await Promise.all(uploads);
            this.options?.log("Uploaded", ...uploadResults);
          }
        } catch (sx) {
          this.options?.error("Trace/HAR file storage error", sx);
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

      this.options?.log("Flushing telemetry");
      await new Promise((resolve, reject) => {
        this.telemetryClient.flush({
          callback: (v) => {
            resolve(v);
          },
        });
      });

      process.once("beforeExit", async () => await new Promise((resolve) => setTimeout(resolve, 200)));

      this.options?.log(
        `Availability result reported:`,
        `id: ${spanId} operation.id: ${this.availabilityTestOperationId} parentId: ${this.availabilityTestSpanId}`,
        this.testName,
        this.errorMessage || "OK"
      );
    }
  }
}
