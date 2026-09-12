import path from 'path';
import { RobotSettings } from './types.js';

export const PORT = 3000;

export const SETTINGS_PATH = path.resolve('settings.json');
export const FONTS_DIR = path.resolve('fonts');

export const defaultSettings: RobotSettings = {
  ip: '192.168.1.2',
  speed: 100,
  acceleration: 200,
  fieldSize: { x: 400, y: 300 },
  markerGripHeight: 300,
  markerLiftHeight: 100,
  availableFonts: ['alphabet.json'],
  selectedFont: 'alphabet.json',
  robotBase: 'RobotBase'
};

export let robotStatus = { 
  isBusy: false, 
  progress: 0, 
  lastMessage: 'Готов к работе' 
};

export let stopRequested = false;
export function setStopRequested(value: boolean) {
  stopRequested = value;
}