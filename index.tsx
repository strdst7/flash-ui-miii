/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

//Vibe coded by ammaar@google.com

import React, { useState, useCallback, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import JSZip from 'jszip';
import { QRCodeCanvas } from 'qrcode.react';

import { Artifact, Session, ComponentVariation, LayoutOption } from './types';
import { INITIAL_PLACEHOLDERS } from './constants';
import { generateId } from './utils';

import DottedGlowBackground from './components/DottedGlowBackground';
import ArtifactCard from './components/ArtifactCard';
import SideDrawer from './components/SideDrawer';
import { 
    ThinkingIcon, 
    CodeIcon, 
    SparklesIcon, 
    ArrowLeftIcon, 
    ArrowRightIcon, 
    ArrowUpIcon, 
    GridIcon,
    HistoryIcon,
    RefreshCwIcon,
    SunIcon,
    MoonIcon,
    DownloadIcon,
    QrCodeIcon
} from './components/Icons';

function App() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSessionIndex, setCurrentSessionIndex] = useState<number>(-1);
  const [focusedArtifactIndex, setFocusedArtifactIndex] = useState<number | null>(null);
  const [artifactTheme, setArtifactTheme] = useState<'light' | 'dark'>('dark');
  const [showQrCode, setShowQrCode] = useState<boolean>(false);
  
  const [inputValue, setInputValue] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [placeholders, setPlaceholders] = useState<string[]>(INITIAL_PLACEHOLDERS);
  
  const [drawerState, setDrawerState] = useState<{
      isOpen: boolean;
      mode: 'code' | 'variations' | 'history' | null;
      title: string;
      data: any; 
  }>({ isOpen: false, mode: null, title: '', data: null });

  const [componentVariations, setComponentVariations] = useState<ComponentVariation[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);
  const gridScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
      inputRef.current?.focus();
  }, []);

  // Fix for mobile: reset scroll when focusing an item to prevent "overscroll" state
  useEffect(() => {
    if (focusedArtifactIndex !== null && window.innerWidth <= 1024) {
        if (gridScrollRef.current) {
            gridScrollRef.current.scrollTop = 0;
        }
        window.scrollTo(0, 0);
    }
  }, [focusedArtifactIndex]);

  // Cycle placeholders
  useEffect(() => {
      const interval = setInterval(() => {
          setPlaceholderIndex(prev => (prev + 1) % placeholders.length);
      }, 3000);
      return () => clearInterval(interval);
  }, [placeholders.length]);

  // Dynamic placeholder generation on load
  useEffect(() => {
      const fetchDynamicPlaceholders = async () => {
          try {
              const response = await fetch('/api/placeholders');
              if (!response.ok) return;
              const data = await response.json();
              const text = data.text || '[]';
              const jsonMatch = text.match(/\[[\s\S]*\]/);
              if (jsonMatch) {
                  const newPlaceholders = JSON.parse(jsonMatch[0]);
                  if (Array.isArray(newPlaceholders) && newPlaceholders.length > 0) {
                      const shuffled = newPlaceholders.sort(() => 0.5 - Math.random()).slice(0, 10);
                      setPlaceholders(prev => [...prev, ...shuffled]);
                  }
              }
          } catch (e) {
              console.warn("Silently failed to fetch dynamic placeholders", e);
          }
      };
      setTimeout(fetchDynamicPlaceholders, 1000);
  }, []);

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(event.target.value);
  };

  const handleGenerateVariations = useCallback(async () => {
    const currentSession = sessions[currentSessionIndex];
    if (!currentSession || focusedArtifactIndex === null) return;
    const currentArtifact = currentSession.artifacts[focusedArtifactIndex];

    setIsLoading(true);
    setComponentVariations([]);
    setDrawerState({ isOpen: true, mode: 'variations', title: 'Variations', data: currentArtifact.id });

    try {
        const response = await fetch('/api/variations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: currentSession.prompt })
        });

        if (!response.ok) throw new Error(`Server returned ${response.status}`);
        
        const reader = response.body?.getReader();
        if (!reader) throw new Error("Could not read response stream");

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            buffer += decoder.decode(value, { stream: true });
            
            // Re-use parseJsonStream logic but for a simple string buffer
            let braceCount = 0;
            let start = buffer.indexOf('{');
            while (start !== -1) {
                braceCount = 0;
                let end = -1;
                for (let i = start; i < buffer.length; i++) {
                    if (buffer[i] === '{') braceCount++;
                    else if (buffer[i] === '}') braceCount--;
                    if (braceCount === 0 && i > start) {
                        end = i;
                        break;
                    }
                }
                if (end !== -1) {
                    const jsonString = buffer.substring(start, end + 1);
                    try {
                        const variation = JSON.parse(jsonString);
                        if (variation.name && variation.html) {
                            setComponentVariations(prev => [...prev, variation]);
                        }
                        buffer = buffer.substring(end + 1);
                        start = buffer.indexOf('{');
                    } catch (e) {
                        start = buffer.indexOf('{', start + 1);
                    }
                } else {
                    break; 
                }
            }
        }
    } catch (e: any) {
        console.error("Error generating variations:", e);
    } finally {
        setIsLoading(false);
    }
  }, [sessions, currentSessionIndex, focusedArtifactIndex]);

  const handleGenerateVariant = useCallback(async () => {
    const currentSession = sessions[currentSessionIndex];
    if (!currentSession || focusedArtifactIndex === null || isLoading) return;

    const currentArtifact = currentSession.artifacts[focusedArtifactIndex];
    setIsLoading(true);

    // Set artifact to streaming mode to show progress
    setSessions(prev => prev.map((sess, i) => 
        i === currentSessionIndex ? {
            ...sess,
            artifacts: sess.artifacts.map((art, j) => 
              j === focusedArtifactIndex ? { ...art, status: 'streaming', html: '' } : art
            )
        } : sess
    ));

    try {
        const response = await fetch('/api/variant', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                prompt: currentSession.prompt,
                currentCode: currentArtifact.html,
                styleName: currentArtifact.styleName
            })
        });

        if (!response.ok) throw new Error(`Server returned ${response.status}`);
        
        const reader = response.body?.getReader();
        if (!reader) throw new Error("Could not read response stream");

        const decoder = new TextDecoder();
        let fullHtml = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunkText = decoder.decode(value, { stream: true });
            fullHtml += chunkText;
            
            // Stream the update
            setSessions(prev => prev.map((sess, i) => 
                i === currentSessionIndex ? {
                    ...sess,
                    artifacts: sess.artifacts.map((art, j) => 
                      j === focusedArtifactIndex ? { ...art, html: fullHtml } : art
                    )
                } : sess
            ));
        }

        // Finalize
        setSessions(prev => prev.map((sess, i) => 
            i === currentSessionIndex ? {
                ...sess,
                artifacts: sess.artifacts.map((art, j) => 
                  j === focusedArtifactIndex ? { ...art, status: 'complete' } : art
                )
            } : sess
        ));

    } catch (e: any) {
        console.error("Error generating variant:", e);
        // Revert status if error
        setSessions(prev => prev.map((sess, i) => 
            i === currentSessionIndex ? {
                ...sess,
                artifacts: sess.artifacts.map((art, j) => 
                  j === focusedArtifactIndex ? { ...art, status: 'complete' } : art
                )
            } : sess
        ));
    } finally {
        setIsLoading(false);
    }
  }, [sessions, currentSessionIndex, focusedArtifactIndex, isLoading]);

  const handleDownload = useCallback(async () => {
    const currentSession = sessions[currentSessionIndex];
    if (!currentSession || focusedArtifactIndex === null) return;

    const currentArtifact = currentSession.artifacts[focusedArtifactIndex];
    const zip = new JSZip();

    // Extract CSS and JS from artifact HTML if possible, or just provide placeholders
    // For simplicity and matching user intent, we'll try to split the generated HTML
    let htmlContent = currentArtifact.html;
    let cssContent = '';
    let jsContent = '';

    // Simple regex extraction for styles and scripts
    const styleMatch = htmlContent.match(/<style[^>]*>([\s\S]*?)<\/style>/);
    if (styleMatch) {
      cssContent = styleMatch[1];
      htmlContent = htmlContent.replace(/<style[^>]*>([\s\S]*?)<\/style>/, '<link rel="stylesheet" href="index.css">');
    }

    const scriptMatch = htmlContent.match(/<script[^>]*>([\s\S]*?)<\/script>/);
    if (scriptMatch) {
      jsContent = scriptMatch[1];
      htmlContent = htmlContent.replace(/<script[^>]*>([\s\S]*?)<\/script>/, '<script src="index.js"></script>');
    }

    zip.file("index.html", htmlContent);
    zip.file("index.css", cssContent || "/* No styles provided */");
    zip.file("index.js", jsContent || "// No scripts provided");
    // Also provide as .tsx as requested, even if it's just plain JS
    zip.file("index.tsx", jsContent || "// No scripts provided");

    const content = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href = url;
    a.download = `artifact-${currentArtifact.id}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [sessions, currentSessionIndex, focusedArtifactIndex]);

  const applyVariation = (html: string) => {
      if (focusedArtifactIndex === null) return;
      setSessions(prev => prev.map((sess, i) => 
          i === currentSessionIndex ? {
              ...sess,
              artifacts: sess.artifacts.map((art, j) => 
                j === focusedArtifactIndex ? { ...art, html, status: 'complete' } : art
              )
          } : sess
      ));
      setDrawerState(s => ({ ...s, isOpen: false }));
  };

  const handleShowCode = () => {
      const currentSession = sessions[currentSessionIndex];
      if (currentSession && focusedArtifactIndex !== null) {
          const artifact = currentSession.artifacts[focusedArtifactIndex];
          setDrawerState({ isOpen: true, mode: 'code', title: 'Source Code', data: artifact.html });
      }
  };

  const handleOpenHistory = () => {
    setDrawerState({ isOpen: true, mode: 'history', title: 'Generation History', data: sessions });
  };

  const handleSendMessage = useCallback(async (manualPrompt?: string) => {
    const promptToUse = manualPrompt || inputValue;
    const trimmedInput = promptToUse.trim();
    
    if (!trimmedInput || isLoading) return;
    if (!manualPrompt) setInputValue('');

    setIsLoading(true);
    const baseTime = Date.now();
    const sessionId = generateId();

    const placeholderArtifacts: Artifact[] = Array(3).fill(null).map((_, i) => ({
        id: `${sessionId}_${i}`,
        styleName: 'Designing...',
        html: '',
        status: 'streaming',
    }));

    const newSession: Session = {
        id: sessionId,
        prompt: trimmedInput,
        timestamp: baseTime,
        artifacts: placeholderArtifacts
    };

    setSessions(prev => [...prev, newSession]);
    setCurrentSessionIndex(sessions.length); 
    setFocusedArtifactIndex(null); 

    try {
        const styleResponse = await fetch('/api/styles', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: trimmedInput })
        });

        let generatedStyles: string[] = [];
        if (styleResponse.ok) {
            const data = await styleResponse.json();
            const styleText = data.text || '[]';
            const jsonMatch = styleText.match(/\[[\s\S]*\]/);
            
            if (jsonMatch) {
                try {
                    generatedStyles = JSON.parse(jsonMatch[0]);
                } catch (e) {
                    console.warn("Failed to parse styles, using fallbacks");
                }
            }
        }

        if (!generatedStyles || generatedStyles.length < 3) {
            generatedStyles = [
                "Primary Pigment Gridwork",
                "Tactile Risograph Layering",
                "Kinetic Silhouette Balance"
            ];
        }
        
        generatedStyles = generatedStyles.slice(0, 3);

        setSessions(prev => prev.map(s => {
            if (s.id !== sessionId) return s;
            return {
                ...s,
                artifacts: s.artifacts.map((art, i) => ({
                    ...art,
                    styleName: generatedStyles[i]
                }))
            };
        }));

    const generateArtifact = async (artifact: Artifact, styleInstruction: string) => {
        try {
            const response = await fetch('/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: trimmedInput, styleInstruction })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Server returned ${response.status}`);
            }
            
            const reader = response.body?.getReader();
            if (!reader) throw new Error("Could not read response stream");

            const decoder = new TextDecoder();
            let accumulatedHtml = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                const chunkText = decoder.decode(value, { stream: true });
                accumulatedHtml += chunkText;

                setSessions(prev => prev.map(sess => 
                    sess.id === sessionId ? {
                        ...sess,
                        artifacts: sess.artifacts.map(art => 
                            art.id === artifact.id ? { ...art, html: accumulatedHtml } : art
                        )
                    } : sess
                ));
            }
            
            let finalHtml = accumulatedHtml.trim();
            if (finalHtml.startsWith('```html')) finalHtml = finalHtml.substring(7).trimStart();
            if (finalHtml.startsWith('```')) finalHtml = finalHtml.substring(3).trimStart();
            if (finalHtml.endsWith('```')) finalHtml = finalHtml.substring(0, finalHtml.length - 3).trimEnd();

            setSessions(prev => prev.map(sess => 
                sess.id === sessionId ? {
                    ...sess,
                    artifacts: sess.artifacts.map(art => 
                        art.id === artifact.id ? { ...art, html: finalHtml, status: finalHtml ? 'complete' : 'error' } : art
                    )
                } : sess
            ));

        } catch (e: any) {
            console.error('Error generating artifact:', e);
            setSessions(prev => prev.map(sess => 
                sess.id === sessionId ? {
                    ...sess,
                    artifacts: sess.artifacts.map(art => 
                        art.id === artifact.id ? { ...art, html: `<div style="color: #ff6b6b; padding: 20px;">Error: ${e.message}</div>`, status: 'error' } : art
                    )
                } : sess
            ));
        }
    };

    // To avoid 429 errors from parallel calls, we sequentialize the generation
    for (let i = 0; i < placeholderArtifacts.length; i++) {
        await generateArtifact(placeholderArtifacts[i], generatedStyles[i]);
        // Add a small delay between generations to be safe
        if (i < placeholderArtifacts.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }

    } catch (e) {
        console.error("Fatal error in generation process", e);
    } finally {
        setIsLoading(false);
        setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [inputValue, isLoading, sessions.length]);

  const handleSurpriseMe = () => {
      const currentPrompt = placeholders[placeholderIndex];
      setInputValue(currentPrompt);
      handleSendMessage(currentPrompt);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !isLoading) {
      event.preventDefault();
      handleSendMessage();
    } else if (event.key === 'Tab' && !inputValue && !isLoading) {
        event.preventDefault();
        setInputValue(placeholders[placeholderIndex]);
    }
  };

  const nextItem = useCallback(() => {
      if (focusedArtifactIndex !== null) {
          if (focusedArtifactIndex < 2) setFocusedArtifactIndex(focusedArtifactIndex + 1);
      } else {
          if (currentSessionIndex < sessions.length - 1) setCurrentSessionIndex(currentSessionIndex + 1);
      }
  }, [currentSessionIndex, sessions.length, focusedArtifactIndex]);

  const prevItem = useCallback(() => {
      if (focusedArtifactIndex !== null) {
          if (focusedArtifactIndex > 0) setFocusedArtifactIndex(focusedArtifactIndex - 1);
      } else {
           if (currentSessionIndex > 0) setCurrentSessionIndex(currentSessionIndex - 1);
      }
  }, [currentSessionIndex, focusedArtifactIndex]);

  const isLoadingDrawer = isLoading && drawerState.mode === 'variations' && componentVariations.length === 0;

  const hasStarted = sessions.length > 0 || isLoading;
  const currentSession = sessions[currentSessionIndex];

  let canGoBack = false;
  let canGoForward = false;

  if (hasStarted) {
      if (focusedArtifactIndex !== null) {
          canGoBack = focusedArtifactIndex > 0;
          canGoForward = focusedArtifactIndex < (currentSession?.artifacts.length || 0) - 1;
      } else {
          canGoBack = currentSessionIndex > 0;
          canGoForward = currentSessionIndex < sessions.length - 1;
      }
  }

  return (
    <>
        <div style={{ position: 'fixed', inset: 0, zIndex: -1, overflow: 'hidden', pointerEvents: 'none' }}>
          <iframe 
            src="https://fluid.krackeddevs.com/#p=1.02,1.19,4.2,0.031,1,17,0,8,13.72,0,0,1,0,1,14,0,0,0,0,0,13349887,1737614,11726379,15456459,-0.05" 
            title="Fluid background" 
            style={{ width: '100%', height: '100%', border: 0, display: 'block' }}
          />
        </div>

        <button className="history-toggle" onClick={handleOpenHistory} aria-label="Open History">
            <HistoryIcon />
        </button>

        <div className={`creator-credit ${hasStarted ? 'hide-on-mobile' : ''}`}>
            Crafted by Miii
        </div>

        <SideDrawer 
            isOpen={drawerState.isOpen} 
            onClose={() => setDrawerState(s => ({...s, isOpen: false}))} 
            title={drawerState.title}
        >
            {isLoadingDrawer && (
                 <div className="loading-state">
                     <ThinkingIcon /> 
                     Designing variations...
                 </div>
            )}

            {drawerState.mode === 'code' && (
                <pre className="code-block"><code>{drawerState.data}</code></pre>
            )}
            
            {drawerState.mode === 'variations' && (
                <div className="sexy-grid">
                    {componentVariations.map((v, i) => (
                         <div key={i} className="sexy-card" onClick={() => applyVariation(v.html)}>
                             <div className="sexy-preview">
                                  <iframe srcDoc={v.html} title={v.name} sandbox="allow-scripts allow-same-origin" />
                             </div>
                             <div className="sexy-label">{v.name}</div>
                         </div>
                    ))}
                </div>
            )}

            {drawerState.mode === 'history' && (
                <div className="history-list">
                    {sessions.length === 0 ? (
                        <div className="empty-history">
                             <ThinkingIcon />
                             <p>No generations yet. Start by typing something below.</p>
                        </div>
                    ) : (
                        [...sessions].reverse().map((session) => {
                            const actualIndex = sessions.findIndex(s => s.id === session.id);
                            return (
                                <div 
                                    key={session.id} 
                                    className={`history-item ${actualIndex === currentSessionIndex ? 'active' : ''}`}
                                    onClick={() => {
                                        setCurrentSessionIndex(actualIndex);
                                        setFocusedArtifactIndex(null);
                                        setDrawerState(s => ({ ...s, isOpen: false }));
                                    }}
                                >
                                    <div className="history-item-content">
                                        <div className="history-item-prompt">{session.prompt}</div>
                                        <div className="history-item-meta">
                                            <span className="history-item-date">
                                                {new Date(session.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                            <div className="history-item-artifacts">
                                                {session.artifacts.map(art => (
                                                    <div key={art.id} className={`artifact-mini-dot ${art.status}`}></div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            )}
        </SideDrawer>

        {showQrCode && (
            <div className="qr-overlay" onClick={() => setShowQrCode(false)}>
                <div className="qr-container" onClick={e => e.stopPropagation()}>
                    <h3>Share Project</h3>
                    <div className="qr-wrapper">
                        <QRCodeCanvas 
                            value={window.location.href} 
                            size={200}
                            bgColor="#ffffff"
                            fgColor="#000000"
                            level="H"
                            includeMargin={true}
                        />
                    </div>
                    <p className="qr-url">{window.location.href}</p>
                    <button className="qr-close" onClick={() => setShowQrCode(false)}>Close</button>
                </div>
            </div>
        )}

        <div className="immersive-app">
            <DottedGlowBackground 
                gap={24} 
                radius={1.5} 
                color="rgba(255, 255, 255, 0.02)" 
                glowColor="rgba(255, 255, 255, 0.15)" 
                speedScale={0.5} 
            />

            <div className={`stage-container ${focusedArtifactIndex !== null ? 'mode-focus' : 'mode-split'}`}>
                 <div className={`empty-state ${hasStarted ? 'fade-out' : ''}`}>
                     <div className="empty-content">
                         <h1>Flash UI</h1>
                         <p>Creative UI generation in a flash</p>
                         <button className="surprise-button" onClick={handleSurpriseMe} disabled={isLoading}>
                             <SparklesIcon /> Surprise Me
                         </button>
                     </div>
                 </div>

                {sessions.map((session, sIndex) => {
                    let positionClass = 'hidden';
                    if (sIndex === currentSessionIndex) positionClass = 'active-session';
                    else if (sIndex < currentSessionIndex) positionClass = 'past-session';
                    else if (sIndex > currentSessionIndex) positionClass = 'future-session';
                    
                    return (
                        <div key={session.id} className={`session-group ${positionClass}`}>
                            <div className="artifact-grid" ref={sIndex === currentSessionIndex ? gridScrollRef : null}>
                                {session.artifacts.map((artifact, aIndex) => {
                                    const isFocused = focusedArtifactIndex === aIndex;
                                    
                                    return (
                                        <ArtifactCard 
                                            key={artifact.id}
                                            artifact={artifact}
                                            isFocused={isFocused}
                                            theme={artifactTheme}
                                            onClick={() => setFocusedArtifactIndex(aIndex)}
                                            onClose={() => setFocusedArtifactIndex(null)}
                                            delay={aIndex * 0.15}
                                        />
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>

             {canGoBack && (
                <button className="nav-handle left" onClick={prevItem} aria-label="Previous">
                    <ArrowLeftIcon />
                </button>
             )}
             {canGoForward && (
                <button className="nav-handle right" onClick={nextItem} aria-label="Next">
                    <ArrowRightIcon />
                </button>
             )}

            <div className={`action-bar ${focusedArtifactIndex !== null ? 'visible' : ''}`}>
                 <div className="active-prompt-label">
                    {currentSession?.prompt}
                 </div>
                 <div className="action-buttons">
                    <button onClick={() => setFocusedArtifactIndex(null)}>
                        <GridIcon /> Grid View
                    </button>
                    <button onClick={handleGenerateVariations} disabled={isLoading}>
                        <SparklesIcon /> Variations
                    </button>
                    <button onClick={handleGenerateVariant} disabled={isLoading}>
                        <RefreshCwIcon /> Generate Variant
                    </button>
                    <button onClick={() => setArtifactTheme(prev => prev === 'light' ? 'dark' : 'light')}>
                        {artifactTheme === 'light' ? <MoonIcon /> : <SunIcon />}
                        Theme: {artifactTheme === 'light' ? 'Dark' : 'Light'}
                    </button>
                    <button onClick={handleDownload}>
                        <DownloadIcon /> Export ZIP
                    </button>
                    <button onClick={() => setShowQrCode(prev => !prev)}>
                        <QrCodeIcon /> Share URL
                    </button>
                    <button onClick={handleShowCode}>
                        <CodeIcon /> Source
                    </button>
                 </div>
            </div>

            <div className="floating-input-container">
                <div className={`input-wrapper ${isLoading ? 'loading' : ''}`}>
                    {(!inputValue && !isLoading) && (
                        <div className="animated-placeholder" key={placeholderIndex}>
                            <span className="placeholder-text">{placeholders[placeholderIndex]}</span>
                            <span className="tab-hint">Tab</span>
                        </div>
                    )}
                    {!isLoading ? (
                        <input 
                            ref={inputRef}
                            type="text" 
                            value={inputValue} 
                            onChange={handleInputChange} 
                            onKeyDown={handleKeyDown} 
                            disabled={isLoading} 
                        />
                    ) : (
                        <div className="input-generating-label">
                            <span className="generating-prompt-text">{currentSession?.prompt}</span>
                            <ThinkingIcon />
                        </div>
                    )}
                    <button className="send-button" onClick={() => handleSendMessage()} disabled={isLoading || !inputValue.trim()}>
                        <ArrowUpIcon />
                    </button>
                </div>
            </div>
        </div>
    </>
  );
}

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(<React.StrictMode><App /></React.StrictMode>);
}