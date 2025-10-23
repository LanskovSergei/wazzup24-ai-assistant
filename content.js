// content.js - Основной скрипт расширения для Wazzup24
console.log('🚀 Wazzup24 AI Assistant загружен');

class WazzupAIAssistant {
  constructor() {
    this.panel = null;
    this.apiKey = null;
    this.isGenerating = false;
    this.lastMessageText = '';
    this.messageObserver = null;
    this.lastProcessedChatId = null;
    this.keepAlivePort = null;
    this.currentView = 'responses';
    this.panelPosition = 100;
    this.systemPrompt = '';
    
    // Селекторы для Wazzup24
    this.selectors = {
      chatInput: '.chat-input[contenteditable="true"]',
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
    
    await this.loadSettings();
    await this.loadPanelPosition();
    
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.setup());
    } else {
      this.setup();
    }
  }

  async loadSettings() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(['apiKey', 'enabled', 'systemPrompt'], (data) => {
        this.apiKey = data.apiKey || null;
        this.enabled = data.enabled !== false;
        this.systemPrompt = data.systemPrompt || this.getDefaultPrompt();
        console.log('⚙️ Настройки загружены:', { 
          hasKey: !!this.apiKey, 
          enabled: this.enabled,
          promptLength: this.systemPrompt.length 
        });
        resolve();
      });
    });
  }

  async loadPanelPosition() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['panelPosition'], (data) => {
        if (data.panelPosition !== undefined) {
          this.panelPosition = data.panelPosition;
        }
        console.log('📍 Позиция панели загружена:', this.panelPosition);
        resolve();
      });
    });
  }

  savePanelPosition() {
    chrome.storage.local.set({ panelPosition: this.panelPosition });
    console.log('💾 Позиция панели сохранена:', this.panelPosition);
  }

  getDefaultPrompt() {
    return `Ты — менеджер магазина DJI Market.

ВАЖНЫЕ ПРАВИЛА ОБРАЩЕНИЯ:
- Всегда обращайся на "Вы" (с большой буквы): "Вы", "Вам", "Вас", "Ваш"
- Пиши вежливо, грамотно и по делу

ТВОЯ РОЛЬ:
Помогаешь клиентам выбрать и купить квадрокоптеры, камеры, стабилизаторы и аксессуары DJI.

ИСТОЧНИК ИНФОРМАЦИИ:
Используй только актуальные данные с сайта dji-market.ru — не придумывай характеристик и цен.

ПРИ ОТВЕТЕ:
1. Предлагай 1–3 подходящих модели с:
   - Названием
   - Ориентиром по цене
   - Ссылкой на dji-market.ru
2. Всегда указывай, что доставка по России бесплатная
3. Пиши уверенно, с пользой для клиента: чем конкретная модель лучше и для кого она подходит
4. ОБЯЗАТЕЛЬНО подталкивай к развитию диалога:
   - Задавай уточняющие вопросы
   - Предлагай дополнительные варианты
   - Рекомендуй аксессуары или апгрейды
   - Предлагай оформить КП или заказ
   - Интересуйся опытом использования техники
5. Поддерживай диалог вдумчиво, показывай экспертность

РАБОТА С ВОЗРАЖЕНИЯМИ КЛИЕНТА:
Когда клиент высказывает сомнения или возражения (например: "дорого", "не уверен", "видел дешевле", "а вдруг сломается"), отрабатывай их спокойно и уверенно:
- "Дорого" / "Высокая цена" → Оригинальная продукция, официальная гарантия производителя, профессиональный сервис, бесплатная доставка
- "Сомнения в качестве" → Только оригинал от DJI, официальная гарантия, сервисная поддержка по всей России
- "Видел дешевле" → У нас 100% оригинал, бесплатная доставка, помощь в настройке, официальная гарантия
- "Боюсь сломается" → Официальная гарантия производителя, наш сервисный центр, техподдержка 24/7
- "Не уверен в выборе" → Помогу подобрать под Ваши задачи, расскажу о преимуществах каждой модели

ЕСЛИ КЛИЕНТ СОМНЕВАЕТСЯ:
- Помоги определиться с выбором через уточняющие вопросы
- Предложи оформить коммерческое предложение (КП) с расчётом
- Предложи оформить заказ с менеджером
- Расскажи про трейд-ин или рассрочку (если уместно)

ФОРМАТ ОТВЕТА:
Сгенерируй 3 варианта ответа, КАЖДЫЙ из которых подталкивает к продолжению диалога:

1. КОРОТКИЙ С ВОПРОСОМ (2-3 предложения)
   - Краткий ответ на вопрос клиента
   - Уточняющий вопрос для развития диалога

2. ПОДРОБНЫЙ С РЕКОМЕНДАЦИЕЙ (3-5 предложений)
   - Развёрнутый ответ с деталями
   - Рекомендация конкретных моделей
   - Предложение дополнительных опций или следующего шага

3. ЭКСПЕРТНЫЙ С ПРЕДЛОЖЕНИЕМ (3-4 предложения)
   - Экспертная рекомендация
   - Обоснование выбора
   - Конкретное предложение действия (оформить КП, заказ, консультацию)

КРИТИЧЕСКИ ВАЖНО:
- В КАЖДОМ варианте должен быть элемент, продолжающий диалог (вопрос, предложение, рекомендация)
- НЕ закрывай диалог фразами типа "Обращайтесь!" или "Всего доброго!"
- Будь проактивным, но не навязчивым`;
  }

  setup() {
    console.log('🔧 Настройка интерфейса...');
    
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

    this.createPanel();
    this.updatePanelPosition();
    this.watchMessages();
    this.watchChatChanges();
    this.checkLastMessage();
    
    console.log('✅ Расширение готово к работе');
  }

  createPanel() {
    if (document.getElementById('wazzup-ai-panel')) {
      console.log('ℹ️ Панель уже существует');
      this.panel = document.getElementById('wazzup-ai-panel');
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
        <div class="wai-header-actions">
          <button class="wai-move-up" title="Поднять вверх">⬆️</button>
          <button class="wai-move-down" title="Опустить вниз">⬇️</button>
          <button class="wai-refresh" title="Обновить ответы">🔄</button>
          <button class="wai-close" title="Свернуть">&times;</button>
        </div>
      </div>
      
      <div class="wai-tabs">
        <button class="wai-tab wai-tab-active" data-tab="responses">Ответы</button>
        <button class="wai-tab" data-tab="prompt">Промпт</button>
      </div>
      
      <div class="wai-content">
        <div class="wai-view wai-view-responses wai-view-active">
          <div class="wai-empty">
            <p>Анализирую последнее сообщение...</p>
            <small>Подождите, генерирую варианты ответов</small>
          </div>
        </div>
        
        <div class="wai-view wai-view-prompt">
          <div class="wai-prompt-editor">
            <textarea class="wai-prompt-textarea" placeholder="Введите системный промпт..."></textarea>
            <div class="wai-prompt-actions">
              <button class="wai-btn wai-btn-save-prompt">💾 Сохранить</button>
              <button class="wai-btn wai-btn-reset-prompt">🔄 Сбросить</button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(panel);
    this.panel = panel;

    const textarea = panel.querySelector('.wai-prompt-textarea');
    if (textarea) {
      textarea.value = this.systemPrompt;
      console.log('✅ Промпт установлен в textarea, длина:', this.systemPrompt.length);
    }

    panel.querySelector('.wai-move-up').addEventListener('click', () => {
      this.movePanel(25);
    });

    panel.querySelector('.wai-move-down').addEventListener('click', () => {
      this.movePanel(-25);
    });

    panel.querySelector('.wai-refresh').addEventListener('click', () => {
      console.log('🔄 Обновление ответов...');
      const lastMessage = this.getLastIncomingMessage();
      if (lastMessage) {
        this.generateResponses(lastMessage);
      } else {
        this.showError('Нет входящих сообщений для обновления');
      }
    });

    panel.querySelector('.wai-close').addEventListener('click', () => {
      panel.classList.toggle('wai-collapsed');
    });

    const tabs = panel.querySelectorAll('.wai-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const targetTab = tab.dataset.tab;
        this.switchTab(targetTab);
      });
    });

    panel.querySelector('.wai-btn-save-prompt').addEventListener('click', () => {
      this.savePrompt();
    });

    panel.querySelector('.wai-btn-reset-prompt').addEventListener('click', () => {
      this.resetPrompt();
    });

    console.log('✅ Панель создана');
  }

  switchTab(tabName) {
    this.panel.querySelectorAll('.wai-tab').forEach(tab => {
      if (tab.dataset.tab === tabName) {
        tab.classList.add('wai-tab-active');
      } else {
        tab.classList.remove('wai-tab-active');
      }
    });

    this.panel.querySelectorAll('.wai-view').forEach(view => {
      if (view.classList.contains(`wai-view-${tabName}`)) {
        view.classList.add('wai-view-active');
      } else {
        view.classList.remove('wai-view-active');
      }
    });

    this.currentView = tabName;
    console.log('✅ Переключено на вкладку:', tabName);
  }

  savePrompt() {
    const textarea = this.panel.querySelector('.wai-prompt-textarea');
    const newPrompt = textarea.value.trim();
    
    if (!newPrompt) {
      alert('Промпт не может быть пустым');
      return;
    }

    this.systemPrompt = newPrompt;
    
    chrome.storage.sync.set({ systemPrompt: newPrompt }, () => {
      console.log('✅ Промпт сохранён, длина:', newPrompt.length);
      
      const saveBtn = this.panel.querySelector('.wai-btn-save-prompt');
      const originalText = saveBtn.textContent;
      saveBtn.textContent = '✅ Сохранено!';
      saveBtn.style.background = '#10b981';
      
      setTimeout(() => {
        saveBtn.textContent = originalText;
        saveBtn.style.background = '';
      }, 2000);
    });
  }

  resetPrompt() {
    if (!confirm('Вы уверены, что хотите сбросить промпт к значению по умолчанию?')) {
      return;
    }

    const defaultPrompt = this.getDefaultPrompt();
    this.systemPrompt = defaultPrompt;
    
    const textarea = this.panel.querySelector('.wai-prompt-textarea');
    textarea.value = defaultPrompt;
    
    chrome.storage.sync.set({ systemPrompt: defaultPrompt }, () => {
      console.log('✅ Промпт сброшен к значению по умолчанию');
      
      const resetBtn = this.panel.querySelector('.wai-btn-reset-prompt');
      const originalText = resetBtn.textContent;
      resetBtn.textContent = '✅ Сброшено!';
      resetBtn.style.background = '#10b981';
      
      setTimeout(() => {
        resetBtn.textContent = originalText;
        resetBtn.style.background = '';
      }, 2000);
    });
  }

  movePanel(delta) {
    this.panelPosition += delta;
    this.panelPosition = Math.max(20, Math.min(this.panelPosition, window.innerHeight - 100));
    this.updatePanelPosition();
    this.savePanelPosition();
  }

  updatePanelPosition() {
    if (this.panel) {
      this.panel.style.bottom = `${this.panelPosition}px`;
      console.log('📍 Панель перемещена на:', this.panelPosition);
    }
  }

  watchMessages() {
    const messagesList = document.querySelector('.body-messages-list') ||
                        document.querySelector('[class*="messages-list"]') ||
                        document.querySelector('[class*="chat-messages"]') ||
                        document.querySelector('.message-item-hover')?.parentElement ||
                        document.body;
    
    if (!messagesList) {
      console.log('⏳ Список сообщений не найден, повтор через 2 сек...');
      setTimeout(() => this.watchMessages(), 2000);
      return;
    }

    console.log('✅ Список сообщений найден:', messagesList.className || messagesList.tagName);

    this.messageObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.addedNodes.length > 0) {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === 1 && node.querySelector) {
              const incomingMsg = node.querySelector('.body-messages-item.incoming') ||
                                (node.classList && node.classList.contains('incoming') ? node : null) ||
                                node.querySelector('[class*="incoming"]');
              
              if (incomingMsg) {
                this.onNewIncomingMessage(incomingMsg);
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

  watchChatChanges() {
    const observer = new MutationObserver(() => {
      const currentChatId = this.getCurrentChatId();
      if (currentChatId && currentChatId !== this.lastProcessedChatId) {
        console.log('🔄 Обнаружена смена чата');
        this.lastProcessedChatId = currentChatId;
        this.lastMessageText = '';
        setTimeout(() => this.checkLastMessage(), 500);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class']
    });
  }

  getCurrentChatId() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('id') || window.location.pathname;
  }

  onNewIncomingMessage(messageElement) {
    console.log('📨 Обнаружено новое входящее сообщение');
    
    setTimeout(() => {
      const textElement = messageElement.querySelector('[dir="auto"], .body-text, [class*="text"]');
      if (textElement) {
        const messageText = textElement.textContent.trim();
        console.log('💬 Текст сообщения:', messageText.substring(0, 100));
        
        if (messageText && messageText !== this.lastMessageText) {
          this.lastMessageText = messageText;
          this.generateResponses(messageText);
        }
      }
    }, 300);
  }

  checkLastMessage() {
    const lastMessage = this.getLastIncomingMessage();
    if (lastMessage && lastMessage !== this.lastMessageText) {
      console.log('🔍 Найдено последнее сообщение при проверке');
      this.lastMessageText = lastMessage;
      this.generateResponses(lastMessage);
    }
  }

  getLastIncomingMessage() {
    const incomingMessages = document.querySelectorAll('.body-messages-item.incoming, [class*="incoming"]');
    if (incomingMessages.length === 0) return null;
    
    const lastMsg = incomingMessages[incomingMessages.length - 1];
    const textElement = lastMsg.querySelector('[dir="auto"], .body-text, [class*="text"]');
    
    return textElement ? textElement.textContent.trim() : null;
  }

  async wakeUpServiceWorker() {
    return new Promise((resolve, reject) => {
      console.log('⏰ Пробуждаем Service Worker...');
      chrome.runtime.sendMessage({ type: 'PING' }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('❌ Ошибка пробуждения SW:', chrome.runtime.lastError);
          reject(chrome.runtime.lastError);
        } else {
          console.log('✅ Service Worker пробуждён');
          resolve(response);
        }
      });
    });
  }

  async generateResponses(clientMessage) {
    if (!this.apiKey) {
      this.showError('API ключ не настроен. Откройте настройки расширения.');
      return;
    }

    if (this.isGenerating) {
      console.log('⏳ Генерация уже в процессе, пропускаем...');
      return;
    }

    this.isGenerating = true;
    this.showLoading();

    try {
      await this.wakeUpServiceWorker();
      
      const context = this.getConversationContext();
      console.log('📝 Контекст получен:', context);
      
      const settings = await chrome.storage.sync.get([
        'model',
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
            model: settings.model || 'gpt-5',
            systemPrompt: this.systemPrompt,
            temperature: settings.temperature || 0.7,
            maxTokens: settings.maxTokens || 800
          }
        }
      };
      
      console.log('📤 Отправка сообщения в background:', messageData);
      
      const timeoutId = setTimeout(() => {
        console.error('⏱️ ТАЙМАУТ! Ответ не получен за 30 секунд');
        this.showError('Превышено время ожидания ответа от сервера');
        this.isGenerating = false;
      }, 30000);
      
      chrome.runtime.sendMessage(messageData, (response) => {
        clearTimeout(timeoutId);
        
        console.log('📥 Callback вызван');
        console.log('📥 Ответ получен:', response);
        
        if (chrome.runtime.lastError) {
          console.error('❌ Chrome runtime error:', chrome.runtime.lastError);
          this.showError('Ошибка связи: ' + chrome.runtime.lastError.message);
          this.isGenerating = false;
          return;
        }
        
        if (!response) {
          console.error('❌ Пустой ответ от background script');
          this.showError('Пустой ответ. Перезагрузите расширение.');
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
    const messages = [];
    const allMessages = document.querySelectorAll('.body-messages-item, [class*="message-item"]');
    
    console.log(`📊 Всего сообщений в чате: ${allMessages.length}`);
    
    const recentMessages = Array.from(allMessages).slice(-50);
    
    console.log(`📊 Берём последние ${recentMessages.length} сообщений`);
    
    recentMessages.forEach((msgEl, index) => {
      const isIncoming = msgEl.classList.contains('incoming') || 
                        msgEl.querySelector('[class*="incoming"]');
      const textEl = msgEl.querySelector('[dir="auto"], .body-text, [class*="text"]');
      
      if (textEl) {
        const messageText = textEl.textContent.trim();
        messages.push({
          role: isIncoming ? 'client' : 'manager',
          text: messageText,
          index: index + 1
        });
      }
    });
    
    console.log('📝 Контекст сформирован:');
    console.log(`   - Всего сообщений: ${messages.length}`);
    console.log(`   - От клиента: ${messages.filter(m => m.role === 'client').length}`);
    console.log(`   - От менеджера: ${messages.filter(m => m.role === 'manager').length}`);
    
    const lastClientMessage = messages.filter(m => m.role === 'client').pop();
    if (lastClientMessage) {
      console.log(`   - Последнее сообщение клиента: "${lastClientMessage.text.substring(0, 50)}..."`);
    }
    
    return messages;
  }

  showLoading() {
    const content = this.panel.querySelector('.wai-view-responses');
    if (content) {
      content.innerHTML = `
        <div class="wai-loader">
          <div class="wai-spinner"></div>
          <p>Генерирую варианты ответов...</p>
        </div>
      `;
    }
  }

  displayResponses(responses) {
    const content = this.panel.querySelector('.wai-view-responses');
    if (!content) return;
    
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
    const inputField = 
      document.querySelector('.chat-input[contenteditable="true"]') ||
      document.querySelector('.chat-input') ||
      document.querySelector('[contenteditable="true"]');
    
    if (!inputField) {
      console.error('❌ Поле ввода не найдено');
      this.showError('Поле ввода не найдено');
      return;
    }

    console.log('✅ Поле ввода найдено:', inputField.className);

    // КРИТИЧНО: Сначала фокусируемся, потом вставляем
    inputField.focus();
    
    // Очищаем поле
    inputField.innerHTML = '';
    
    // Вставляем текст посимвольно (имитируем набор)
    let currentText = '';
    for (let char of text) {
      currentText += char;
      inputField.textContent = currentText;
      
      // Триггерим события после каждого символа
      inputField.dispatchEvent(new InputEvent('input', { 
        bubbles: true,
        cancelable: true,
        inputType: 'insertText',
        data: char
      }));
    }
    
    // Финальные события
    inputField.dispatchEvent(new Event('change', { bubbles: true }));
    inputField.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
    
    // Ставим курсор в конец
    const range = document.createRange();
    const sel = window.getSelection();
    range.selectNodeContents(inputField);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);

    console.log('✅ Текст вставлен посимвольно, Wazzup24 должен увидеть изменения');
  }

  insertAndSendResponse(text) {
    this.insertResponse(text);
    
    // Даем Wazzup24 время обработать изменения и переключить кнопку
    setTimeout(() => {
      // Ищем кнопку отправки в контейнере footer-send
      const sendContainer = document.querySelector('.footer-send');
      if (!sendContainer) {
        console.error('❌ Контейнер footer-send не найден');
        return;
      }
      
      // Ищем кнопку внутри контейнера
      const sendBtn = sendContainer.querySelector('button');
      
      if (sendBtn) {
        console.log('✅ Кнопка отправки найдена, кликаем');
        sendBtn.click();
      } else {
        console.error('❌ Кнопка отправки не найдена в контейнере');
      }
    }, 500); // Увеличил задержку до 500ms
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
}

// Запускаем расширение
const assistant = new WazzupAIAssistant();
