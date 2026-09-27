import React, { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import { BUILTIN_COLOR_PRESETS, ColorPresetItem } from '../types/card';
import {
  hexToHsl,
  hexToRgb,
  hslToHex,
  isValidHex,
  normalizeHex,
  rgbToHex,
} from '../utils/color';
import { Language, UI_TEXT } from '../utils/i18n';

interface ColorControlPanelProps {
  lang: Language;
  label: string;
  color: string;
  opacity: number; // 0 to 1
  brightness: number; // -100 to 100
  secondaryColor?: string;
  secondaryLabel?: string;
  onChangeColor: (newHex: string, commitHistory?: boolean) => void;
  onChangeOpacity: (newOpacity: number, commitHistory?: boolean) => void;
  onChangeBrightness: (newBrightness: number, commitHistory?: boolean) => void;
  onChangeSecondaryColor?: (newHex: string, commitHistory?: boolean) => void;
  customPresets: ColorPresetItem[];
  onAddCustomPreset: (hex: string) => void;
  onRemoveCustomPreset: (id: string) => void;
}

export const ColorControlPanel: React.FC<ColorControlPanelProps> = ({
  lang,
  label,
  color,
  opacity,
  brightness,
  secondaryColor,
  secondaryLabel,
  onChangeColor,
  onChangeOpacity,
  onChangeBrightness,
  onChangeSecondaryColor,
  customPresets,
  onAddCustomPreset,
  onRemoveCustomPreset,
}) => {
  const t = UI_TEXT[lang];
  const normalizedHex = normalizeHex(color);
  const rgb = hexToRgb(normalizedHex);
  const hsl = hexToHsl(normalizedHex);

  const [hexInput, setHexInput] = useState(normalizedHex);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    setHexInput(normalizeHex(color));
  }, [color]);

  const handleHexInputChange = (val: string) => {
    setHexInput(val);
    const withHash = val.startsWith('#') ? val : `#${val}`;
    if (isValidHex(withHash) && (withHash.length === 7 || withHash.length === 4)) {
      onChangeColor(normalizeHex(withHash), true);
    }
  };

  const handleRgbChange = (channel: 'r' | 'g' | 'b', value: number, commit = false) => {
    const nextRgb = { ...rgb, [channel]: Math.max(0, Math.min(255, Math.round(value))) };
    onChangeColor(rgbToHex(nextRgb), commit);
  };

  const handleHslChange = (channel: 'h' | 's' | 'l', value: number, commit = false) => {
    const maxVal = channel === 'h' ? 360 : 100;
    const nextHsl = { ...hsl, [channel]: Math.max(0, Math.min(maxVal, Math.round(value))) };
    onChangeColor(hslToHex(nextHsl), commit);
  };

  const opacityPct = Math.round((opacity ?? 1) * 100);

  return (
    <div className="space-y-3.5">
      {/* Primary Color Picker, HEX & Opacity Card */}
      <div className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200/80 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-700">{label}</span>
          <span className="font-mono text-[11px] text-slate-400 tabular-nums">
            RGB({rgb.r}, {rgb.g}, {rgb.b})
          </span>
        </div>

        <div className="flex items-center gap-3">
          <label className="relative flex items-center cursor-pointer shrink-0">
            <input
              type="color"
              value={normalizedHex}
              onChange={(e) => onChangeColor(e.target.value.toUpperCase(), false)}
              onBlur={(e) => onChangeColor(e.target.value.toUpperCase(), true)}
              className="sr-only"
            />
            <span
              className="w-10 h-10 rounded-lg border-2 border-white shadow-sm ring-1 ring-slate-300 block transition-transform hover:scale-105"
              style={{ backgroundColor: normalizedHex }}
              title={t.openColorPicker}
            />
          </label>

          <div className="flex-1">
            <label className="block text-[11px] font-medium text-slate-500 mb-0.5">
              {t.hexCode}
            </label>
            <input
              type="text"
              value={hexInput}
              onChange={(e) => handleHexInputChange(e.target.value)}
              onBlur={() => setHexInput(normalizedHex)}
              placeholder="#008C95"
              maxLength={7}
              className="w-full px-2.5 py-1.5 text-sm font-mono font-semibold uppercase bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 tabular-nums"
            />
          </div>
        </div>

        {/* Opacity Slider right in the main card */}
        <div className="flex items-center gap-2.5 pt-1">
          <span className="w-16 text-xs font-medium text-slate-600 shrink-0">
            {t.opacity}
          </span>
          <input
            type="range"
            min={0}
            max={100}
            value={opacityPct}
            onChange={(e) => onChangeOpacity(Number(e.target.value) / 100, false)}
            onMouseUp={(e) =>
              onChangeOpacity(Number((e.target as HTMLInputElement).value) / 100, true)
            }
            onTouchEnd={(e) =>
              onChangeOpacity(Number((e.target as HTMLInputElement).value) / 100, true)
            }
            className="flex-1 h-1.5 bg-slate-200 rounded-lg cursor-pointer accent-emerald-600"
          />
          <span className="w-11 text-right text-xs font-mono text-slate-600 tabular-nums">
            {opacityPct}%
          </span>
        </div>

        {/* Secondary Fill (if applicable, e.g., Penguin Belly, Logo Ring, Card Border) */}
        {secondaryColor && onChangeSecondaryColor && (
          <div className="pt-2.5 border-t border-slate-200/70 flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-slate-600">
              {secondaryLabel || t.secondaryDefault}
            </span>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={normalizeHex(secondaryColor)}
                onChange={(e) => onChangeSecondaryColor(e.target.value.toUpperCase(), true)}
                className="w-7 h-7 rounded cursor-pointer border border-slate-200 bg-white p-0.5"
              />
              <input
                type="text"
                value={normalizeHex(secondaryColor)}
                onChange={(e) => {
                  const v = e.target.value;
                  if (isValidHex(v) && v.replace('#', '').length === 6) {
                    onChangeSecondaryColor(normalizeHex(v), true);
                  }
                }}
                className="w-22 px-2 py-1 text-xs font-mono uppercase bg-white border border-slate-200 rounded-md tabular-nums"
              />
            </div>
          </div>
        )}
      </div>

      {/* Quick Color Swatches (Presets + Custom) */}
      <div className="p-3.5 bg-white rounded-xl border border-slate-200/80 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-700">
            {t.colorPresetsTitle}
          </span>
          <button
            type="button"
            onClick={() => onAddCustomPreset(normalizedHex)}
            disabled={customPresets.length >= 10}
            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-40 rounded-md transition-colors whitespace-nowrap"
          >
            <Plus className="w-3 h-3" />
            <span>
              {t.savePreset} ({customPresets.length}/10)
            </span>
          </button>
        </div>

        <div className="grid grid-cols-4 gap-1.5">
          {BUILTIN_COLOR_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => onChangeColor(preset.hex, true)}
              className={`group flex items-center gap-1.5 p-1.5 rounded-lg border text-left transition-all ${
                normalizedHex === preset.hex
                  ? 'border-emerald-600 bg-emerald-50/50 ring-1 ring-emerald-600/30'
                  : 'border-slate-200 hover:border-slate-300 bg-slate-50/40'
              }`}
              title={`${preset.name} (${preset.hex})`}
            >
              <span
                className="w-4 h-4 rounded-sm border border-slate-300/80 shrink-0"
                style={{ backgroundColor: preset.hex }}
              />
              <span className="text-[11px] font-medium text-slate-700 truncate">
                {preset.name.replace('Suica ', '')}
              </span>
            </button>
          ))}
        </div>

        {customPresets.length > 0 && (
          <div className="pt-2 border-t border-slate-100 flex flex-wrap gap-1.5">
            {customPresets.map((cp) => (
              <div
                key={cp.id}
                className="inline-flex items-center gap-1 pl-1.5 pr-1 py-1 bg-slate-50 border border-slate-200 rounded-md text-xs font-mono"
              >
                <button
                  type="button"
                  onClick={() => onChangeColor(cp.hex, true)}
                  className="inline-flex items-center gap-1.5 hover:text-emerald-700"
                >
                  <span
                    className="w-3.5 h-3.5 rounded-xs border border-slate-300"
                    style={{ backgroundColor: cp.hex }}
                  />
                  <span className="text-[11px] tabular-nums">{cp.hex}</span>
                </button>
                <button
                  type="button"
                  onClick={() => onRemoveCustomPreset(cp.id)}
                  className="p-0.5 text-slate-400 hover:text-rose-600 rounded"
                  title={t.deleteCustomPreset}
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Collapsible Advanced RGB / HSL / Brightness Controls */}
      <div className="bg-white rounded-xl border border-slate-200/80 overflow-hidden">
        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          className="w-full px-3.5 py-2.5 flex items-center justify-between text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
        >
          <span>{t.advancedColorToggle}</span>
          {showAdvanced ? (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          )}
        </button>

        {showAdvanced && (
          <div className="p-3.5 pt-2 border-t border-slate-100 space-y-3">
            {/* RGB Sliders */}
            <div className="space-y-2">
              <div className="text-[11px] font-semibold text-slate-500">
                {t.rgbChannels} ({rgb.r}, {rgb.g}, {rgb.b})
              </div>
              {(
                [
                  { key: 'r', name: 'R', val: rgb.r, accent: 'accent-rose-500' },
                  { key: 'g', name: 'G', val: rgb.g, accent: 'accent-emerald-600' },
                  { key: 'b', name: 'B', val: rgb.b, accent: 'accent-sky-600' },
                ] as const
              ).map((item) => (
                <div key={item.key} className="flex items-center gap-2">
                  <span className="w-6 text-xs font-mono font-semibold text-slate-600">
                    {item.name}
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={255}
                    value={item.val}
                    onChange={(e) => handleRgbChange(item.key, Number(e.target.value), false)}
                    onMouseUp={(e) =>
                      handleRgbChange(item.key, Number((e.target as HTMLInputElement).value), true)
                    }
                    onTouchEnd={(e) =>
                      handleRgbChange(item.key, Number((e.target as HTMLInputElement).value), true)
                    }
                    className={`flex-1 h-1.5 bg-slate-200 rounded-lg cursor-pointer ${item.accent}`}
                  />
                  <input
                    type="number"
                    min={0}
                    max={255}
                    value={item.val}
                    onChange={(e) => handleRgbChange(item.key, Number(e.target.value), true)}
                    className="w-13 px-1.5 py-0.5 text-xs font-mono text-right bg-slate-50 border border-slate-200 rounded tabular-nums"
                  />
                </div>
              ))}
            </div>

            {/* HSL + Brightness Sliders */}
            <div className="pt-2 border-t border-slate-100 space-y-2">
              <div className="text-[11px] font-semibold text-slate-500">
                {t.hslAndBrightness} ({hsl.h}°, {hsl.s}%, {hsl.l}%)
              </div>
              {(
                [
                  { key: 'h', label: t.hueH, max: 360, val: hsl.h },
                  { key: 's', label: t.satS, max: 100, val: hsl.s },
                  { key: 'l', label: t.lightL, max: 100, val: hsl.l },
                ] as const
              ).map((item) => (
                <div key={item.key} className="flex items-center gap-2">
                  <span className="w-12 text-xs text-slate-600 shrink-0">
                    {item.label}
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={item.max}
                    value={item.val}
                    onChange={(e) => handleHslChange(item.key, Number(e.target.value), false)}
                    onMouseUp={(e) =>
                      handleHslChange(item.key, Number((e.target as HTMLInputElement).value), true)
                    }
                    onTouchEnd={(e) =>
                      handleHslChange(item.key, Number((e.target as HTMLInputElement).value), true)
                    }
                    className="flex-1 h-1.5 bg-slate-200 rounded-lg cursor-pointer accent-emerald-600"
                  />
                  <input
                    type="number"
                    min={0}
                    max={item.max}
                    value={item.val}
                    onChange={(e) => handleHslChange(item.key, Number(e.target.value), true)}
                    className="w-13 px-1.5 py-0.5 text-xs font-mono text-right bg-slate-50 border border-slate-200 rounded tabular-nums"
                  />
                </div>
              ))}

              <div className="flex items-center gap-2">
                <span className="w-12 text-xs text-slate-600 shrink-0">
                  {t.brightnessDiff}
                </span>
                <input
                  type="range"
                  min={-100}
                  max={100}
                  value={brightness || 0}
                  onChange={(e) => onChangeBrightness(Number(e.target.value), false)}
                  onMouseUp={(e) =>
                    onChangeBrightness(Number((e.target as HTMLInputElement).value), true)
                  }
                  onTouchEnd={(e) =>
                    onChangeBrightness(Number((e.target as HTMLInputElement).value), true)
                  }
                  className="flex-1 h-1.5 bg-slate-200 rounded-lg cursor-pointer accent-amber-500"
                />
                <input
                  type="number"
                  min={-100}
                  max={100}
                  value={brightness || 0}
                  onChange={(e) => onChangeBrightness(Number(e.target.value), true)}
                  className="w-13 px-1.5 py-0.5 text-xs font-mono text-right bg-slate-50 border border-slate-200 rounded tabular-nums"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
