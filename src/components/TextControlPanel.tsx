import React from 'react';
import { AlignCenter, AlignLeft, AlignRight, Plus } from 'lucide-react';
import {
  DEFAULT_CANVAS_HEIGHT,
  DEFAULT_CANVAS_WIDTH,
  FONT_OPTIONS,
  TextCardElement,
} from '../types/card';
import { getElementDisplayLabel, Language, UI_TEXT } from '../utils/i18n';

interface TextControlPanelProps {
  lang: Language;
  element: TextCardElement;
  allTextElements: TextCardElement[];
  onSelectElement: (id: string) => void;
  onUpdateTextElement: (
    id: string,
    updates: Partial<TextCardElement>,
    commitHistory?: boolean
  ) => void;
  onAddTextElement: () => void;
}

export const TextControlPanel: React.FC<TextControlPanelProps> = ({
  lang,
  element,
  allTextElements,
  onSelectElement,
  onUpdateTextElement,
  onAddTextElement,
}) => {
  const t = UI_TEXT[lang];

  return (
    <div className="space-y-4">
      {/* Quick Switcher between all Text Elements */}
      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-700">
            {t.selectTextBlock}
          </span>
          <button
            type="button"
            onClick={onAddTextElement}
            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-md transition-colors whitespace-nowrap"
          >
            <Plus className="w-3 h-3" />
            <span>{t.addTextField}</span>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          {allTextElements.map((tEl) => (
            <button
              key={tEl.id}
              type="button"
              onClick={() => onSelectElement(tEl.id)}
              className={`px-2.5 py-2 rounded-lg text-left text-xs transition-all border ${
                tEl.id === element.id
                  ? 'bg-white border-emerald-600 text-slate-900 shadow-xs ring-1 ring-emerald-600/20 font-semibold'
                  : 'bg-white/60 border-slate-200 text-slate-600 hover:bg-white hover:text-slate-900'
              }`}
            >
              <div className="truncate">{getElementDisplayLabel(tEl, lang)}</div>
              <div className="text-[11px] text-slate-400 truncate font-mono mt-0.5">
                {tEl.text || t.emptyText}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Text Content & Font Settings */}
      <div className="p-3.5 bg-white rounded-xl border border-slate-200/80 space-y-3.5">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            {t.textContentLabel}
          </label>
          <textarea
            rows={2}
            value={element.text}
            onChange={(e) =>
              onUpdateTextElement(element.id, { text: e.target.value }, true)
            }
            placeholder={t.textPlaceholder}
            className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
          />
        </div>

        {/* Font Family */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            {t.fontFamilyLabel}
          </label>
          <select
            value={element.fontFamily}
            onChange={(e) =>
              onUpdateTextElement(
                element.id,
                { fontFamily: e.target.value },
                true
              )
            }
            className="w-full px-2.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
          >
            {FONT_OPTIONS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </div>

        {/* Alignment & Weight */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {t.textAlignLabel}
            </label>
            <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-lg">
              {(
                [
                  { value: 'left', icon: AlignLeft, label: t.alignLeft },
                  { value: 'center', icon: AlignCenter, label: t.alignCenter },
                  { value: 'right', icon: AlignRight, label: t.alignRight },
                ] as const
              ).map((item) => {
                const Icon = item.icon;
                const active = element.textAlign === item.value;
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() =>
                      onUpdateTextElement(
                        element.id,
                        { textAlign: item.value },
                        true
                      )
                    }
                    className={`flex items-center justify-center py-1.5 rounded-md text-xs font-medium transition-colors ${
                      active
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                    title={item.label}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {t.fontWeightLabel}
            </label>
            <select
              value={element.fontWeight}
              onChange={(e) =>
                onUpdateTextElement(
                  element.id,
                  { fontWeight: Number(e.target.value) },
                  true
                )
              }
              className="w-full px-2.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600 font-mono tabular-nums"
            >
              <option value={400}>400 (Regular)</option>
              <option value={500}>500 (Medium)</option>
              <option value={600}>600 (SemiBold)</option>
              <option value={700}>700 (Bold)</option>
              <option value={800}>800 (ExtraBold)</option>
              <option value={900}>900 (Black)</option>
            </select>
          </div>
        </div>

        {/* Classic Suica Hollow 'i' & 'c' Style Toggle */}
        <label className="flex items-center justify-between p-2.5 bg-emerald-50/60 border border-emerald-200/70 rounded-lg cursor-pointer">
          <div>
            <div className="text-xs font-semibold text-emerald-950">
              {t.suicaHollowTitle}
            </div>
            <div className="text-[11px] text-emerald-700">
              {t.suicaHollowDesc}
            </div>
          </div>
          <input
            type="checkbox"
            checked={Boolean(element.suicaInlineStyle)}
            onChange={(e) =>
              onUpdateTextElement(
                element.id,
                { suicaInlineStyle: e.target.checked },
                true
              )
            }
            className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
          />
        </label>

        {/* Font Size Slider */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="font-medium text-slate-600">{t.fontSizeLabel}</span>
            <span className="font-mono text-slate-700 tabular-nums">
              {element.fontSize} px
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            <input
              type="range"
              min={10}
              max={220}
              value={element.fontSize}
              onChange={(e) =>
                onUpdateTextElement(
                  element.id,
                  { fontSize: Number(e.target.value) },
                  false
                )
              }
              onMouseUp={(e) =>
                onUpdateTextElement(
                  element.id,
                  { fontSize: Number((e.target as HTMLInputElement).value) },
                  true
                )
              }
              onTouchEnd={(e) =>
                onUpdateTextElement(
                  element.id,
                  { fontSize: Number((e.target as HTMLInputElement).value) },
                  true
                )
              }
              className="flex-1 h-1.5 bg-slate-200 rounded-lg cursor-pointer accent-emerald-600"
            />
            <input
              type="number"
              min={8}
              max={300}
              value={element.fontSize}
              onChange={(e) =>
                onUpdateTextElement(
                  element.id,
                  { fontSize: Math.max(8, Number(e.target.value)) },
                  true
                )
              }
              className="w-16 px-2 py-1 text-xs font-mono text-right bg-slate-50 border border-slate-200 rounded-md tabular-nums"
            />
          </div>
        </div>

        {/* Letter Spacing */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="font-medium text-slate-600">
              {t.letterSpacingLabel}
            </span>
            <span className="font-mono text-slate-700 tabular-nums">
              {element.letterSpacing} px
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            <input
              type="range"
              min={-10}
              max={50}
              step={0.5}
              value={element.letterSpacing}
              onChange={(e) =>
                onUpdateTextElement(
                  element.id,
                  { letterSpacing: Number(e.target.value) },
                  false
                )
              }
              onMouseUp={(e) =>
                onUpdateTextElement(
                  element.id,
                  {
                    letterSpacing: Number((e.target as HTMLInputElement).value),
                  },
                  true
                )
              }
              onTouchEnd={(e) =>
                onUpdateTextElement(
                  element.id,
                  {
                    letterSpacing: Number((e.target as HTMLInputElement).value),
                  },
                  true
                )
              }
              className="flex-1 h-1.5 bg-slate-200 rounded-lg cursor-pointer accent-emerald-600"
            />
            <input
              type="number"
              min={-20}
              max={100}
              step={0.5}
              value={element.letterSpacing}
              onChange={(e) =>
                onUpdateTextElement(
                  element.id,
                  { letterSpacing: Number(e.target.value) },
                  true
                )
              }
              className="w-16 px-2 py-1 text-xs font-mono text-right bg-slate-50 border border-slate-200 rounded-md tabular-nums"
            />
          </div>
        </div>

        {/* Line Height */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="font-medium text-slate-600">
              {t.lineHeightLabel}
            </span>
            <span className="font-mono text-slate-700 tabular-nums">
              {element.lineHeight}x
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            <input
              type="range"
              min={0.8}
              max={2.5}
              step={0.05}
              value={element.lineHeight}
              onChange={(e) =>
                onUpdateTextElement(
                  element.id,
                  { lineHeight: Number(e.target.value) },
                  false
                )
              }
              onMouseUp={(e) =>
                onUpdateTextElement(
                  element.id,
                  { lineHeight: Number((e.target as HTMLInputElement).value) },
                  true
                )
              }
              onTouchEnd={(e) =>
                onUpdateTextElement(
                  element.id,
                  { lineHeight: Number((e.target as HTMLInputElement).value) },
                  true
                )
              }
              className="flex-1 h-1.5 bg-slate-200 rounded-lg cursor-pointer accent-emerald-600"
            />
            <input
              type="number"
              min={0.5}
              max={3}
              step={0.05}
              value={element.lineHeight}
              onChange={(e) =>
                onUpdateTextElement(
                  element.id,
                  { lineHeight: Number(e.target.value) },
                  true
                )
              }
              className="w-16 px-2 py-1 text-xs font-mono text-right bg-slate-50 border border-slate-200 rounded-md tabular-nums"
            />
          </div>
        </div>

        {/* X and Y Position */}
        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              {t.posXLabel}
            </label>
            <input
              type="number"
              min={0}
              max={DEFAULT_CANVAS_WIDTH}
              value={Math.round(element.x)}
              onChange={(e) =>
                onUpdateTextElement(
                  element.id,
                  { x: Number(e.target.value) },
                  true
                )
              }
              className="w-full px-2.5 py-1.5 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg tabular-nums"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              {t.posYLabel}
            </label>
            <input
              type="number"
              min={0}
              max={DEFAULT_CANVAS_HEIGHT}
              value={Math.round(element.y)}
              onChange={(e) =>
                onUpdateTextElement(
                  element.id,
                  { y: Number(e.target.value) },
                  true
                )
              }
              className="w-full px-2.5 py-1.5 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg tabular-nums"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
