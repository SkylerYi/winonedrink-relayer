/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PRIVY_APP_ID: string;
  readonly VITE_BACKEND_URL: string;
  readonly VITE_POLY_BUILDER_CODE: string;
  readonly VITE_BUILDER_TAKER_BPS: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
