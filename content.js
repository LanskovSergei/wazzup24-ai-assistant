console.log('🚀 Wazzup24 AI Assistant загружен');

class WazzupAIAssistant {
  constructor() {
    console.log('📝 Инициализация расширения...');
    this.currentMessage = null;
    this.panel = null;
    this.responses = [];
    this.chatContainer = null;
    
    this.init();
  }

  async init() {
    try {
      const settings = await this.loadSettings();
      console.log('⚙️ Настройки загружены:', {
        hasKey: !!settings.apiKey,
        enabled: settings.enabled
      });
      
      if (!settings.enabled) {
        console.log('⏸️ Расширение отключено');
        return;
      }

      console.log('🔧 Настройка интерфейса...');
      await this.setupUI();
      this.watchIncomingMessages();
      this.watchChatChanges();
      
      console.log('✅ Расширение готово к работе');
    } catch (error) {
      console.error('❌ Ошибка инициализации:', error);
    }
  }

  async setupUI() {
    const maxAttempts = 10;
    let attempt = 0;

    while (attempt < maxAttempts) {
      this.chatContainer = document.querySelector('.body-messages');
      
      if (this.chatContainer) {
        const firstIncoming = this.chatContainer.querySelector('.body-messages-item.incoming');
        console.log('✅ Контейнер чата найден:', firstIncoming ? firstIncoming.className : 'нет входящих');
        this.createPanel();
        this.checkLastMessage();
        return;
      }

      attempt++;
      console.log(`⏳ Чат не загружен, повтор через ${attempt} сек...`);
      await this.sleep(1000);
    }

    console.error('❌ Не удалось найти контейнер чата');
  }

  createPanel() {
    if (document.getElementById('wazzup-ai-panel')) {
      console.log('⚠️ Панель уже существует');
      return;
    }

    this.panel = document.createElement('div');
    this.panel.id = 'wazzup-ai-panel';
    this.panel.className = 'wai-panel';
    this.panel.innerHTML = `
      <div class="wai-header">
        <h3 class="wai-title">🤖 AI Помощник</h3>
        <button class="wai-close" title="Свернуть">−</button>
      </div>
      <div class="wai-content">
        <div class="wai-view-responses"></div>
      </div>
    `;

    document.body.appendChild(this.panel);
    console.log('🎨 Панель создана и добавлена в DOM');

    this.panel.querySelector('.wai-close').addEventListener('click', () => {
      this.panel.classList.toggle('wai-minimized');
    });
  }

  checkLastMessage() {
    console.log('🔍 Проверка последнего входящего сообщения...');
    
    if (!this.chatContainer) {
      console.log('❌ Контейнер чата не найден');
      return;
    }

    const incomingMessages = this.chatContainer.querySelectorAll('.body-messages-item.incoming');
    
    if (incomingMessages.length > 0) {
      const lastIncoming = incomingMessages[incomingMessages.length - 1];
      console.log('✅ Найдено последнее входящее сообщение');
      this.onNewIncomingMessage(lastIncoming, true);
    } else {
      console.log('ℹ️ Входящих сообщений не найдено');
      this.showEmptyState();
    }
  }

  watchChatChanges() {
    console.log('👀 Начинаем отслеживать смену чата...');
    
    let lastChatUrl = window.location.href;
    
    const urlObserver = setInterval(() => {
      const currentUrl = window.location.href;
      
      if (currentUrl !== lastChatUrl) {
        console.log('🔄 Обнаружена смена чата');
        lastChatUrl = currentUrl;
        
        setTimeout(() => {
          this.chatContainer = document.querySelector('.body-messages');
          this.checkLastMessage();
        }, 500);
      }
    }, 500);
  }

