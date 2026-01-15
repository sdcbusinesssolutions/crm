/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly BRIDGE_DOMAIN?: string
}

interface ImportMeta {
    readonly env: ImportMetaEnv
}
