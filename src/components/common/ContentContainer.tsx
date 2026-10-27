import React, { ReactNode } from 'react';

export interface ContentContainerProps {
  children: ReactNode;
  maxWidth?: number | string;
  className?: string;
  style?: React.CSSProperties;
}

export const ContentContainer: React.FC<ContentContainerProps> = ({
  children,
  maxWidth,
  className = '',
  style = {},
}) => {
  return (
    <div
      className={`content-container ${className}`.trim()}
      style={{
        maxWidth: maxWidth ? (typeof maxWidth === 'number' ? `${maxWidth}px` : maxWidth) : undefined,
        ...style,
      }}
    >
      {children}
    </div>
  );
};
