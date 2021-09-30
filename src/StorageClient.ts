import * as azStorage from "azure-storage";
import { SharedOptions } from "./SharedOptions";

export interface StorageClientOptions extends SharedOptions {
  connectionString: string;
}

export class StorageClient {
  private blobService?: azStorage.BlobService;

  public async uploadLocalFile(containerName: string, blobName: string, localFileName: string): Promise<string> {
    return new Promise((resolve, reject) => {
      this.blobService!.createBlockBlobFromLocalFile(containerName, blobName, localFileName, (err, result, response) => {
        if (err) {
          this.options.error("Failed to upload file:", blobName, "Error:", err);
          reject(err);
        } else {
          let fileLink = this.hostName() + containerName + "/" + blobName;
          this.options.log("Uploaded file", fileLink);
          resolve(fileLink);
        }
      });
    });
  }

  public async ensureContainerExists(containerName: string): Promise<string> {
    return new Promise((resolve, reject) => {
      this.blobService!.createContainerIfNotExists(containerName, {}, (err, result, response) => {
        if (err) {
          console.error("Failed to create container", containerName, "Error:", err);
          reject(err);
        } else {
          resolve(this.hostName() + containerName);
        }
      });
    });
  }

  constructor(private options: StorageClientOptions) {
    if (options.connectionString != "") {
      this.blobService = azStorage.createBlobService(options.connectionString);
    } else {
      this.blobService = undefined;
    }
  }

  public hostName(): string {
    return this.blobService!.host.primaryHost;
  }
}
