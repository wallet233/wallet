import React, { CSSProperties } from "react";
import "../../styles/globals.css";

interface PageContainerProps {
  children: React.ReactNode;
  style?: CSSProperties; 
}

export default function PageContainer({ children, style }: PageContainerProps) {
  return (
    <main
      className="page-container page-enter"
      style={{
        maxWidth: '100%',
        padding: 'var(--space-md)',
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        ...style // merge with passed styles
      }}
    >
      {children}
    </main>
  );
}
