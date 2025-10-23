// content.js - Основной скрипт для интеграции с Wazzup24

console.log('🚀 Wazzup24 AI Assistant загружен');

// Глобальные переменные
let settings = null;
let aiPanel = null;
let isEnabled = true;

// Инициализация расширения
async function init() {
  console.log('🔧 Инициализация расширения...');
  
  try {
    // Загружаем настройки
    await loadSettings();
    
    if (!isEnabled) {
      console.log('⏸️ Расширение отключено');
      return;
    }
    
    // Создаем панель
    createAIPanel();
    
    // Наблюдаем за изменениями в DOM
    observeMessages();
    
    console.log('✅ Расширение инициализировано');
  } catch (error) {
    console.error('❌ Ошибка инициализации:', error);
  }
}

// Загрузка настроек
async function loadSettings() {
  console.log('📂 Загрузка настроек...');
  
  try {
    const response = await chrome.runtime.sendMessage({ 
      type: 'GET_SETTINGS' 
    });
    
    if (response && response.success) {
      settings = response.settings;
      isEnabled = settings.enabled !== false;
      console.log('✅ Настройки загружены:', settings);
    } else {
      console.error('❌ Ошибка загрузки настроек');
    }
  } catch (error) {
    console.error('❌ Ошибка связи с background:', error);
  }
}

// Создание панели AI
function createAIPanel() {
  if (aiPanel) {
    console.log('ℹ️ Панель уже существует');
    return;
  }
  
  console.log('🎨 Создание панели AI...');
  
  aiPanel = document.createElement('div');
  aiPanel.id = 'wazzup-ai-panel';
  aiPanel.innerHTML = `
    <div class="wai-header">
      <div class="wai-title">
        <span class="wai-icon">✨</span>
        AI Помощник
      </div>
      <button class="wai-close" title="Свернуть">−</button>
    </div>
    <div class="wai-content">
      <div class="wai-empty">
        <p>👋 Привет!</p>
        <small>Когда клиент напишет, я предложу варианты ответов</small>
      </div>
    </div>
  `;
  
  document.body.appendChild(aiPanel);
  
  // Обработчик закрытия/сворачивания
  const closeBtn = aiPanel.querySelector('.wai-close');
  closeBtn.addEventListener('click', () => {
    aiPanel.classList.toggle('wai-minimized');
    closeBtn.textContent = aiPanel.classList.contains('wai-minimized') ? '+' : '−';
    closeBtn.title = aiPanel.classList.contains('wai-minimized') ? 'Развернуть' : 'Свернуть';
  });
  
  console.log('✅ Панель создана');
}

// Наблюдение за новыми сообщениями
function observeMessages() {
  console.log('👀 Запуск наблюдения за сообщениями...');
  
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === 1) {
          checkForNewClientMessage(node);
        }
      });
    });
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
  
  console.log('✅ Наблюдатель запущен');
}

// Проверка на новое сообщение от клиента
function checkForNewClientMessage(node) {
  // Wazzup24 использует разные селекторы, попробуем несколько вариантов
  const selectors = [
    '[data-message-type="incoming"]',
    '.message.incoming',
    '.chat-message.incoming',
    '[class*="incoming"]'
  ];
  
  let messageElement = null;
  
  for (const selector of selectors) {
    if (node.matches && node.matches(selector)) {
      messageElement = node;
      break;
    }
    
    messageElement = node.querySelector && node.querySelector(selector);
    if (messageElement) break;
  }
  
  if (messageElement) {
    const messageText = extractMessageText(messageElement);
    
    if (messageText && messageText.length > 0) {
      console.log('💬 Новое сообщение от клиента:', messageText);
      handleNewClientMessage(messageText);
    }
  }
}

// Извлечение текста сообщения
function extractMessageText(messageElement) {
  // Пробуем разные селекторы для текста
  const textSelectors = [
    '.message-text',
    '.chat-message-text',
    '[class*="message"][class*="text"]',
    'p',
    'span'
  ];
  
  for (const selector of textSelectors) {
    const textElement = messageElement.querySelector(selector);
    if (textElement && textElement.textContent.trim()) {
      return textElement.textContent.trim();
    }
  }
  
  return messageElement.textContent.trim();
}

// Обработка нового сообщения
async function handleNewClientMessage(messageText) {
  console.log('🤖 Обработка сообщения:', messageText);
  
  if (!settings || !settings.apiKey) {
    showError('API ключ не настроен. Откройте настройки расширения.');
    return;
  }
  
  // Показываем загрузку
  showLoading();
  
  try {
    // Получаем контекст переписки
    const context = getConversationContext();
    
    // Запрашиваем генерацию ответов
    const response = await chrome.runtime.sendMessage({
      type: 'GENERATE_RESPONSES',
      data: {
        clientMessage: messageText,
        context: context,
        settings: settings
      }
    });
    
    console.log('📥 Ответ от background:', response);
    
    if (response && response.success) {
      showSuggestions(response.variants);
      
      // Логируем успех
      chrome.runtime.sendMessage({
        type: 'GENERATION_SUCCESS',
        variants: response.variants
      });
    } else {
      throw new Error(response.error || 'Неизвестная ошибка');
    }
    
  } catch (error) {
    console.error('❌ Ошибка генерации:', error);
    showError(error.message);
  }
}

