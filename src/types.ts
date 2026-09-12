export interface RobotSettings {
  ip: string;
  speed: number;
  acceleration: number;
  fieldSize: { x: number; y: number };
  markerGripHeight: number;
  markerLiftHeight: number;
  availableFonts: string[];
  selectedFont: string;
  robotBase: string;
}

export interface CharCell {
  char: string;
  x_index: number;
  y_index: number;
  abs_x: number;
  abs_y: number;
}

export type GlyphCommand =
  | { cmd: 'up' | 'down' }
  | { cmd: 'line' | 'blend'; x: number; y: number }
  | { cmd: 'circle'; x1: number; y1: number; cx: number; cy: number; x2: number; y2: number; isClockwise: boolean };

export interface FontData {
  charWidth: number;
  charHeight: number;
  alphabet: Record<string, GlyphCommand[]>;
}
