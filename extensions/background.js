// Система авторизации и профилей
const AUTH_CONFIG = {
    // Админские аккаунты (с полным управлением)
    adminAccounts: {
      'admin123': {
        name: 'Администратор',
        type: 'admin',
        canManage: true
      }
    },
    
    // Обычные пользователи (только автоподключение)
    userAccounts: {
      'profile1': {
        name: 'profile1',
        ip: '45.139.125.123',
        port: 1050,
        username: 'fOwk1c',
        password: 'hBP8MJjtKg',
        region: 'Россия',
        type: 'user',
        localPort: 3128
      },
      'profile2': {
        name: 'profile2', 
        ip: '91.188.244.4',
        port: 1050,
        username: 'fOwk1c',
        password: 'hBP8MJjtKg',
        region: 'Россия',
        type: 'user',
        localPort: 3129
      },
      'profile3': {
        name: 'profile3',
        ip: '185.181.245.211', 
        port: 1050,
        username: 'fOwk1c',
        password: 'hBP8MJjtKg',
        region: 'Россия',
        type: 'user',
        localPort: 3130
      },
      'profile4': {
        name: 'profile4',
        ip: '188.130.187.174',
        port: 1050, 
        username: 'fOwk1c',
        password: 'hBP8MJjtKg',
        region: 'Россия',
        type: 'user',
        localPort: 3131
      }
    }
  };
  
  // Текущее состояние
  let currentProfile = null;
  let isAuthenticated = false;
  let currentUser = null;
  let userType = null; // 'admin' или 'user'
  let isConnecting = false; // Флаг для предотвращения множественных подключений
  let lastConnectionAttempt = 0; // Время последней попытки подключения
  let connectionRetryCount = 0; // Счетчик попыток переподключения
  let lastSwitchAtMs = 0; // Время последнего переключения/подключения
  let isSwitching = false; // Флаг активного переключения
  
  // Статус прокси
  let proxyStatus = {
    connected: false,
    realIP: null,
    expectedIP: null,
    lastCheck: 0,
    checkInterval: null
  };
  
  // Статус лицензии
  let licenseStatus = {
    valid: false,
    client_id: null,
    expire_date: null,
    days_remaining: 0,
    error: null,
    lastCheck: 0
  };
  
  // Определение типа пользователя по паролю
  function getUserType(password) {
    // Проверяем админские аккаунты
    if (AUTH_CONFIG.adminAccounts[password]) {
      return { type: 'admin', user: AUTH_CONFIG.adminAccounts[password] };
    }
    
    // Проверяем обычных пользователей
    if (AUTH_CONFIG.userAccounts[password]) {
      return { type: 'user', user: AUTH_CONFIG.userAccounts[password] };
    }
    
    return null;
  }
  
  // Вспомогательные функции для общения с локальным помощником FastAPI
  async function helperApplyProxy(ip, port, username, password, listenPort = 3128, userType = 'user', profileId = '') {
    try {
      const response = await fetch('http://94.241.175.200:8765/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          ip, 
          port, 
          username, 
          password, 
          listen_port: listenPort,
          user_type: userType,
          profile_id: profileId
        })
      });
      
      // Проверяем статус ответа
      if (!response.ok) {
        const errorData = await response.json();
        return { ok: false, status: response.status, error: errorData.detail || 'Ошибка подключения' };
      }
      
      return await response.json();
    } catch (e) {
      console.log('Не удалось обратиться к помощнику FastAPI:', e);
      return { ok: false, error: 'Не удалось подключиться к серверу' };
    }
  }
  
  // Функция для освобождения профиля
  async function helperReleaseProfile(profileId) {
    try {
      const response = await fetch(`http://94.241.175.200:8765/release/${profileId}`, {
        method: 'POST'
      });
      return await response.json();
    } catch (e) {
      console.log('Не удалось освободить профиль:', e);
      return { ok: false };
    }
  }
  
  // Функция для проверки доступности профиля
  async function helperCheckProfile(profileId) {
    try {
      const response = await fetch(`http://94.241.175.200:8765/check/${profileId}`, {
        method: 'GET'
      });
      
      // Проверяем лицензию
      if (response.status === 402) {
        const errorData = await response.json();
        console.log('❌ Лицензия недействительна:', errorData);
        licenseStatus = errorData.license_status || { valid: false, error: errorData.detail };
        notifyLicenseExpired();
        return { available: false, error: true, licenseError: true };
      }
      
      return await response.json();
    } catch (e) {
      console.log('Не удалось проверить профиль:', e);
      return { available: false, error: true };
    }
  }
  
  // Функция для проверки статуса лицензии
  async function checkLicenseStatus() {
    try {
      const response = await fetch('http://94.241.175.200:8765/license/status', {
        method: 'GET'
      });
      
      const data = await response.json();
      const oldStatus = licenseStatus.valid;
      
      licenseStatus = data.license_status || { valid: false };
      licenseStatus.lastCheck = Date.now();
      
      console.log('🔑 Статус лицензии:', licenseStatus);
      
      // Сохраняем статус в storage
      chrome.storage.local.set({ licenseStatus });
      
      // Если лицензия истекла - уведомляем
      if (!licenseStatus.valid && oldStatus) {
        console.log('⚠️ Лицензия больше не действительна!');
        notifyLicenseExpired();
      }
      
      // Если лицензия скоро истечет (менее 7 дней) - предупреждаем
      if (licenseStatus.valid && licenseStatus.days_remaining <= 7) {
        console.log(`⚠️ Лицензия истекает через ${licenseStatus.days_remaining} дней`);
        notifyLicenseExpiring(licenseStatus.days_remaining);
      }
      
      return licenseStatus;
    } catch (e) {
      console.log('Ошибка проверки лицензии:', e);
      return { valid: false, error: 'Не удалось проверить лицензию' };
    }
  }
  
  // Уведомление об истечении лицензии
  function notifyLicenseExpired() {
    console.log('🚨 Отправка уведомления об истечении лицензии');
    
    // Останавливаем прокси
    stopProxyMonitoring();
    helperClearProxy();
    
    // Создаем системное уведомление
    chrome.notifications.create(`license-expired-${Date.now()}`, {
      type: 'basic',
      iconUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
      title: '🚨 ЛИЦЕНЗИЯ ИСТЕКЛА!',
      message: `Лицензия на использование прокси-сервиса истекла.\n\nОбратитесь к администратору для продления.`
    });
    
    // Уведомляем popup
    chrome.runtime.sendMessage({
      action: 'licenseExpired',
      licenseStatus: licenseStatus
    }).catch(() => {
      console.log('Popup не открыт');
    });
  }
  
  // Уведомление о скором истечении лицензии
  function notifyLicenseExpiring(daysRemaining) {
    chrome.runtime.sendMessage({
      action: 'licenseExpiring',
      daysRemaining: daysRemaining,
      licenseStatus: licenseStatus
    }).catch(() => {
      console.log('Popup не открыт');
    });
  }
  
  // Функция для проверки реального IP через API
  async function checkRealIP() {
    // Список API для проверки IP (fallback)
    const apis = [
      'https://api.ipify.org?format=json',
      'https://ipapi.co/json/',
      'https://httpbin.org/ip',
      'https://api.my-ip.io/ip.json'
    ];
    
    for (let i = 0; i < apis.length; i++) {
      try {
        console.log(`🌐 Запрос к API ${i + 1}/${apis.length}: ${apis[i]}`);
        const response = await fetch(apis[i], {
          method: 'GET',
          timeout: 5000
        });
        
        if (!response.ok) {
          console.log(`API ${i + 1} вернул ошибку: ${response.status} ${response.statusText}`);
          continue;
        }
        
        const data = await response.json();
        console.log(`API ${i + 1} ответ получен: ${JSON.stringify(data)}`);
        
        // Извлекаем IP из разных форматов ответов
        let ip = null;
        if (data.ip) {
          ip = data.ip;
        } else if (data.origin) {
          ip = data.origin;
        } else if (typeof data === 'string') {
          ip = data.trim();
        }
        
        if (ip) {
          console.log(`Реальный IP адрес: ${ip}`);
          return ip;
        } else {
          console.log(`API ${i + 1}: IP не найден в ответе`);
        }
      } catch (e) {
        console.log(`API ${i + 1} ошибка:`, e.message);
        continue;
      }
    }
    
    console.log('Все API недоступны, не удалось получить реальный IP');
    return null;
  }
  
  // Функция для проверки статуса прокси
  async function checkProxyStatus(expectedIP) {
    try {
      console.log(`Проверка статуса прокси...`);
      console.log(`Ожидаемый IP: ${expectedIP}`);
      
      const realIP = await checkRealIP();
      if (!realIP) {
        console.log(`Не удалось получить реальный IP`);
        return { connected: false, ip: null, reason: 'Не удалось получить IP' };
      }
      
    console.log(`Сравнение IP адресов:`);
    console.log(`   Ожидаемый: ${expectedIP}`);
    console.log(`   Реальный:  ${realIP}`);
    console.log(`   Совпадают: ${realIP === expectedIP ? 'ДА' : 'НЕТ'}`);
    
    if (realIP === expectedIP) {
        console.log(`Прокси работает корректно! IP совпадает.`);
        return { connected: true, ip: realIP };
      } else {
        console.log(`Прокси не работает! IP не совпадает.`);
        console.log(`   Ожидался: ${expectedIP}`);
        console.log(`   Получен:  ${realIP}`);
        return { connected: false, ip: realIP, expectedIP: expectedIP, reason: `IP не совпадает. Ожидался: ${expectedIP}, получен: ${realIP}` };
      }
    } catch (e) {
      console.log('Ошибка проверки статуса прокси:', e);
      return { connected: false, ip: null, reason: 'Ошибка проверки' };
    }
  }
  
  // Функция для запуска периодической проверки прокси
  function startProxyMonitoring(expectedIP) {
    // Останавливаем предыдущий мониторинг
    stopProxyMonitoring();
    
    proxyStatus.expectedIP = expectedIP;
    proxyStatus.connected = false;
    
    console.log(`Запуск мониторинга прокси для IP: ${expectedIP}`);
    console.log(`Первая проверка через 5 секунд...`);
    
    // Первая проверка через 5 секунд после подключения
    setTimeout(async () => {
      console.log(`Время первой проверки наступило!`);
      await performProxyCheck();
    }, 5000);
    
    // Периодические проверки каждые 30 секунд
    proxyStatus.checkInterval = setInterval(async () => {
      console.log(`Время периодической проверки наступило!`);
      await performProxyCheck();
    }, 60000);
  }
  
  // Функция для остановки мониторинга прокси
  function stopProxyMonitoring() {
    if (proxyStatus.checkInterval) {
      clearInterval(proxyStatus.checkInterval);
      proxyStatus.checkInterval = null;
    }
    proxyStatus.connected = false;
    proxyStatus.realIP = null;
    proxyStatus.expectedIP = null;
  }
  
  // Функция для выполнения проверки прокси
  async function performProxyCheck() {
    if (!proxyStatus.expectedIP) {
      console.log(`Нет ожидаемого IP для проверки`);
      return;
    }
    
    console.log(`=== НАЧАЛО ПРОВЕРКИ ПРОКСИ ===`);
    console.log(`Ожидаемый IP: ${proxyStatus.expectedIP}`);
    console.log(`Время проверки: ${new Date().toLocaleTimeString()}`);
    
    const status = await checkProxyStatus(proxyStatus.expectedIP);
    
    const previousStatus = proxyStatus.connected;
    
    console.log(`Результат проверки:`);
    console.log(`   Статус: ${status.connected ? 'ПОДКЛЮЧЕН' : 'НЕ ПОДКЛЮЧЕН'}`);
    console.log(`   Реальный IP: ${status.ip || 'не получен'}`);
    console.log(`   Ожидаемый IP: ${proxyStatus.expectedIP}`);
    console.log(`   Изменился ли статус: ${previousStatus !== status.connected ? 'ДА' : 'НЕТ'}`);
    
    if (status.connected) {
      console.log(`ПРОКСИ ПОДКЛЮЧЕН! Устанавливаем proxyEnabled: true`);
      
      // Показываем уведомления только если статус изменился (был не подключен, стал подключен)
      if (previousStatus !== true) {
        console.log(`Статус изменился: был не подключен, стал подключен - показываем уведомления`);
        
        // Показываем уведомление об успешном подключении
        const currentTime = new Date().toLocaleTimeString();
        const successMessage = `ПРОКСИ ПОДКЛЮЧЕН!\n\nВремя: ${currentTime}\nIP адрес: ${status.ip}\nОжидался: ${proxyStatus.expectedIP}\n\nПодключение работает корректно!`;
        
        // Системные уведомления при успехе НЕ показываем
        
        // Отправляем уведомление в popup (если открыт)
        chrome.runtime.sendMessage({
          action: 'proxyConnected',
          message: successMessage,
          proxyStatus: {
            connected: true,
            realIP: status.ip,
            expectedIP: proxyStatus.expectedIP,
            lastCheck: Date.now()
          }
        }).catch(() => {
          console.log(`Popup не открыт, уведомление об успехе не отправлено`);
        });
        
        // Консольное уведомление об успехе
        console.log(`ПРОКСИ УСПЕШНО ПОДКЛЮЧЕН!`);
        console.log(`Время: ${currentTime}`);
        console.log(`IP адрес: ${status.ip}`);
        console.log(`Ожидался: ${proxyStatus.expectedIP}`);
        console.log(`Подключение работает корректно!`);
      } else {
        console.log(`Статус не изменился: прокси уже был подключен - уведомления не показываем`);
      }
      
    } else {
      console.log(`ПРОКСИ НЕ ПОДКЛЮЧЕН! Устанавливаем proxyEnabled: false`);
    }
    
    if (status.connected) {
      console.log(`Прокси работает корректно! IP: ${status.ip}`);
    } else {
      console.log(`Прокси не работает: ${status.reason}`);
      
      // Показываем системные уведомления при каждом несовпадении IP
      console.log(`IP не совпадает! Показываем уведомление пользователю`);
      console.log(`Детали несовпадения:`);
      console.log(`   Предыдущий статус: ${previousStatus ? 'подключен' : 'не подключен'}`);
      console.log(`   Текущий статус: не подключен`);
      console.log(`   Тип уведомления: ${previousStatus === true ? 'ОТКЛЮЧИЛСЯ' : 'НЕ ПОДКЛЮЧЕН'}`);
      
      // Показываем уведомление браузера (работает в фоне)
      const currentTime = new Date().toLocaleTimeString();
      const alertType = previousStatus === true ? 'ОТКЛЮЧИЛСЯ' : 'НЕ ПОДКЛЮЧЕН';
      const expectedIP = status.expectedIP || proxyStatus.expectedIP || 'неизвестен';
      const receivedIP = status.ip || 'не получен';
        
        // Создаем уведомление браузера (упрощенное)
        const notificationId = `proxy-error-${Date.now()}`;
        chrome.notifications.create(notificationId, {
          type: 'basic',
          iconUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
          title: `ПРОКСИ ${alertType}!`,
          message: `${currentTime}\nОжидался: ${expectedIP}\nПолучен: ${receivedIP}\n\nПроверьте подключение!`
        }, (createdId) => {
          if (chrome.runtime.lastError) {
            console.log('Ошибка создания уведомления:', chrome.runtime.lastError);
            // Fallback - показываем в консоли
            console.error(`ПРОКСИ ${alertType}! ${currentTime} Ожидался: ${expectedIP} Получен: ${receivedIP}`);
          } else {
            console.log('Уведомление создано:', createdId);
          }
        });
        
        // Также отправляем уведомление в popup (если открыт)
        chrome.runtime.sendMessage({
          action: 'proxyDisconnected',
          message: `ПРОКСИ ${alertType}!\n\nВремя: ${currentTime}\nОжидался IP: ${expectedIP}\nПолучен IP: ${receivedIP}\n\nПроверьте подключение к интернету и настройки прокси.`,
          showRetryButton: true // Показывать кнопку "Попробовать снова"
        }).catch(() => {
          console.log(`Popup не открыт, уведомление не отправлено`);
        });
        
        // Дополнительное уведомление через консоль (service worker не поддерживает window)
        console.error(`КРИТИЧЕСКАЯ ОШИБКА ПРОКСИ!`);
        console.error(`Время: ${currentTime}`);
        console.error(`Ожидался IP: ${expectedIP}`);
        console.error(`Получен IP: ${receivedIP}`);
        console.error(`Прокси отключен! Проверьте подключение!`);
        
      // ОТКЛЮЧАЕМ ПРОКСИ при ошибке проверки
      console.log(`ОТКЛЮЧАЕМ ПРОКСИ из-за несовпадения IP!`);
      
      // Очищаем tinyproxy в помощнике
      helperClearProxy();
      
      // Отключаем прокси в браузере
      chrome.proxy.settings.clear({ scope: 'regular' }, () => {
        console.log(`Прокси отключен из-за ошибки проверки IP`);
      });
      
      // Останавливаем мониторинг
      stopProxyMonitoring();
    
    // Очищаем данные профиля при ошибке
    chrome.storage.local.set({
      proxyEnabled: false,
      currentProfile: null,
      profileInfo: null,
      proxyStatus: {
        connected: false,
        realIP: null,
        expectedIP: null,
        lastCheck: Date.now()
      }
    });
    }
    
    // Обновляем статус ПЕРЕД сохранением в storage
    proxyStatus.connected = status.connected;
    proxyStatus.realIP = status.ip;
    proxyStatus.lastCheck = Date.now();
    
    // Обновляем storage с актуальным статусом
    chrome.storage.local.set({
      proxyEnabled: proxyStatus.connected, // Только true если IP совпадает
      proxyStatus: {
        connected: proxyStatus.connected,
        realIP: proxyStatus.realIP,
        expectedIP: proxyStatus.expectedIP,
        lastCheck: proxyStatus.lastCheck
      }
    });
    
    console.log(`Статус сохранен в storage: connected=${proxyStatus.connected}, realIP=${proxyStatus.realIP}`);
    
    // Уведомляем popup об изменении статуса
    chrome.runtime.sendMessage({
      action: 'proxyStatusChanged',
      proxyStatus: {
        connected: proxyStatus.connected,
        realIP: proxyStatus.realIP,
        expectedIP: proxyStatus.expectedIP,
        lastCheck: proxyStatus.lastCheck
      }
    }).catch(() => {
      console.log(`Popup не открыт, уведомление не отправлено`);
    });
    
    console.log(`=== КОНЕЦ ПРОВЕРКИ ПРОКСИ ===`);
  }
  
  async function helperClearProxy(port = null) {
    try {
      if (port) {
        // Очищаем конкретный порт
        await fetch(`http://94.241.175.200:8765/clear/${port}`, { method: 'POST' });
      } else {
        // Очищаем все порты
        await fetch('http://94.241.175.200:8765/clear', { method: 'POST' });
      }
    } catch (e) {
      console.log('Не удалось очистить прокси в помощнике:', e);
    }
  }
  
  // Автоматическое подключение для обычных пользователей
  function autoConnectUser(userAccount) {
    console.log(`Автоматическое подключение для пользователя: ${userAccount.name}`);
    console.log('Детали пользователя:', userAccount);
    
    // Проверяем, не подключен ли уже этот пользователь
    chrome.storage.local.get(['currentProfile', 'proxyEnabled'], (result) => {
      if (result.proxyEnabled && result.currentProfile === userAccount.name) {
        console.log(`Прокси уже подключен для ${userAccount.name}, пропускаем`);
        isConnecting = false;
        return;
      }
      
      // Подключаем прокси для пользователя
      setupProxyForUser(userAccount);
    });
  }
  
  // Автоматическое подключение прокси с защитой от множественных вызовов
  function setupAutoProxy(force = false) {
    const now = Date.now();
    const minInterval = 10000; // Минимальный интервал между попытками подключения (10 секунд)
    
    // Проверяем, не слишком ли часто вызывается функция
    if (!force && (now - lastConnectionAttempt) < minInterval) {
      console.log('Слишком частый вызов setupAutoProxy, пропускаем');
      return;
    }
    
    // Проверяем, не идет ли уже подключение
    if (isConnecting && !force) {
      console.log('Подключение уже в процессе, пропускаем');
      return;
    }
    
    console.log('=== НАЧАЛО АВТОПОДКЛЮЧЕНИЯ ===');
    lastConnectionAttempt = now;
    isConnecting = true;
    
    // Проверяем авторизацию
    chrome.storage.local.get(['isAuthenticated', 'userType', 'currentUser', 'authTime'], (result) => {
      console.log('Результат проверки авторизации:', result);
      
      // Проверяем валидность сессии
      const now = Date.now();
      const authTime = result.authTime || 0;
      const sessionTimeout = 24 * 60 * 60 * 1000; // 24 часа
      
      if (!result.isAuthenticated || (now - authTime) >= sessionTimeout) {
        console.log('Требуется авторизация для автоматического подключения');
        isConnecting = false;
        return;
      }
      
      // Если это обычный пользователь - автоматически подключаем его IP
      if (result.userType === 'user' && result.currentUser) {
        console.log(`Автоматическое подключение для пользователя: ${result.currentUser.name}`);
        autoConnectUser(result.currentUser);
        return;
      }
      
      // Если это админ - показываем управление
      if (result.userType === 'admin') {
        console.log('Админский режим - показываем управление');
        isConnecting = false;
        return;
      }
      
      isConnecting = false;
    });
    
    console.log('=== КОНЕЦ АВТОПОДКЛЮЧЕНИЯ ===');
  }
  
  // Проверка авторизации
  function checkAuthentication() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['isAuthenticated', 'authTime'], (result) => {
        const now = Date.now();
        const authTime = result.authTime || 0;
        const sessionTimeout = 24 * 60 * 60 * 1000; // 24 часа
        
        if (result.isAuthenticated && (now - authTime) < sessionTimeout) {
          isAuthenticated = true;
          resolve(true);
        } else {
          isAuthenticated = false;
          resolve(false);
        }
      });
    });
  }
  
  // Функция для настройки прокси для обычных пользователей с аутентификацией
  async function setupProxyForUser(userAccount) {
    console.log(`Настройка прокси для пользователя: ${userAccount.name}`);
    
    // Проверяем, не подключен ли уже этот пользователь
    const currentState = await new Promise((resolve) => {
      chrome.storage.local.get(['currentProfile', 'proxyEnabled'], resolve);
    });
    
    if (currentState.proxyEnabled && currentState.currentProfile === userAccount.name) {
      console.log(`Прокси уже подключен для ${userAccount.name}, пропускаем повторное подключение`);
      isConnecting = false;
      return;
    }
    
  
    const localPort = userAccount.localPort || 3128;
    
    isSwitching = true;
    lastSwitchAtMs = Date.now();
    
    // Передаем тип пользователя и profile_id (ищем по IP адресу, так как он уникален)
    const profileKey = Object.keys(AUTH_CONFIG.userAccounts).find(
      key => AUTH_CONFIG.userAccounts[key].ip === userAccount.ip
    );
    
    console.log(`Найден profileKey для IP ${userAccount.ip}: ${profileKey}`);
    
    // СНАЧАЛА пытаемся подключиться через FastAPI (без очистки порта)
    // FastAPI сам проверит, занят ли профиль
    const res = await helperApplyProxy(
      userAccount.ip, 
      userAccount.port, 
      userAccount.username, 
      userAccount.password, 
      localPort,
      'user',  // тип пользователя
      profileKey || `user_${userAccount.ip}`  // profile_id (fallback на IP)
    );
    
    if (!res || res.ok !== true) {
      console.log('Помощник вернул ошибку при apply:', res);
      isConnecting = false;
      isSwitching = false;
      
      // Проверяем, не занят ли аккаунт
      if (res.status === 423) {
        console.log('❌ Аккаунт занят другим пользователем');
        console.log(`Профиль ${profileKey} недоступен`);
        
        // Показываем уведомление пользователю
        chrome.runtime.sendMessage({
          action: 'accountBusy',
          message: `Профиль "${profileKey}" уже используется.\n\nВыберите другой профиль или обратитесь к администратору.`
        }).catch(() => {
          console.log('Popup не открыт, уведомление не отправлено');
        });
      }
      
      return;
    }
    
    console.log('✅ Профиль свободен, подключение разрешено');
    
    // Дополнительная задержка для стабилизации tinyproxy
    await new Promise(resolve => setTimeout(resolve, 3000));
  
    // Настраиваем браузер на локальный прокси без пароля
    const pacData = `function FindProxyForURL(url, host) { return "PROXY 94.241.175.200:${localPort}"; }`;
    chrome.proxy.settings.set(
      { value: { mode: 'pac_script', pacScript: { data: pacData } }, scope: 'regular' },
      () => {
        console.log(`Локальный прокси 94.241.175.200:${localPort} установлен для ${userAccount.name}`);
        currentProfile = profileKey || userAccount.name;
        isConnecting = false;
        connectionRetryCount = 0;
        isSwitching = false;
        
        // НЕ показываем "Подключен" пока не проверим IP
        chrome.storage.local.set({ 
          proxyEnabled: false, // Временно false до проверки IP
          currentProfile: profileKey || userAccount.name,  // Используем profileKey вместо имени
          profileInfo: { name: userAccount.name, ip: userAccount.ip, region: userAccount.region }
        });
        
        console.log(`Профиль сохранен в storage: ${profileKey || userAccount.name} (${userAccount.ip})`);
        console.log(`Profile Key: ${profileKey}`);
        console.log(`Статус: "Подключение..." (ожидаем проверки IP)`);
        
        // Запускаем мониторинг прокси
        console.log(`Запуск мониторинга для пользователя: ${userAccount.name}`);
        console.log(`Ожидаемый IP для мониторинга: ${userAccount.ip}`);
        startProxyMonitoring(userAccount.ip);
        
        // Уведомляем popup о подключении (статус будет обновлен после проверки IP)
        chrome.runtime.sendMessage({
          action: 'proxyConnected',
          profileInfo: { name: userAccount.name, ip: userAccount.ip, region: userAccount.region },
          proxyStatus: {
            connected: false, // Пока false, будет обновлено после проверки IP
            realIP: null,
            expectedIP: userAccount.ip,
            lastCheck: Date.now()
          }
        }).catch(() => {
          // Игнорируем ошибки если popup не открыт
        });
      }
    );
  }
  
  // Функция для настройки прокси (админская версия) с аутентификацией
  async function setupProxy(profileKey) {
    if (!profileKey || !AUTH_CONFIG.userAccounts[profileKey]) {
      console.log('Неверный профиль:', profileKey);
      return;
    }
  
    const profile = AUTH_CONFIG.userAccounts[profileKey];
    
    // Проверяем, не подключен ли уже этот профиль
    const currentState = await new Promise((resolve) => {
      chrome.storage.local.get(['currentProfile', 'proxyEnabled'], resolve);
    });
    
    if (currentState.proxyEnabled && currentState.currentProfile === profileKey) {
      console.log(`Прокси уже подключен для ${profile.name}, пропускаем повторное подключение`);
      return;
    }
    
    const localPort = profile.localPort || 3128;
    
    // Админ сначала очищает порт (приоритетный доступ)
    console.log(`🔧 Админ подключается, очищаем порт ${localPort}`);
    await helperClearProxy(localPort);
    // Задержка для полной остановки tinyproxy
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    isSwitching = true;
    lastSwitchAtMs = Date.now();
    
    // Передаем тип пользователя 'admin' и profile_id
    const res = await helperApplyProxy(
      profile.ip, 
      profile.port, 
      profile.username, 
      profile.password, 
      localPort,
      'admin',  // тип пользователя - админ
      profileKey  // profile_id
    );
    
    if (!res || res.ok !== true) {
      console.log('Помощник вернул ошибку при apply (admin):', res);
      isSwitching = false;
      
      // Для админа просто логируем
      if (res.status === 423) {
        console.log('⚠️ Неожиданная ошибка 423 для админа');
      }
      
      return;
    }
    
    console.log('✅ Админ успешно подключился к профилю');
    
    // Дополнительная задержка для стабилизации tinyproxy
    await new Promise(resolve => setTimeout(resolve, 3000));
  
    // Переключаем браузер на локальный прокси
    const pacDataAdmin = `function FindProxyForURL(url, host) { return "PROXY 94.241.175.200:${localPort}"; }`;
    chrome.proxy.settings.set(
      { value: { mode: 'pac_script', pacScript: { data: pacDataAdmin } }, scope: 'regular' },
      () => {
        console.log(`Локальный прокси 94.241.175.200:${localPort} установлен для ${profile.name}`);
        currentProfile = profileKey;
        
        // НЕ показываем "Подключен" пока не проверим IP
        chrome.storage.local.set({ 
          proxyEnabled: false, // Временно false до проверки IP
          currentProfile: profileKey,
          profileInfo: { name: profile.name, ip: profile.ip, region: profile.region }
        });
        
        console.log(`Профиль сохранен в storage: ${profile.name} (${profile.ip})`);
        console.log(`Статус: "Подключение..." (ожидаем проверки IP)`);
        
        // Запускаем мониторинг прокси
        console.log(`Запуск мониторинга для админа: ${profile.name}`);
        console.log(`Ожидаемый IP для мониторинга: ${profile.ip}`);
        startProxyMonitoring(profile.ip);
        isSwitching = false;
      }
    );
  }
  
  // Настройка прокси с аутентификацией через PAC скрипт
  function setupProxyWithAuth(profileKey) {
    if (!profileKey || !AUTH_CONFIG.userAccounts[profileKey]) {
      console.log('Неверный профиль:', profileKey);
      return;
    }
  
    const profile = AUTH_CONFIG.userAccounts[profileKey];
    
    // Создаем PAC скрипт с аутентификацией
    const pacScript = `
      function FindProxyForURL(url, host) {
        // Всегда используем прокси
        return "PROXY ${profile.ip}:${profile.port}";
      }
    `;
    
    // Создаем blob URL для PAC скрипта
    const blob = new Blob([pacScript], { type: 'application/javascript' });
    const pacUrl = URL.createObjectURL(blob);
    
    const config = {
      mode: "pac_script",
      pacScript: {
        url: pacUrl
      }
    };
  
    chrome.proxy.settings.set(
      { value: config, scope: 'regular' },
      () => {
        console.log(`Прокси с PAC скриптом подключен для ${profile.name}:`, profile.ip);
        currentProfile = profileKey;
        
        // Сохраняем статус
        chrome.storage.local.set({ 
          proxyEnabled: true,
          currentProfile: profileKey,
          profileInfo: {
            name: profile.name,
            ip: profile.ip,
            region: profile.region
          }
        });
      }
    );
  }
  
  // Автоматическое подключение при установке расширения
  chrome.runtime.onInstalled.addListener(async () => {
    console.log('Расширение установлено');
    setupAutoProxy();
  });
  
  // Автоматическое подключение при запуске браузера
  chrome.runtime.onStartup.addListener(async () => {
    console.log('Браузер запущен');
    setupAutoProxy();
  });

  // Восстановление мониторинга при инициализации расширения
  async function restoreProxyMonitoring() {
    try {
      // Получаем сохраненный статус из storage
      const data = await chrome.storage.local.get(['proxyEnabled', 'currentProfile', 'proxyStatus']);
      
      if (data.proxyEnabled && data.currentProfile && data.proxyStatus && data.proxyStatus.expectedIP) {
        console.log('Восстановление мониторинга прокси после перезапуска');
        console.log(`Профиль: ${data.currentProfile.name}`);
        console.log(`Ожидаемый IP: ${data.proxyStatus.expectedIP}`);
        
        // Запускаем мониторинг с сохраненными параметрами
        startProxyMonitoring(data.proxyStatus.expectedIP);
      }
    } catch (error) {
      console.log('Ошибка восстановления мониторинга:', error);
    }
  }

  // Вызываем восстановление мониторинга при инициализации
  restoreProxyMonitoring();
  
  // Отслеживание изменений профиля
  chrome.management.onEnabled.addListener((info) => {
    console.log('Профиль изменен, переподключаем прокси...');
    // Сбрасываем флаги при изменении профиля
    isConnecting = false;
    connectionRetryCount = 0;
    setupAutoProxy();
  });
  
