import { memo, type CSSProperties, type ReactNode, type Ref } from 'react';

interface InteractionScreenProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  dataBiomeUi?: boolean;
  containerRef?: Ref<HTMLDivElement>;
}

export const InteractionScreen = memo(function InteractionScreen({
  children,
  className,
  style,
  dataBiomeUi = false,
  containerRef,
}: InteractionScreenProps) {
  return (
    <div
      className={className}
      style={style}
      data-biome-ui={dataBiomeUi || undefined}
      ref={containerRef}
    >
      {children}
    </div>
  );
});
