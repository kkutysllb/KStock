/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** gateway 基地址，默认 ``http://localhost:18001``。打包态可覆盖。 */
  readonly VITE_GATEWAY_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
