import { SharedOptions } from "./SharedOptions";
export interface PlaywrightTestLauncherOptions extends SharedOptions {
    addParameters?: string;
}
export declare class PlaywrightTestLauncher {
    static Run(options?: PlaywrightTestLauncherOptions): Promise<string>;
}
