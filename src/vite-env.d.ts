/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY?: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string;
  readonly VITE_FIREBASE_PROJECT_ID?: string;
  readonly VITE_FIREBASE_APP_ID?: string;
  readonly VITE_AUDIT_API_URL?: string;
  readonly VITE_ADMIN_API_URL?: string;
  readonly VITE_AUDIT_SHEET_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
