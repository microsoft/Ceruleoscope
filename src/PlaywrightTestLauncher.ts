import { exec } from "child_process";
import { appInsightsAvailabilityTesterTag } from "./AppInsightsAvailabilityFixture";

export class PlaywrightTestLauncher {
  public static async Run(): Promise<string> {
    let responseMessage = "start";
    try {
      if (process.env.AZURE_FUNCTIONS_ENVIRONMENT != "Development") {
        if (!process.env.PLAYWRIGHT_BROWSERS_PATH || !process.env.PLAYWRIGHT_BROWSERS_PATH.startsWith("/home")) {
          console.error("PLAYWRIGHT_BROWSERS_PATH value not as expected:", process.env.PLAYWRIGHT_BROWSERS_PATH, "tests may not run");
        }
        if (!process.env.APPINSIGHTS_INSTRUMENTATIONKEY && !process.env.APPLICATIONINSIGHTS_CONNECTION_STRING) {
          console.error("AppInsights ikey and connection string not as set, telemetry will not be emitted");
        }
        if (!process.env.AzureWebJobsStorage) {
          console.error("AzureWebJobsStorage not set, test data will not be persisted in Azure Storage");
        }
      }

      let cmd = `${process.cwd()}/node_modules/.bin/playwright test`;

      console.log("Launching Playwright tests:", cmd);
      let output = await new Promise((resolve, reject) => {
        const p = exec(cmd, (error, stdout, stderr) => {
          resolve({ error, stdout, stderr });
        });
      });

      responseMessage = "done";

      if ((<any>output).error) {
        console.error((<any>output).error);
        responseMessage += "\r\nError running tests: " + JSON.stringify((<any>output).error, null, 2);
      }

      responseMessage += "\r\nSTDOUT: " + (<any>output).stdout;
      if ((<any>output).stderr) {
        responseMessage += "\r\nSTDERR: " + (<any>output).stderr;
      }

      if (responseMessage.indexOf(appInsightsAvailabilityTesterTag) < 0) {
        console.error("AppInsights Availability Fixture tag not found, check test's `require` statement");
      }
    } catch (x) {
      console.error("Error runnning Playwright tests", x);
      responseMessage += "\r\n" + JSON.stringify(x, null, 2);
    }

    return responseMessage;
  }
}