// Отслеживание изменений в настройках прокси
chrome.proxy.onProxyError.addListener((details) => {
  // Игнорируем ошибки в течение короткого окна после переключения
  const now = Date.now();
  if (isSwitching || (now - lastSwitchAtMs) < 10000) {
    console.log('Игнорируем ошибку прокси в период переключения');
    return;
  }
  
  // Игнорируем несущественные ошибки туннелирования
  const ignorableErrors = [
    'net::ERR_TUNNEL_CONNECTION_FAILED',
    'net::ERR_PROXY_AUTH_UNSUPPORTED',
    'net::ERR_PROXY_CONNECTION_FAILED'
  ];
  
  if (ignorableErrors.includes(details.error)) {
    console.log(`Игнорируем несущественную ошибку: ${details.error}`);
    return;
  }
  
  console.log('Критическая ошибка прокси:', details);
    
    // Проверяем состояние прокси перед обработкой ошибки
    chrome.storage.local.get(['proxyEnabled', 'currentProfile'], (result) => {
      if (result.proxyEnabled && result.currentProfile) {
        console.log('Прокси подключен, игнорируем ошибку');
        return;
      }
      
      // Увеличиваем счетчик попыток только если прокси не подключен
      connectionRetryCount++;
      
      // Не переподключаемся при каждой ошибке, только при критических
      const criticalErrors = ['net::ERR_TUNNEL_CONNECTION_FAILED', 'net::ERR_PROXY_CONNECTION_FAILED'];
      const isCriticalError = criticalErrors.includes(details.error);
      
      // Ограничиваем количество попыток переподключения
      if (isCriticalError && connectionRetryCount <= 3) {
        console.log(`Критическая ошибка прокси, попытка переподключения ${connectionRetryCount}/3`);
        setTimeout(() => {
          setupAutoProxy(true); // Принудительное переподключение
        }, 10000); // Увеличиваем задержку до 10 секунд
      } else if (connectionRetryCount > 3) {
        console.log('Превышено максимальное количество попыток переподключения');
        isConnecting = false;
      }
    });
  });
  
  // Сообщения от popup
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'authenticate') {
      const userInfo = getUserType(request.password);
      
      if (!userInfo) {
        sendResponse({ success: false, message: 'Неверный пароль' });
        return true;
      }
      
      // СНАЧАЛА проверяем лицензию для всех типов пользователей
      console.log('🔍 Проверка лицензии перед авторизацией...');
      
      checkLicenseStatus().then((license) => {
        console.log('Результат проверки лицензии:', license);
        
        // Если лицензия недействительна - отказываем в авторизации
        if (!license.valid) {
          console.log('❌ Лицензия недействительна, отказываем в авторизации');
          
          let errorMessage = 'Лицензия истекла.\n\nОбратитесь к администратору для продления.';
          
          // Формируем сообщение в зависимости от причины
          if (license.days_remaining < 0) {
            const daysExpired = Math.abs(license.days_remaining);
            errorMessage = `Лицензия истекла ${daysExpired} ${getDaysWord(daysExpired)} назад.\n\nОбратитесь к администратору для продления.`;
          } else if (license.error) {
            errorMessage = `${license.error}\n\nОбратитесь к администратору.`;
          }
          
          sendResponse({ 
            success: false, 
            message: errorMessage,
            licenseExpired: true,
            licenseStatus: license
          });
          return;
        }
        
        console.log('✅ Лицензия действительна, продолжаем авторизацию');
        
        // Для обычных пользователей проверяем доступность профиля
        if (userInfo.type === 'user') {
        // Ищем profileKey по IP адресу
        const profileKey = Object.keys(AUTH_CONFIG.userAccounts).find(
          key => AUTH_CONFIG.userAccounts[key].ip === userInfo.user.ip
        );
        
        console.log(`🔍 Проверка доступности профиля ${profileKey} при авторизации...`);
        
        // Проверяем доступность профиля
        helperCheckProfile(profileKey).then((checkResult) => {
          console.log('Результат проверки профиля:', checkResult);
          
          if (!checkResult.available && !checkResult.error) {
            // Профиль занят
            console.log(`❌ Профиль ${profileKey} занят пользователем типа ${checkResult.occupied_by}`);
            sendResponse({ 
              success: false, 
              message: `Профиль "${profileKey}" уже используется.\n\nВыберите другой профиль или обратитесь к администратору.`,
              profileBusy: true
            });
            return;
          }
          
          // Профиль свободен или произошла ошибка проверки - разрешаем вход
          console.log(`✅ Профиль ${profileKey} доступен`);
          completeAuthentication(userInfo, sendResponse);
        }).catch((err) => {
          console.log('Ошибка при проверке профиля:', err);
          // При ошибке проверки разрешаем вход
          completeAuthentication(userInfo, sendResponse);
        });
        
          return true; // Асинхронный ответ
        }
        
        // Для админов проверяем только занятость (без проверки профиля)
        console.log('🔑 Админ входит без проверки занятости');
        completeAuthentication(userInfo, sendResponse);
      }).catch((err) => {
        console.log('Ошибка при проверке лицензии:', err);
        sendResponse({ 
          success: false, 
          message: 'Ошибка проверки лицензии.\n\nОбратитесь к администратору.',
          licenseExpired: true
        });
      });
      
      return true; // Асинхронный ответ
    }
    
    if (request.action === 'checkLicense') {
      checkLicenseStatus().then((license) => {
        sendResponse({ licenseStatus: license });
      });
      return true;
    }
    
    if (request.action === 'getProfileInfo') {
      chrome.storage.local.get(['currentProfile', 'profileInfo', 'userType', 'currentUser', 'isAuthenticated', 'authTime', 'proxyStatus', 'licenseStatus'], (result) => {
        const nowTs = Date.now();
        const authTime = result.authTime || 0;
        const sessionTimeout = 24 * 60 * 60 * 1000; // 24 часа
        const isAuthValid = !!(result.isAuthenticated && (nowTs - authTime) < sessionTimeout);
  
        if (result.userType === 'admin') {
          // Для админа показываем все профили
          const availableProfiles = Object.keys(AUTH_CONFIG.userAccounts).map(key => ({
            key,
            name: AUTH_CONFIG.userAccounts[key].name,
            region: AUTH_CONFIG.userAccounts[key].region,
            ip: AUTH_CONFIG.userAccounts[key].ip
          }));
          
          sendResponse({
            currentProfile: result.currentProfile,
            profileInfo: result.profileInfo,
            isAuthenticated: isAuthValid,
            userType: result.userType,
            userName: result.currentUser?.name,
            availableProfiles: availableProfiles,
            proxyStatus: result.proxyStatus || { connected: false, realIP: null, expectedIP: null },
            licenseStatus: result.licenseStatus || licenseStatus
          });
        } else {
          // Для обычного пользователя показываем только его данные
          sendResponse({
            currentProfile: result.currentProfile,
            profileInfo: result.profileInfo,
            isAuthenticated: isAuthValid,
            userType: result.userType,
            userName: result.currentUser?.name,
            availableProfiles: [],
            proxyStatus: result.proxyStatus || { connected: false, realIP: null, expectedIP: null },
            licenseStatus: result.licenseStatus || licenseStatus
          });
        }
      });
      return true;
    }
    
    if (request.action === 'switchProfile') {
      if (!isAuthenticated) {
        sendResponse({ success: false, message: 'Требуется авторизация' });
        return;
      }
      
      // Сохраняем выбранный профиль пользователем
      chrome.storage.local.set({ userProfile: request.profileKey }, () => {
        setupProxy(request.profileKey).then(() => {
          sendResponse({ success: true, message: `Переключен на ${AUTH_CONFIG.userAccounts[request.profileKey].name}` });
        });
      });
      return true;
    }
    
    if (request.action === 'autoConnect') {
      if (!isAuthenticated) {
        sendResponse({ success: false, message: 'Требуется авторизация' });
        return;
      }
      
      console.log('Запуск автоподключения...');
      console.log('Доступные профили для автоподключения:', Object.keys(AUTH_CONFIG.userAccounts));
      
      setupAutoProxy();
      sendResponse({ success: true, message: 'Автоматическое подключение запущено' });
      return true;
    }
    
    if (request.action === 'saveProfile') {
      if (!isAuthenticated) {
        sendResponse({ success: false, message: 'Требуется авторизация' });
        return;
      }
      
      // Сохраняем выбранный профиль
      chrome.storage.local.set({ userProfile: request.profileKey }, () => {
        console.log(`Профиль сохранен: ${request.profileKey}`);
        // Автоматически подключаем прокси для сохраненного профиля
        setupProxy(request.profileKey);
        sendResponse({ success: true, message: `Профиль "${AUTH_CONFIG.userAccounts[request.profileKey].name}" сохранен и подключен` });
      });
      return true;
    }
    
    if (request.action === 'toggleProxy') {
      if (!isAuthenticated) {
        sendResponse({ success: false, message: 'Требуется авторизация' });
        return;
      }
      
      if (request.enabled) {
        setupProxy(currentProfile);
        sendResponse({ success: true, message: 'Прокси включен' });
      } else {
        chrome.proxy.settings.clear({ scope: 'regular' }, () => {
          console.log('Прокси отключен');
          chrome.storage.local.set({ proxyEnabled: false });
          sendResponse({ success: true, message: 'Прокси отключен' });
        });
      }
      return true;
    }
    
    if (request.action === 'retryConnection') {
      console.log('🔄 Попытка переподключения...');
      
      // Сбрасываем флаги
      isConnecting = false;
      connectionRetryCount = 0;
      lastConnectionAttempt = 0;
      
      // Запускаем автоподключение заново
      setupAutoProxy(true);
      sendResponse({ success: true, message: 'Попытка переподключения запущена' });
      return true;
    }
    
    if (request.action === 'logout') {
      // Получаем текущий профиль для освобождения
      chrome.storage.local.get(['currentProfile'], async (result) => {
        const profileToRelease = result.currentProfile;
        
        isAuthenticated = false;
        currentUser = null;
        userType = null;
        currentProfile = null;
        isConnecting = false;
        connectionRetryCount = 0;
        lastConnectionAttempt = 0;
        
        // Останавливаем мониторинг прокси
        stopProxyMonitoring();
        
        // Освобождаем профиль в FastAPI
        if (profileToRelease) {
          console.log(`Освобождаем профиль: ${profileToRelease}`);
          await helperReleaseProfile(profileToRelease);
        }
        
        // Останавливаем все прокси в помощнике
        await helperClearProxy();
    
        // Сброс прокси через пустой PAC-скрипт
        chrome.proxy.settings.set(
          {
            value: {
              mode: 'pac_script',
              pacScript: {
                data: 'function FindProxyForURL(url, host) { return "DIRECT"; }'
              }
            },
            scope: 'regular'
          },
          () => {
            console.log('Прокси сброшены');
          }
        );
        
        chrome.storage.local.clear();
      });
      
      sendResponse({ success: true, message: 'Выход выполнен' });
      return true;
    }
  });
  
  // В MV3 блокирующие webRequest слушатели недоступны вне корпоративной установки.
  // Авторизацию выполняет внешний помощник; браузеру отдаем локальный прокси без пароля.
  
  // Вспомогательная функция для склонения слова "день"
  function getDaysWord(days) {
    const lastDigit = days % 10;
    const lastTwoDigits = days % 100;
    
    if (lastTwoDigits >= 11 && lastTwoDigits <= 19) {
      return 'дней';
    }
    if (lastDigit === 1) {
      return 'день';
    }
    if (lastDigit >= 2 && lastDigit <= 4) {
      return 'дня';
    }
    return 'дней';
  }

  // Функция завершения авторизации
  function completeAuthentication(userInfo, sendResponse) {
    isAuthenticated = true;
    currentUser = userInfo.user;
    userType = userInfo.type;
    
    // Сбрасываем флаги подключения при новой авторизации
    isConnecting = false;
    connectionRetryCount = 0;
    
    // Очищаем старые данные профиля перед новой авторизацией
    chrome.storage.local.remove(['currentProfile', 'profileInfo'], () => {
      chrome.storage.local.set({ 
        isAuthenticated: true, 
        authTime: Date.now(),
        userType: userInfo.type,
        currentUser: userInfo.user
      }, () => {
        console.log('Авторизация сохранена в storage');
        console.log('Старые данные профиля очищены');
        
        // Автоматически подключаем прокси после авторизации с небольшой задержкой
        setTimeout(() => {
          setupAutoProxy(true); // Принудительное подключение после авторизации
        }, 1000);
      });
    });
    
    sendResponse({ 
      success: true, 
      message: `Авторизация успешна. Добро пожаловать, ${userInfo.user.name}!`,
      userType: userInfo.type,
      userName: userInfo.user.name
    });
  }

  // Освобождение профиля при закрытии браузера
  chrome.runtime.onSuspend.addListener(async () => {
    console.log('Расширение завершает работу, освобождаем профиль...');
    
    // Получаем текущий профиль
    const data = await chrome.storage.local.get(['currentProfile']);
    if (data.currentProfile) {
      console.log(`Освобождаем профиль при suspend: ${data.currentProfile}`);
      await helperReleaseProfile(data.currentProfile);
    }
  });

  // Проверка лицензии каждые 12 часов
  setInterval(() => {
    console.log('⏰ Плановая проверка лицензии...');
    checkLicenseStatus();
  }, 12 * 60 * 60 * 1000); // 12 часов

  // Инициализация при загрузке
  (async () => {
    console.log('Инициализация расширения...');
    
    // Проверяем лицензию при старте
    console.log('🔑 Проверка лицензии...');
    const license = await checkLicenseStatus();
    
    if (!license.valid) {
      console.log('❌ Лицензия недействительна, расширение работать не будет');
      console.log(`Причина: ${license.error}`);
      return;
    }
    
    console.log('✅ Лицензия действительна, запускаем расширение');
    setupAutoProxy();
  })();
  