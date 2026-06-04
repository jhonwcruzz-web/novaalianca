import React, { useState, useCallback, useRef, useEffect } from 'react';

interface ResizableHeaderProps {
    children: React.ReactNode;
    initialWidth?: number;
    minWidth?: number;
    className?: string;
}

export default function ResizableHeader({
    children,
    initialWidth = 150,
    minWidth = 50,
    className = ""
}: ResizableHeaderProps) {
    const [width, setWidth] = useState(initialWidth);
    const isResizing = useRef(false);

    const startResizing = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        isResizing.current = true;
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', stopResizing);
        document.body.style.cursor = 'col-resize';
    }, []);

    const stopResizing = useCallback(() => {
        isResizing.current = false;
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', stopResizing);
        document.body.style.cursor = 'default';
    }, []);

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!isResizing.current) return;

        // Get the header element to calculate offset
        const header = document.getElementById(`resizable-th-${children?.toString()}`);
        if (header) {
            const newWidth = e.clientX - header.getBoundingClientRect().left;
            if (newWidth >= minWidth) {
                setWidth(newWidth);
            }
        }
    }, [children, minWidth]);

    // Clean up listeners
    useEffect(() => {
        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', stopResizing);
        };
    }, [handleMouseMove, stopResizing]);

    return (
        <th
            id={`resizable-th-${children?.toString()}`}
            style={{ width: `${width}px`, minWidth: `${width}px`, maxWidth: `${width}px` }}
            className={`relative group ${className} whitespace-nowrap overflow-hidden`}
        >
            <div className="truncate w-full px-4 py-3">
                {children}
            </div>

            {/* Resize Handle */}
            <div
                onMouseDown={startResizing}
                className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-brand-400/50 active:bg-brand-500 transition-colors z-10"
                title="Arraste para redimensionar"
            />
        </th>
    );
}
