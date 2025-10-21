// popup.js - Скрипт для окна настроек

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('settingsForm');
  const apiKeyInput = document.getElementById('apiKey');
  const modelSelect = document.getElementById('model');
  const customPromptInput = document.getElementById('customPrompt');
  const temperatureInput = document.getElementById('temperature');
  const temperatureValue = document.getElementById('temperatureValue');
  const maxTokensInput = document.getElementById('maxTokens');
  const contextMessagesInput = document.getElementById('contextMessages');
  const statusDiv = document.getElementById('status');

  // Загрузка сохранённых настроек
  chrome.storage.sync.get([
    'apiKey',
    'model',
    'customPrompt',
    'temperature',
    'maxTokens',
    'contextMessages'
  ], (data) => {
    if (data.apiKey) apiKeyInput.value = data.apiKey;
    if (data.model) modelSelect.value = data.model;
    if (data.customPrompt) customPromptInput.value = data.customPrompt;
    if (data.temperature !== undefined) {
      temperatureInput.value = data.temperature;
      temperatureValue.textContent = data.temperature;
    }
    if (data.maxTokens) maxTokensInput.value = data.maxTokens;
    if (data.contextMessages) contextMessagesInput.value = data.contextMessages;
  });

  // Обновление значения temperature
  temperatureInput.addEventListener('input', (e) => {
    temperatureValue.textContent = e.target.value;
  });

  // Сохранение настроек
  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const settings = {
      apiKey: apiKeyInput.value.trim(),
      model: modelSelect.value,
      customPrompt: customPromptInput.value.trim(),
      temperature: parseFloat(temperatureInput.value),
      maxTokens: parseInt(maxTokensInput.value),
      contextMessages: parseInt(contextMessagesInput.value),
      enabled: true
    };

    // Валидация
    if (!settings.apiKey) {
      showStatus('Введите API ключ OpenAI', 'error');
      return;
    }

    if (!settings.apiKey.startsWith('sk-')) {
      showStatus('Неверный формат API ключа. Ключ должен начинаться с "sk-"', 'error');
      return;
    }

    if (settings.maxTokens < 100 || settings.maxTokens > 2000) {
      showStatus('Максимальная длина должна быть от 100 до 2000 токенов', 'error');
      return;
    }

    if (settings.contextMessages < 5 || settings.contextMessages > 50) {
      showStatus('Количество сообщений должно быть от 5 до 50', 'error');
      return;
    }

    // Сохранение в Chrome Storage
    chrome.storage.sync.set(settings, () => {
      showStatus('✅ Настройки сохранены успешно!', 'success');
      
      // Уведомляем content script об обновлении настроек
      chrome.tabs.query({ url: 'https://app.wazzup24.com/*' }, (tabs) => {
        tabs.forEach((tab) => {
          chrome.tabs.sendMessage(tab.id, { 
            type: 'SETTINGS_UPDATED', 
            settings 
          }).catch(() => {
            // Игнорируем ошибки, если вкладка не отвечает
          });
        });
      });

      // Закрываем popup через 2 секунды
      setTimeout(() => {
        window.close();
      }, 2000);
    });
  });

  function showStatus(message, type) {
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
    
    if (type === 'error') {
      setTimeout(() => {
        statusDiv.className = 'status';
      }, 5000);
    }
  }
});
