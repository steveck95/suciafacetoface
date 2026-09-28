export const DEFAULT_CANVAS_WIDTH = 1012;
export const DEFAULT_CANVAS_HEIGHT = 638;

export type ElementCategory =
  | 'background'
  | 'band'
  | 'decoration'
  | 'logo'
  | 'text'
  | 'custom';

export type BandShapeStyle =
  | 'suica-trapezoid'
  | 'suica-trapezoid-with-top'
  | 'top-band'
  | 'diagonal-split';

export type DecorationPatternStyle =
  | 'penguin-mascot'
  | 'penguin-and-wave'
  | 'geometric-wave'
  | 'minimal-chip'
  | 'custom-image';

export type ImageFitMode = 'contain' | 'cover' | 'fill';

export interface BaseCardElement {
  id: string;
  name: string;
  labelZh: string;
  category: ElementCategory;
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
  color: string; // kept in sync with fill for JSON compatibility
  secondaryFill?: string;
  opacity: number; // 0 to 1
  brightness: number; // -100 to +100
  visible: boolean;
  locked: boolean;
  borderRadius?: number;
  rotation?: number; // rotation angle in degrees (-180 to 180)
}

export interface ShapeCardElement extends BaseCardElement {
  type: 'background' | 'color-band' | 'decoration' | 'logo' | 'rectangle';
  bandStyle?: BandShapeStyle;
  slantOffset?: number; // top vs bottom width difference for trapezoid
  decorationStyle?: DecorationPatternStyle;
  customImageUrl?: string;
  customImageName?: string;
  imageFit?: ImageFitMode;
}

export interface TextCardElement extends BaseCardElement {
  type: 'text';
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  letterSpacing: number; // px
  lineHeight: number; // multiplier e.g. 1.2
  textAlign: 'left' | 'center' | 'right';
  suicaInlineStyle?: boolean; // iconic outlined 'i' and 'c' when text is Suica
}

export type CardElement = ShapeCardElement | TextCardElement;

/**
 * Section 四: 指定範圍 (X, Y, Width, Height) 局部顏色覆蓋規則
 */
export interface ScopeColorRule {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  opacity: number; // 0 to 1
  targetElementId: 'all' | string;
  enabled: boolean;
}

export interface CardProjectState {
  canvas: {
    width: number;
    height: number;
  };
  elements: CardElement[];
  scopeRules: ScopeColorRule[];
}

export interface ColorPresetItem {
  id: string;
  name: string;
  labelZh: string;
  hex: string;
  isCustom?: boolean;
}

export interface ThemePresetItem {
  id: string;
  name: string;
  description: string;
  colors: {
    background: string;
    colorBand: string;
    decoration: string;
    logo: string;
    mainText: string;
    subtitle: string;
    smallText: string;
    number: string;
  };
}

export const BUILTIN_COLOR_PRESETS: ColorPresetItem[] = [
  { id: 'suica-classic-green', name: 'Suica Green', labelZh: '經典西瓜綠', hex: '#6BB927' },
  { id: 'suica-teal', name: 'Suica Teal', labelZh: '青翠湖水綠', hex: '#008C95' },
  { id: 'suica-blue', name: 'Suica Blue', labelZh: 'Rinkai 海洋藍', hex: '#0072BC' },
  { id: 'suica-gray', name: 'Suica Gray', labelZh: '經典銀灰底', hex: '#E4E6E8' },
  { id: 'mint', name: 'Mint', labelZh: '清爽薄荷綠', hex: '#65C8C5' },
  { id: 'dark-green', name: 'Dark Green', labelZh: '深邃森林綠', hex: '#005A4E' },
  { id: 'white', name: 'White', labelZh: '純淨白', hex: '#FFFFFF' },
  { id: 'black', name: 'Black', labelZh: '曜石黑', hex: '#1E2328' },
];

export const THEME_PRESETS: ThemePresetItem[] = [
  {
    id: 'reference-classic',
    name: '經典企鵝卡面 (圖片預設)',
    description: '還原上傳圖片之經典淺灰底、鮮綠斜切色塊與企鵝造型',
    colors: {
      background: '#E4E6E8',
      colorBand: '#6BB927',
      decoration: '#1C1E21',
      logo: '#6BB927',
      mainText: '#FFFFFF',
      subtitle: '#2C333A',
      smallText: '#525B65',
      number: '#5A626A',
    },
  },
  {
    id: 'teal-turquoise',
    name: '青翠湖水綠 (#008C95)',
    description: '規格書範例配色：#008C95 主調搭配薄荷綠裝飾',
    colors: {
      background: '#008C95',
      colorBand: '#FFFFFF',
      decoration: '#65C8C5',
      logo: '#008C95',
      mainText: '#008C95',
      subtitle: '#FFFFFF',
      smallText: '#E0F7FA',
      number: '#E0F7FA',
    },
  },
  {
    id: 'welcome-sakura',
    name: 'Welcome Suica 櫻花紅',
    description: '訪日旅客限定風格，緋紅斜切色塊與柔和白底',
    colors: {
      background: '#FAF6F6',
      colorBand: '#E8384F',
      decoration: '#22252A',
      logo: '#E8384F',
      mainText: '#FFFFFF',
      subtitle: '#8C1D2E',
      smallText: '#B83346',
      number: '#6E5A5D',
    },
  },
  {
    id: 'rinkai-ocean',
    name: 'Rinkai 臨海海洋藍',
    description: '清爽湛藍斜切色塊搭配冰川銀灰背景',
    colors: {
      background: '#EBF1F5',
      colorBand: '#0072BC',
      decoration: '#1A2B3C',
      logo: '#0072BC',
      mainText: '#FFFFFF',
      subtitle: '#0F3C66',
      smallText: '#2A5C8A',
      number: '#5A7184',
    },
  },
  {
    id: 'obsidian-gold',
    name: '黑曜石質感紀念卡',
    description: '深邃消光黑背景搭配流金與翠綠點綴',
    colors: {
      background: '#181B20',
      colorBand: '#262B33',
      decoration: '#D4AF37',
      logo: '#6BB927',
      mainText: '#F8FAFC',
      subtitle: '#D4AF37',
      smallText: '#94A3B8',
      number: '#64748B',
    },
  },
];

