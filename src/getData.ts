import { FONTS_DIR, SETTINGS_PATH, defaultSettings } from "./config.js";
import { RobotSettings } from './types.js';
import { readFile, writeFile, readdir } from 'fs/promises';

export async function getFontsList(): Promise<string[]> {
  try {
    const files = await readdir(FONTS_DIR);
    const fonts = files.filter(f => f.endsWith('.json'));
    return fonts.length > 0 ? fonts : ['alphabet.json'];
  } catch {
    return ['alphabet.json'];
  }
}

export async function getValidatedSettings(): Promise<RobotSettings> {
  let settings: RobotSettings;

  try {
    const fileData = await readFile(SETTINGS_PATH, 'utf-8');
    settings = JSON.parse(fileData);
  } catch {
    settings = { ...defaultSettings };
    await writeFile(SETTINGS_PATH, JSON.stringify(settings, null, 2));
    console.log('Создан файл настроек по умолчанию');
  }

  const fonts = await getFontsList();
  settings.availableFonts = fonts;

  if (!fonts.includes(settings.selectedFont)) {
    if (fonts.includes('alphabet.json')) {
      settings.selectedFont = 'alphabet.json';
    } else if (fonts.length > 0) {
      settings.selectedFont = fonts[0];
    } else {
      settings.selectedFont = '';
    }
  }

  return settings;
}