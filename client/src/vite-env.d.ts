/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PORTHOLE_WS_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

