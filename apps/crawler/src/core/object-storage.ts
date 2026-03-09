import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { Client as MinioClient } from "minio";

export interface RawSnapshotStorage {
  ensureBucket(): Promise<void>;
  putObject(key: string, body: string, contentType: string): Promise<string>;
  getObject(key: string): Promise<string>;
}

class FileRawSnapshotStorage implements RawSnapshotStorage {
  constructor(private readonly rootDir: string) {}

  async ensureBucket() {
    await mkdir(this.rootDir, { recursive: true });
  }

  async putObject(key: string, body: string) {
    const target = path.join(this.rootDir, key);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, body, "utf8");
    return key;
  }

  async getObject(key: string) {
    return readFile(path.join(this.rootDir, key), "utf8");
  }
}

class MinioRawSnapshotStorage implements RawSnapshotStorage {
  private readonly client: MinioClient;
  private readonly bucket: string;

  constructor() {
    const endpoint = new URL(process.env.S3_ENDPOINT ?? "http://127.0.0.1:9000");

    this.client = new MinioClient({
      endPoint: endpoint.hostname,
      port: Number(endpoint.port || (endpoint.protocol === "https:" ? 443 : 80)),
      useSSL: endpoint.protocol === "https:",
      accessKey: process.env.S3_ACCESS_KEY ?? "minioadmin",
      secretKey: process.env.S3_SECRET_KEY ?? "minioadmin"
    });
    this.bucket = process.env.S3_BUCKET_RAW ?? "raw-snapshots";
  }

  async ensureBucket() {
    const exists = await this.client.bucketExists(this.bucket);
    if (!exists) {
      await this.client.makeBucket(this.bucket);
    }
  }

  async putObject(key: string, body: string, contentType: string) {
    await this.client.putObject(this.bucket, key, body, body.length, {
      "Content-Type": contentType
    });
    return key;
  }

  async getObject(key: string) {
    const stream = await this.client.getObject(this.bucket, key);
    const chunks: Buffer[] = [];

    return new Promise<string>((resolve, reject) => {
      stream.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
      stream.on("error", reject);
    });
  }
}

export function createRawSnapshotStorage(): RawSnapshotStorage {
  if (process.env.S3_ENDPOINT && process.env.S3_ACCESS_KEY && process.env.S3_SECRET_KEY) {
    return new MinioRawSnapshotStorage();
  }

  return new FileRawSnapshotStorage(path.resolve(process.cwd(), ".raw-snapshots"));
}
