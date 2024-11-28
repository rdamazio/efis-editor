import { GDRIVE_CLIENT_ID } from './dev-keys';

export const ENVIRONMENT = {
  production: false,

  // This client ID is defined in a gitignored file, and must be set by the developer locally.
  // See https://developers.google.com/drive/api/ for how to generate an OAuth client ID.
  googleDriveClientId: GDRIVE_CLIENT_ID,
};
