// background.js - Service Worker для Wazzup24 AI Assistant

console.log('🚀 Wazzup24 AI Assistant Service Worker запущен');

// Пробуждение Service Worker
self.addEventListener('activate', (event) => {
  console.log('⚡ Service Worker активирован');
});

self.addEventListener('install', (event) => {
  console.log('📦 Service Worker установлен');
  self.skipWaiting();
});

// Обработка установки расширения
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('🎉 Расширение установлено');
    
    // Устанавливаем начальные настройки
    chrome.storage.sync.set({
      enabled: true,
      apiKey: '',
      model: 'gpt-4',
      customPrompt: '',
      temperature: 0.7,
      maxTokens: 500,
      contextMessages: 5
    });
    
  } else if (details.reason === 'update') {
    const previousVersion = details.previousVersion;
    const currentVersion = chrome.runtime.getManifest().version;
    console.log(`🔄 Обновление с ${previousVersion} на ${currentVersion}`);
  }
});

// Обработка сообщений от content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('🔔 ЛЮБОЕ сообщение получено!');
  console.log('📨 Тип сообщения:', message.type);
  console.log('📨 Полное сообщение:', message);
  console.log('📨 Отправитель:', sender);
  
  switch (message.type) {
    case 'GET_SETTINGS':
      console.log('⚙️ Запрос настроек');
      handleGetSettings(sendResponse);
      return true; // Асинхронный ответ
      
    case 'GENERATE_RESPONSES':
      console.log('🤖 Запрос генерации ответов');
      handleGenerateResponses(message.data, sendResponse);
      return true; // Асинхронный ответ
      
    case 'LOG_ERROR':
      console.error('❌ Ошибка из content script:', message.error);
      break;
      
    case 'LOG_INFO':
      console.log('ℹ️ Инфо из content script:', message.info);
      break;
      
    case 'GENERATION_SUCCESS':
      generationCount++;
      console.log(`📊 Всего генераций: ${generationCount}`);
      break;
      
    default:
      console.warn('⚠️ Неизвестный тип сообщения:', message.type);
  }
});

// Получение настроек
async function handleGetSettings(sendResponse) {
  console.log('📖 Получение настроек из storage...');
  try {
    const settings = await chrome.storage.sync.get([
      'enabled',
      'apiKey',
      'model',
      'customPrompt',
      'temperature',
      'maxTokens',
      'contextMessages'
    ]);
    
    console.log('✅ Настройки получены:', settings);
    sendResponse({ success: true, settings });
  } catch (error) {
    console.error('❌ Ошибка получения настроек:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// Генерация ответов через OpenAI API
async function handleGenerateResponses(data, sendResponse) {
  console.log('🎯 handleGenerateResponses вызвана');
  console.log('📦 Данные запроса:', data);
  
  try {
    const { clientMessage, context, settings } = data;
    
    console.log('📝 Сообщение клиента:', clientMessage);
    console.log('📝 Контекст:', context);
    console.log('📝 Настройки:', settings);
    
    if (!settings.apiKey) {
      console.error('❌ API ключ отсутствует');
      throw new Error('API ключ не настроен');
    }
    
    console.log('✅ API ключ найден:', settings.apiKey.substring(0, 15) + '...');
    console.log('🤖 Генерация ответов для:', clientMessage);
    
    // Формируем промпт
    const prompt = buildPrompt(clientMessage, context, settings.customPrompt);
    console.log('📝 Промпт сформирован, длина:', prompt.length);
    
    const requestBody = {
      model: settings.model || 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'Ты — ассистент для менеджера интернет-магазина дронов DJI Market. Генерируй 3 варианта ответа на сообщения клиентов.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: settings.temperature || 0.7,
      max_tokens: settings.maxTokens || 500
    };
    
    console.log('📤 Отправка запроса к OpenAI API...');
    console.log('📤 Модель:', requestBody.model);
    console.log('📤 Temperature:', requestBody.temperature);
    console.log('📤 Max tokens:', requestBody.max_tokens);
    
    // Запрос к OpenAI API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.apiKey}`
      },
      body: JSON.stringify(requestBody)
    });
    
    console.log('📥 Ответ от OpenAI получен, статус:', response.status);
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('❌ Ошибка API OpenAI:', errorData);
      throw new Error(errorData.error?.message || `API ошибка: ${response.status}`);
    }
    
    const responseData = await response.json();
    console.log('📥 Данные ответа:', responseData);
    
    const content = responseData.choices[0].message.content;
    console.log('📥 Контент ответа:', content);
    
    console.log('✅ Ответ от OpenAI получен');
    
    // Парсим JSON из ответа
    const variants = parseGPTResponse(content);
    console.log('✅ Варианты распарсены:', variants);
    
    const successResponse = { 
      success: true, 
      variants,
      usage: responseData.usage // Статистика использования токенов
    };
    
    console.log('📤 Отправка успешного ответа в content script:', successResponse);
    sendResponse(successResponse);
    
  } catch (error) {
    console.error('❌ Ошибка генерации:', error);
    console.error('❌ Стек ошибки:', error.stack);
    
    const errorResponse = { 
      success: false, 
      error: error.message 
    };
    
    console.log('📤 Отправка ошибки в content script:', errorResponse);
    sendResponse(errorResponse);
  }
}