export const FONT_OPTIONS = [
  { label: 'Plus Jakarta Sans (現代無襯線 - 預設)', value: '"Plus Jakarta Sans", "Noto Sans TC", "Noto Sans JP", sans-serif' },
  { label: 'Noto Sans JP / TC (日文/繁中黑體)', value: '"Noto Sans JP", "Noto Sans TC", sans-serif' },
  { label: 'Arial Black / Heavy Transit (粗體交通字型)', value: '"Arial Black", "Plus Jakarta Sans", sans-serif' },
  { label: 'IBM Plex Mono (等寬編號字型)', value: '"IBM Plex Mono", monospace' },
  { label: 'Georgia / Serif (典雅襯線體)', value: 'Georgia, "Noto Serif TC", serif' },
];

export function createInitialCardState(): CardProjectState {
  const elements: CardElement[] = [
    {
      id: 'background',
      name: 'Background',
      labelZh: '主背景',
      category: 'background',
      type: 'background',
      x: 0,
      y: 0,
      width: DEFAULT_CANVAS_WIDTH,
      height: DEFAULT_CANVAS_HEIGHT,
      fill: '#E4E6E8',
      color: '#E4E6E8',
      secondaryFill: '#C5C8CC',
      opacity: 1,
      brightness: 0,
      visible: true,
      locked: false,
      borderRadius: 36,
    },
    {
      id: 'color-band',
      name: 'Color Band',
      labelZh: '上方色帶／主色塊',
      category: 'band',
      type: 'color-band',
      x: 30,
      y: 34,
      width: 586,
      height: 570,
      fill: '#6BB927',
      color: '#6BB927',
      secondaryFill: '#FFFFFF',
      opacity: 1,
      brightness: 0,
      visible: true,
      locked: false,
      borderRadius: 32,
      bandStyle: 'suica-trapezoid',
      slantOffset: 196,
    },
    {
      id: 'top-left-image',
      name: 'Top-Left Image',
      labelZh: '左上自訂圖片區',
      category: 'decoration',
      type: 'decoration',
      x: 70,
      y: 68,
      width: 220,
      height: 140,
      fill: '#FFFFFF',
      color: '#FFFFFF',
      opacity: 1,
      brightness: 0,
      visible: true,
      locked: false,
      borderRadius: 0,
      rotation: 0,
      decorationStyle: 'custom-image',
      imageFit: 'contain',
    },
    {
      id: 'decoration',
      name: 'Decoration',
      labelZh: '裝飾圖案 (企鵝)',
      category: 'decoration',
      type: 'decoration',
      x: 710,
      y: 318,
      width: 220,
      height: 270,
      fill: '#1C1E21',
      color: '#1C1E21',
      secondaryFill: '#FFFFFF',
      opacity: 1,
      brightness: 0,
      visible: true,
      locked: false,
      decorationStyle: 'penguin-mascot',
    },
    {
      id: 'logo',
      name: 'Logo',
      labelZh: 'Logo 標誌區',
      category: 'logo',
      type: 'logo',
      x: 765,
      y: 36,
      width: 195,
      height: 98,
      fill: '#6BB927',
      color: '#6BB927',
      secondaryFill: '#1C1E21',
      opacity: 1,
      brightness: 0,
      visible: true,
      locked: false,
    },
    {
      id: 'main-text',
      name: 'Main Text',
      labelZh: '卡面主標題',
      category: 'text',
      type: 'text',
      text: 'Suica',
      x: 68,
      y: 446,
      width: 495,
      height: 125,
      fill: '#FFFFFF',
      color: '#FFFFFF',
      opacity: 1,
      brightness: 0,
      visible: true,
      locked: false,
      fontFamily: '"Plus Jakarta Sans", "Noto Sans TC", "Noto Sans JP", sans-serif',
      fontSize: 132,
      fontWeight: 800,
      letterSpacing: 14,
      lineHeight: 1.1,
      textAlign: 'left',
      suicaInlineStyle: true,
    },
    {
      id: 'number',
      name: 'Number',
      labelZh: '編號區域',
      category: 'text',
      type: 'text',
      text: 'JE 1234 5678 9012',
      x: 960,
      y: 592,
      width: 260,
      height: 26,
      fill: '#687078',
      color: '#687078',
      opacity: 0.85,
      brightness: 0,
      visible: true,
      locked: false,
      fontFamily: '"IBM Plex Mono", monospace',
      fontSize: 15,
      fontWeight: 500,
      letterSpacing: 2,
      lineHeight: 1.2,
      textAlign: 'right',
    },
  ];

  return {
    canvas: {
      width: DEFAULT_CANVAS_WIDTH,
      height: DEFAULT_CANVAS_HEIGHT,
    },
    elements,
    scopeRules: [],
  };
}
