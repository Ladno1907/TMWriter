import { TMScriptConnection, TMTagNumber } from "techman-js";
import { textToCellMap } from "./textMapper.js";
import { RobotSettings, FontData } from "./types.js";
import { robotStatus, stopRequested, setStopRequested } from './config.js'

const DEFAULT_ROBOT_BASE = "RobotBase";
let FIXED_ORIENTATION = [0, 0, 180];
const SHIFT_X = 0;
const SHIFT_Y = 0;
const BLENDING = 100;

function getArcPoint(x1: number, y1: number, cx: number, cy: number, x2: number, y2: number, isClockwise: boolean) {
  let a1 = Math.atan2(y1 - cy, x1 - cx);
  let a2 = Math.atan2(y2 - cy, x2 - cx);

  if (isClockwise && a2 <= a1) a2 += Math.PI * 2;
  if (!isClockwise && a2 >= a1) a2 -= Math.PI * 2;

  const midAngle = (a1 + a2) / 2;
  const radius = Math.sqrt(Math.pow(x1 - cx, 2) + Math.pow(y1 - cy, 2));

  return {
    x: cx + radius * Math.cos(midAngle),
    y: cy + radius * Math.sin(midAngle)
  };
}

export async function runRobotProcess(text: string, scale: number, settings: RobotSettings, fontData: FontData) {
  setStopRequested(false);

  const robot = new TMScriptConnection(settings.ip);
  const layout = textToCellMap(text, scale, fontData, settings);

  if (settings.robotBase === DEFAULT_ROBOT_BASE) {
    FIXED_ORIENTATION = [180, 0, 90];//[0, 0, 180];
  }

  try {
    await robot.connect();
    await robot.client.changeBase(settings.robotBase);
    await new Promise(r => setTimeout(r, 1000));

    let sentIndex = 0;
    let confirmedIndex = 0;
    let isMarkerDown = false;
    let blending = 0;

    const sendLetter = async (index: number) => {
      const cell = layout[index];
      const glyph = fontData.alphabet[cell.char];
      if (!glyph) return;

      for (const step of glyph) {
        if (step.cmd === 'down') {
          await robot.client.moveLine(
            [0, 0, settings.markerLiftHeight, 0, 0, 0],
            'TAR',
            settings.speed,
            settings.acceleration,
            0,
            false
          )

          isMarkerDown = true;
          continue;
        }

        if (step.cmd === 'up') {
          await robot.client.moveLine(
            [0, 0, -settings.markerLiftHeight, 0, 0, 0],
            'TAR',
            settings.speed,
            settings.acceleration,
            0,
            false
          )

          isMarkerDown = false;
          continue;
        }

        if (step.cmd === 'line' || step.cmd === 'blend') {
          if (step.cmd === 'blend') {
            blending = BLENDING;
          } else {
            blending = 0;
          }

          const cmdWithCoords = step as { x: number; y: number };

          const x = cell.abs_x + (cmdWithCoords.x * scale);
          let y = cell.abs_y + (cmdWithCoords.y * scale);
          let z = isMarkerDown ? settings.markerGripHeight : (settings.markerGripHeight + settings.markerLiftHeight);

          if (settings.robotBase != DEFAULT_ROBOT_BASE) {
            y *= -1;
            z *= -1;
          }

          await robot.client.line(
            [x + SHIFT_X, y + SHIFT_Y, z, ...FIXED_ORIENTATION],
            'CAR',
            settings.speed,
            settings.acceleration,
            blending,
            false
          );
        }

        if (step.cmd === 'circle') {
          const cmdWithCoords = step as { x1: number; y1: number; cx: number; cy: number; x2: number; y2: number; isClockwise: boolean };
          const arcPoint = getArcPoint( cmdWithCoords.x1, cmdWithCoords.y1, cmdWithCoords.cx, cmdWithCoords.cy, cmdWithCoords.x2, cmdWithCoords.y2,cmdWithCoords.isClockwise );

          const x1 = cell.abs_x + (arcPoint.x * scale);
          let y1 = cell.abs_y + (arcPoint.y * scale);
          const x2 = cell.abs_x + (cmdWithCoords.x2 * scale);
          let y2 = cell.abs_y + (cmdWithCoords.y2 * scale);
          let z = isMarkerDown ? settings.markerGripHeight : (settings.markerGripHeight + settings.markerLiftHeight);

          if (settings.robotBase != DEFAULT_ROBOT_BASE) {
            y1 *= -1;
            y2 *= -1;
            z *= -1;
          }

          await robot.client.circle(
            [x1 + SHIFT_X, y1 + SHIFT_Y, z, ...FIXED_ORIENTATION],
            [x2 + SHIFT_X, y2 + SHIFT_Y, z, ...FIXED_ORIENTATION],
            'CAP',
            settings.speed,
            settings.acceleration,
            0,
            0,
            false
          );
        }
      }

      const tagNum = (index % 15) + 1;
      await robot.client.setQueueTag(tagNum);
    };

    await sendLetter(0);
    console.log(`Инициализация: Буква 1 (${layout[0].char}) отправлена`);
    
    if (layout.length > 1) {
      await sendLetter(1);
      console.log(`Инициализация: Буква 2 (${layout[1].char}) отправлена`);
      sentIndex = 2;
    } else {
      sentIndex = 1;
    }

    while (confirmedIndex < layout.length) {
      if (stopRequested) {
        console.log("!!! ПОЛУЧЕН СИГНАЛ СТОП !!!");

        await robot.client.stopAndClear();
        robot.disconnect();

        robotStatus.lastMessage = "Аварийная остановка";
        robotStatus.isBusy = false;
        throw new Error("Операция прервана пользователем"); 
      }

      const tagToCheck = ((confirmedIndex % 15) + 1).toString().padStart(2, '0') as TMTagNumber;
      const response = await robot.client.checkTagStatus(tagToCheck);

      if (response.content && 'status' in response.content && response.content.status === true) {
        console.log(`Буква ${confirmedIndex + 1} (${layout[confirmedIndex].char}) выполнена`);

        confirmedIndex++;
        robotStatus.progress = Math.round((confirmedIndex / layout.length) * 100);
        robotStatus.lastMessage = `Завершено: ${confirmedIndex}/${layout.length}`;

        if (sentIndex < layout.length) {
          console.log(`Отправляем в буфер букву ${sentIndex + 1} (${layout[sentIndex].char})`);
          await sendLetter(sentIndex);
          sentIndex++;
        }
      }

      await new Promise(r => setTimeout(r, 1000));
    }

    await robot.client.scriptExit();
    console.log("Программа успешно завершена");

  } catch (err) {
    console.error("Ошибка при работе робота:", err);
    robotStatus.lastMessage = "Ошибка: " + (err as Error).message;
  } finally {
    robotStatus.isBusy = false;
    robot.disconnect();
  }
}