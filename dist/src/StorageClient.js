"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StorageClient = void 0;
const azStorage = __importStar(require("azure-storage"));
class StorageClient {
    constructor(options) {
        this.options = options;
        if (options.connectionString != "") {
            this.blobService = azStorage.createBlobService(options.connectionString);
        }
        else {
            this.blobService = undefined;
        }
    }
    uploadLocalFile(containerName, blobName, localFileName) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                this.blobService.createBlockBlobFromLocalFile(containerName, blobName, localFileName, (err, result, response) => {
                    if (err) {
                        this.options.error("Failed to upload file:", blobName, "Error:", err);
                        reject(err);
                    }
                    else {
                        let fileLink = this.hostName() + containerName + "/" + blobName;
                        this.options.log("Uploaded file", fileLink);
                        resolve(fileLink);
                    }
                });
            });
        });
    }
    ensureContainerExists(containerName) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                this.blobService.createContainerIfNotExists(containerName, {}, (err, result, response) => {
                    if (err) {
                        console.error("Failed to create container", containerName, "Error:", err);
                        reject(err);
                    }
                    else {
                        resolve(this.hostName() + containerName);
                    }
                });
            });
        });
    }
    hostName() {
        return this.blobService.host.primaryHost;
    }
}
exports.StorageClient = StorageClient;
//# sourceMappingURL=StorageClient.js.map