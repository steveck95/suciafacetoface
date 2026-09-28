import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Copy,
  Download,
  FileCode2,
  Globe,
  ImagePlus,
  Maximize2,
  Redo2,
  RotateCcw,
  RotateCw,
  Share2,
  Trash2,
  Undo2,
  X,
} from 'lucide-react';
import {
  CardElement,
  CardProjectState,
  ColorPresetItem,
  createInitialCardState,
  TextCardElement,
} from './types/card';
import {
  generateCardSVG,
  getElementBounds,
  hitTestCardElements,
  hitTestSelectionHandles,
  preloadCardImage,
  renderCardToCanvas,
} from './utils/cardRenderer';
import { normalizeHex } from './utils/color';
import {
  getElementDisplayLabel,
  Language,
  LANGUAGE_OPTIONS,
  UI_TEXT,
} from './utils/i18n';
import { ColorControlPanel } from './components/ColorControlPanel';
import { TextControlPanel } from './components/TextControlPanel';

type ControlTab = 'background' | 'band' | 'decoration' | 'logo' | 'text';

const CUSTOM_PRESETS_STORAGE_KEY = 'suica_studio_custom_color_presets_v1';
const LANGUAGE_STORAGE_KEY = 'suica_studio_lang_v1';

export default function App() {
  // Language State ('zh' | 'ja' | 'en')
  const [lang, setLang] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
      if (saved === 'zh' || saved === 'ja' || saved === 'en') return saved;
    } catch {
      // ignore
    }
    return 'zh';
  });

  useEffect(() => {
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
    } catch {
      // ignore
    }
  }, [lang]);

  const t = UI_TEXT[lang];

  // History & Current Project State
  const [history, setHistory] = useState<CardProjectState[]>(() => [
    createInitialCardState(),
  ]);
  const [historyIndex, setHistoryIndex] = useState<number>(0);
  const [liveState, setLiveState] = useState<CardProjectState>(() =>
    createInitialCardState()
  );

  // Active Navigation Tab & Selected Element
  const [activeTab, setActiveTab] = useState<ControlTab>('decoration');
  const [selectedElementId, setSelectedElementId] =
    useState<string>('decoration');

  // Selection Box Toggle
  const [showSelectionBox, setShowSelectionBox] = useState(true);

  // Export PNG Scale (1x, 2x, 3x)
  const [pngScale, setPngScale] = useState<1 | 2 | 3>(2);

  // Mobile-friendly Exported PNG Preview & Save Modal State
  const [exportedImage, setExportedImage] = useState<{
    dataUrl: string;
    blob: Blob;
    filename: string;
    width: number;
    height: number;
    scale: 1 | 2 | 3;
  } | null>(null);

  // Toast Feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Custom Color Presets (up to 10)
  const [customPresets, setCustomPresets] = useState<ColorPresetItem[]>(() => {
    try {
      const saved = localStorage.getItem(CUSTOM_PRESETS_STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore storage errors
    }
    return [
      {
        id: 'custom-init-1',
        name: 'Teal Accent',
        labelZh: '湖水青',
        hex: '#00A8A8',
        isCustom: true,
      },
    ];
  });

  // Canvas & File Input Refs
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const decorationImageInputRef = useRef<HTMLInputElement | null>(null);
  const [imageRenderTick, setImageRenderTick] = useState(0);

  const [draggingHud, setDraggingHud] = useState<{
    x: number;
    y: number;
    label?: string;
  } | null>(null);

  const dragRef = useRef<{
    mode: 'move-element' | 'rotate-element' | 'resize-element' | null;
    elementId?: string;
    startCanvasX: number;
    startCanvasY: number;
    initialElementX: number;
    initialElementY: number;
    initialWidth: number;
    initialHeight: number;
    centerX: number;
    centerY: number;
    initialDistance: number;
    hasMoved: boolean;
  }>({
    mode: null,
    startCanvasX: 0,
    startCanvasY: 0,
    initialElementX: 0,
    initialElementY: 0,
    initialWidth: 220,
    initialHeight: 270,
    centerX: 0,
    centerY: 0,
    initialDistance: 100,
    hasMoved: false,
  });

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
  }, []);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(null), 2600);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  // Save custom presets to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(
        CUSTOM_PRESETS_STORAGE_KEY,
        JSON.stringify(customPresets)
      );
    } catch {
      // ignore
    }
  }, [customPresets]);

  // Commit state change to Undo/Redo history
  const commitState = useCallback(
    (nextState: CardProjectState) => {
      setLiveState(nextState);
      setHistory((prev) => {
        const sliced = prev.slice(0, historyIndex + 1);
        return [...sliced, JSON.parse(JSON.stringify(nextState))];
      });
      setHistoryIndex((prev) => prev + 1);
    },
    [historyIndex]
  );

  // Undo / Redo / Reset handlers
  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  const handleUndo = useCallback(() => {
    if (historyIndex <= 0) return;
    const nextIdx = historyIndex - 1;
    const restored = JSON.parse(JSON.stringify(history[nextIdx]));
    setHistoryIndex(nextIdx);
    setLiveState(restored);
    showToast(t.toastUndo);
  }, [history, historyIndex, showToast, t.toastUndo]);

  const handleRedo = useCallback(() => {
    if (historyIndex >= history.length - 1) return;
    const nextIdx = historyIndex + 1;
    const restored = JSON.parse(JSON.stringify(history[nextIdx]));
    setHistoryIndex(nextIdx);
    setLiveState(restored);
    showToast(t.toastRedo);
  }, [history, historyIndex, showToast, t.toastRedo]);

  const handleReset = useCallback(() => {
    const fresh = createInitialCardState();
    commitState(fresh);
    setSelectedElementId('decoration');
    setActiveTab('decoration');
    showToast(t.toastReset);
  }, [commitState, showToast, t.toastReset]);

  // Keyboard shortcuts for Ctrl+Z / Ctrl+Y
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleUndo, handleRedo]);

  // Synchronize Selected Element & Active Tab
  const selectElementAndSyncTab = useCallback(
    (id: string, switchTab = true) => {
      setSelectedElementId(id);
      if (!switchTab) return;
      const el = liveState.elements.find((e) => e.id === id);
      if (!el) return;
      if (el.category === 'background') setActiveTab('background');
      else if (el.category === 'band') setActiveTab('band');
      else if (el.category === 'decoration') setActiveTab('decoration');
      else if (el.category === 'logo') setActiveTab('logo');
      else if (el.category === 'text') setActiveTab('text');
    },
    [liveState.elements]
  );

  const handleSelectTab = (tab: ControlTab) => {
    setActiveTab(tab);
    if (tab === 'background') setSelectedElementId('background');
    else if (tab === 'band') setSelectedElementId('color-band');
    else if (tab === 'decoration') setSelectedElementId('decoration');
    else if (tab === 'logo') setSelectedElementId('logo');
    else if (tab === 'text') {
      const curr = liveState.elements.find((e) => e.id === selectedElementId);
      if (!curr || curr.type !== 'text') {
        const firstText = liveState.elements.find((e) => e.type === 'text');
        if (firstText) setSelectedElementId(firstText.id);
      }
    }
  };

  // Element update helper
  const updateElement = useCallback(
    (id: string, updates: Partial<CardElement>, commitHistory = true) => {
      setLiveState((prev) => {
        const nextElements = prev.elements.map((el) => {
          if (el.id !== id) return el;
          const syncedUpdates = { ...updates };
          if (syncedUpdates.fill !== undefined) {
            syncedUpdates.color = syncedUpdates.fill;
          } else if (syncedUpdates.color !== undefined) {
            syncedUpdates.fill = syncedUpdates.color;
          }
          return { ...el, ...syncedUpdates } as CardElement;
        });
        const nextState: CardProjectState = {
          ...prev,
          elements: nextElements,
        };
        if (commitHistory) {
          setHistory((hPrev) => {
            const sliced = hPrev.slice(0, historyIndex + 1);
            return [...sliced, JSON.parse(JSON.stringify(nextState))];
          });
          setHistoryIndex((idxPrev) => idxPrev + 1);
        }
        return nextState;
      });
    },
    [historyIndex]
  );

  // Render preview canvas whenever liveState or overlays change
  useEffect(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    renderCardToCanvas(canvas, liveState, {
      scale: 1,
      includeOverlays: true,
      selectedElementId: showSelectionBox ? selectedElementId : null,
      draggingInfo: draggingHud,
    });
  }, [
    liveState,
    selectedElementId,
    showSelectionBox,
    draggingHud,
    imageRenderTick,
  ]);

  // Handle uploading a custom image to replace the Penguin (Decoration) position
  const handleDecorationImageUpload = useCallback(
    (file: File) => {
      if (!file.type.startsWith('image/')) {
        showToast(t.toastInvalidImg);
        return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = String(ev.target?.result || '');
        if (!dataUrl) return;
        preloadCardImage(dataUrl, () => {
          setImageRenderTick((tTick) => tTick + 1);
        });
        updateElement(
          'decoration',
          {
            decorationStyle: 'custom-image',
            customImageUrl: dataUrl,
            customImageName: file.name,
            labelZh: '自訂圖片 (企鵝區)',
            visible: true,
          },
          true
        );
        setSelectedElementId('decoration');
        setActiveTab('decoration');
        showToast(`${t.toastImgUploaded}${file.name}`);
      };
      reader.readAsDataURL(file);
    },
    [showToast, t.toastImgUploaded, t.toastInvalidImg, updateElement]
  );

  // Convert Pointer Event to Canvas (1012x638) coordinates
  const getCanvasCoords = (
    e: React.PointerEvent<HTMLCanvasElement>
  ): { x: number; y: number } => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = liveState.canvas.width / rect.width;
    const scaleY = liveState.canvas.height / rect.height;
    return {
      x: Math.max(
        0,
        Math.min(liveState.canvas.width, (e.clientX - rect.left) * scaleX)
      ),
      y: Math.max(
        0,
        Math.min(liveState.canvas.height, (e.clientY - rect.top) * scaleY)
      ),
    };
  };

  // Pointer Down on Card Canvas (Supports Move, Rotate Handle, and Corner Resize Handle)
  const handleCanvasPointerDown = (
    e: React.PointerEvent<HTMLCanvasElement>
  ) => {
    const coords = getCanvasCoords(e);
    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const currentSelected = liveState.elements.find(
      (el) => el.id === selectedElementId
    );

    // 1. First check if user clicked on the Rotation Handle or Resize Corner of the currently selected element
    if (showSelectionBox && currentSelected) {
      const handleHit = hitTestSelectionHandles(
        currentSelected,
        coords.x,
        coords.y,
        ctx
      );
      if (handleHit === 'rotate') {
        e.currentTarget.setPointerCapture(e.pointerId);
        const b = getElementBounds(currentSelected, ctx);
        const cx = b.x + b.width / 2;
        const cy = b.y + b.height / 2;
        dragRef.current = {
          mode: 'rotate-element',
          elementId: currentSelected.id,
          startCanvasX: coords.x,
          startCanvasY: coords.y,
          initialElementX: currentSelected.x,
          initialElementY: currentSelected.y,
          initialWidth: currentSelected.width,
          initialHeight: currentSelected.height,
          centerX: cx,
          centerY: cy,
          initialDistance: 100,
          hasMoved: false,
        };
        setDraggingHud({
          x: cx,
          y: b.y,
          label: `${t.hudAngle}: ${Math.round(currentSelected.rotation || 0)}°`,
        });
        return;
      }

      if (handleHit === 'resize') {
        e.currentTarget.setPointerCapture(e.pointerId);
        const cx = currentSelected.x + currentSelected.width / 2;
        const cy = currentSelected.y + currentSelected.height / 2;
        const initDist = Math.max(
          16,
          Math.hypot(coords.x - cx, coords.y - cy)
        );
        dragRef.current = {
          mode: 'resize-element',
          elementId: currentSelected.id,
          startCanvasX: coords.x,
          startCanvasY: coords.y,
          initialElementX: currentSelected.x,
          initialElementY: currentSelected.y,
          initialWidth: currentSelected.width,
          initialHeight: currentSelected.height,
          centerX: cx,
          centerY: cy,
          initialDistance: initDist,
          hasMoved: false,
        };
        setDraggingHud({
          x: currentSelected.x,
          y: currentSelected.y,
          label: `${t.hudSize}: ${Math.round(currentSelected.width)} × ${Math.round(
            currentSelected.height
          )}`,
        });
        return;
      }
    }

    // 2. Normal Element Selection & Dragging
    const hitEl = hitTestCardElements(
      liveState.elements,
      coords.x,
      coords.y,
      ctx
    );

    if (hitEl) {
      selectElementAndSyncTab(hitEl.id, true);
      if (hitEl.type !== 'background' && !hitEl.locked) {
        e.currentTarget.setPointerCapture(e.pointerId);
        dragRef.current = {
          mode: 'move-element',
          elementId: hitEl.id,
          startCanvasX: coords.x,
          startCanvasY: coords.y,
          initialElementX: hitEl.x,
          initialElementY: hitEl.y,
          initialWidth: hitEl.width,
          initialHeight: hitEl.height,
          centerX: hitEl.x + hitEl.width / 2,
          centerY: hitEl.y + hitEl.height / 2,
          initialDistance: 100,
          hasMoved: false,
        };
        setDraggingHud({
          x: hitEl.x,
          y: hitEl.y,
          label: getElementDisplayLabel(hitEl, lang),
        });
      }
    }
  };

  // Pointer Move on Card Canvas
  const handleCanvasPointerMove = (
    e: React.PointerEvent<HTMLCanvasElement>
  ) => {
    const drag = dragRef.current;
    if (!drag.mode || !drag.elementId) return;

    const coords = getCanvasCoords(e);
    const dx = coords.x - drag.startCanvasX;
    const dy = coords.y - drag.startCanvasY;

    if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
      drag.hasMoved = true;
    }

    if (drag.mode === 'move-element') {
      const nextX = Math.round(drag.initialElementX + dx);
      const nextY = Math.round(drag.initialElementY + dy);
      updateElement(drag.elementId, { x: nextX, y: nextY }, false);
      const el = liveState.elements.find((item) => item.id === drag.elementId);
      setDraggingHud({
        x: nextX,
        y: nextY,
        label: el ? getElementDisplayLabel(el, lang) : undefined,
      });
    } else if (drag.mode === 'rotate-element') {
      const angleRad = Math.atan2(
        coords.y - drag.centerY,
        coords.x - drag.centerX
      );
      let deg = Math.round((angleRad * 180) / Math.PI + 90);
      if (deg > 180) deg -= 360;
      if (deg < -180) deg += 360;
      updateElement(drag.elementId, { rotation: deg }, false);
      setDraggingHud({
        x: drag.centerX,
        y: Math.max(20, drag.centerY - 120),
        label: `${t.hudRotateAngle}: ${deg}°`,
      });
    } else if (drag.mode === 'resize-element') {
      const currDist = Math.max(
        12,
        Math.hypot(coords.x - drag.centerX, coords.y - drag.centerY)
      );
      const ratio = currDist / Math.max(1, drag.initialDistance);
      const newW = Math.max(24, Math.min(980, Math.round(drag.initialWidth * ratio)));
      const newH = Math.max(24, Math.min(620, Math.round(drag.initialHeight * ratio)));
      const newX = Math.round(drag.centerX - newW / 2);
      const newY = Math.round(drag.centerY - newH / 2);
      updateElement(
        drag.elementId,
        { x: newX, y: newY, width: newW, height: newH },
        false
      );
      setDraggingHud({
        x: newX,
        y: newY,
        label: `${t.hudSize}: ${newW} × ${newH} px`,
      });
    }
  };

  // Pointer Up on Card Canvas
  const handleCanvasPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (!drag.mode) return;

    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }

    if (drag.elementId && drag.hasMoved) {
      commitState(liveState);
    }

    dragRef.current.mode = null;
    setDraggingHud(null);
  };

  // Add Extra Text Element
  const handleAddTextElement = () => {
    const textCount =
      liveState.elements.filter((el) => el.type === 'text').length + 1;
    const newId = `custom-text-${Date.now()}`;
    const newText: TextCardElement = {
      id: newId,
      name: `Custom Text ${textCount}`,
      labelZh: `自訂文字 #${textCount}`,
      category: 'text',
      type: 'text',
      text: 'JR EAST PASS',
      x: 70,
      y: 200,
      width: 240,
      height: 36,
      fill: '#FFFFFF',
      color: '#FFFFFF',
      opacity: 1,
      brightness: 0,
      visible: true,
      locked: false,
      fontFamily: '"Plus Jakarta Sans", "Noto Sans TC", "Noto Sans JP", sans-serif',
      fontSize: 28,
      fontWeight: 700,
      letterSpacing: 2,
      lineHeight: 1.2,
      textAlign: 'left',
    };
    const nextState: CardProjectState = {
      ...liveState,
      elements: [...liveState.elements, newText],
    };
    commitState(nextState);
    setSelectedElementId(newId);
    setActiveTab('text');
    showToast(t.toastTextAdded);
  };

  // Custom Color Presets (Max 10)
  const handleAddCustomPreset = (hex: string) => {
    if (customPresets.length >= 10) return;
    const norm = normalizeHex(hex);
    if (customPresets.some((p) => p.hex === norm)) {
      showToast(t.toastPresetExists);
      return;
    }
    setCustomPresets((prev) => [
      ...prev,
      {
        id: `custom-${Date.now()}`,
        name: norm,
        labelZh: '自訂色',
        hex: norm,
        isCustom: true,
      },
    ]);
    showToast(`${t.toastPresetSaved} ${norm}`);
  };

  const handleRemoveCustomPreset = (id: string) => {
    setCustomPresets((prev) => prev.filter((p) => p.id !== id));
  };

  // Convert DataURL synchronously to Blob (preserves mobile user-gesture activation)
  const dataUrlToBlob = (dataUrl: string): Blob => {
    const parts = dataUrl.split(',');
    const mimeMatch = parts[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'image/png';
    const binary = atob(parts[1] || '');
    const array = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      array[i] = binary.charCodeAt(i);
    }
    return new Blob([array], { type: mime });
  };

  // Mobile-compatible Blob file download helper (appends to body & delays revokeObjectURL)
  const triggerBlobDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.rel = 'noopener';
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 15000);
  };

  // Generate PNG DataURL + Blob at specified scale (1x, 2x, 3x)
  const generateExportPngPayload = useCallback(
    (scale: 1 | 2 | 3) => {
      const offscreen = document.createElement('canvas');
      renderCardToCanvas(offscreen, liveState, {
        scale,
        includeOverlays: false,
      });
      const dataUrl = offscreen.toDataURL('image/png');
      const blob = dataUrlToBlob(dataUrl);
      const width = liveState.canvas.width * scale;
      const height = liveState.canvas.height * scale;
      const filename = `suica-card-${width}x${height}-${scale}x.png`;
      return { dataUrl, blob, filename, width, height, scale };
    },
    [liveState]
  );

  // Export PNG (1x, 2x, 3x - Card face only, no overlays!)
  const handleExportPNG = (scale: 1 | 2 | 3 = pngScale) => {
    const payload = generateExportPngPayload(scale);
    setExportedImage(payload);

    // On non-iOS browsers, trigger direct file download immediately in addition to opening the save modal
    const isIOS =
      typeof navigator !== 'undefined' &&
      (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

    if (!isIOS) {
      triggerBlobDownload(payload.blob, payload.filename);
    }

    showToast(
      `${t.toastExportPng} (${scale}x: ${payload.width} × ${payload.height} px)`
    );
  };

  // Share or Save to Photos via Mobile Native Web Share API (with file fallback)
  const handleShareOrSaveImage = async () => {
    if (!exportedImage) return;
    try {
      const file = new File([exportedImage.blob], exportedImage.filename, {
        type: 'image/png',
      });
      if (
        typeof navigator !== 'undefined' &&
        navigator.share &&
        (!navigator.canShare || navigator.canShare({ files: [file] }))
      ) {
        await navigator.share({
          files: [file],
          title: t.appTitle,
        });
        return;
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
    }
    triggerBlobDownload(exportedImage.blob, exportedImage.filename);
  };

  // Copy PNG Image to Clipboard
  const handleCopyExportedImage = async () => {
    if (!exportedImage) return;
    try {
      if (navigator.clipboard && typeof ClipboardItem !== 'undefined') {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': exportedImage.blob }),
        ]);
        showToast(t.toastImageCopied);
        return;
      }
    } catch {
      // fallback to download if clipboard denied
    }
    triggerBlobDownload(exportedImage.blob, exportedImage.filename);
  };

  // Export SVG
  const handleExportSVG = () => {
    const svgString = generateCardSVG(liveState);
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    triggerBlobDownload(blob, 'suica-card-face.svg');
    showToast(t.toastExportSvg);
  };

  // Proportional Scale Helper for Decoration / Custom Image (keeps center anchored)
  const handleScaleDecorationProportionally = (
    scalePercent: number,
    commit: boolean
  ) => {
    const decEl = liveState.elements.find((e) => e.id === 'decoration');
    if (!decEl) return;
    const baseW = 220;
    const baseH = 270;
    const aspect = decEl.height > 0 ? decEl.width / decEl.height : baseW / baseH;
    const centerX = decEl.x + decEl.width / 2;
    const centerY = decEl.y + decEl.height / 2;

    const newH = Math.max(24, Math.min(620, Math.round((baseH * scalePercent) / 100)));
    const newW = Math.max(24, Math.min(980, Math.round(newH * aspect)));
    const newX = Math.round(centerX - newW / 2);
    const newY = Math.round(centerY - newH / 2);

    updateElement(
      decEl.id,
      { x: newX, y: newY, width: newW, height: newH },
      commit
    );
  };

  // Currently selected element object
  const selectedElement =
    liveState.elements.find((e) => e.id === selectedElementId) ||
    liveState.elements[0];

  const selectedElementLabel = getElementDisplayLabel(selectedElement, lang);

  const allTextElements = liveState.elements.filter(
    (e): e is TextCardElement => e.type === 'text'
  );

  const isCustomImageActive =
    selectedElement.type === 'decoration' &&
    selectedElement.decorationStyle === 'custom-image' &&
    Boolean(selectedElement.customImageUrl);

  const currentScalePercent =
    selectedElement.type === 'decoration'
      ? Math.round((selectedElement.height / 270) * 100)
      : 100;

  return (
    <div className="min-h-screen flex flex-col bg-slate-100/80 text-slate-900">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-xs border-b border-slate-200 px-3 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-3">
          <a
            href="#top"
            className="text-sm sm:text-base lg:text-lg font-extrabold tracking-tight text-slate-900 whitespace-nowrap"
          >
            {t.appTitle}
          </a>

          <nav className="hidden md:flex items-center gap-1 text-xs font-medium text-slate-600 border-l border-slate-200 pl-3">
            <button
              type="button"
              onClick={handleUndo}
              disabled={!canUndo}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-35 transition-colors whitespace-nowrap"
              title={t.undoTitle}
            >
              <Undo2 className="w-3.5 h-3.5" />
              <span>{t.undo}</span>
            </button>
            <button
              type="button"
              onClick={handleRedo}
              disabled={!canRedo}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-35 transition-colors whitespace-nowrap"
              title={t.redoTitle}
            >
              <Redo2 className="w-3.5 h-3.5" />
              <span>{t.redo}</span>
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors whitespace-nowrap"
              title={t.resetTitle}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{t.reset}</span>
            </button>
          </nav>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Free Language Switcher: 繁中 / 日本語 / EN */}
          <div
            className="inline-flex items-center p-0.5 bg-slate-100 border border-slate-200/80 rounded-lg"
            role="group"
            aria-label="Language Switcher"
          >
            <Globe className="w-3.5 h-3.5 text-slate-400 ml-1.5 mr-1 hidden sm:inline" />
            {LANGUAGE_OPTIONS.map((opt) => {
              const active = lang === opt.code;
              return (
                <button
                  key={opt.code}
                  type="button"
                  onClick={() => setLang(opt.code)}
                  className={`px-2 py-1 rounded-md text-xs font-semibold transition-all whitespace-nowrap ${
                    active
                      ? 'bg-white text-emerald-700 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => decorationImageInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors whitespace-nowrap"
          >
            <ImagePlus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t.uploadPenguinImg}</span>
            <span className="sm:hidden">{t.uploadImgShort}</span>
          </button>

          <button
            type="button"
            onClick={() => handleExportPNG(pngScale)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition-colors whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            <span>
              {t.exportPng} ({pngScale}x)
            </span>
          </button>
        </div>
      </header>

      {/* Main Responsive Workspace */}
      <main className="flex-1 max-w-[1380px] w-full mx-auto px-4 lg:px-6 py-5 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* RIGHT ON DESKTOP / TOP ON MOBILE: Real-time Card Face Preview Stage */}
        <section className="order-1 lg:order-2 lg:col-span-7 lg:sticky lg:top-20 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-6 shadow-xs space-y-4">
            {/* Top Status Strip */}
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 text-slate-600">
                <span className="font-semibold text-slate-900">
                  {t.livePreview}
                </span>
                <span aria-hidden="true">·</span>
                <span className="text-emerald-700 font-medium">
                  {t.currentlySelected}
                  {selectedElementLabel}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showSelectionBox}
                    onChange={(e) => setShowSelectionBox(e.target.checked)}
                    className="w-3.5 h-3.5 accent-emerald-600 rounded"
                  />
                  <span>{t.showHandles}</span>
                </label>

                <input
                  ref={decorationImageInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleDecorationImageUpload(file);
                    e.target.value = '';
                  }}
                  className="hidden"
                />
              </div>
            </div>

            {/* Interactive Fixed-Aspect-Ratio Card Canvas Wrapper */}
            <div className="relative w-full bg-slate-100/90 rounded-xl p-3 sm:p-6 flex items-center justify-center border border-slate-200/60 overflow-hidden">
              <div
                className="relative w-full max-w-[760px] shadow-lg rounded-[22px] sm:rounded-[28px] overflow-hidden transition-shadow"
                style={{
                  aspectRatio: `${liveState.canvas.width} / ${liveState.canvas.height}`,
                }}
              >
                <canvas
                  ref={previewCanvasRef}
                  width={liveState.canvas.width}
                  height={liveState.canvas.height}
                  onPointerDown={handleCanvasPointerDown}
                  onPointerMove={handleCanvasPointerMove}
                  onPointerUp={handleCanvasPointerUp}
                  onPointerCancel={handleCanvasPointerUp}
                  className="w-full h-full block select-none touch-none cursor-grab active:cursor-grabbing"
                />
              </div>
            </div>

            {/* Direct Region Quick Selector Bar */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>{t.canvasHint}</span>
                <div className="flex md:hidden items-center gap-1">
                  <button
                    type="button"
                    onClick={handleUndo}
                    disabled={!canUndo}
                    className="p-1.5 bg-slate-100 rounded-md disabled:opacity-30"
                    title={t.undo}
                  >
                    <Undo2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={handleRedo}
                    disabled={!canRedo}
                    className="p-1.5 bg-slate-100 rounded-md disabled:opacity-30"
                    title={t.redo}
                  >
                    <Redo2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={handleReset}
                    className="p-1.5 bg-slate-100 rounded-md"
                    title={t.reset}
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                {liveState.elements.map((el) => {
                  const active = el.id === selectedElementId;
                  return (
                    <button
                      key={el.id}
                      type="button"
                      onClick={() => selectElementAndSyncTab(el.id, true)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 whitespace-nowrap border ${
                        active
                          ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <span
                        className="w-3 h-3 rounded-xs border border-white/40 shrink-0"
                        style={{ backgroundColor: el.fill || el.color }}
                      />
                      <span>{getElementDisplayLabel(el, lang)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Streamlined Export & Project Save/Load Bar */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            {/* PNG Resolution Selector: 1x, 2x, 3x */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-700 whitespace-nowrap">
                {t.resolution}
              </span>
              <div className="inline-flex p-1 bg-slate-100 rounded-xl gap-1">
                {(
                  [
                    { scale: 1, label: '1x (1012×638)' },
                    { scale: 2, label: '2x (2024×1276)' },
                    { scale: 3, label: '3x (3036×1914)' },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.scale}
                    type="button"
                    onClick={() => setPngScale(item.scale)}
                    className={`py-1.5 px-2.5 rounded-lg text-xs transition-all whitespace-nowrap ${
                      pngScale === item.scale
                        ? 'bg-white text-slate-900 shadow-xs font-bold'
                        : 'text-slate-600 hover:text-slate-900 font-medium'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Export Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => handleExportPNG(pngScale)}
                className="inline-flex items-center justify-center gap-1.5 py-2 px-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" />
                <span>
                  {t.exportPng} ({pngScale}x)
                </span>
              </button>

              <button
                type="button"
                onClick={handleExportSVG}
                className="inline-flex items-center justify-center gap-1.5 py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition-colors whitespace-nowrap"
              >
                <FileCode2 className="w-3.5 h-3.5" />
                <span>{t.exportSvg}</span>
              </button>
            </div>
          </div>
        </section>

        {/* LEFT ON DESKTOP / BOTTOM ON MOBILE: Simplified Control Panel */}
        <aside className="order-2 lg:order-1 lg:col-span-5 bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
          {/* 5 Clean Tabs: 背景 / 色帶 / 企鵝・圖片 / Logo / 文字 */}
          <div className="border-b border-slate-200 bg-slate-50/70 p-2 grid grid-cols-5 gap-1">
            {(
              [
                { id: 'background', label: t.tabs.background },
                { id: 'band', label: t.tabs.band },
                { id: 'decoration', label: t.tabs.decoration },
                { id: 'logo', label: t.tabs.logo },
                { id: 'text', label: t.tabs.text },
              ] as const
            ).map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleSelectTab(tab.id)}
                  className={`py-2 px-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap truncate ${
                    active
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="p-4 sm:p-5 space-y-4">
            {/* Active Element Header */}
            <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span
                  className="w-3.5 h-3.5 rounded-sm border border-slate-300 inline-block"
                  style={{
                    backgroundColor:
                      selectedElement.fill || selectedElement.color,
                  }}
                />
                <h2 className="text-sm font-bold text-slate-900">
                  {selectedElementLabel}
                </h2>
              </div>

              {selectedElement.type !== 'background' && (
                <span className="text-[11px] font-mono text-slate-400 tabular-nums">
                  X:{Math.round(selectedElement.x)} Y:{Math.round(selectedElement.y)}
                  {selectedElement.rotation
                    ? ` · ${Math.round(selectedElement.rotation)}°`
                    : ''}
                </span>
              )}
            </div>

            {/* Color Band Style Controls */}
            {selectedElement.type === 'color-band' && (
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2.5">
                <div className="text-xs font-semibold text-slate-700">
                  {t.bandStyleTitle}
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {(
                    [
                      {
                        id: 'suica-trapezoid',
                        label: t.bandStyles['suica-trapezoid'],
                      },
                      {
                        id: 'suica-trapezoid-with-top',
                        label: t.bandStyles['suica-trapezoid-with-top'],
                      },
                      {
                        id: 'top-band',
                        label: t.bandStyles['top-band'],
                      },
                      {
                        id: 'diagonal-split',
                        label: t.bandStyles['diagonal-split'],
                      },
                    ] as const
                  ).map((st) => (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => {
                        if (st.id === 'top-band') {
                          updateElement(
                            selectedElement.id,
                            {
                              bandStyle: st.id,
                              x: 30,
                              y: 34,
                              width: 952,
                              height: 110,
                            },
                            true
                          );
                        } else {
                          updateElement(
                            selectedElement.id,
                            {
                              bandStyle: st.id,
                              x: 30,
                              y: 34,
                              width: 586,
                              height: 570,
                            },
                            true
                          );
                        }
                      }}
                      className={`px-2.5 py-2 rounded-lg text-xs font-medium text-left border transition-all ${
                        (selectedElement.bandStyle || 'suica-trapezoid') ===
                        st.id
                          ? 'bg-white border-emerald-600 text-slate-900 shadow-2xs font-semibold'
                          : 'bg-white/60 border-slate-200 text-slate-600 hover:bg-white'
                      }`}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Decoration / Custom Image Controls (Free Size & Rotation Angle) */}
            {selectedElement.type === 'decoration' && (
              <div className="space-y-3.5">
                {/* 1. Upload / Switch Image Card */}
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-700">
                      {t.customImageSectionTitle}
                    </span>
                    <button
                      type="button"
                      onClick={() => decorationImageInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs transition-colors whitespace-nowrap"
                    >
                      <ImagePlus className="w-3.5 h-3.5" />
                      <span>
                        {selectedElement.customImageUrl
                          ? t.changeImage
                          : t.uploadImageBtn}
                      </span>
                    </button>
                  </div>

                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const file = e.dataTransfer.files?.[0];
                      if (file) handleDecorationImageUpload(file);
                    }}
                    className="p-3 bg-white rounded-xl border border-dashed border-emerald-300 hover:border-emerald-500 transition-colors"
                  >
                    {selectedElement.customImageUrl ? (
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <img
                              src={selectedElement.customImageUrl}
                              alt="Custom Decoration"
                              className="w-11 h-11 rounded-lg object-contain bg-slate-100 border border-slate-200 p-1 shrink-0"
                            />
                            <div className="min-w-0">
                              <div className="text-xs font-semibold text-slate-800 truncate">
                                {selectedElement.customImageName ||
                                  t.customImageDefaultName}
                              </div>
                              <div className="text-[11px] text-emerald-700">
                                {t.customImageSubhint}
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              updateElement(
                                selectedElement.id,
                                {
                                  decorationStyle: 'penguin-mascot',
                                  customImageUrl: undefined,
                                  customImageName: undefined,
                                  rotation: 0,
                                  x: 710,
                                  y: 318,
                                  width: 220,
                                  height: 270,
                                  labelZh: '裝飾圖案 (企鵝)',
                                },
                                true
                              );
                              showToast(t.toastRestoredPenguin);
                            }}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-md shrink-0"
                            title={t.restorePenguinTitle}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>{t.restorePenguin}</span>
                          </button>
                        </div>

                        {/* Fit Mode */}
                        <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-slate-100">
                          {(
                            [
                              { id: 'contain', label: t.fitContain },
                              { id: 'cover', label: t.fitCover },
                              { id: 'fill', label: t.fitFill },
                            ] as const
                          ).map((fitOpt) => (
                            <button
                              key={fitOpt.id}
                              type="button"
                              onClick={() =>
                                updateElement(
                                  selectedElement.id,
                                  {
                                    decorationStyle: 'custom-image',
                                    imageFit: fitOpt.id,
                                  },
                                  true
                                )
                              }
                              className={`py-1.5 px-2 rounded-lg text-[11px] font-medium border transition-all ${
                                (selectedElement.imageFit || 'contain') ===
                                fitOpt.id
                                  ? 'bg-emerald-50 border-emerald-600 text-emerald-900 font-semibold'
                                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                              }`}
                            >
                              {fitOpt.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div
                        onClick={() => decorationImageInputRef.current?.click()}
                        className="flex flex-col items-center justify-center py-2.5 text-center cursor-pointer"
                      >
                        <ImagePlus className="w-5 h-5 text-emerald-600 mb-1" />
                        <div className="text-xs font-semibold text-slate-700">
                          {t.dropzoneTitle}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {t.dropzoneSub}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. Free Size & Rotation Angle Controls */}
                <div className="p-3.5 bg-white rounded-xl border border-slate-200/80 space-y-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-700">
                      {t.sizeAndAngleTitle}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        updateElement(
                          selectedElement.id,
                          {
                            x: 710,
                            y: 318,
                            width: 220,
                            height: 270,
                            rotation: 0,
                            borderRadius: 0,
                          },
                          true
                        )
                      }
                      className="text-[11px] font-medium text-emerald-700 hover:underline"
                    >
                      {t.resetSizeAndAngle}
                    </button>
                  </div>

                  {/* Proportional Scale Slider */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-600 flex items-center gap-1">
                        <Maximize2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>{t.scaleLabel}</span>
                      </span>
                      <span className="font-mono text-slate-700 tabular-nums">
                        {currentScalePercent}% ({Math.round(selectedElement.width)} ×{' '}
                        {Math.round(selectedElement.height)} px)
                      </span>
                    </div>
                    <input
                      type="range"
                      min={15}
                      max={260}
                      value={currentScalePercent}
                      onChange={(e) =>
                        handleScaleDecorationProportionally(
                          Number(e.target.value),
                          false
                        )
                      }
                      onMouseUp={(e) =>
                        handleScaleDecorationProportionally(
                          Number((e.target as HTMLInputElement).value),
                          true
                        )
                      }
                      onTouchEnd={(e) =>
                        handleScaleDecorationProportionally(
                          Number((e.target as HTMLInputElement).value),
                          true
                        )
                      }
                      className="w-full h-1.5 bg-slate-200 rounded-lg cursor-pointer accent-emerald-600"
                    />
                  </div>

                  {/* Independent Width & Height Sliders */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] text-slate-600">
                        <span>{t.widthLabel}</span>
                        <span className="font-mono tabular-nums">
                          {Math.round(selectedElement.width)} px
                        </span>
                      </div>
                      <input
                        type="range"
                        min={24}
                        max={800}
                        value={Math.round(selectedElement.width)}
                        onChange={(e) =>
                          updateElement(
                            selectedElement.id,
                            { width: Number(e.target.value) },
                            false
                          )
                        }
                        onMouseUp={(e) =>
                          updateElement(
                            selectedElement.id,
                            { width: Number((e.target as HTMLInputElement).value) },
                            true
                          )
                        }
                        onTouchEnd={(e) =>
                          updateElement(
                            selectedElement.id,
                            { width: Number((e.target as HTMLInputElement).value) },
                            true
                          )
                        }
                        className="w-full h-1.5 bg-slate-200 rounded-lg cursor-pointer accent-emerald-600"
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] text-slate-600">
                        <span>{t.heightLabel}</span>
                        <span className="font-mono tabular-nums">
                          {Math.round(selectedElement.height)} px
                        </span>
                      </div>
                      <input
                        type="range"
                        min={24}
                        max={600}
                        value={Math.round(selectedElement.height)}
                        onChange={(e) =>
                          updateElement(
                            selectedElement.id,
                            { height: Number(e.target.value) },
                            false
                          )
                        }
                        onMouseUp={(e) =>
                          updateElement(
                            selectedElement.id,
                            { height: Number((e.target as HTMLInputElement).value) },
                            true
                          )
                        }
                        onTouchEnd={(e) =>
                          updateElement(
                            selectedElement.id,
                            { height: Number((e.target as HTMLInputElement).value) },
                            true
                          )
                        }
                        className="w-full h-1.5 bg-slate-200 rounded-lg cursor-pointer accent-emerald-600"
                      />
                    </div>
                  </div>

                  {/* Rotation Angle Slider (-180° to +180°) & Quick Buttons */}
                  <div className="pt-2 border-t border-slate-100 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-600 flex items-center gap-1">
                        <RotateCw className="w-3.5 h-3.5 text-emerald-600" />
                        <span>{t.rotationLabel}</span>
                      </span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min={-180}
                          max={180}
                          value={Math.round(selectedElement.rotation || 0)}
                          onChange={(e) =>
                            updateElement(
                              selectedElement.id,
                              {
                                rotation: Math.max(
                                  -180,
                                  Math.min(180, Number(e.target.value))
                                ),
                              },
                              true
                            )
                          }
                          className="w-16 px-1.5 py-0.5 text-xs font-mono text-right bg-slate-50 border border-slate-200 rounded tabular-nums"
                        />
                        <span className="text-xs font-mono text-slate-500">°</span>
                      </div>
                    </div>

                    <input
                      type="range"
                      min={-180}
                      max={180}
                      value={Math.round(selectedElement.rotation || 0)}
                      onChange={(e) =>
                        updateElement(
                          selectedElement.id,
                          { rotation: Number(e.target.value) },
                          false
                        )
                      }
                      onMouseUp={(e) =>
                        updateElement(
                          selectedElement.id,
                          { rotation: Number((e.target as HTMLInputElement).value) },
                          true
                        )
                      }
                      onTouchEnd={(e) =>
                        updateElement(
                          selectedElement.id,
                          { rotation: Number((e.target as HTMLInputElement).value) },
                          true
                        )
                      }
                      className="w-full h-1.5 bg-slate-200 rounded-lg cursor-pointer accent-emerald-600"
                    />

                    {/* Quick Angle Presets */}
                    <div className="grid grid-cols-5 gap-1">
                      {([-90, -45, 0, 45, 90] as const).map((deg) => (
                        <button
                          key={deg}
                          type="button"
                          onClick={() =>
                            updateElement(
                              selectedElement.id,
                              { rotation: deg },
                              true
                            )
                          }
                          className={`py-1 rounded text-[11px] font-mono border transition-colors ${
                            Math.round(selectedElement.rotation || 0) === deg
                              ? 'bg-emerald-50 border-emerald-600 text-emerald-800 font-semibold'
                              : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          {deg === 0 ? t.degZero : `${deg > 0 ? `+${deg}` : deg}°`}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* If Custom Image is active, show simple Opacity & Corner Radius controls instead of vector color picker */}
                {isCustomImageActive && (
                  <div className="p-3.5 bg-white rounded-xl border border-slate-200/80 space-y-2.5">
                    <div className="text-xs font-semibold text-slate-700">
                      {t.imgOpacityAndRadius}
                    </div>
                    <div className="flex items-center gap-2.5">
                      <span className="w-16 text-xs text-slate-600 shrink-0">
                        {t.opacity}
                      </span>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={Math.round((selectedElement.opacity ?? 1) * 100)}
                        onChange={(e) =>
                          updateElement(
                            selectedElement.id,
                            { opacity: Number(e.target.value) / 100 },
                            false
                          )
                        }
                        onMouseUp={(e) =>
                          updateElement(
                            selectedElement.id,
                            {
                              opacity:
                                Number((e.target as HTMLInputElement).value) /
                                100,
                            },
                            true
                          )
                        }
                        className="flex-1 h-1.5 bg-slate-200 rounded-lg cursor-pointer accent-emerald-600"
                      />
                      <span className="w-10 text-right text-xs font-mono text-slate-600 tabular-nums">
                        {Math.round((selectedElement.opacity ?? 1) * 100)}%
                      </span>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <span className="w-16 text-xs text-slate-600 shrink-0">
                        {t.borderRadius}
                      </span>
                      <input
                        type="range"
                        min={0}
                        max={140}
                        value={Math.round(selectedElement.borderRadius ?? 0)}
                        onChange={(e) =>
                          updateElement(
                            selectedElement.id,
                            { borderRadius: Number(e.target.value) },
                            false
                          )
                        }
                        onMouseUp={(e) =>
                          updateElement(
                            selectedElement.id,
                            {
                              borderRadius: Number(
                                (e.target as HTMLInputElement).value
                              ),
                            },
                            true
                          )
                        }
                        className="flex-1 h-1.5 bg-slate-200 rounded-lg cursor-pointer accent-emerald-600"
                      />
                      <span className="w-10 text-right text-xs font-mono text-slate-600 tabular-nums">
                        {Math.round(selectedElement.borderRadius ?? 0)}px
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Text Control Panel when a Text element is selected */}
            {selectedElement.type === 'text' && (
              <TextControlPanel
                lang={lang}
                element={selectedElement as TextCardElement}
                allTextElements={allTextElements}
                onSelectElement={(id) => selectElementAndSyncTab(id, false)}
                onUpdateTextElement={(id, updates, commit) =>
                  updateElement(id, updates, commit)
                }
                onAddTextElement={handleAddTextElement}
              />
            )}

            {/* Universal Color Control Panel (Hidden when custom image is active to keep settings clean) */}
            {!isCustomImageActive && (
              <ColorControlPanel
                lang={lang}
                label={`${selectedElementLabel} ${t.colorSettingSuffix}`}
                color={selectedElement.fill || selectedElement.color}
                opacity={selectedElement.opacity}
                brightness={selectedElement.brightness || 0}
                secondaryColor={selectedElement.secondaryFill}
                secondaryLabel={
                  selectedElement.id === 'decoration'
                    ? t.secondaryPenguin
                    : selectedElement.id === 'logo'
                    ? t.secondaryLogo
                    : selectedElement.id === 'background'
                    ? t.secondaryBackground
                    : undefined
                }
                onChangeColor={(newHex, commit) =>
                  updateElement(
                    selectedElement.id,
                    { fill: newHex, color: newHex },
                    commit
                  )
                }
                onChangeOpacity={(newOpacity, commit) =>
                  updateElement(
                    selectedElement.id,
                    { opacity: newOpacity },
                    commit
                  )
                }
                onChangeBrightness={(newBrightness, commit) =>
                  updateElement(
                    selectedElement.id,
                    { brightness: newBrightness },
                    commit
                  )
                }
                onChangeSecondaryColor={
                  selectedElement.secondaryFill !== undefined
                    ? (newHex, commit) =>
                        updateElement(
                          selectedElement.id,
                          { secondaryFill: newHex },
                          commit
                        )
                    : undefined
                }
                customPresets={customPresets}
                onAddCustomPreset={handleAddCustomPreset}
                onRemoveCustomPreset={handleRemoveCustomPreset}
              />
            )}
          </div>
        </aside>
      </main>

      {/* Mobile-Friendly Export & Save PNG Modal (Supports Long-Press to Save to Photos, Native Share Sheet & Direct Blob Download) */}
      {exportedImage && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
          onClick={() => setExportedImage(null)}
        >
          <div
            className="bg-white rounded-2xl border border-slate-200 max-w-xl w-full p-4 sm:p-5 space-y-4 shadow-2xl my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900">
                  {t.exportModalTitle}
                </h3>
                <p className="text-xs font-mono text-slate-500">
                  {exportedImage.width} × {exportedImage.height} px (
                  {exportedImage.scale}x)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setExportedImage(null)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                <span>{t.close}</span>
              </button>
            </div>

            {/* Prominent Mobile Long-Press Instruction Banner */}
            <div className="px-3.5 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-medium text-emerald-900 leading-relaxed">
              {t.exportModalMobileTip}
            </div>

            {/* Rendered High-Res PNG Image (Supports Native Mobile Long-Press -> Save to Photos) */}
            <div className="bg-slate-100 rounded-xl p-3 sm:p-4 border border-slate-200/80 flex items-center justify-center">
              <img
                src={exportedImage.dataUrl}
                alt={exportedImage.filename}
                className="w-full max-w-[480px] h-auto block rounded-[16px] shadow-md select-auto pointer-events-auto"
                style={{
                  WebkitTouchCallout: 'default',
                  WebkitUserSelect: 'auto',
                  userSelect: 'auto',
                }}
              />
            </div>

            {/* Resolution Switcher inside Modal */}
            <div className="flex items-center justify-between gap-2 pt-1">
              <span className="text-xs font-semibold text-slate-700">
                {t.resolution}
              </span>
              <div className="inline-flex p-1 bg-slate-100 rounded-xl gap-1">
                {(
                  [
                    { scale: 1, label: '1x (1012×638)' },
                    { scale: 2, label: '2x (2024×1276)' },
                    { scale: 3, label: '3x (3036×1914)' },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.scale}
                    type="button"
                    onClick={() => {
                      setPngScale(item.scale);
                      setExportedImage(generateExportPngPayload(item.scale));
                    }}
                    className={`py-1 px-2.5 rounded-lg text-xs transition-all whitespace-nowrap ${
                      exportedImage.scale === item.scale
                        ? 'bg-white text-slate-900 shadow-xs font-bold'
                        : 'text-slate-600 hover:text-slate-900 font-medium'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Action Buttons: Share / Save to Photos, Direct File Download, Copy Image */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
              <button
                type="button"
                onClick={handleShareOrSaveImage}
                className="inline-flex items-center justify-center gap-1.5 py-2.5 px-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>{t.exportModalShareBtn}</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  triggerBlobDownload(
                    exportedImage.blob,
                    exportedImage.filename
                  )
                }
                className="inline-flex items-center justify-center gap-1.5 py-2.5 px-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{t.exportModalDownloadBtn}</span>
              </button>

              <button
                type="button"
                onClick={handleCopyExportedImage}
                className="inline-flex items-center justify-center gap-1.5 py-2.5 px-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{t.exportModalCopyBtn}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 px-4 py-2.5 bg-slate-900 text-white text-xs font-medium rounded-xl shadow-lg flex items-center gap-2 pointer-events-none">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
