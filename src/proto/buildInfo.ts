import build from 'virtual:proto-build';

const formatTime = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

export const PROTO_BUILD_COMMIT = build.commit;
const buildDate = new Date(build.startedAt);
export const PROTO_BUILD_LABEL = [buildDate.getMonth() + 1, buildDate.getDate(), buildDate.getHours(), buildDate.getMinutes()]
  .map(value => String(value).padStart(2, '0')).join('');
export const PROTO_BUILD_TITLE = `Source ${build.revision}, commit ${build.commit}, built ${formatTime(build.startedAt)}`;
