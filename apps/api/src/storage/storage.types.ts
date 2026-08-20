export type StoredFile = {
  key: string;
  name: string;
  mime: string;
  size: number;
  url: string;
};

export type StorageDriver = 'local' | 'r2';

export type AttachmentPolicy = {
  maxSizeMb: number;
  allowedTypes: Array<'images' | 'pdf' | 'documents' | 'spreadsheets' | 'archives' | 'text'>;
};
