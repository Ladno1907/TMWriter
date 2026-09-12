import { RobotSettings } from './types.js';
import { FontData, CharCell } from './types.js';

/**
 * Рассчитывает координаты букв на поле.
 * Учитывает размеры поля из настроек и размеры символов из шрифта.
 */
export function textToCellMap(text: string, scale: number = 1, font: FontData, settings: RobotSettings): CharCell[] {
  const { x: fieldX, y: fieldY } = settings.fieldSize;

  const scaledWidth = font.charWidth * scale;
  const scaledHeight = font.charHeight * scale;

  const cellCountX = Math.floor(fieldX / scaledWidth);
  const cellCountY = Math.floor(fieldY / scaledHeight);

  if (cellCountX <= 0 || cellCountY <= 0) {
    throw new Error("Шрифт слишком большой для такого поля");
  }

  const words = text.split(/\s+/).filter(w => w.length > 0);
  const result: CharCell[] = [];

  let currentX = 0;
  let currentY = cellCountY - 1;

  for (let i = 0; i < words.length; i++) {
    const word = words[i];

    if (word.length > cellCountX) {
      throw new Error(`Слово "${word}" слишком длинное`);
    }

    if (currentX + word.length > cellCountX) {
      currentY--;
      currentX = 0;
    }

    if (currentY < 0) {
      throw new Error("Текст не помещается по высоте поля");
    }

    for (const char of word) {
      result.push({
        char,
        x_index: currentX,
        y_index: currentY,
        abs_x: currentX * scaledWidth,
        abs_y: currentY * scaledHeight
      });
      currentX++;
    }

    if (i < words.length - 1) {
      currentX++;
      if (currentX >= cellCountX) {
        currentY--;
        currentX = 0;
      }
    }
  }

  return result;
}

/**
 * Визуализация для консоли с учетом масштаба
 */
export function printTextInGrid(layout: CharCell[], scale: number = 1, settings: RobotSettings, font: FontData): void {
  const scaledWidth = font.charWidth * scale;
  const scaledHeight = font.charHeight * scale;

  const cellCountX = Math.floor(settings.fieldSize.x / scaledWidth);
  const cellCountY = Math.floor(settings.fieldSize.y / scaledHeight);

  if (cellCountX <= 0 || cellCountY <= 0) {
    console.log('Поле слишком маленькое для текущего масштаба');
    return;
  }

  const grid: string[][] = Array(cellCountY)
    .fill(null)
    .map(() => Array(cellCountX).fill('.'));

  for (const item of layout) {
    const rowIndex = (cellCountY - 1) - item.y_index;

    if (rowIndex >= 0 && rowIndex < cellCountY && item.x_index < cellCountX) {
      grid[rowIndex][item.x_index] = item.char;
    }
  }

  console.log(`\n📐 Сетка поля (${cellCountX}x${cellCountY} ячеек):`);
  grid.forEach(line => console.log(line.join(' ')));
}
