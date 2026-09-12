// Константы элементов
const fontInput = document.getElementById('fontInput');
const fontModal = document.getElementById('fontModal');
const activeFontDisplay = document.getElementById('active-font-name');
const fontsListContainer = document.getElementById('fontsList');

// 1. ЗАГРУЗКА НАСТРОЕК (при запуске и обновлении)
async function loadSettings() {
  try {
    const response = await fetch('/api/settings');
    const result = await response.json();
    if (result.status === 'ok') {
      applySettings(result.data);
      renderFontsList(result.data.availableFonts);
    }
  } catch (err) { 
    console.error('Ошибка загрузки настроек:', err); 
  }
}

function applySettings(data) {
  if (document.getElementById('set-ip')) document.getElementById('set-ip').value = data.ip || '';
  if (document.getElementById('set-speed')) document.getElementById('set-speed').value = data.speed || '';
  if (document.getElementById('set-accel')) document.getElementById('set-accel').value = data.acceleration || '';
  if (document.getElementById('set-field-x')) document.getElementById('set-field-x').value = data.fieldSize?.x || '';
  if (document.getElementById('set-field-y')) document.getElementById('set-field-y').value = data.fieldSize?.y || '';
  if (document.getElementById('set-grip')) document.getElementById('set-grip').value = data.markerGripHeight || '';
  if (document.getElementById('set-lift')) document.getElementById('set-lift').value = data.markerLiftHeight || '';
  if (document.getElementById('set-base')) document.getElementById('set-base').value = data.robotBase || '';

  activeFontDisplay.textContent = data.selectedFont || 'Название файла...';
}

// 2. СОХРАНЕНИЕ НАСТРОЕК
document.getElementById('btn-save').addEventListener('click', async () => {
  const toSave = {
    ip: document.getElementById('set-ip').value,
    speed: Number(document.getElementById('set-speed').value),
    acceleration: Number(document.getElementById('set-accel').value),
    fieldSize: {
      x: Number(document.getElementById('set-field-x').value),
      y: Number(document.getElementById('set-field-y').value)
    },
    markerGripHeight: Number(document.getElementById('set-grip').value),
    markerLiftHeight: Number(document.getElementById('set-lift').value),
    selectedFont: activeFontDisplay.textContent,
    robotBase: document.getElementById('set-base').value
  };

  try {
    const response = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(toSave)
    });
    if (response.ok) {
      await updatePreview();
      updateStatus('Настройки сохранены');
    } else {
      updateStatus('Ошибка сервера', true);
    };
  } catch (err) {
    updateStatus('Ошибка при сохранении', true);
  }
});

// 3. ЗАГРУЗКА ФАЙЛА ШРИФТА
document.getElementById('btn-load-font').addEventListener('click', () => {
  fontInput.click();
});

fontInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append('font', file);

  try {
    const response = await fetch('/api/fonts/upload', {
      method: 'POST',
      body: formData
    });
    const result = await response.json();
    if (result.status === 'success') {
      activeFontDisplay.textContent = result.filename;
      renderFontsList(result.availableFonts);
      updateStatus('Шрифт успешно загружен на сервер');
    }
  } catch (err) {
    updateStatus('Ошибка загрузки файла', true);
  }
});

// 4. МОДАЛЬНОЕ ОКНО (Выбор шрифта)
document.getElementById('btn-select-font').addEventListener('click', () => {
  fontModal.style.display = 'flex';
});

document.getElementById('closeModal').addEventListener('click', () => {
  fontModal.style.display = 'none';
});

window.addEventListener('click', (e) => {
  if (e.target === fontModal) fontModal.style.display = 'none';
});

function renderFontsList(fonts) {
  if (!fonts) return;
  fontsListContainer.innerHTML = '';

  fonts.forEach(fontName => {
    const item = document.createElement('div');
    item.className = 'font-item';
    item.textContent = fontName;
    item.onclick = () => {
      activeFontDisplay.textContent = fontName;
      fontModal.style.display = 'none';
      updateStatus(`Выбран шрифт: ${fontName}`)
    };
    fontsListContainer.appendChild(item);
  });
}

// Находим все числовые инпуты и запрещаем вводить всё, кроме цифр и точек
document.querySelectorAll('input[type="number"]').forEach(input => {
  input.addEventListener('keydown', (e) => {
    const allowedKeys = ['Backspace', 'Delete', 'Tab', 'Escape', 'Enter', '.', ',', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];
    if (allowedKeys.includes(e.key) || (e.key >= '0' && e.key <= '9')) {
      return;
    }
    e.preventDefault();
  });
});

/**
 * Обновляет текст в блоке статуса
 * @param {string} message - Текст сообщения
 * @param {boolean} isError - Если true, текст станет красным
 */
function updateStatus(message, isError = false) {
  const statusElement = document.getElementById('status-display');
  if (!statusElement) return;

  statusElement.textContent = message;

  statusElement.style.color = isError ? "#d93025" : "#174EA7";

  setTimeout(() => {
    statusElement.textContent = "Ожидание...";
    statusElement.style.color = "#000";
  }, 10000);
}

let statusInterval = null;

// Функция для циклического опроса статуса
function startStatusPolling() {
  if (statusInterval) clearInterval(statusInterval);

  statusInterval = setInterval(async () => {
    try {
      const res = await fetch('/api/robot-status');
      const status = await res.json();

      const statusElement = document.getElementById('status-display');
      statusElement.textContent = `${status.lastMessage} (${status.progress}%)`;
      statusElement.style.color = "#174EA7";

      if (!status.isBusy) {
        stopStatusPolling();
        updateStatus("Печать завершена");
      }
    } catch (err) {
      console.error("Ошибка опроса статуса:", err);
      stopStatusPolling();
    }
  }, 1000);
}

