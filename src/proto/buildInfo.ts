import build from 'virtual:proto-build';

const formatTime = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

export const PROTO_BUILD_COMMIT = build.commit;
export const PROTO_BUILD_LABEL = `Build ${build.commit}.${build.revision} · ${formatTime(build.startedAt)}`;
export const PROTO_BUILD_TITLE = `Source ${build.revision}, commit ${build.commit}, built ${formatTime(build.startedAt)}`;
