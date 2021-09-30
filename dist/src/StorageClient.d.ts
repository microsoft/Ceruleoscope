import { SharedOptions } from "./SharedOptions";
export interface StorageClientOptions extends SharedOptions {
    connectionString: string;
}
export declare class StorageClient {
    private options;
    private blobService?;
    uploadLocalFile(containerName: string, blobName: string, localFileName: string): Promise<string>;
    ensureContainerExists(containerName: string): Promise<string>;
    constructor(options: StorageClientOptions);
    hostName(): string;
}
