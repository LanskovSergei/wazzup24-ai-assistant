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
      model: 'gpt-4o', // По умолчанию gpt-4o
      customPrompt: '',
      temperature: 0.7,
      maxTokens: 800, // Увеличил для более длинных ответов
      contextMessages: 50 // Увеличил до 50
    });
    
  } else if (details.reason === 'update') {
    const previousVersion = details.previousVersion;
    const currentVersion = chrome.runtime.getManifest().version;
    console.log(`🔄 Обновление с ${previousVersion} на ${currentVersion}`);
  }
});

// Логирование статистики
let generationCount = 0;

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
      return true;
      
    case 'GENERATE_RESPONSES':
      console.log('🤖 Запрос генерации ответов');
      handleGenerateResponses(message.data, sendResponse);
      return true;
      
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
  
  return false;
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
    
    // Используем gpt-4o вместо выбранной модели
    const actualModel = 'gpt-4o';
    
    const requestBody = {
      model: actualModel,
      messages: [
        {
          role: 'system',
          content: getSystemPrompt(settings.customPrompt)
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: settings.temperature || 0.7,
      max_tokens: settings.maxTokens || 800
    };
    
    console.log('📤 Отправка запроса к OpenAI API...');
    console.log('📤 Модель:', actualModel);
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
      usage: responseData.usage
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

// Системный промпт
function getSystemPrompt(customPrompt) {
  let systemPrompt = `Ты — менеджер магазина DJI Market.

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
4. Задавай уточняющие вопросы, если нужно понять потребности клиента лучше
5. Поддерживай диалог вдумчиво, показывай экспертность

РАБОТА С ВОЗРАЖЕНИЯМИ:
Отрабатывай возражения спокойно, с акцентом на выгоды:
- Официальная гарантия от производителя
- Оригинальная продукция (не подделки)
- Бесплатная доставка по всей России
- Профессиональный сервис и поддержка
- Помощь в выборе и настройке

ЕСЛИ КЛИЕНТ СОМНЕВАЕТСЯ:
- Помоги определиться с выбором
- Предложи оформить коммерческое предложение (КП)
- Предложи оформить заказ

ФОРМАТ ОТВЕТА:
Сгенерируй 3 варианта ответа в JSON формате:
1. Короткий и конкретный (1-2 предложения)
2. Развёрнутый с дополнительной информацией и рекомендациями (3-5 предложений)
3. Дружелюбный с вопросами для уточнения (2-4 предложения)`;

  if (customPrompt) {
    systemPrompt += `\n\nДОПОЛНИТЕЛЬНЫЕ ИНСТРУКЦИИ:\n${customPrompt}`;
  }

  return systemPrompt;
}

// Построение промпта для GPT
function buildPrompt(clientMessage, context, customPrompt) {
  let prompt = '';

  // Добавляем контекст переписки (до 50 сообщений)
  if (context && context.length > 0) {
    prompt += 'КОНТЕКСТ ПЕРЕПИСКИ (от старых к новым сообщениям):\n';
    context.forEach((msg, index) => {
      const role = msg.role === 'client' ? 'Клиент' : 'Менеджер';
      prompt += `${index + 1}. ${role}: ${msg.text}\n`;
    });
    prompt += '\n';
  }

  prompt += `ПОСЛЕДНЕЕ АКТУАЛЬНОЕ СООБЩЕНИЕ КЛИЕНТА (на которое нужно ответить):\n"${clientMessage}"\n\n`;

  prompt += `ЗАДАЧА:
Проанализируй весь контекст переписки, но сформируй ответ ИМЕННО на последнее сообщение клиента.
Учитывай предыдущие сообщения для понимания ситуации, но отвечай на самый свежий вопрос.

Верни ТОЛЬКО JSON в формате:
{
  "variant1": "короткий ответ",
  "variant2": "развёрнутый ответ с рекомендациями",
  "variant3": "дружелюбный ответ с уточняющими вопросами"
}

КРИТИЧЕСКИ ВАЖНО:
- Обращайся ТОЛЬКО на "Вы" с большой буквы: "Вы", "Вам", "Вас", "Ваш"
- Не используй "вы", "вам", "вас" с маленькой буквы

Никакого другого текста, только JSON!`;

  return prompt;
}

// Парсинг ответа от GPT
function parseGPTResponse(content) {
  console.log('🔍 Парсинг ответа GPT...');
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    
    if (!jsonMatch) {
      console.error('❌ JSON не найден в ответе');
      throw new Error('JSON не найден в ответе GPT');
    }
    
    console.log('✅ JSON найден:', jsonMatch[0]);
    
    const parsed = JSON.parse(jsonMatch[0]);
    console.log('✅ JSON распарсен:', parsed);
    
    if (!parsed.variant1 || !parsed.variant2 || !parsed.variant3) {
      console.error('❌ Неполный ответ от GPT:', parsed);
      throw new Error('Неполный ответ от GPT');
    }
    
    const variants = [
      { label: 'Короткий', text: parsed.variant1 },
      { label: 'Подробный', text: parsed.variant2 },
      { label: 'С вопросами', text: parsed.variant3 }
    ];
    
    console.log('✅ Варианты сформированы:', variants);
    return variants;
    
  } catch (error) {
    console.error('❌ Ошибка парсинга ответа GPT:', error);
    console.log('📄 Исходный ответ:', content);
    
    console.log('⚠️ Использую запасные варианты');
    return [
      { label: 'Короткий', text: 'Здравствуйте! Благодарю за обращение. Уточню информацию и свяжусь с Вами в ближайшее время.' },
      { label: 'Подробный', text: 'Добрый день! Спасибо, что обратились в DJI Market. Я внимательно изучу Ваш запрос и подберу оптимальные варианты. У нас официальная гарантия, оригинальная продукция и бесплатная доставка по России.' },
      { label: 'С вопросами', text: 'Здравствуйте! Помогу Вам с выбором. Уточните, пожалуйста: для каких целей Вы планируете использовать технику? Это поможет мне подобрать идеальный вариант.' }
    ];
  }
}

// Обработка изменений в storage
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'sync') {
    console.log('⚙️ Настройки изменены:', changes);
    
    if (changes.enabled) {
      const isEnabled = changes.enabled.newValue;
      console.log(`🔄 Расширение ${isEnabled ? 'включено' : 'выключено'}`);
      
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

console.log('✅ Background Service Worker готов к работе');
