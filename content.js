// content.js - Основной скрипт расширения для Wazzup24
console.log('🚀 Wazzup24 AI Assistant загружен');

class WazzupAIAssistant {
  constructor() {
    this.panel = null;
    this.apiKey = null;
    this.isGenerating = false;
    this.lastMessageText = '';
    this.messageObserver = null;
    
    // Селекторы для Wazzup24 (из твоего HTML)
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
    
    // Проверяем, что мы на странице чата
    const chatContainer = document.querySelector(this.selectors.chatContainer);
    if (!chatContainer) {
      console.log('⏳ Чат не загружен, повтор через 1 сек...');
      setTimeout(() => this.setup(), 1000);
      return;
    }

    // Создаём панель с вариантами ответов
    this.createPanel();
    
    // Следим за новыми сообщениями
    this.watchMessages();
    
    console.log('✅ Расширение готово к работе');
  }

  createPanel() {
    // Проверяем, не создана ли уже панель
    if (document.getElementById('wazzup-ai-panel')) {
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
          <p>Ожидание входящего сообщения...</p>
          <small>Когда клиент напишет, я предложу варианты ответов</small>
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

    console.log('🎨 Панель создана');
  }

  watchMessages() {
    const messagesList = document.querySelector(this.selectors.messagesList);
    
    if (!messagesList) {
      console.log('⏳ Список сообщений не найден, повтор...');
      setTimeout(() => this.watchMessages(), 1000);
      return;
    }

    // Создаём наблюдатель за изменениями DOM
    this.messageObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.addedNodes.length > 0) {
          // Проверяем, добавлено ли входящее сообщение
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === 1 && node.querySelector) {
              const incomingMsg = node.querySelector(this.selectors.incomingMessage);
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

  onNewIncomingMessage(messageElement) {
    // Получаем текст сообщения
    const textElement = messageElement.querySelector(this.selectors.messageText);
    if (!textElement) return;

    const messageText = textElement.textContent.trim();
    
    // Игнорируем пустые сообщения и дубликаты
    if (!messageText || messageText === this.lastMessageText) {
      return;
    }

    this.lastMessageText = messageText;
    console.log('📨 Новое сообщение:', messageText);

    // Генерируем варианты ответов
    this.generateResponses(messageText);
  }

  async generateResponses(clientMessage) {
    if (!this.apiKey) {
      this.showError('API ключ OpenAI не настроен. Откройте настройки расширения.');
      return;
    }

    if (this.isGenerating) {
      console.log('⏳ Генерация уже выполняется...');
      return;
    }

    this.isGenerating = true;
    this.showLoading();

    try {
      // Получаем контекст последних сообщений
      const context = this.getConversationContext();
      
      // Формируем промпт для GPT
      const prompt = this.buildPrompt(clientMessage, context);
      
      // Запрос к OpenAI API
      const responses = await this.callOpenAI(prompt);
      
      // Показываем варианты ответов
      this.displayResponses(responses);
      
    } catch (error) {
      console.error('❌ Ошибка генерации:', error);
      this.showError('Ошибка генерации ответов: ' + error.message);
    } finally {
      this.isGenerating = false;
    }
  }

  getConversationContext() {
    // Получаем последние 5 сообщений для контекста
    const messages = [];
    const allMessages = document.querySelectorAll('.body-messages-item');
    
    // Берём последние 5 сообщений
    const recentMessages = Array.from(allMessages).slice(-5);
    
    recentMessages.forEach((msgEl) => {
      const isIncoming = msgEl.classList.contains('incoming');
      const textEl = msgEl.querySelector(this.selectors.messageText);
      
      if (textEl) {
        messages.push({
          role: isIncoming ? 'client' : 'manager',
          text: textEl.textContent.trim()
        });
      }
    });
    
    return messages;
  }

  buildPrompt(clientMessage, context) {
    // Промпт на основе ТЗ
    let prompt = `Ты — интеллектуальный помощник интернет-магазина DJI Market. 
Твоя задача — предложить менеджеру 3 варианта ответа на сообщение клиента.

Тон общения:
- Дружелюбный и профессиональный
- Адаптируйся под стиль клиента (формальный/неформальный)
- Используй "Вы", "Вас" с большой буквы
- Немного смайликов 🙂

`;

    // Добавляем контекст
    if (context.length > 0) {
      prompt += '\nКонтекст переписки:\n';
      context.forEach((msg) => {
        const role = msg.role === 'client' ? 'Клиент' : 'Менеджер';
        prompt += `${role}: ${msg.text}\n`;
      });
    }

    prompt += `\nПоследнее сообщение клиента: "${clientMessage}"

Сгенерируй 3 варианта ответа:
1. Короткий и конкретный
2. Развёрнутый с дополнительной информацией
3. Дружелюбный с рекомендациями

Формат ответа (JSON):
{
  "variant1": "текст ответа 1",
  "variant2": "текст ответа 2",
  "variant3": "текст ответа 3"
}`;

    return prompt;
  }

  async callOpenAI(prompt) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'Ты — ассистент для менеджера интернет-магазина дронов DJI.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 500
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Ошибка API OpenAI');
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    // Парсим JSON из ответа
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Неверный формат ответа от GPT');
    }
    
    const variants = JSON.parse(jsonMatch[0]);
    
    return [
      { label: 'Короткий', text: variants.variant1 },
      { label: 'Подробный', text: variants.variant2 },
      { label: 'Дружелюбный', text: variants.variant3 }
    ];
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
