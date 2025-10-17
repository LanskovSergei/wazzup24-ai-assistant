// popup.js - Скрипт настроек расширения

console.log('🔧 Popup загружен');

// Элементы DOM
const elements = {
  enabledToggle: document.getElementById('enabledToggle'),
  apiKey: document.getElementById('apiKey'),
  modelSelect: document.getElementById('modelSelect'),
  promptInput: document.getElementById('promptInput'),
  temperature: document.getElementById('temperature'),
  tempValue: document.getElementById('tempValue'),
  maxTokens: document.getElementById('maxTokens'),
  contextMessages: document.getElementById('contextMessages'),
  saveBtn: document.getElementById('saveBtn'),
  status: document.getElementById('status'),
  advancedToggle: document.getElementById('advancedToggle'),
  advancedContent: document.getElementById('advancedContent')
};

// Настройки по умолчанию
const defaultSettings = {
  enabled: true,
  apiKey: '',
  model: 'gpt-4',
  customPrompt: '',
  temperature: 0.7,
  maxTokens: 500,
  contextMessages: 5
};

// Загрузка настроек при открытии popup
document.addEventListener('DOMContentLoaded', async () => {
  console.log('📂 Загрузка настроек...');
  await loadSettings();
  setupEventListeners();
});

// Загрузка настроек из storage
async function loadSettings() {
  try {
    const settings = await chrome.storage.sync.get(defaultSettings);
    
    elements.enabledToggle.checked = settings.enabled;
    elements.apiKey.value = settings.apiKey || '';
    elements.modelSelect.value = settings.model || 'gpt-4';
    elements.promptInput.value = settings.customPrompt || '';
    elements.temperature.value = settings.temperature || 0.7;
    elements.tempValue.textContent = settings.temperature || 0.7;
    elements.maxTokens.value = settings.maxTokens || 500;
    elements.contextMessages.value = settings.contextMessages || 5;
    
    console.log('✅ Настройки загружены:', settings);
  } catch (error) {
    console.error('❌ Ошибка загрузки настроек:', error);
    showStatus('Ошибка загрузки настроек', 'error');
  }
}

// Настройка обработчиков событий
function setupEventListeners() {
  // Кнопка сохранения
  elements.saveBtn.addEventListener('click', saveSettings);
  
  // Сохранение по Enter в поле API ключа
  elements.apiKey.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      saveSettings();
    }
  });
  
  // Обновление значения температуры
  elements.temperature.addEventListener('input', (e) => {
    elements.tempValue.textContent = e.target.value;
  });
  
  // Toggle расширенных настроек
  elements.advancedToggle.addEventListener('click', (e) => {
    e.preventDefault();
    elements.advancedContent.classList.toggle('show');
    const isShown = elements.advancedContent.classList.contains('show');
    elements.advancedToggle.textContent = isShown 
      ? '⚙️ Скрыть расширенные настройки' 
      : '⚙️ Расширенные настройки';
  });
  
  // Мгновенное сохранение toggle
  elements.enabledToggle.addEventListener('change', async () => {
    try {
      await chrome.storage.sync.set({ 
        enabled: elements.enabledToggle.checked 
      });
      
      const status = elements.enabledToggle.checked ? 'включено' : 'выключено';
      showStatus(`Расширение ${status}`, 'success');
      
      // Отправляем сообщение content script о изменении статуса
      notifyContentScript();
    } catch (error) {
      console.error('❌ Ошибка сохранения toggle:', error);
    }
  });
}

// Сохранение настроек
async function saveSettings() {
  const apiKey = elements.apiKey.value.trim();
  
  // Валидация API ключа
  if (!apiKey) {
    showStatus('Введите API ключ OpenAI', 'error');
    elements.apiKey.focus();
    return;
  }
  
  if (!apiKey.startsWith('sk-')) {
    showStatus('API ключ должен начинаться с "sk-"', 'error');
    elements.apiKey.focus();
    return;
  }
  
  // Отключаем кнопку во время сохранения
  elements.saveBtn.disabled = true;
  elements.saveBtn.textContent = 'Сохранение...';
  
  try {
    const settings = {
      enabled: elements.enabledToggle.checked,
      apiKey: apiKey,
      model: elements.modelSelect.value,
      customPrompt: elements.promptInput.value.trim(),
      temperature: parseFloat(elements.temperature.value),
      maxTokens: parseInt(elements.maxTokens.value),
      contextMessages: parseInt(elements.contextMessages.value)
    };
    
    // Сохраняем в chrome.storage
    await chrome.storage.sync.set(settings);
    
    console.log('✅ Настройки сохранены:', settings);
    showStatus('Настройки успешно сохранены!', 'success');
    
    // Уведомляем content script об обновлении настроек
    notifyContentScript();
    
    // Закрываем popup через 1.5 секунды
    setTimeout(() => {
      window.close();
    }, 1500);
    
  } catch (error) {
    console.error('❌ Ошибка сохранения:', error);
    showStatus('Ошибка сохранения настроек', 'error');
  } finally {
    elements.saveBtn.disabled = false;
    elements.saveBtn.textContent = 'Сохранить настройки';
  }
}

// Показ статуса
function showStatus(message, type = 'success') {
  elements.status.textContent = message;
  elements.status.className = `status ${type}`;
  
  // Автоматически скрываем через 5 секунд
  setTimeout(() => {
    elements.status.className = 'status';
  }, 5000);
}

// Уведомление content script об изменениях
async function notifyContentScript() {
  try {
    const [tab] = await chrome.tabs.query({ 
      active: true, 
      currentWindow: true 
    });
    
    if (tab && tab.url && tab.url.includes('wazzup24.com')) {
      await chrome.tabs.sendMessage(tab.id, { 
        type: 'SETTINGS_UPDATED' 
      });
      console.log('📤 Уведомление отправлено content script');
    }
  } catch (error) {
    console.log('ℹ️ Content script недоступен (возможно, страница не загружена)');
  }
}

// Валидация числовых полей
elements.maxTokens.addEventListener('change', (e) => {
  const value = parseInt(e.target.value);
  if (value < 100) e.target.value = 100;
  if (value > 2000) e.target.value = 2000;
});

elements.contextMessages.addEventListener('change', (e) => {
  const value = parseInt(e.target.value);
  if (value < 1) e.target.value = 1;
  if (value > 10) e.target.value = 10;
});

// Показ/скрытие пароля (опционально)
const togglePasswordBtn = document.createElement('button');
togglePasswordBtn.textContent = '👁️';
togglePasswordBtn.style.cssText = `
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  border: none;
  background: none;
  cursor: pointer;
  font-size: 16px;
  opacity: 0.6;
`;
togglePasswordBtn.addEventListener('click', () => {
  const type = elements.apiKey.type === 'password' ? 'text' : 'password';
  elements.apiKey.type = type;
  togglePasswordBtn.textContent = type === 'password' ? '👁️' : '🙈';
});

// Добавляем кнопку показа пароля
const apiKeyGroup = elements.apiKey.parentElement;
apiKeyGroup.style.position = 'relative';
apiKeyGroup.appendChild(togglePasswordBtn);
