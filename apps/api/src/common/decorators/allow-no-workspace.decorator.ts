import { SetMetadata } from '@nestjs/common';

export const ALLOW_NO_WORKSPACE_KEY = 'allowNoWorkspace';
export const AllowNoWorkspace = () => SetMetadata(ALLOW_NO_WORKSPACE_KEY, true);
