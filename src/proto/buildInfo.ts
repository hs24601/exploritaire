// Injected by vite.config.ts. Fallback keeps tests and tools that skip Vite's define working.
const build = typeof __PROTO_BUILD__ === 'undefined' ? { commit: 'dev', committedAt: '', startedAt: '' } : __PROTO_BUILD__;

const formatTime = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export const PROTO_BUILD_COMMIT = build.commit;
export const PROTO_BUILD_LABEL = `Build ${build.commit}${build.committedAt ? ` · ${formatTime(build.committedAt)}` : ''}`;
export const PROTO_BUILD_TITLE = `Commit ${build.commit}${build.committedAt ? `, committed ${formatTime(build.committedAt)}` : ''}${build.startedAt ? `, server started ${formatTime(build.startedAt)}` : ''}`;