  watchIncomingMessages() {
    const messagesList = document.querySelector('.chat-body-wrapper');
    
    if (!messagesList) {
      console.error('❌ Не удалось найти список сообщений');
      return;
    }

    console.log('✅ Список сообщений найден:', messagesList.className);

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.addedNodes.length > 0) {
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === 1 && node.classList && node.classList.contains('incoming')) {
              console.log('🔔 Обнаружено новое входящее сообщение');
              this.onNewIncomingMessage(node, false);
            }
          });
        }
      }
    });

    observer.observe(messagesList, {
      childList: true,
      subtree: true
    });

    console.log('👀 Наблюдатель за сообщениями активирован');
  }

  async onNewIncomingMessage(messageElement, isInitial = false) {
    console.log(`🔔 Обнаружено входящее сообщение (${isInitial ? 'при загрузке' : 'новое'})`);
    
    await this.sleep(500);

    const messageText = this.extractMessageText(messageElement);
    
    if (!messageText || messageText.trim() === '') {
      console.log('⚠️ Сообщение пустое, пропускаем');
      return;
    }

    console.log('📨 Сообщение для обработки:', messageText);
    this.currentMessage = messageText;

    this.generateResponses(messageText);
  }

  extractMessageText(element) {
    const textElement = element.querySelector('.body-messages-item-text span span');
    return textElement ? textElement.textContent.trim() : '';
  }

  showEmptyState() {
    const content = this.panel.querySelector('.wai-view-responses');
    if (content) {
      content.innerHTML = `
        <div class="wai-empty-state">
          <p>💬 Ожидаю входящего сообщения...</p>
        </div>
      `;
    }
  }

  async generateResponses(message) {
    console.log('🎯 generateResponses вызван с сообщением:', message);

    try {
      const settings = await this.loadSettings();

      if (!settings.apiKey) {
        console.error('❌ API ключ не найден');
        this.showError('API ключ не настроен. Откройте настройки расширения.');
        return;
      }

      console.log('✅ API ключ найден:', settings.apiKey.substring(0, 10) + '...');

      this.showLoading();

      const context = this.getMessageContext();
      console.log('📝 Контекст получен:', context);

      chrome.storage.sync.get([
        'model',
        'temperature',
        'maxTokens',
        'contextMessages',
        'customPrompt'
      ], (items) => {
        console.log('⚙️ Настройки получены:', items);

        const requestData = {
          message: message,
          context: context,
          settings: {
            model: items.model || 'gpt-4',
            temperature: items.temperature || 0.7,
            maxTokens: items.maxTokens || 500,
            customPrompt: items.customPrompt || ''
          }
        };

        console.log('📤 Отправка сообщения в background:', {
          type: 'GENERATE_RESPONSES',
          data: requestData
        });

        chrome.runtime.sendMessage(
          {
            type: 'GENERATE_RESPONSES',
            data: requestData
          },
          (response) => {
            console.log('📥 Получен ответ от background:', response);

            if (chrome.runtime.lastError) {
              console.error('❌ Ошибка runtime:', chrome.runtime.lastError);
              this.showError('Ошибка связи с расширением: ' + chrome.runtime.lastError.message);
              return;
            }

            if (!response) {
              console.error('❌ Пустой ответ от background');
              this.showError('Не получен ответ от расширения');
              return;
            }

            if (response.error) {
              console.error('❌ Ошибка в ответе:', response.error);
              this.showError(response.error);
              return;
            }

            if (response.responses && response.responses.length > 0) {
              console.log('✅ Получены варианты ответов:', response.responses.length);
              this.responses = response.responses;
              this.displayResponses();
            } else {
              console.error('❌ Нет вариантов ответов в ответе');
              this.showError('Не удалось получить варианты ответов');
            }
          }
        );

        console.log('✅ Сообщение отправлено, ждём ответа...');
      });

    } catch (error) {
      console.error('❌ Ошибка в generateResponses:', error);
      this.showError('Произошла ошибка: ' + error.message);
    }
  }

  getMessageContext() {
    if (!this.chatContainer) return [];

    const messages = Array.from(this.chatContainer.querySelectorAll('.body-messages-item'));
    const contextMessages = messages.slice(-10).map(msg => {
      const isIncoming = msg.classList.contains('incoming');
      const textElement = msg.querySelector('.body-messages-item-text span span');
      const text = textElement ? textElement.textContent.trim() : '';
      
      return {
        role: isIncoming ? 'user' : 'assistant',
        content: text
      };
    }).filter(msg => msg.content !== '');

    return contextMessages;
  }

  displayResponses() {
    const content = this.panel.querySelector('.wai-view-responses');
    if (!content) return;

    content.innerHTML = '';
    
    this.responses.forEach((response, index) => {
      const responseCard = document.createElement('div');
      responseCard.className = 'wai-response-card';
      responseCard.innerHTML = `
        <div class="wai-response-text">${this.escapeHtml(response)}</div>
        <div class="wai-response-actions">
          <button class="wai-btn wai-btn-insert" data-index="${index}">
            📋 Вставить
          </button>
          <button class="wai-btn wai-btn-send" data-index="${index}">
            ✉️ Отправить
          </button>
        </div>
      `;
      
      content.appendChild(responseCard);
    });

    content.querySelectorAll('.wai-btn-insert').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const index = parseInt(e.target.dataset.index);
        this.insertResponse(this.responses[index]);
      });
    });

    content.querySelectorAll('.wai-btn-send').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const index = parseInt(e.target.dataset.index);
        this.insertAndSendResponse(this.responses[index]);
      });
    });
  }

  showLoading() {
    const content = this.panel.querySelector('.wai-view-responses');
    if (content) {
      content.innerHTML = `
        <div class="wai-loading">
          <div class="wai-spinner"></div>
          <p>Генерирую варианты ответов...</p>
        </div>
      `;
    }
  }

  // ИСПРАВЛЕНО: вставка в правильное поле!
  insertResponse(text) {
    console.log('📝 Вставка текста:', text);

    // Ищем ПРАВИЛЬНОЕ поле - .chat-input-field (не .chat-input!)
    const chatInputField = document.querySelector('.chat-input-field');
    
    if (!chatInputField) {
      console.error('❌ Поле .chat-input-field не найдено');
      this.showError('Поле ввода не найдено');
      return;
    }

    console.log('✅ Поле ввода найдено:', chatInputField);

    // Вставляем текст и триггерим событие
    chatInputField.focus();
    chatInputField.textContent = text;
    chatInputField.dispatchEvent(new Event('input', { bubbles: true }));
    
    console.log('✅ Текст вставлен, кнопка должна активироваться');
  }

  // ИСПРАВЛЕНО: отправка через активную кнопку
  insertAndSendResponse(text) {
    this.insertResponse(text);
    
    setTimeout(() => {
      const sendBtn = document.querySelector('.footer-send button');
      
      if (sendBtn && sendBtn.className.includes('primary--text')) {
        console.log('✅ Кнопка активна, отправляем');
        sendBtn.click();
      } else {
        console.error('❌ Кнопка не активна:', sendBtn?.className);
        // Попробуем еще раз через 200ms
        setTimeout(() => {
          const btn = document.querySelector('.footer-send button');
          if (btn && btn.className.includes('primary--text')) {
            console.log('✅ Кнопка активна (2-я попытка), отправляем');
            btn.click();
          } else {
            console.error('❌ Кнопка так и не активировалась');
          }
        }, 200);
      }
    }, 300);
  }

  showError(message) {
    const content = this.panel.querySelector('.wai-view-responses');
    if (content) {
      content.innerHTML = `
        <div class="wai-error">
          <span class="wai-error-icon">⚠️</span>
          <p>${message}</p>
        </div>
      `;
    }
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async loadSettings() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(['apiKey', 'enabled'], (items) => {
        resolve({
          apiKey: items.apiKey || '',
          enabled: items.enabled !== false
        });
      });
    });
  }
}

