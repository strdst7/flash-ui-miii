/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useEffect, useRef, useState } from 'react';
import { Artifact, ViewportSize } from '../types';
import { XIcon, MonitorIcon, TabletIcon, PhoneIcon } from './Icons';

interface ArtifactCardProps {
    artifact: Artifact;
    isFocused: boolean;
    onClick: () => void;
    onClose?: () => void;
    theme?: 'light' | 'dark';
}

const ArtifactCard = React.memo(({ 
    artifact, 
    isFocused, 
    onClick,
    onClose,
    theme = 'dark'
}: ArtifactCardProps) => {
    const codeRef = useRef<HTMLPreElement>(null);
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const [viewport, setViewport] = useState<ViewportSize>('desktop');

    // Auto-scroll logic for this specific card
    useEffect(() => {
        if (codeRef.current) {
            codeRef.current.scrollTop = codeRef.current.scrollHeight;
        }
    }, [artifact.html]);

    // Inject theme into iframe
    useEffect(() => {
        const injectTheme = () => {
            if (iframeRef.current && iframeRef.current.contentDocument) {
                const doc = iframeRef.current.contentDocument;
                if (doc.documentElement) {
                    doc.documentElement.setAttribute('data-theme', theme);
                    // Also set color-scheme if possible
                    doc.documentElement.style.colorScheme = theme;
                }
            }
        };

        injectTheme();

        // Also listen for load event in case it's still loading
        const iframe = iframeRef.current;
        if (iframe) {
            iframe.addEventListener('load', injectTheme);
            return () => iframe.removeEventListener('load', injectTheme);
        }
    }, [theme, artifact.html]);

    const isBlurring = artifact.status === 'streaming';

    return (
        <div 
            className={`artifact-card ${isFocused ? 'focused' : ''} ${isBlurring ? 'generating' : ''}`}
            onClick={onClick}
        >
            <div className="artifact-header">
                <div className="artifact-header-left">
                    <span className="artifact-style-tag">{artifact.styleName}</span>
                </div>

                {isFocused && (
                    <div className="viewport-toggle">
                        <button 
                            className={`viewport-btn ${viewport === 'mobile' ? 'active' : ''}`}
                            onClick={(e) => { e.stopPropagation(); setViewport('mobile'); }}
                            title="Mobile view"
                        >
                            <PhoneIcon />
                        </button>
                        <button 
                            className={`viewport-btn ${viewport === 'tablet' ? 'active' : ''}`}
                            onClick={(e) => { e.stopPropagation(); setViewport('tablet'); }}
                            title="Tablet view"
                        >
                            <TabletIcon />
                        </button>
                        <button 
                            className={`viewport-btn ${viewport === 'desktop' ? 'active' : ''}`}
                            onClick={(e) => { e.stopPropagation(); setViewport('desktop'); }}
                            title="Desktop view"
                        >
                            <MonitorIcon />
                        </button>
                    </div>
                )}

                <div className="artifact-header-right">
                    {(isFocused && onClose) && (
                        <button 
                            className="artifact-close-button" 
                            onClick={(e) => {
                                e.stopPropagation();
                                onClose();
                            }}
                            aria-label="Close Focus Mode"
                        >
                            <XIcon />
                        </button>
                    )}
                </div>
            </div>
            <div className={`artifact-card-inner ${isFocused ? viewport : ''}`}>
                {isBlurring && (
                    <div className="generating-overlay">
                        <pre ref={codeRef} className="code-stream-preview">
                            {artifact.html}
                        </pre>
                    </div>
                )}
                <iframe 
                    ref={iframeRef}
                    srcDoc={artifact.html} 
                    title={artifact.id} 
                    sandbox="allow-scripts allow-forms allow-modals allow-popups allow-presentation allow-same-origin"
                    className="artifact-iframe"
                />
            </div>
        </div>
    );
});

export default ArtifactCard;