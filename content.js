console.log('Content script загружен для Wazzup');

// Ждём появления поля ввода
function waitForInputField() {
  return new Promise((resolve) => {
    console.log('Начинаю поиск поля ввода...');
    
    const checkInterval = setInterval(() => {
      const input = document.querySelector('.chat-input-text');
      
      if (input) {
        clearInterval(checkInterval);
        console.log('✓ Поле ввода найдено!');
        console.log('contentEditable:', input.contentEditable);
        console.log('isContentEditable:', input.isContentEditable);
        resolve(input);
      }
    }, 100); // Проверяем каждые 100ms
    
    // Таймаут 10 секунд
    setTimeout(() => {
      clearInterval(checkInterval);
      console.error('Таймаут: поле ввода не найдено за 10 секунд');
      resolve(null);
    }, 10000);
  });
}

// Функция вставки текста с полной поддержкой редактирования
async function insertText(text) {
  console.log('Начинаю вставку текста:', text);
  
  const input = await waitForInputField();
  
  if (!input) {
    console.error('❌ Поле ввода не найдено!');
    return false;
  }
  
  try {
    // Фокусируемся на поле
    input.focus();
    console.log('Фокус установлен на поле');
    
    // Очищаем содержимое
    input.innerHTML = '';
    console.log('Поле очищено');
    
    // Создаём текстовый узел
    const textNode = document.createTextNode(text);
    input.appendChild(textNode);
    console.log('Текст добавлен как текстовый узел');
    
    // Устанавливаем курсор в конец текста
    const range = document.createRange();
    const selection = window.getSelection();
    
    range.setStart(textNode, text.length);
    range.setEnd(textNode, text.length);
    range.collapse(false);
    
    selection.removeAllRanges();
    selection.addRange(range);
    console.log('Курсор установлен в конец текста');
    
    // Генерируем события для уведомления системы
    
    // 1. Input event - основное событие ввода
    const inputEvent = new InputEvent('input', {
      bubbles: true,
      cancelable: true,
      inputType: 'insertText',
      data: text,
      composed: true
    });
    input.dispatchEvent(inputEvent);
    console.log('InputEvent отправлен');
    
    // 2. Change event
    const changeEvent = new Event('change', {
      bubbles: true,
      cancelable: true
    });
    input.dispatchEvent(changeEvent);
    console.log('ChangeEvent отправлен');
    
    // 3. KeyUp event (имитация завершения ввода)
    const keyupEvent = new KeyboardEvent('keyup', {
      bubbles: true,
      cancelable: true,
      key: text.charAt(text.length - 1),
      code: 'Key' + text.charAt(text.length - 1).toUpperCase()
    });
    input.dispatchEvent(keyupEvent);
    console.log('KeyUpEvent отправлен');
    
    // Проверяем финальное состояние
    setTimeout(() => {
      console.log('=== ФИНАЛЬНАЯ ПРОВЕРКА ===');
      console.log('Содержимое поля:', input.textContent);
      console.log('Редактируемо:', input.isContentEditable);
      console.log('В фокусе:', document.activeElement === input);
      console.log('✓ Вставка завершена успешно!');
    }, 100);
    
    return true;
    
  } catch (error) {
    console.error('❌ Ошибка при вставке текста:', error);
    return false;
  }
}

// Слушаем сообщения от popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Получено сообщение:', request);
  
  if (request.action === 'insertText') {
    insertText(request.text)
      .then(success => {
        sendResponse({ success: success });
      })
      .catch(error => {
        console.error('Ошибка в обработчике:', error);
        sendResponse({ success: false, error: error.message });
      });
    
    return true; // Важно! Указывает, что ответ будет асинхронным
  }
});

console.log('Content script инициализирован и готов к работе');