// Получение контекста переписки
function getConversationContext() {
  const messages = [];
  const maxMessages = settings.contextMessages || 5;
  
  // Пробуем найти контейнер с сообщениями
  const chatSelectors = [
    '.chat-messages',
    '.messages-container',
    '[class*="messages"]',
    '[class*="chat"]'
  ];
  
  let chatContainer = null;
  
  for (const selector of chatSelectors) {
    chatContainer = document.querySelector(selector);
    if (chatContainer) break;
  }
  
  if (!chatContainer) {
    console.log('⚠️ Контейнер сообщений не найден');
    return messages;
  }
  
  // Получаем последние сообщения
  const allMessages = chatContainer.querySelectorAll('[data-message-type], .message, .chat-message');
  const recentMessages = Array.from(allMessages).slice(-maxMessages);
  
  recentMessages.forEach((msg) => {
    const text = extractMessageText(msg);
    const isIncoming = msg.matches('[data-message-type="incoming"]') || 
                       msg.classList.contains('incoming');
    
    if (text) {
      messages.push({
        role: isIncoming ? 'client' : 'manager',
        text: text
      });
    }
  });
  
  console.log('📚 Контекст переписки:', messages);
  return messages;
}

// Показ загрузки
function showLoading() {
  if (!aiPanel) return;
  
  const content = aiPanel.querySelector('.wai-content');
  content.innerHTML = `
    <div class="wai-loader">
      <div class="wai-spinner"></div>
      <p>Генерирую варианты ответов...</p>
    </div>
  `;
}

// Показ вариантов ответов
function showSuggestions(variants) {
  if (!aiPanel) return;
  
  console.log('📝 Отображение вариантов:', variants);
  
  const content = aiPanel.querySelector('.wai-content');
  content.innerHTML = variants.map((variant, index) => `
    <div class="wai-suggestion">
      <div class="wai-suggestion-label">Вариант ${index + 1}: ${variant.label}</div>
      <div class="wai-suggestion-text">${variant.text}</div>
      <div class="wai-suggestion-actions">
        <button class="wai-btn wai-btn-copy" data-text="${escapeHtml(variant.text)}">
          📋 Скопировать
        </button>
      </div>
    </div>
  `).join('');
  
  // Добавляем обработчики для кнопок копирования
  content.querySelectorAll('.wai-btn-copy').forEach((btn) => {
    btn.addEventListener('click', () => {
      const text = btn.getAttribute('data-text');
      copyToClipboard(text, btn);
    });
  });
  
  // Разворачиваем панель если она была свернута
  aiPanel.classList.remove('wai-minimized');
  const closeBtn = aiPanel.querySelector('.wai-close');
  closeBtn.textContent = '−';
  closeBtn.title = 'Свернуть';
}

// Показ ошибки
function showError(errorMessage) {
  if (!aiPanel) return;
  
  const content = aiPanel.querySelector('.wai-content');
  content.innerHTML = `
    <div class="wai-error">
      <span class="wai-error-icon">⚠️</span>
      <p>${errorMessage}</p>
    </div>
  `;
}

// Копирование текста в буфер обмена
async function copyToClipboard(text, button) {
  try {
    await navigator.clipboard.writeText(text);
    
    // Визуальная обратная связь
    const originalText = button.innerHTML;
    button.innerHTML = '✅ Скопировано!';
    button.style.background = '#4caf50';
    button.style.color = 'white';
    button.disabled = true;
    
    setTimeout(() => {
      button.innerHTML = originalText;
      button.style.background = '';
      button.style.color = '';
      button.disabled = false;
    }, 2000);
    
    console.log('✅ Текст скопирован в буфер обмена');
  } catch (error) {
    console.error('❌ Ошибка копирования:', error);
    
    // Fallback для старых браузеров
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      
      button.innerHTML = '✅ Скопировано!';
      setTimeout(() => {
        button.innerHTML = '📋 Скопировать';
      }, 2000);
    } catch (fallbackError) {
      console.error('❌ Fallback копирование не удалось:', fallbackError);
      button.innerHTML = '❌ Ошибка';
      setTimeout(() => {
        button.innerHTML = '📋 Скопировать';
      }, 2000);
    }
  }
}

// Экранирование HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Слушатель сообщений от background/popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('📨 Сообщение получено:', message);
  
  switch (message.type) {
    case 'SETTINGS_UPDATED':
      console.log('⚙️ Настройки обновлены, перезагрузка...');
      loadSettings().then(() => {
        if (isEnabled && !aiPanel) {
          createAIPanel();
        } else if (!isEnabled && aiPanel) {
          aiPanel.remove();
          aiPanel = null;
        }
      });
      break;
      
    case 'ENABLED_CHANGED':
      isEnabled = message.enabled;
      console.log(`🔄 Расширение ${isEnabled ? 'включено' : 'выключено'}`);
      
      if (isEnabled && !aiPanel) {
        createAIPanel();
      } else if (!isEnabled && aiPanel) {
        aiPanel.remove();
        aiPanel = null;
      }
      break;
  }
  
  return false;
});

// Запуск при загрузке страницы
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

console.log('✅ Content script загружен');