// Добавляем стили
const style = document.createElement('style');
style.textContent = `
  .wai-panel {
    position: fixed;
    right: 20px;
    bottom: 20px;
    width: 400px;
    max-height: 600px;
    background: white;
    border-radius: 12px;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
    z-index: 999999;
    display: flex;
    flex-direction: column;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    transition: all 0.3s ease;
  }

  .wai-panel.wai-minimized {
    max-height: 60px;
  }

  .wai-panel.wai-minimized .wai-content {
    display: none;
  }

  .wai-header {
    padding: 16px 20px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border-radius: 12px 12px 0 0;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .wai-title {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
  }

  .wai-close {
    background: rgba(255, 255, 255, 0.2);
    border: none;
    color: white;
    width: 28px;
    height: 28px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.2s;
  }

  .wai-close:hover {
    background: rgba(255, 255, 255, 0.3);
  }

  .wai-content {
    padding: 16px;
    overflow-y: auto;
    flex: 1;
  }

  .wai-view-responses {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .wai-response-card {
    background: #f8f9fa;
    border-radius: 8px;
    padding: 12px;
    transition: transform 0.2s, box-shadow 0.2s;
  }

  .wai-response-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }

  .wai-response-text {
    color: #2d3748;
    font-size: 14px;
    line-height: 1.6;
    margin-bottom: 12px;
    white-space: pre-wrap;
    word-wrap: break-word;
  }

  .wai-response-actions {
    display: flex;
    gap: 8px;
  }

  .wai-btn {
    flex: 1;
    padding: 8px 12px;
    border: none;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .wai-btn-insert {
    background: #e2e8f0;
    color: #4a5568;
  }

  .wai-btn-insert:hover {
    background: #cbd5e0;
  }

  .wai-btn-send {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
  }

  .wai-btn-send:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
  }

  .wai-loading {
    text-align: center;
    padding: 32px 16px;
    color: #718096;
  }

  .wai-spinner {
    width: 40px;
    height: 40px;
    margin: 0 auto 16px;
    border: 3px solid #e2e8f0;
    border-top-color: #667eea;
    border-radius: 50%;
    animation: wai-spin 1s linear infinite;
  }

  @keyframes wai-spin {
    to { transform: rotate(360deg); }
  }

  .wai-error {
    background: #fff5f5;
    border: 1px solid #fc8181;
    border-radius: 8px;
    padding: 16px;
    color: #c53030;
    text-align: center;
  }

  .wai-error-icon {
    font-size: 24px;
    display: block;
    margin-bottom: 8px;
  }

  .wai-empty-state {
    text-align: center;
    padding: 32px 16px;
    color: #a0aec0;
  }

  .wai-empty-state p {
    margin: 0;
    font-size: 14px;
  }
`;

document.head.appendChild(style);

// Запускаем расширение
const assistant = new WazzupAIAssistant();
