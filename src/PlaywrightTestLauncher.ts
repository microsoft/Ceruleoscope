import { exec } from "child_process";
import { SharedOptions } from "./SharedOptions";
import { appInsightsAvailabilityTesterTag } from "./AppInsightsAvailabilityFixture";

export interface PlaywrightTestLauncherOptions extends SharedOptions {
  addParameters?: string;
}
export class PlaywrightTestLauncher {
  public static async Run(options?: PlaywrightTestLauncherOptions): Promise<string> {
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
      if (options.addParameters && options?.addParameters.length > 0) {
        cmd += " " + options.addParameters;
      }

      options.log("Launching Playwright tests:", cmd);
      let output = await new Promise((resolve, reject) => {
        const p = exec(cmd, (error, stdout, stderr) => {
          resolve({ error, stdout, stderr });
        });
      });

      responseMessage = "done";

      if ((<any>output).error) {
        options.error((<any>output).error);
        responseMessage += "\r\nError running tests: " + JSON.stringify((<any>output).error, null, 2);
      }

      responseMessage += "\r\nSTDOUT: " + (<any>output).stdout;
      if ((<any>output).stderr) {
        responseMessage += "\r\nSTDERR: " + (<any>output).stderr;
      }

      if (responseMessage.indexOf(appInsightsAvailabilityTesterTag) < 0) {
        options.error("AppInsights Availability Fixture tag not found, check test's `require` statement");
      }
    } catch (x) {
      options.error("Error runnning Playwright tests", x);
      responseMessage += "\r\n" + JSON.stringify(x, null, 2);
    }

    return responseMessage;
  }
}
