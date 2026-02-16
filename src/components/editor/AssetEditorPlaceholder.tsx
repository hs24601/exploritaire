export function AssetEditorPlaceholder({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <div className="relative bg-game-bg-dark border border-game-teal/40 rounded-lg p-4 w-full h-full overflow-hidden text-game-white menu-text">
      <div className="text-xs text-game-teal tracking-[4px] mb-3">{title}</div>
      <div className="h-[calc(100%-1.75rem)] border border-game-teal/20 rounded p-4 bg-game-bg-dark/40 flex flex-col items-center justify-center text-center">
        <div className="text-[11px] tracking-[2px] text-game-gold mb-2">{subtitle}</div>
        <div className="text-[10px] text-game-white/60 max-w-[560px]">
          Placeholder scaffold is active. This pane is ready for editor modules and shared save pipelines.
        </div>
      </div>
    </div>
  );
}