function stopStatusPolling() {
  if (statusInterval) {
    clearInterval(statusInterval);
    statusInterval = null;
  }
}

// Обновляем кнопку ОТПРАВИТЬ
document.getElementById('btn-send').addEventListener('click', async () => {
  const text = document.getElementById('main-text-input').value;
  const fontSize = document.getElementById('set-scale').value;

  if (!text) {
  updateStatus("Введите текст для отправки", true);
  return;
  }

  try {
    const res = await fetch('/api/command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, fontSize })
    });
    const data = await res.json();

    if (data.status === 'started') {
      updateStatus("Команда принята");
      startStatusPolling();
    } else {
      updateStatus(data.error || "Ошибка запуска", true);
    }
  } catch (err) {
    updateStatus("Ошибка связи с сервером", true);
  }
});

document.getElementById('btn-stop').addEventListener('click', async () => {
  try {
    const res = await fetch('/api/stop', { method: 'POST' });
    if (res.ok) {
      updateStatus("Команда остановки отправлена", true);
    }
  } catch (err) {
    updateStatus("Не удалось связаться с роботом", true);
  }
});

function draw(commands, fieldSize, fontMetrics) {
  const canvas = document.getElementById('previewCanvas');
  const ctx = canvas.getContext('2d');
  const container = canvas.parentElement;

  const dpr = window.devicePixelRatio || 1;
  const pad = 16;
  const ratio = Math.min((container.clientWidth - pad) / fieldSize.x, (container.clientHeight - pad) / fieldSize.y);

  canvas.width = fieldSize.x * ratio * dpr;
  canvas.height = fieldSize.y * ratio * dpr;
  canvas.style.width = `${fieldSize.x * ratio}px`;
  canvas.style.height = `${fieldSize.y * ratio}px`;

  ctx.scale(ratio * dpr, ratio * dpr);
  ctx.clearRect(0, 0, fieldSize.x, fieldSize.y);

  ctx.beginPath();
  ctx.strokeStyle = "#E2E8F0"; 
  ctx.lineWidth = 1 / ratio;

  const sw = fontMetrics.charWidth;
  const sh = fontMetrics.charHeight;

  for (let x = 0; x <= fieldSize.x; x += sw) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, fieldSize.y);
  }

  for (let y = fieldSize.y; y >= 0; y -= sh) {
    ctx.moveTo(0, y);
    ctx.lineTo(fieldSize.x, y);
  }
  ctx.stroke();

  const textScale = Number(document.getElementById('set-scale').value) || 1;
  ctx.strokeStyle = "#174EA7";

  ctx.lineWidth = Math.max(1.5 / ratio, 0.4 + (textScale * 0.12)); 
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  let isMarkerDown = false;
  ctx.beginPath();

  for (let i = 0; i < commands.length; i++) {
    const cmd = commands[i];
    const next = commands[i + 1];
    const hasXY = 'x' in cmd && 'y' in cmd;
    const curY = hasXY ? fieldSize.y - cmd.y : null;

    if (cmd.cmd === 'down') {
      isMarkerDown = true;
      continue;
    }
    if (cmd.cmd === 'up') {
      ctx.stroke();
      ctx.beginPath();
      isMarkerDown = false;
      continue;
    }

    if (hasXY || cmd.cmd === 'circle') {
      if (isMarkerDown) {
        if (cmd.cmd === 'line') {
          ctx.lineTo(cmd.x, curY);
        } 
        else if (cmd.cmd === 'blend') {
          if (next && ('x' in next)) {
            ctx.arcTo(cmd.x, curY, next.x, fieldSize.y - next.y, 2 * textScale);
          } else {
            ctx.lineTo(cmd.x, curY);
          }
        }
        else if (cmd.cmd === 'circle') {
          const cx = cmd.cx;
          const cy = fieldSize.y - cmd.cy;
          const radius = Math.sqrt(Math.pow(cmd.x1 - cmd.cx, 2) + Math.pow(cmd.y1 - cmd.cy, 2));

          const startAngle = Math.atan2((fieldSize.y - cmd.y1) - cy, cmd.x1 - cx);
          const endAngle = Math.atan2((fieldSize.y - cmd.y2) - cy, cmd.x2 - cx);

          ctx.arc(cx, cy, radius, startAngle, endAngle, cmd.isClockwise); 

          ctx.moveTo(cmd.x2, fieldSize.y - cmd.y2);
      }
      } else {
        if (hasXY) ctx.moveTo(cmd.x, curY);
        else if (cmd.cmd === 'circle') ctx.moveTo(cmd.x2, fieldSize.y - cmd.y2);
      }
    }
  }
  ctx.stroke();
}

async function updatePreview() {
  const text = document.getElementById('main-text-input').value;
  const fontSize = document.getElementById('set-scale').value;

  try {
    const res = await fetch('/api/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, fontSize })
    });
    const data = await res.json();
    if (data.status === 'success') {
      draw(data.commands, data.fieldSize, data.fontMetrics, data.cell);
    }
  } catch (err) { console.error(err); }
}

document.getElementById('main-text-input').addEventListener('input', updatePreview);
document.getElementById('set-scale').addEventListener('input', updatePreview);
window.addEventListener('resize', updatePreview);
window.addEventListener('load', updatePreview);

loadSettings();