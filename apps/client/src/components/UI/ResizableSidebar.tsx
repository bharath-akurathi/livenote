import { useState, useRef, useEffect, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  initialWidth?: number;
  minWidth?: number;
  maxWidth?: number;
  className?: string;
  /** Which side is the resizer handle on? Use 'left' for right-side panels. */
  side?: 'left' | 'right'; 
}

export function ResizableSidebar({ 
  children, 
  initialWidth = 320, 
  minWidth = 200, 
  maxWidth = 600,
  className = '',
  side = 'left' 
}: Props) {
  const [width, setWidth] = useState(initialWidth);
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    startXRef.current = e.clientX;
    startWidthRef.current = sidebarRef.current?.getBoundingClientRect().width || width;
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const deltaX = e.clientX - startXRef.current;
      
      let newWidth;
      if (side === 'left') {
        // If resizer is on left edge, moving mouse left (negative delta) increases width
        newWidth = startWidthRef.current - deltaX;
      } else {
        // If resizer is on right edge, moving mouse right (positive delta) increases width
        newWidth = startWidthRef.current + deltaX;
      }
      
      setWidth(Math.min(Math.max(newWidth, minWidth), maxWidth));
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'col-resize';
    } else {
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [isResizing, minWidth, maxWidth, side]);

  return (
    <div 
      ref={sidebarRef}
      style={{ width }} 
      className={`relative flex-shrink-0 flex flex-col ${className}`}
    >
      {/* Resizer Handle */}
      <div 
        className={`absolute top-0 bottom-0 w-2 hover:bg-brand-500/50 cursor-col-resize z-10 transition-colors ${
          isResizing ? 'bg-brand-500/50' : 'bg-transparent'
        } ${side === 'left' ? '-left-1' : '-right-1'}`}
        onMouseDown={handleMouseDown}
      />
      {children}
    </div>
  );
}