// Построение промпта для GPT
function buildPrompt(clientMessage, context, customPrompt) {
  let prompt = `Ты — интеллектуальный помощник интернет-магазина DJI Market. Твоя задача — анализировать сообщения клиентов в WhatsApp и предлагать менеджеру три варианта ответа на выбор. Ответы должны быть чёткими, полезными и соответствовать тону общения клиента.

Тон общения:
- Дружелюбный и профессиональный.
- Адаптируйся под стиль клиента (если он пишет формально — отвечай официально, если неформально — пиши проще).
- Если клиент задаёт короткий вопрос — отвечай лаконично, если хочет подробностей — давай развёрнутый ответ.

`;

  // Добавляем кастомный промпт, если есть
  if (customPrompt) {
    prompt += `\nДополнительные инструкции: ${customPrompt}\n`;
  }

  // Добавляем контекст переписки
  if (context && context.length > 0) {
    prompt += '\nКонтекст переписки:\n';
    context.forEach((msg) => {
      const role = msg.role === 'client' ? 'Клиент' : 'Менеджер';
      prompt += `${role}: ${msg.text}\n`;
    });
  }

  prompt += `\nПоследнее сообщение клиента: "${clientMessage}"

Сгенерируй 3 варианта ответа:
1. Короткий и конкретный (1-2 предложения)
2. Развёрнутый с дополнительной информацией (2-4 предложения)
3. Дружелюбный с рекомендациями (2-3 предложения)

ВАЖНО: Верни ТОЛЬКО JSON в формате:
{
  "variant1": "текст короткого ответа",
  "variant2": "текст развёрнутого ответа",
  "variant3": "текст дружелюбного ответа"
}

Никакого другого текста, только JSON!`;

  return prompt;
}

// Парсинг ответа от GPT
function parseGPTResponse(content) {
  console.log('🔍 Парсинг ответа GPT...');
  try {
    // Пытаемся найти JSON в ответе
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    
    if (!jsonMatch) {
      console.error('❌ JSON не найден в ответе');
      throw new Error('JSON не найден в ответе GPT');
    }
    
    console.log('✅ JSON найден:', jsonMatch[0]);
    
    const parsed = JSON.parse(jsonMatch[0]);
    console.log('✅ JSON распарсен:', parsed);
    
    // Проверяем наличие всех вариантов
    if (!parsed.variant1 || !parsed.variant2 || !parsed.variant3) {
      console.error('❌ Неполный ответ от GPT:', parsed);
      throw new Error('Неполный ответ от GPT');
    }
    
    const variants = [
      { label: 'Короткий', text: parsed.variant1 },
      { label: 'Подробный', text: parsed.variant2 },
      { label: 'Дружелюбный', text: parsed.variant3 }
    ];
    
    console.log('✅ Варианты сформированы:', variants);
    return variants;
    
  } catch (error) {
    console.error('❌ Ошибка парсинга ответа GPT:', error);
    console.log('📄 Исходный ответ:', content);
    
    // Возвращаем запасные варианты
    console.log('⚠️ Использую запасные варианты');
    return [
      { label: 'Короткий', text: 'Спасибо за обращение! Уточню информацию и отвечу в течение нескольких минут 🙂' },
      { label: 'Подробный', text: 'Здравствуйте! Благодарю за Ваш вопрос. Сейчас уточню всю необходимую информацию и предоставлю Вам детальный ответ.' },
      { label: 'Дружелюбный', text: 'Привет! Отличный вопрос 😊 Дайте мне пару минут, чтобы проверить актуальную информацию, и я всё подробно расскажу!' }
    ];
  }
}

// Обработка изменений в storage
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'sync') {
    console.log('⚙️ Настройки изменены:', changes);
    
    // Если изменился статус enabled
    if (changes.enabled) {
      const isEnabled = changes.enabled.newValue;
      console.log(`🔄 Расширение ${isEnabled ? 'включено' : 'выключено'}`);
      
      // Уведомляем все вкладки с Wazzup24
      notifyAllTabs({ type: 'ENABLED_CHANGED', enabled: isEnabled });
    }
  }
});

// Уведомление всех вкладок Wazzup24
async function notifyAllTabs(message) {
  try {
    const tabs = await chrome.tabs.query({ 
      url: 'https://app.wazzup24.com/*' 
    });
    
    tabs.forEach((tab) => {
      chrome.tabs.sendMessage(tab.id, message).catch((error) => {
        console.log(`ℹ️ Не удалось отправить сообщение в таб ${tab.id}`);
      });
    });
  } catch (error) {
    console.error('❌ Ошибка уведомления вкладок:', error);
  }
}

// Обработка клика на иконку расширения
chrome.action.onClicked.addListener(async (tab) => {
  // Проверяем, на странице Wazzup24 ли мы
  if (tab.url && tab.url.includes('wazzup24.com')) {
    console.log('📌 Клик на иконку на странице Wazzup24');
    
    // Отправляем команду toggle панели
    try {
      await chrome.tabs.sendMessage(tab.id, { 
        type: 'TOGGLE_PANEL' 
      });
    } catch (error) {
      console.log('ℹ️ Content script не отвечает, возможно страница не загружена');
    }
  }
});

// Логирование статистики
let generationCount = 0;

// Периодическая очистка кеша (опционально)
chrome.alarms.create('clearCache', { periodInMinutes: 60 });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'clearCache') {
    console.log('🧹 Очистка кеша...');
    // Здесь можно добавить логику очистки
  }
});

console.log('✅ Background Service Worker готов к работе');
