// content.js - Основной скрипт расширения для Wazzup24
console.log('🚀 Wazzup24 AI Assistant загружен');

class WazzupAIAssistant {
  constructor() {
    this.panel = null;
    this.apiKey = null;
    this.isGenerating = false;
    this.lastMessageText = '';
    this.messageObserver = null;
    this.lastProcessedChatId = null; // Для отслеживания смены чата
    
    // Селекторы для Wazzup24
    this.selectors = {
      chatInput: '.chat-input-text[contenteditable="true"]',
      messagesList: '.body-messages-list',
      incomingMessage: '.body-messages-item.incoming',
      messageText: '.body-text-message.body-text div[dir="auto"]',
      sendButton: '.footer-send button',
      chatContainer: '.body-messages'
    };
    
    this.init();
  }

  async init() {
    console.log('📝 Инициализация расширения...');
    
    // Загружаем API ключ из настроек
    await this.loadSettings();
    
    // Ждём загрузки страницы
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.setup());
    } else {
      this.setup();
    }
  }

  async loadSettings() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(['apiKey', 'enabled'], (data) => {
        this.apiKey = data.apiKey || null;
        this.enabled = data.enabled !== false;
        console.log('⚙️ Настройки загружены:', { hasKey: !!this.apiKey, enabled: this.enabled });
        resolve();
      });
    });
  }

  setup() {
    console.log('🔧 Настройка интерфейса...');
    
    // Проверяем, что мы на странице чата (пробуем разные селекторы)
    const chatContainer = 
      document.querySelector(this.selectors.chatContainer) ||
      document.querySelector('[class*="body-messages"]') ||
      document.querySelector('[class*="chat-container"]') ||
      document.querySelector('[class*="messages-wrapper"]') ||
      document.querySelector('main') ||
      document.querySelector('#app');
    
    if (!chatContainer) {
      console.log('⏳ Чат не загружен, повтор через 2 сек...');
      setTimeout(() => this.setup(), 2000);
      return;
    }

    console.log('✅ Контейнер чата найден:', chatContainer.className || chatContainer.tagName);

    // Создаём панель с вариантами ответов
    this.createPanel();
    
    // Следим за новыми сообщениями
    this.watchMessages();
    
    // НОВОЕ: Следим за сменой чата
    this.watchChatChanges();
    
    // НОВОЕ: Анализируем последнее сообщение при загрузке
    this.checkLastMessage();
    
    console.log('✅ Расширение готово к работе');
  }

  createPanel() {
    // Проверяем, не создана ли уже панель
    if (document.getElementById('wazzup-ai-panel')) {
      console.log('ℹ️ Панель уже существует');
      return;
    }

    const panel = document.createElement('div');
    panel.id = 'wazzup-ai-panel';
    panel.innerHTML = `
      <div class="wai-header">
        <div class="wai-title">
          <span class="wai-icon">✨</span>
          AI Подсказки
        </div>
        <button class="wai-close" title="Свернуть">&times;</button>
      </div>
      <div class="wai-content">
        <div class="wai-empty">
          <p>Анализирую последнее сообщение...</p>
          <small>Подождите, генерирую варианты ответов</small>
        </div>
      </div>
    `;

    // Добавляем панель в DOM
    document.body.appendChild(panel);
    this.panel = panel;

    // Обработчик кнопки закрытия
    panel.querySelector('.wai-close').addEventListener('click', () => {
      panel.classList.toggle('wai-minimized');
    });

    console.log('🎨 Панель создана и добавлена в DOM');
  }

  // НОВОЕ: Проверка последнего сообщения при загрузке чата
  checkLastMessage() {
    console.log('🔍 Проверка последнего входящего сообщения...');
    
    // Ищем все входящие сообщения
    const incomingMessages = document.querySelectorAll(
      '.body-messages-item.incoming, [class*="incoming"]'
    );
    
    if (incomingMessages.length === 0) {
      console.log('ℹ️ Входящих сообщений не найдено');
      this.showEmptyState();
      return;
    }
    
    // Берём последнее входящее сообщение
    const lastIncoming = incomingMessages[incomingMessages.length - 1];
    console.log('✅ Найдено последнее входящее сообщение');
    
    // Обрабатываем его
    this.onNewIncomingMessage(lastIncoming, true);
  }

  // НОВОЕ: Отслеживание смены чата
  watchChatChanges() {
    console.log('👀 Начинаем отслеживать смену чата...');
    
    // Следим за изменением URL
    let lastUrl = location.href;
    new MutationObserver(() => {
      const url = location.href;
      if (url !== lastUrl) {
        console.log('🔄 URL изменился, чат переключен');
        lastUrl = url;
        this.lastMessageText = ''; // Сбрасываем последнее сообщение
        this.lastProcessedChatId = null;
        
        // Проверяем последнее сообщение в новом чате
        setTimeout(() => this.checkLastMessage(), 1000);
      }
    }).observe(document, { subtree: true, childList: true });
  }

  watchMessages() {
    // Ищем родительский контейнер всех сообщений
    const messagesList = 
      document.querySelector('.body-messages-list') ||
      document.querySelector('[class*="messages-list"]') ||
      document.querySelector('[class*="chat-messages"]') ||
      document.querySelector('.chat-body-wrapper') ||
      // НОВОЕ: ищем родителя элементов с классом message-item-hover
      document.querySelector('.message-item-hover')?.parentElement ||
      document.body; // в крайнем случае следим за всем body
    
    if (!messagesList) {
      console.log('⏳ Список сообщений не найден, повтор через 2 сек...');
      setTimeout(() => this.watchMessages(), 2000);
      return;
    }

    console.log('✅ Список сообщений найден:', messagesList.className || messagesList.tagName);

    // Создаём наблюдатель за изменениями DOM
    this.messageObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.addedNodes.length > 0) {
          // Проверяем, добавлено ли входящее сообщение
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === 1 && node.querySelector) {
              // Ищем входящие сообщения
              const incomingMsg = 
                node.querySelector('.body-messages-item.incoming') ||
                (node.classList && node.classList.contains('incoming') ? node : null) ||
                node.querySelector('[class*="incoming"]');
                
              if (incomingMsg) {
                this.onNewIncomingMessage(incomingMsg, false);
              }
            }
          });
        }
      }
    });

    this.messageObserver.observe(messagesList, {
      childList: true,
      subtree: true
    });

    console.log('👀 Наблюдатель за сообщениями активирован');
  }

  onNewIncomingMessage(messageElement, isInitial = false) {
    console.log('🔔 Обнаружено входящее сообщение', isInitial ? '(при загрузке)' : '(новое)');
    
    // Получаем текст сообщения (пробуем разные селекторы)
    const textElement = 
      messageElement.querySelector(this.selectors.messageText) ||
      messageElement.querySelector('[dir="auto"]') ||
      messageElement.querySelector('.body-text') ||
      messageElement.querySelector('[class*="text"]');
      
    if (!textElement) {
      console.log('⚠️ Текст сообщения не найден');
      if (isInitial) {
        this.showEmptyState();
      }
      return;
    }

    const messageText = textElement.textContent.trim();
    
    // Игнорируем пустые сообщения и дубликаты
    if (!messageText) {
      console.log('ℹ️ Сообщение пустое');
      if (isInitial) {
        this.showEmptyState();
      }
      return;
    }
    
    // Для начального сообщения или если текст изменился
    if (isInitial || messageText !== this.lastMessageText) {
      this.lastMessageText = messageText;
      console.log('📨 Сообщение для обработки:', messageText);

      // Генерируем варианты ответов
      this.generateResponses(messageText);
    } else {
      console.log('ℹ️ Дубликат сообщения, игнорируем');
    }
  }

  showEmptyState() {
    const content = this.panel.querySelector('.wai-content');
    content.innerHTML = `
      <div class="wai-empty">
        <p>Нет входящих сообщений</p>
        <small>Когда клиент напишет, я предложу варианты ответов</small>
      </div>
    `;
  }

  async generateResponses(clientMessage) {
    console.log('🎯 generateResponses вызван с сообщением:', clientMessage);
    
    if (!this.apiKey) {
      console.error('❌ API ключ не найден');
      this.showError('API ключ OpenAI не настроен. Откройте настройки расширения.');
      return;
    }

    console.log('✅ API ключ найден:', this.apiKey.substring(0, 10) + '...');

    if (this.isGenerating) {
      console.log('⏳ Генерация уже выполняется...');
      return;
    }

    this.isGenerating = true;
    this.showLoading();

    try {
      // Получаем контекст последних сообщений
      const context = this.getConversationContext();
      console.log('📝 Контекст получен:', context);
      
      // Получаем настройки из storage
      const settings = await chrome.storage.sync.get([
        'model',
        'customPrompt',
        'temperature',
        'maxTokens',
        'contextMessages'
      ]);
      
      console.log('⚙️ Настройки получены:', settings);
      
      const messageData = {
        type: 'GENERATE_RESPONSES',
        data: {
          clientMessage,
          context,
          settings: {
            apiKey: this.apiKey,
            model: settings.model || 'gpt-4',
            customPrompt: settings.customPrompt || '',
            temperature: settings.temperature || 0.7,
            maxTokens: settings.maxTokens || 500
          }
        }
      };
      
      console.log('📤 Отправка сообщения в background:', messageData);
      
      // Создаём таймаут на 30 секунд
      const timeoutId = setTimeout(() => {
        console.error('⏱️ ТАЙМАУТ! Ответ не получен за 30 секунд');
        this.showError('Превышено время ожидания ответа от сервера');
        this.isGenerating = false;
      }, 30000);
      
      // Отправляем запрос через background script
      chrome.runtime.sendMessage(messageData, (response) => {
        clearTimeout(timeoutId);
        
        console.log('📥 Callback вызван');
        console.log('📥 Ответ получен:', response);
        console.log('📥 chrome.runtime.lastError:', chrome.runtime.lastError);
        
        if (chrome.runtime.lastError) {
          console.error('❌ Chrome runtime error:', chrome.runtime.lastError);
          this.showError('Ошибка связи с расширением: ' + chrome.runtime.lastError.message);
          this.isGenerating = false;
          return;
        }
        
        if (!response) {
          console.error('❌ Пустой ответ от background script');
          this.showError('Не получен ответ от background script. Проверьте консоль background script (chrome://extensions).');
          this.isGenerating = false;
          return;
        }
        
        if (response.success) {
          console.log('✅ Успешно получены варианты:', response.variants);
          this.displayResponses(response.variants);
        } else {
          console.error('❌ Ошибка в ответе:', response.error);
          this.showError('Ошибка: ' + response.error);
        }
        this.isGenerating = false;
      });
      
      console.log('✅ Сообщение отправлено, ждём ответа...');
      
    } catch (error) {
      console.error('❌ Ошибка генерации:', error);
      this.showError('Ошибка генерации ответов: ' + error.message);
      this.isGenerating = false;
    }
  }

  getConversationContext() {
    // Получаем последние 5 сообщений для контекста
    const messages = [];
    const allMessages = document.querySelectorAll('.body-messages-item, [class*="message-item"]');
    
    // Берём последние 5 сообщений
    const recentMessages = Array.from(allMessages).slice(-5);
    
    recentMessages.forEach((msgEl) => {
      const isIncoming = msgEl.classList.contains('incoming') || 
                        msgEl.querySelector('[class*="incoming"]');
      const textEl = msgEl.querySelector('[dir="auto"], .body-text, [class*="text"]');
      
      if (textEl) {
        messages.push({
          role: isIncoming ? 'client' : 'manager',
          text: textEl.textContent.trim()
        });
      }
    });
    
    return messages;
  }

  showLoading() {
    const content = this.panel.querySelector('.wai-content');
    content.innerHTML = `
      <div class="wai-loader">
        <div class="wai-spinner"></div>
        <p>Генерирую варианты ответов...</p>
      </div>
    `;
  }

  displayResponses(responses) {
    const content = this.panel.querySelector('.wai-content');
    content.innerHTML = '';

    responses.forEach((response, index) => {
      const suggestionEl = document.createElement('div');
      suggestionEl.className = 'wai-suggestion';
      suggestionEl.innerHTML = `
        <div class="wai-suggestion-label">${response.label}</div>
        <div class="wai-suggestion-text">${response.text}</div>
        <div class="wai-suggestion-actions">
          <button class="wai-btn wai-btn-insert" data-index="${index}">
            📋 Вставить
          </button>
          <button class="wai-btn wai-btn-send" data-index="${index}">
            ✉️ Отправить
          </button>
        </div>
      `;

      // Обработчики кнопок
      suggestionEl.querySelector('.wai-btn-insert').addEventListener('click', () => {
        this.insertResponse(response.text);
      });

      suggestionEl.querySelector('.wai-btn-send').addEventListener('click', () => {
        this.insertAndSendResponse(response.text);
      });

      content.appendChild(suggestionEl);
    });

    console.log('✅ Варианты ответов отображены');
  }

  insertResponse(text) {
    const inputField = document.querySelector(this.selectors.chatInput);
    if (!inputField) {
      this.showError('Поле ввода не найдено');
      return;
    }

    // Вставляем текст
    inputField.textContent = text;
    
    // Эмулируем событие input для корректной работы Wazzup
    inputField.dispatchEvent(new Event('input', { bubbles: true }));
    inputField.focus();

    console.log('✅ Текст вставлен в поле ввода');
  }

  insertAndSendResponse(text) {
    this.insertResponse(text);
    
    // Ждём немного и кликаем на кнопку отправки
    setTimeout(() => {
      const sendBtn = document.querySelector(this.selectors.sendButton);
      if (sendBtn) {
        sendBtn.click();
        console.log('✅ Сообщение отправлено');
      }
    }, 100);
  }

  showError(message) {
    const content = this.panel.querySelector('.wai-content');
    content.innerHTML = `
      <div class="wai-error">
        <span class="wai-error-icon">⚠️</span>
        <p>${message}</p>
      </div>
    `;
  }
}

// Запускаем расширение
const assistant = new WazzupAIAssistant();
