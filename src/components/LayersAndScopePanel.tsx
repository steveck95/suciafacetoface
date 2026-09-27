import React from 'react';
import {
  ArrowDown,
  ArrowUp,
  Crosshair,
  Eye,
  EyeOff,
  Lock,
  Pipette,
  Plus,
  SquareDashedMousePointer,
  Trash2,
  Unlock,
} from 'lucide-react';
import {
  CardElement,
  DEFAULT_CANVAS_HEIGHT,
  DEFAULT_CANVAS_WIDTH,
  ScopeColorRule,
} from '../types/card';
import { hexToHsl, hexToRgb, isValidHex, normalizeHex } from '../utils/color';

interface LayersPanelProps {
  elements: CardElement[];
  selectedElementId: string;
  onSelectElement: (id: string) => void;
  onToggleVisible: (id: string) => void;
  onToggleLock: (id: string) => void;
  onMoveLayer: (id: string, direction: 'up' | 'down') => void;
  onDeleteElement: (id: string) => void;
  onAddCustomRegion: () => void;
  isDrawCustomRegionMode: boolean;
  onToggleDrawCustomRegionMode: () => void;
}

export const LayersPanel: React.FC<LayersPanelProps> = ({
  elements,
  selectedElementId,
  onSelectElement,
  onToggleVisible,
  onToggleLock,
  onMoveLayer,
  onDeleteElement,
  onAddCustomRegion,
  isDrawCustomRegionMode,
  onToggleDrawCustomRegionMode,
}) => {
  // Display top-most layer first in UI (standard graphics editor convention)
  const reversed = [...elements].reverse();

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-semibold text-slate-700">
          圖層順序與狀態 (上層在前)
        </span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onToggleDrawCustomRegionMode}
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
              isDrawCustomRegionMode
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
            title="在卡面上直接用滑鼠或手指拖曳建立自訂矩形區域"
          >
            <SquareDashedMousePointer className="w-3.5 h-3.5" />
            <span>{isDrawCustomRegionMode ? '請在卡面拖曳...' : '拖曳新增區域'}</span>
          </button>
          <button
            type="button"
            onClick={onAddCustomRegion}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-900 text-white hover:bg-slate-800 rounded-lg text-xs font-medium transition-colors whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Custom Region</span>
          </button>
        </div>
      </div>

      <div className="divide-y divide-slate-100 bg-white rounded-xl border border-slate-200/80 overflow-hidden">
        {reversed.map((el, revIdx) => {
          const actualIdx = elements.length - 1 - revIdx;
          const isSelected = el.id === selectedElementId;
          const isRemovable =
            el.category === 'custom' ||
            (el.type === 'text' &&
              !['main-text', 'subtitle', 'small-text', 'number'].includes(el.id));

          return (
            <div
              key={el.id}
              onClick={() => onSelectElement(el.id)}
              className={`flex items-center justify-between gap-2 px-3 py-2.5 cursor-pointer transition-colors ${
                isSelected
                  ? 'bg-emerald-50/70 text-slate-900'
                  : 'hover:bg-slate-50 text-slate-700'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <span
                  className="w-4 h-4 rounded-sm border border-slate-300 shrink-0 shadow-2xs"
                  style={{ backgroundColor: el.fill || el.color }}
                />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold truncate flex items-center gap-1.5">
                    <span>{el.name}</span>
                    <span className="text-[11px] font-normal text-slate-400">
                      · {el.labelZh}
                    </span>
                  </div>
                  <div className="text-[11px] font-mono text-slate-400 tabular-nums">
                    X:{Math.round(el.x)} Y:{Math.round(el.y)} · {(el.fill || el.color).toUpperCase()}
                  </div>
                </div>
              </div>

              <div
                className="flex items-center gap-0.5 shrink-0"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={() => onMoveLayer(el.id, 'up')}
                  disabled={actualIdx === elements.length - 1}
                  className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-30 rounded-md"
                  title="上移一層"
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onMoveLayer(el.id, 'down')}
                  disabled={actualIdx === 0}
                  className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-30 rounded-md"
                  title="下移一層"
                >
                  <ArrowDown className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onToggleLock(el.id)}
                  className={`p-1.5 rounded-md ${
                    el.locked
                      ? 'text-amber-600 bg-amber-50'
                      : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                  }`}
                  title={el.locked ? '解除鎖定' : '鎖定圖層'}
                >
                  {el.locked ? (
                    <Lock className="w-3.5 h-3.5" />
                  ) : (
                    <Unlock className="w-3.5 h-3.5" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => onToggleVisible(el.id)}
                  className={`p-1.5 rounded-md ${
                    !el.visible
                      ? 'text-slate-300 bg-slate-50'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                  title={el.visible ? '隱藏圖層' : '顯示圖層'}
                >
                  {el.visible ? (
                    <Eye className="w-3.5 h-3.5" />
                  ) : (
                    <EyeOff className="w-3.5 h-3.5" />
                  )}
                </button>
                {isRemovable && (
                  <button
                    type="button"
                    onClick={() => onDeleteElement(el.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md"
                    title="刪除此自訂圖層"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

interface ScopeControlPanelProps {
  elements: CardElement[];
  scopeRules: ScopeColorRule[];
  draftScope: {
    x: number;
    y: number;
    width: number;
    height: number;
    color: string;
    opacity: number;
    targetElementId: string;
    showPreview: boolean;
  };
  onChangeDraftScope: (
    updates: Partial<ScopeControlPanelProps['draftScope']>
  ) => void;
  onApplyScopeRule: () => void;
  onToggleScopeRule: (id: string) => void;
  onDeleteScopeRule: (id: string) => void;
  isDrawScopeMode: boolean;
  onToggleDrawScopeMode: () => void;
  pickedColor: string | null;
  isEyedropperActive: boolean;
  onToggleEyedropper: () => void;
  onApplyPickedColorToSelected: (hex: string) => void;
}

export const ScopeControlPanel: React.FC<ScopeControlPanelProps> = ({
  elements,
  scopeRules,
  draftScope,
  onChangeDraftScope,
  onApplyScopeRule,
  onToggleScopeRule,
  onDeleteScopeRule,
  isDrawScopeMode,
  onToggleDrawScopeMode,
  pickedColor,
  isEyedropperActive,
  onToggleEyedropper,
  onApplyPickedColorToSelected,
}) => {
  const pickedNormalized = pickedColor ? normalizeHex(pickedColor) : '#6BB927';
  const pickedRgb = hexToRgb(pickedNormalized);
  const pickedHsl = hexToHsl(pickedNormalized);

  return (
    <div className="space-y-4">
      {/* Eyedropper Tool Card (Section 四: 取色工具) */}
      <div className="p-3.5 bg-white rounded-xl border border-slate-200/80 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-xs font-semibold text-slate-800">
              卡面取色工具 (Eyedropper)
            </h4>
            <p className="text-[11px] text-slate-500">
              點擊卡面任意位置，立即取得該座標像素之 HEX / RGB / HSL
            </p>
          </div>
          <button
            type="button"
            onClick={onToggleEyedropper}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
              isEyedropperActive
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-slate-900 text-white hover:bg-slate-800'
            }`}
          >
            <Pipette className="w-3.5 h-3.5" />
            <span>{isEyedropperActive ? '請點擊卡面取色...' : '啟動取色工具'}</span>
          </button>
        </div>

        <div className="flex items-center justify-between gap-3 p-2.5 bg-slate-50 rounded-lg border border-slate-200/70">
          <div className="flex items-center gap-2.5">
            <span
              className="w-9 h-9 rounded-lg border border-slate-300 shadow-2xs shrink-0"
              style={{ backgroundColor: pickedNormalized }}
            />
            <div className="font-mono text-xs space-y-0.5 tabular-nums">
              <div className="font-semibold text-slate-900">
                HEX: {pickedNormalized}
              </div>
              <div className="text-[11px] text-slate-600">
                RGB: ({pickedRgb.r}, {pickedRgb.g}, {pickedRgb.b}) · HSL: (
                {pickedHsl.h}°, {pickedHsl.s}%, {pickedHsl.l}%)
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onApplyPickedColorToSelected(pickedNormalized)}
            className="px-2.5 py-1.5 bg-white border border-slate-200 hover:border-emerald-600 hover:text-emerald-700 rounded-lg text-xs font-medium transition-colors whitespace-nowrap"
          >
            套用至選中元素
          </button>
        </div>
      </div>

      {/* Rectangular Scope Color Override (Section 四: 指定範圍 X, Y, Width, Height) */}
      <div className="p-3.5 bg-white rounded-xl border border-slate-200/80 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h4 className="text-xs font-semibold text-slate-800">
              指定矩形範圍局部調色 (X / Y / Width / Height)
            </h4>
            <p className="text-[11px] text-slate-500">
              只修改矩形範圍內的指定元素顏色，範圍外保持原色
            </p>
          </div>
          <button
            type="button"
            onClick={onToggleDrawScopeMode}
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
              isDrawScopeMode
                ? 'bg-sky-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Crosshair className="w-3.5 h-3.5" />
            <span>{isDrawScopeMode ? '在卡面拖曳框選中...' : '卡面拖曳框選'}</span>
          </button>
        </div>

        <div className="grid grid-cols-4 gap-2">
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">
              X 座標
            </label>
            <input
              type="number"
              min={0}
              max={DEFAULT_CANVAS_WIDTH}
              value={Math.round(draftScope.x)}
              onChange={(e) =>
                onChangeDraftScope({ x: Number(e.target.value), showPreview: true })
              }
              className="w-full px-2 py-1.5 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg tabular-nums"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">
              Y 座標
            </label>
            <input
              type="number"
              min={0}
              max={DEFAULT_CANVAS_HEIGHT}
              value={Math.round(draftScope.y)}
              onChange={(e) =>
                onChangeDraftScope({ y: Number(e.target.value), showPreview: true })
              }
              className="w-full px-2 py-1.5 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg tabular-nums"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">
              Width 寬度
            </label>
            <input
              type="number"
              min={1}
              max={DEFAULT_CANVAS_WIDTH}
              value={Math.round(draftScope.width)}
              onChange={(e) =>
                onChangeDraftScope({
                  width: Math.max(1, Number(e.target.value)),
                  showPreview: true,
                })
              }
              className="w-full px-2 py-1.5 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg tabular-nums"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">
              Height 高度
            </label>
            <input
              type="number"
              min={1}
              max={DEFAULT_CANVAS_HEIGHT}
              value={Math.round(draftScope.height)}
              onChange={(e) =>
                onChangeDraftScope({
                  height: Math.max(1, Number(e.target.value)),
                  showPreview: true,
                })
              }
              className="w-full px-2 py-1.5 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg tabular-nums"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">
              目標元素 (Target)
            </label>
            <select
              value={draftScope.targetElementId}
              onChange={(e) =>
                onChangeDraftScope({ targetElementId: e.target.value })
              }
              className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg"
            >
              <option value="all">範圍內所有元素 (All Elements)</option>
              {elements.map((el) => (
                <option key={el.id} value={el.id}>
                  只修改：{el.labelZh} ({el.name})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">
              指定顏色 (Color)
            </label>
            <div className="flex items-center gap-1.5">
              <input
                type="color"
                value={normalizeHex(draftScope.color)}
                onChange={(e) =>
                  onChangeDraftScope({ color: e.target.value.toUpperCase() })
                }
                className="w-8 h-8 rounded cursor-pointer border border-slate-200 bg-white p-0.5 shrink-0"
              />
              <input
                type="text"
                value={draftScope.color}
                onChange={(e) => {
                  const val = e.target.value;
                  onChangeDraftScope({
                    color: isValidHex(val) ? normalizeHex(val) : val,
                  });
                }}
                className="w-full px-2 py-1.5 text-xs font-mono uppercase bg-slate-50 border border-slate-200 rounded-lg tabular-nums"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-1">
          <label className="inline-flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              checked={draftScope.showPreview}
              onChange={(e) =>
                onChangeDraftScope({ showPreview: e.target.checked })
              }
              className="w-3.5 h-3.5 accent-emerald-600 rounded"
            />
            <span>在預覽卡面顯示選取框線</span>
          </label>

          <button
            type="button"
            onClick={onApplyScopeRule}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>套用此範圍改色</span>
          </button>
        </div>

        {/* Active Scope Rules List */}
        {scopeRules.length > 0 && (
          <div className="pt-2.5 border-t border-slate-100 space-y-1.5">
            <div className="text-[11px] font-semibold text-slate-600">
              已生效的範圍調色規則 ({scopeRules.length})
            </div>
            {scopeRules.map((rule) => {
              const targetName =
                rule.targetElementId === 'all'
                  ? '所有元素'
                  : elements.find((e) => e.id === rule.targetElementId)
                      ?.labelZh || rule.targetElementId;
              return (
                <div
                  key={rule.id}
                  className="flex items-center justify-between gap-2 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <input
                      type="checkbox"
                      checked={rule.enabled}
                      onChange={() => onToggleScopeRule(rule.id)}
                      className="w-3.5 h-3.5 accent-emerald-600 rounded cursor-pointer"
                    />
                    <span
                      className="w-3.5 h-3.5 rounded-xs border border-slate-300 shrink-0"
                      style={{ backgroundColor: rule.color }}
                    />
                    <span className="truncate font-medium text-slate-700">
                      {targetName}
                    </span>
                    <span className="font-mono text-[11px] text-slate-400 tabular-nums shrink-0">
                      ({rule.x},{rule.y} {rule.width}×{rule.height})
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onDeleteScopeRule(rule.id)}
                    className="p-1 text-slate-400 hover:text-rose-600 rounded"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
