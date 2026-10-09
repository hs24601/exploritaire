/// <reference types="vite/client" />

declare const __PROTO_BUILD__: { commit: string; committedAt: string; startedAt: string };
declare module 'virtual:proto-build' {
  const build: { commit: string; revision: string; committedAt: string; startedAt: string };
  export default build;
}
