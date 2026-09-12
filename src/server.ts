import express from 'express';
import path from 'path';
import multer from 'multer';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { textToCellMap, printTextInGrid } from './textMapper.js';
import { RobotSettings, FontData } from './types.js';
import { FONTS_DIR, robotStatus, PORT, SETTINGS_PATH, setStopRequested } from './config.js';
import { runRobotProcess } from './runRobotProcess.js';
import { getValidatedSettings, getFontsList } from './getData.js';

const app = express();

await mkdir(FONTS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: FONTS_DIR,
  filename: (_, file, cb) => {
    if (path.extname(file.originalname) === '.json') {
      cb(null, file.originalname);
    } else {
      cb(new Error('Only .json fonts allowed'), '');
    }
  }
});
const upload = multer({ storage });

app.use(express.json());
app.use(express.static('public'));

// 1. ЗАГРУЗИТЬ НАСТРОЙКИ 
app.get('/api/settings', async (_, res) => {
  try {
    const settings = await getValidatedSettings();
    res.json({ status: 'ok', data: settings });
  } catch (err) {
    res.status(500).json({ status: 'error', message: 'Критическая ошибка настроек' });
  }
});

// 2. СОХРАНИТЬ НАСТРОЙКИ
app.post('/api/settings', async (req, res) => {
  try {
    const { availableFonts, ...toSave } = req.body as RobotSettings;
    await writeFile(SETTINGS_PATH, JSON.stringify(toSave, null, 2));
    res.json({ status: 'success' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: 'Не удалось сохранить файл' });
  }
});

// 3. ЗАГРУЗИТЬ НОВЫЙ ШРИФТ
app.post('/api/fonts/upload', upload.single('font'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ status: 'error', message: 'Файл не загружен или не .json' });
    }

    const fonts = await getFontsList();
    res.json({ 
      status: 'success', 
      filename: req.file.filename,
      availableFonts: fonts
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: 'Ошибка при загрузке шрифта' });
  }
});

// 4. ПРЕВЬЮ
app.post('/api/preview', async (req, res) => {
  try {
    const { text, fontSize } = req.body;
    const scale = Number(fontSize) || 1;
    const settings = await getValidatedSettings();

    if (!settings.selectedFont) {
      return res.json({ status: 'success', commands: [], fieldSize: settings.fieldSize }); 
    }

    const fontPath = path.join(FONTS_DIR, settings.selectedFont);
    const fontData: FontData = JSON.parse(await readFile(fontPath, 'utf-8'));

    const layout = textToCellMap(text, scale, fontData, settings);

    const allCommands: any[] = [];

    layout.forEach(cell => {
      const glyph = fontData.alphabet[cell.char];
      if (!glyph) return;

      glyph.forEach((step) => {
        if (step.cmd === 'line' || step.cmd === 'blend') {
          allCommands.push({
            ...step,
            x: cell.abs_x + (step.x * scale),
            y: cell.abs_y + (step.y * scale)
          });
        } 
        else if (step.cmd === 'circle') {
          allCommands.push({
            ...step,
            x1: cell.abs_x + (step.x1 * scale),
            y1: cell.abs_y + (step.y1 * scale),
            cx: cell.abs_x + (step.cx * scale),
            cy: cell.abs_y + (step.cy * scale),
            x2: cell.abs_x + (step.x2 * scale),
            y2: cell.abs_y + (step.y2 * scale)
          });
        } 
        else {
          allCommands.push(step);
        }
      });
    });

    res.json({ 
      status: 'success', 
      commands: allCommands, 
      fieldSize: settings.fieldSize,
      fontMetrics: {
        charWidth: fontData.charWidth * scale,
        charHeight: fontData.charHeight * scale
      }
    });
  } catch (err: any) {
    res.status(400).json({ status: 'error', message: err.message });
  }
});

// 5. ОТПРАВИТЬ КОМАНДУ
app.post('/api/command', async (req, res) => {
  const { text, fontSize } = req.body;
  const scale = Number(fontSize) || 1;

  if (robotStatus.isBusy) return res.status(409).json({ error: 'Занято' });

  try {
    const settings = await getValidatedSettings();
    if (!settings.selectedFont) {
      throw new Error('Нет доступных шрифтов для выполнения команды');
    }

    const fontPath = path.join(FONTS_DIR, settings.selectedFont);
    const fontData = JSON.parse(await readFile(fontPath, 'utf-8'));

    const layout = textToCellMap(text, scale, fontData, settings); // Bliat

    console.log(`\n--- Генерация макета для: "${text}" ---`);
    printTextInGrid(layout, fontSize, settings, fontData); 
    console.log(`------------------------------------------\n`);

    res.json({ 
      status: 'started', 
      cellsCount: layout.length,
      message: `Робот начал печать ${layout.length} символов` 
    });

    robotStatus.isBusy = true;
    robotStatus.progress = 0;
    robotStatus.lastMessage = 'Робот в движении...';

    runRobotProcess(text, scale, settings, fontData);

  } catch (err: any) {
    res.status(400).json({ status: 'error', message: err.message });
  }
});

// 6. ЗАПРОС СТАТУСА
app.get('/api/robot-status', (_, res) => {
  res.json(robotStatus);
});

// 7. ОСТАНОВКА
app.post('/api/stop', async (_, res) => {
  setStopRequested(true);
  robotStatus.lastMessage = 'Остановка...';
  res.json({ status: 'stopping' });
});

app.listen(PORT, () => {
  console.log(`Сервер запущен: http://localhost:${PORT}`);
});
