import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, extname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { AttachmentPolicy, StorageDriver, StoredFile } from './storage.types';

@Injectable()
export class StorageService {
  constructor(private readonly config: ConfigService) {}

  async upload(file: Express.Multer.File, policy?: AttachmentPolicy): Promise<StoredFile> {
    const maxSizeMb = policy?.maxSizeMb ?? this.config.get<number>('MAX_UPLOAD_SIZE_MB', 5);
    const maxSize = maxSizeMb * 1_024 * 1_024;
    if (file.size > maxSize) throw new BadRequestException(`File exceeds the ${maxSizeMb} MB limit`);
    if (!this.isAllowed(file.mimetype))
      throw new BadRequestException(`File type ${file.mimetype} is not allowed`);
    if (policy && !policy.allowedTypes.includes(this.category(file.mimetype))) {
      throw new BadRequestException(`File type ${file.mimetype} is disabled for this workspace`);
    }
    const driver = this.config.get<StorageDriver>('STORAGE_DRIVER', 'local');
    return driver === 'r2' ? this.uploadToR2(file) : this.uploadLocally(file);
  }

  private async uploadLocally(file: Express.Multer.File): Promise<StoredFile> {
    const directory = resolve(this.config.get<string>('STORAGE_LOCAL_PATH', 'uploads'));
    const key = this.createKey(file.originalname);
    const destination = resolve(directory, key);
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, file.buffer);

    const configuredUrl = this.config.get<string>('STORAGE_PUBLIC_URL');
    const apiUrl = this.config.get<string>('API_PUBLIC_URL', 'http://localhost:3000').replace(/\/$/, '');
    const publicUrl = (configuredUrl || `${apiUrl}/uploads`).replace(/\/$/, '');
    return this.result(file, key, `${publicUrl}/${key}`);
  }

  private async uploadToR2(file: Express.Multer.File): Promise<StoredFile> {
    const accountId = this.required('R2_ACCOUNT_ID');
    const accessKeyId = this.required('R2_ACCESS_KEY_ID');
    const secretAccessKey = this.required('R2_SECRET_ACCESS_KEY');
    const bucket = this.required('R2_BUCKET');
    const publicUrl = this.required('R2_PUBLIC_URL').replace(/\/$/, '');
    const key = this.createKey(file.originalname);
    const client = new S3Client({
      region: 'auto',
      endpoint: this.config.get<string>('R2_ENDPOINT') || `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    });
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
        ContentLength: file.size,
      }),
    );
    return this.result(file, key, `${publicUrl}/${key}`);
  }

  private createKey(originalName: string) {
    const extension = extname(originalName)
      .toLowerCase()
      .replace(/[^a-z0-9.]/g, '')
      .slice(0, 10);
    return `${new Date().toISOString().slice(0, 10)}/${randomUUID()}${extension}`;
  }

  private result(file: Express.Multer.File, key: string, url: string): StoredFile {
    return { key, name: file.originalname, mime: file.mimetype, size: file.size, url };
  }

  private required(name: string) {
    const value = this.config.get<string>(name);
    if (!value) throw new InternalServerErrorException(`${name} is required when STORAGE_DRIVER=r2`);
    return value;
  }

  private isAllowed(mime: string) {
    return (
      ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/avif'].includes(mime) ||
      [
        'application/pdf',
        'text/plain',
        'text/csv',
        'application/zip',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ].includes(mime)
    );
  }

  private category(mime: string): AttachmentPolicy['allowedTypes'][number] {
    if (mime.startsWith('image/')) return 'images';
    if (mime === 'application/pdf') return 'pdf';
    if (
      [
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ].includes(mime)
    ) {
      return 'documents';
    }
    if (
      [
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ].includes(mime)
    ) {
      return 'spreadsheets';
    }
    if (mime === 'application/zip') return 'archives';
    return 'text';
  }
}
