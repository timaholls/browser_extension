// Система логирования с сохранением в storage
const LOG_CONFIG = {
    maxLogs: 500, // Максимальное количество записей в логе
    enableLogging: true // Включить/выключить логирование
};

let logBuffer = [];

// Функция добавления лога
async function addLog(level, category, message, data = null) {
    if (!LOG_CONFIG.enableLogging) return;
    
    const logEntry = {
        timestamp: new Date().toISOString(),
        level: level, // 'INFO', 'WARN', 'ERROR', 'AUTH', 'PROXY'
        category: category,
        message: message,
        data: data ? JSON.stringify(data) : null
    };
    
    logBuffer.push(logEntry);
    
    // Сохраняем в storage
    try {
        const result = await chrome.storage.local.get(['systemLogs']);
        let logs = result.systemLogs || [];
        logs.push(logEntry);
        
        // Ротация логов - оставляем только последние maxLogs записей
        if (logs.length > LOG_CONFIG.maxLogs) {
            logs = logs.slice(-LOG_CONFIG.maxLogs);
        }
        
        await chrome.storage.local.set({ systemLogs: logs });
    } catch (error) {
        console.error('Ошибка сохранения лога:', error);
    }
}

// Функция получения всех логов
async function getAllLogs() {
    try {
        const result = await chrome.storage.local.get(['systemLogs']);
        return result.systemLogs || [];
    } catch (error) {
        console.error('Ошибка получения логов:', error);
        return [];
    }
}

// Функция очистки логов
async function clearLogs() {
    try {
        await chrome.storage.local.remove(['systemLogs']);
        logBuffer = [];
        await addLog('INFO', 'SYSTEM', 'Логи очищены');
    } catch (error) {
        console.error('Ошибка очистки логов:', error);
    }
}

// Встроенная конфигурация прокси
const EMBEDDED_CONFIG = {
  "profiles": {
    "user1": {
      "name": "Рус2",
      "proxy": {
        "host": "46.161.30.65",
        "port": 60514,
        "username": "DQ5787bQp2",
        "password": "DSkKs9pX3Q"
      },
      "ip": "46.161.30.65",
      "region": "Россия"
    },
    "user2": {
      "name": "Рус3",
      "proxy": {
        "host": "46.161.28.224",
        "port": 61170,
        "username": "VPQmx42H4D",
        "password": "WvR7Bcjmpx"
      },
      "ip": "46.161.28.224",
      "region": "Россия"
    },
    "user3": {
      "name": "Анж",
      "proxy": {
        "host": "46.161.30.125",
        "port": 61185,
        "username": "2pXwvEJ6rM",
        "password": "GZFFTxaJY5"
      },
      "ip": "46.161.30.125",
      "region": "Россия"
    },
    "user4": {
      "name": "Юли",
      "proxy": {
        "host": "185.42.27.159",
        "port": 61975,
        "username": "8k8keCXeuc",
        "password": "ZrxUAfsGFp"
      },
      "ip": "185.42.27.159",
      "region": "Россия"
    },
  },
  "settings": {
    "productionMode": true,
    "sessionTimeout": 86400000,
    "connectionRetryCount": 3,
    "monitoringInterval": 30000
  },
  "license": {
    "installDate": "2025-11-27T09:35:50+05:00",
    "validDays": 60
  }
};

// Флаг режима работы
const PRODUCTION_MODE = EMBEDDED_CONFIG.settings.productionMode;

// Конфигурация прокси (загружается из встроенной конфигурации)
let PROXY_CONFIG = null;

// Функция проверки лицензии (скрытая защита)
function checkLicense() {
    try {
        const installDate = new Date(EMBEDDED_CONFIG.license.installDate);
        const currentDate = new Date();
        const daysPassed = Math.floor((currentDate - installDate) / (1000 * 60 * 60 * 24));
        const validDays = EMBEDDED_CONFIG.license.validDays;
        
        if (daysPassed > validDays) {
            return false;
        }
        
        return true;
    } catch (error) {
        return false;
    }
}

// Загрузка конфигурации из встроенной переменной
async function loadConfig() {
    try {
        await addLog('INFO', 'CONFIG', 'Загрузка конфигурации');
        
        // Преобразуем конфигурацию в нужный формат
        const firstProfileKey = Object.keys(EMBEDDED_CONFIG.profiles)[0];
        const firstProfile = EMBEDDED_CONFIG.profiles[firstProfileKey];
        
        PROXY_CONFIG = {
            proxy: firstProfile.proxy, // Основной прокси (первый профиль)
            profiles: {}
        };
        
        // Преобразуем профили
        Object.keys(EMBEDDED_CONFIG.profiles).forEach(key => {
            const profile = EMBEDDED_CONFIG.profiles[key];
            PROXY_CONFIG.profiles[key] = {
                host: profile.proxy.host,
                port: profile.proxy.port,
                username: profile.proxy.username,
                password: profile.proxy.password,
                name: profile.name,
                ip: profile.ip,
                region: profile.region
            };
        });
        
        await addLog('INFO', 'CONFIG', `Конфигурация загружена успешно. Профилей: ${Object.keys(PROXY_CONFIG.profiles).length}`);
        return true;
    } catch (error) {
        await addLog('ERROR', 'CONFIG', 'Ошибка загрузки конфигурации', { error: error.message });
        return false;
    }
}

// Автоматическая авторизация через webRequestAuthProvider
function setupAutoAuth() {
    // console.log removed
    
    chrome.webRequest.onAuthRequired.addListener(
        function(details, callbackFn) {
            // console.log removed
            
            // Проверяем что конфигурация загружена
            if (!PROXY_CONFIG) {
                // console.error removed
                callbackFn({});
                return;
            }
            
            // Определяем профиль по порту
            const port = details.challenger?.port;
            let credentials = null;
            
            // Динамически ищем профиль по порту
            let foundProfile = null;
            let foundProfileKey = null;
            
            // console.log removed
            // console.log removed
            
            for (const [key, profile] of Object.entries(PROXY_CONFIG.profiles)) {
                // console.log removed
                if (profile.port === port) {
                    foundProfile = profile;
                    foundProfileKey = key;
                    // console.log removed
                    break;
                }
            }
            
            if (foundProfile) {
                credentials = {
                    username: foundProfile.username,
                    password: foundProfile.password
                };
                // console.log removed
            } else {
                // Fallback на основной профиль
                credentials = {
                    username: PROXY_CONFIG.proxy.username,
                    password: PROXY_CONFIG.proxy.password
                };
                // console.log removed
            }
            
            // console.log removed
            // console.log removed
            callbackFn({ authCredentials: credentials });
        },
        { urls: ["<all_urls>"] },
        ['asyncBlocking']
    );
    
    // console.log removed
}

// Настройка прокси через fixed_servers
function setupProxy(profileKey = null) {
    // Если профиль не указан, используем первый доступный
    if (!profileKey) {
        profileKey = Object.keys(PROXY_CONFIG.profiles)[0];
    }
    
    // console.log removed
    
    const profile = PROXY_CONFIG.profiles[profileKey];
    
    if (!profile) {
        // console.error removed
        return;
    }
    
    chrome.proxy.settings.set({
        value: {
            mode: 'fixed_servers',
            rules: {
                singleProxy: {
                    scheme: 'http',
                    host: profile.host,
                    port: profile.port
                },
                bypassList: ["localhost"]
            }
        },
        scope: 'regular'
    }, () => {
        // console.log removed
        // console.log removed
        // console.log removed
        // console.log removed
        
        // Проверяем настройку прокси
        chrome.proxy.settings.get({}, (config) => {
            // console.log removed
        });
    });
}

// Переключение между профилями
async function switchProfile(profileKey) {
    await addLog('INFO', 'PROXY', `Переключение профиля на: ${profileKey}`);
    
    if (!PROXY_CONFIG.profiles[profileKey]) {
        // Используем первый доступный профиль
        const firstProfileKey = Object.keys(PROXY_CONFIG.profiles)[0];
        await addLog('WARN', 'PROXY', `Профиль ${profileKey} не найден, используем ${firstProfileKey}`);
        profileKey = firstProfileKey;
    }
    
    const profile = PROXY_CONFIG.profiles[profileKey];
    
    // Настраиваем автоматическую авторизацию
    setupAutoAuth();
    
    // Настраиваем прокси для выбранного профиля
    setupProxy(profileKey);
    
    // Обновляем текущий профиль
    currentProfile = profileKey;
    
    // Получаем текущие данные пользователя, чтобы не потерять userType
    chrome.storage.sync.get(['userType', 'currentUser', 'isAuthenticated'], async (result) => {
        // Если это админ, всегда сохраняем админские данные
        const adminUser = { name: 'Администратор', ip: 'Админ', region: 'Админ', port: 'Админ' };
        
        const dataToSave = {
            currentProfile: profileKey,
            profileInfo: {
                name: profile.name,
                ip: profile.ip,
                port: profile.port,
                region: 'Россия'
            },
            // Сохраняем данные авторизации
            userType: result.userType || 'admin',
            // Для админа ВСЕГДА сохраняем админские данные
            currentUser: (result.userType === 'admin') ? adminUser : (result.currentUser || adminUser),
            isAuthenticated: result.isAuthenticated !== undefined ? result.isAuthenticated : true
        };
        
        await addLog('INFO', 'PROXY', `Сохранение данных: userType=${dataToSave.userType}, currentUser=${dataToSave.currentUser.name}`);
        
        chrome.storage.sync.set(dataToSave);
        
        await addLog('INFO', 'PROXY', `Профиль переключен на: ${profile.name} (${profile.ip})`);
    });
    
    // Запускаем мониторинг для админа тоже
    startProxyMonitoring(profile.ip);
}

// Текущее состояние
let currentProfile = null;
let isAuthenticated = false;
let currentUser = null;
let userType = null;
let isConnecting = false;
let lastConnectionAttempt = 0;
let connectionRetryCount = 0;
let lastSwitchAtMs = 0;
let isSwitching = false;

// Состояние блокировки интернета
let internetBlocked = false;
let blockReason = null;
let blockTime = null;

// Статус прокси
let proxyStatus = {
    connected: false,
    realIP: null,
    expectedIP: null,
    lastCheck: 0,
    checkInterval: null
};

// Функция блокировки всех сетевых запросов через declarativeNetRequest
async function blockAllNetworkRequests() {
    // console.log removed
    
    // В режиме тестирования не блокируем интернет
    if (!PRODUCTION_MODE) {
        return;
    }
    
    try {
        // Сначала удаляем существующие правила с ID 1
        await chrome.declarativeNetRequest.updateDynamicRules({
            removeRuleIds: [1]
        });
        
        // Создаем правило блокировки всех запросов, кроме доменов проверки IP
        const blockRule = {
            id: 1,
            priority: 1,
            action: {
                type: 'block'
            },
            condition: {
                urlFilter: '*',
                resourceTypes: ['main_frame', 'sub_frame', 'stylesheet', 'script', 'image', 'font', 'object', 'xmlhttprequest', 'ping', 'csp_report', 'media', 'websocket', 'other'],
                excludedRequestDomains: ['api.ipify.org']
            }
        };
        
        // Добавляем правило блокировки
        await chrome.declarativeNetRequest.updateDynamicRules({
            addRules: [blockRule]
        });
        
        internetBlocked = true;
        blockTime = Date.now();
        
        // console.log removed
        
    } catch (error) {
        // console.error removed
        // Просто устанавливаем флаг блокировки без fallback
        internetBlocked = true;
        blockTime = Date.now();
        // console.log removed
    }
}

// Функция разблокировки интернета
async function unblockInternet() {
    // console.log removed
    
    try {
        // Удаляем правило блокировки
        await chrome.declarativeNetRequest.updateDynamicRules({
            removeRuleIds: [1]
        });
        
        internetBlocked = false;
        blockReason = null;
        blockTime = null;
        
        // console.log removed
        
    } catch (error) {
        // console.error removed
        // Просто сбрасываем флаг блокировки
        internetBlocked = false;
        blockReason = null;
        blockTime = null;
        // console.log removed
    }
}

// Функция экстренного отключения с блокировкой
async function emergencyDisconnect() {
    // console.log removed
    
    // Отключаем прокси
    chrome.proxy.settings.clear({scope: 'regular'}, () => {
        // console.log removed
    });
    
    // Блокируем все сетевые запросы
    await blockAllNetworkRequests();
    
    // Останавливаем мониторинг прокси
    stopProxyMonitoring();
    
    // Обновляем статус в storage
    chrome.storage.sync.set({
        proxyEnabled: false,
        internetBlocked: PRODUCTION_MODE ? true : false,
        blockReason: PRODUCTION_MODE ? 'IP verification failed' : null,
        blockTime: PRODUCTION_MODE ? Date.now() : null,
        proxyStatus: {
            connected: false,
            realIP: null,
            expectedIP: null,
            lastCheck: Date.now()
        }
    });
    
    // Показываем уведомление только в продакшн режиме
    if (PRODUCTION_MODE) {
        chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon.svg',
            title: '🔒 БЕЗОПАСНОСТЬ',
            message: 'Интернет заблокирован для защиты IP адреса!'
        });
    }
    
    // console.log removed
}

// Динамическая авторизация с выбором профиля по паролю
async function authenticateUser(password) {
    await addLog('AUTH', 'AUTH', 'Попытка авторизации');
    
    if (!PROXY_CONFIG) {
        await addLog('ERROR', 'AUTH', 'Конфигурация не загружена');
        return null;
    }
    
    // Проверяем админскую учетку
    if (password === 'admin123') {
        await addLog('AUTH', 'AUTH', 'Успешная авторизация администратора');
        return {
            type: 'admin',
            user: {
                name: 'Администратор',
                ip: 'Админ',
                region: 'Админ',
                port: 'Админ'
            },
            profileKey: 'admin',
            profile: null
        };
    }
    
    // Динамически ищем профиль по паролю
    const profileKey = password;
    const selectedProfile = PROXY_CONFIG.profiles[profileKey];
    
    if (selectedProfile) {
        await addLog('AUTH', 'AUTH', `Успешная авторизация пользователя: ${selectedProfile.name}`, { profileKey });
        return {
            type: 'user',
            user: {
                name: selectedProfile.name,
                ip: selectedProfile.ip,
                region: selectedProfile.region,
                port: selectedProfile.port
            },
            profileKey: profileKey,
            profile: selectedProfile
        };
    }
    
    await addLog('WARN', 'AUTH', 'Неверный пароль');
    return null;
}

// Автоматическое подключение для авторизованных пользователей
function autoConnectUser(userAccount) {
    // console.log removed
    // console.log removed

    // Проверяем, не подключен ли уже этот пользователь
    chrome.storage.sync.get(['currentProfile', 'proxyEnabled'], (result) => {
        if (result.proxyEnabled && result.currentProfile === userAccount.name) {
            // console.log removed
            isConnecting = false;
            return;
        }

        // Подключаем прокси для пользователя
        setupDirectProxy();
    });
}

// Автоматическое подключение прокси с защитой от множественных вызовов
async function setupAutoProxy(force = false) {
    const now = Date.now();
    const minInterval = 10000; // Минимальный интервал между попытками подключения (10 секунд)

    // Проверяем, не слишком ли часто вызывается функция
    if (!force && (now - lastConnectionAttempt) < minInterval) {
        await addLog('WARN', 'PROXY', 'Попытка переподключения слишком частая');
        return;
    }

    // Проверяем, не идет ли уже подключение
    if (isConnecting && !force) {
        await addLog('WARN', 'PROXY', 'Подключение уже в процессе');
        return;
    }

    await addLog('INFO', 'PROXY', 'Запуск автоматического подключения');
    lastConnectionAttempt = now;
    isConnecting = true;

    // Проверяем авторизацию
    chrome.storage.sync.get(['isAuthenticated', 'userType', 'currentUser'], async (result) => {
        // Проверяем валидность сессии
        if (!result) {
            await addLog('WARN', 'AUTH', 'Данные авторизации не найдены в storage');
            isConnecting = false;
            return;
        }

        if (!result.isAuthenticated) {
            await addLog('WARN', 'AUTH', 'Пользователь не авторизован');
            isConnecting = false;
            return;
        }

        await addLog('INFO', 'AUTH', `Авторизация подтверждена: ${result.userType} - ${result.currentUser?.name}`);

        // Если это обычный пользователь - автоматически подключаем его IP
        if (result.userType === 'user' && result.currentUser) {
            await addLog('INFO', 'PROXY', `Автоподключение для пользователя: ${result.currentUser.name}`);
            autoConnectUser(result.currentUser);
            return;
        }

        isConnecting = false;
    });
}

// Функция для проверки реального IP
async function checkRealIP() {
    const apis = [
        'https://api.ipify.org?format=json'
    ];

    for (let i = 0; i < apis.length; i++) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);

            const response = await fetch(apis[i], {
                method: 'GET',
                signal: controller.signal,
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                await addLog('WARN', 'PROXY', `API ${apis[i]} вернул ошибку: ${response.status}`);
                continue;
            }

            const data = await response.json();

            let ip = null;
            if (data.ip) {
                ip = data.ip;
            } else if (data.origin) {
                ip = data.origin;
            } else if (data.query) {
                ip = data.query;
            } else if (typeof data === 'string') {
                ip = data.trim();
            }

            if (ip && ip !== '127.0.0.1' && ip !== 'localhost') {
                return ip;
            }
        } catch (e) {
            await addLog('ERROR', 'PROXY', `Ошибка проверки IP через ${apis[i]}`, { error: e.message });
            continue;
        }
    }

    await addLog('ERROR', 'PROXY', 'Не удалось получить IP ни от одного API');
    return null;
}

// Функция для проверки статуса прокси
async function checkProxyStatus(expectedIP) {
    try {
        // В режиме тестирования пропускаем проверку IP
        if (!PRODUCTION_MODE) {
            return {connected: true, ip: 'test_ip', reason: 'Тестовый режим'};
        }

        const realIP = await checkRealIP();
        if (!realIP) {
            await addLog('ERROR', 'PROXY', 'Проверка прокси: не удалось получить реальный IP');
            return {connected: false, ip: null, reason: 'Не удалось получить IP'};
        }

        if (realIP === expectedIP) {
            await addLog('INFO', 'PROXY', `✅ Проверка прокси: IP совпадает (${realIP})`);
            return {connected: true, ip: realIP};
        } else {
            await addLog('ERROR', 'PROXY', `❌ Проверка прокси: IP НЕ совпадает`, {
                expected: expectedIP,
                received: realIP
            });
            return {
                connected: false,
                ip: realIP,
                expectedIP: expectedIP,
                reason: `IP не совпадает. Ожидался: ${expectedIP}, получен: ${realIP}`
            };
        }
    } catch (e) {
        await addLog('ERROR', 'PROXY', 'Критическая ошибка при проверке прокси', { error: e.message });
        return {connected: false, ip: null, reason: 'Ошибка проверки'};
    }
}

// Функция для запуска периодической проверки прокси
async function startProxyMonitoring(expectedIP) {
    stopProxyMonitoring();

    proxyStatus.expectedIP = expectedIP;
    proxyStatus.connected = false;

    await addLog('INFO', 'PROXY', `🔍 Запуск мониторинга прокси. Ожидаемый IP: ${expectedIP}`);

    // В режиме тестирования сразу считаем прокси подключенным
    if (!PRODUCTION_MODE) {
        proxyStatus.connected = true;
        proxyStatus.realIP = 'test_ip';
        
        chrome.storage.sync.set({
            proxyEnabled: true,
            proxyStatus: {
                connected: true,
                realIP: 'test_ip',
                expectedIP: expectedIP,
                lastCheck: Date.now()
            }
        });

        await addLog('INFO', 'PROXY', 'Тестовый режим: мониторинг пропущен');
        return;
    }

    // Первая проверка через 5 секунд
    setTimeout(async () => {
        await performProxyCheck();
    }, 5000);

    // Периодическая проверка каждые 15 секунд
    proxyStatus.checkInterval = setInterval(async () => {
        await performProxyCheck();
    }, 15000);
    
    await addLog('INFO', 'PROXY', 'Периодическая проверка прокси запущена (интервал: 15 сек)');
}

// Функция для остановки мониторинга прокси
async function stopProxyMonitoring() {
    if (proxyStatus.checkInterval) {
        clearInterval(proxyStatus.checkInterval);
        proxyStatus.checkInterval = null;
        await addLog('INFO', 'PROXY', '⏹️ Мониторинг прокси остановлен');
    }
    proxyStatus.connected = false;
    proxyStatus.realIP = null;
    proxyStatus.expectedIP = null;
}

// Функция для выполнения проверки прокси
async function performProxyCheck() {
    if (!proxyStatus.expectedIP) {
        // console.log removed
        return;
    }
    
    // Проверяем что мониторинг еще активен
    if (!proxyStatus.checkInterval) {
        // console.log removed
        return;
    }

    // В режиме тестирования пропускаем проверку
    if (!PRODUCTION_MODE) {
        return;
    }

    // console.log removed
    // console.log removed
    // console.log removed

    // СКРЫТАЯ ПРОВЕРКА ЛИЦЕНЗИИ
    if (!checkLicense()) {
        await addLog('ERROR', 'SYSTEM', '🔒 ЛИЦЕНЗИЯ ИСТЕКЛА! Экстренное отключение прокси');
        await emergencyDisconnect();
        
        chrome.runtime.sendMessage({
            action: 'proxyDisconnected',
            message: `🚨 ПРОКСИ НЕ ПОДКЛЮЧЕН!\n\nВремя: ${new Date().toLocaleTimeString()}\nОжидался IP: ${proxyStatus.expectedIP}\nПолучен IP: не получен\n\n🔒 ИНТЕРНЕТ ЗАБЛОКИРОВАН ДЛЯ ЗАЩИТЫ!\n\nОбратитесь к администратору для разблокировки.`,
            showRetryButton: false,
            internetBlocked: true
        }).catch(() => {});
        
        return;
    }

    const status = await checkProxyStatus(proxyStatus.expectedIP);
    const previousStatus = proxyStatus.connected;

    // console.log removed
    // console.log removed
    // console.log removed
    // console.log removed

    if (status.connected) {
        if (previousStatus !== true) {
            // Прокси только что успешно подключился
            await addLog('INFO', 'PROXY', `✅ ПРОКСИ УСПЕШНО ПОДКЛЮЧЕН! IP: ${status.ip}`);

            const currentTime = new Date().toLocaleTimeString();
            const successMessage = `ПРОКСИ ПОДКЛЮЧЕН!\n\nВремя: ${currentTime}\nIP адрес: ${status.ip}\nОжидался: ${proxyStatus.expectedIP}\n\nПодключение работает корректно!`;

            chrome.runtime.sendMessage({
                action: 'proxyConnected',
                message: successMessage,
                proxyStatus: {
                    connected: true,
                    realIP: status.ip,
                    expectedIP: proxyStatus.expectedIP,
                    lastCheck: Date.now()
                }
            }).catch(() => {});
        }
    } else {
        // Прокси не подключен или отключился
        if (previousStatus === true) {
            await addLog('ERROR', 'PROXY', `❌ ПРОКСИ ОТКЛЮЧИЛСЯ!`, {
                expected: proxyStatus.expectedIP,
                received: status.ip
            });
        }
    }

    if (status.connected) {
        // Если ранее был включен блок, снимаем его автоматически
        if (internetBlocked) {
            await unblockInternet();
            chrome.storage.sync.set({
                internetBlocked: false,
                blockReason: null,
                blockTime: null
            });
        }
        // console.log removed
    } else {
        // console.log removed

        // console.log removed
        // console.log removed
        // console.log removed
        // console.log removed

        const currentTime = new Date().toLocaleTimeString();
        const alertType = previousStatus === true ? 'ОТКЛЮЧИЛСЯ' : 'НЕ ПОДКЛЮЧЕН';
        const expectedIP = status.expectedIP || proxyStatus.expectedIP || 'неизвестен';
        const receivedIP = status.ip || 'не получен';

        await addLog('ERROR', 'PROXY', `🚨 КРИТИЧЕСКАЯ ОШИБКА: ПРОКСИ ${alertType}!`, {
            expectedIP: expectedIP,
            receivedIP: receivedIP,
            time: currentTime
        });

        // АКТИВАЦИЯ ЭКСТРЕННОГО ОТКЛЮЧЕНИЯ И БЛОКИРОВКИ ИНТЕРНЕТА
        await addLog('ERROR', 'SYSTEM', '🔒 ЭКСТРЕННАЯ БЛОКИРОВКА ИНТЕРНЕТА для защиты IP!');
        await emergencyDisconnect();

        chrome.runtime.sendMessage({
            action: 'proxyDisconnected',
            message: `🚨 ПРОКСИ ${alertType}!\n\nВремя: ${currentTime}\nОжидался IP: ${expectedIP}\nПолучен IP: ${receivedIP}\n\n🔒 ИНТЕРНЕТ ЗАБЛОКИРОВАН ДЛЯ ЗАЩИТЫ!\n\nОбратитесь к администратору для разблокировки.`,
            showRetryButton: false,
            internetBlocked: true
        }).catch(() => {});
    }

    proxyStatus.connected = status.connected;
    proxyStatus.realIP = status.ip;
    proxyStatus.lastCheck = Date.now();

    chrome.storage.sync.set({
        proxyEnabled: proxyStatus.connected,
        proxyStatus: {
            connected: proxyStatus.connected,
            realIP: proxyStatus.realIP,
            expectedIP: proxyStatus.expectedIP,
            lastCheck: proxyStatus.lastCheck
        }
    });

    // console.log removed

    chrome.runtime.sendMessage({
        action: 'proxyStatusChanged',
        proxyStatus: {
            connected: proxyStatus.connected,
            realIP: proxyStatus.realIP,
            expectedIP: proxyStatus.expectedIP,
            lastCheck: proxyStatus.lastCheck
        }
    }).catch(() => {
        // console.log removed
    });

    // console.log removed
}

// Прямое подключение к прокси с автоматической авторизацией
async function setupDirectProxy() {
    if (!PROXY_CONFIG) {
        // console.error removed
        return;
    }
    
    // Получаем текущий профиль из storage
    chrome.storage.sync.get(['currentProfile', 'profileInfo'], (result) => {
        let profileKey = result.currentProfile;
        
        // Если профиль не найден, используем первый доступный
        if (!profileKey || !PROXY_CONFIG.profiles[profileKey]) {
            profileKey = Object.keys(PROXY_CONFIG.profiles)[0];
            // console.log removed
        }
        
        const profile = PROXY_CONFIG.profiles[profileKey];
        
        // console.log removed
        // console.log removed
        // console.log removed
        // console.log removed

        isSwitching = true;
        lastSwitchAtMs = Date.now();

        // Настраиваем автоматическую авторизацию
        setupAutoAuth();
        
        // Настраиваем прокси для выбранного профиля
        setupProxy(profileKey);

        // Основная логика после настройки прокси
        setTimeout(() => {
            currentProfile = profileKey;
            isConnecting = false;
            connectionRetryCount = 0;
            isSwitching = false;

            // Получаем текущие данные авторизации, чтобы не перезаписать их
            chrome.storage.sync.get(['userType', 'currentUser', 'isAuthenticated'], async (authData) => {
                // Если пользователь уже авторизован (например, админ), сохраняем его данные
                const existingUserType = authData.userType;
                const existingCurrentUser = authData.currentUser;
                const existingIsAuthenticated = authData.isAuthenticated;
                
                // Определяем, какие данные сохранять
                let dataToSave;
                
                if (existingUserType === 'admin' && existingIsAuthenticated) {
                    // Если это админ - сохраняем админские данные
                    await addLog('INFO', 'PROXY', 'setupDirectProxy: Сохранение данных админа');
                    dataToSave = {
                        proxyEnabled: false, // Временно false до проверки IP
                        currentProfile: profileKey,
                        profileInfo: {
                            name: profile.name,
                            ip: profile.ip,
                            port: profile.port,
                            region: 'Россия'
                        },
                        isAuthenticated: true,
                        userType: 'admin',
                        currentUser: existingCurrentUser || { name: 'Администратор', ip: 'Админ', region: 'Админ', port: 'Админ' }
                    };
                } else {
                    // Для обычных пользователей или новых сессий
                    await addLog('INFO', 'PROXY', 'setupDirectProxy: Сохранение данных обычного пользователя');
                    dataToSave = {
                        proxyEnabled: false, // Временно false до проверки IP
                        currentProfile: profileKey,
                        profileInfo: {
                            name: profile.name,
                            ip: profile.ip,
                            port: profile.port,
                            region: 'Россия'
                        },
                        isAuthenticated: true,
                        userType: 'user',
                        currentUser: {
                            name: profile.name,
                            ip: profile.ip,
                            region: 'Россия'
                        }
                    };
                }
                
                // Обновляем глобальные переменные
                isAuthenticated = dataToSave.isAuthenticated;
                currentUser = dataToSave.currentUser;
                userType = dataToSave.userType;
                
                // Сохраняем в storage
                chrome.storage.sync.set(dataToSave);

                // Запускаем мониторинг прокси
                startProxyMonitoring(profile.ip);
            });
        }, 2000); // Даем время на настройку прокси
    });
}

// Автоматическое подключение при установке расширения
chrome.runtime.onInstalled.addListener(async (details) => {
    // console.log removed
    
    // Загружаем конфигурацию
    const configLoaded = await loadConfig();
    if (configLoaded) {
        // console.log removed
        // console.log removed
    } else {
        // console.error removed
    }
});

// Автоматическое подключение при запуске браузера
chrome.runtime.onStartup.addListener(async () => {
    await addLog('INFO', 'SYSTEM', '=== ЗАПУСК БРАУЗЕРА ===');
    
    // Загружаем конфигурацию
    const configLoaded = await loadConfig();
    if (configLoaded) {
        await addLog('INFO', 'SYSTEM', 'Конфигурация загружена при запуске');
        
        // Проверяем есть ли сохраненная авторизация
        chrome.storage.sync.get(['isAuthenticated', 'currentUser', 'userType'], async (result) => {
            if (!result) {
                await addLog('WARN', 'AUTH', 'Нет данных авторизации при запуске');
                return;
            }
            
            if (result.isAuthenticated) {
                await addLog('INFO', 'AUTH', `Найдена сохраненная авторизация: ${result.userType} - ${result.currentUser?.name}`);
                setupDirectProxy();
            } else {
                await addLog('INFO', 'AUTH', 'Пользователь не авторизован при запуске');
            }
        });
    } else {
        await addLog('ERROR', 'SYSTEM', 'Ошибка загрузки конфигурации при запуске');
    }
});

// Восстановление после краша или перезапуска service worker
self.addEventListener('activate', async (event) => {
    await addLog('INFO', 'SYSTEM', '=== SERVICE WORKER АКТИВИРОВАН (возможно после краша) ===');
    
    // Загружаем конфигурацию
    const configLoaded = await loadConfig();
    if (configLoaded) {
        // Восстанавливаем мониторинг
        await restoreProxyMonitoring();
        
        // Восстанавливаем глобальные переменные из storage
        const data = await chrome.storage.sync.get(['isAuthenticated', 'userType', 'currentUser', 'currentProfile']);
        if (data.isAuthenticated) {
            isAuthenticated = data.isAuthenticated;
            userType = data.userType;
            currentUser = data.currentUser;
            currentProfile = data.currentProfile;
            
            await addLog('INFO', 'SYSTEM', `Восстановлены данные: ${data.userType} - ${data.currentUser?.name}`);
        }
    }
});

// Восстановление мониторинга при инициализации расширения
async function restoreProxyMonitoring() {
    try {
        await addLog('INFO', 'SYSTEM', 'Попытка восстановления мониторинга');
        const data = await chrome.storage.sync.get(['proxyEnabled', 'currentProfile', 'proxyStatus', 'isAuthenticated']);

        if (!data) {
            await addLog('WARN', 'SYSTEM', 'Нет данных для восстановления мониторинга');
            return;
        }

        // Проверяем авторизацию
        if (data.isAuthenticated && data.proxyEnabled && data.currentProfile && data.proxyStatus && data.proxyStatus.expectedIP) {
            await addLog('INFO', 'PROXY', `Восстановление мониторинга для профиля: ${data.currentProfile}`, {
                expectedIP: data.proxyStatus.expectedIP
            });

            startProxyMonitoring(data.proxyStatus.expectedIP);
        } else {
            await addLog('INFO', 'SYSTEM', 'Условия для восстановления мониторинга не выполнены', {
                isAuthenticated: data.isAuthenticated,
                proxyEnabled: data.proxyEnabled,
                hasProfile: !!data.currentProfile
            });
        }
    } catch (error) {
        await addLog('ERROR', 'SYSTEM', 'Ошибка восстановления мониторинга', { error: error.message });
    }
}

// Вызываем восстановление мониторинга при инициализации
restoreProxyMonitoring();

// Периодическая проверка и восстановление мониторинга (защита от краша service worker)
setInterval(async () => {
    try {
        // Проверяем, должен ли быть активен мониторинг
        const data = await chrome.storage.sync.get(['isAuthenticated', 'proxyEnabled', 'currentProfile', 'proxyStatus']);
        
        if (!data) {
            return;
        }
        
        // Если пользователь авторизован и прокси должен работать, но мониторинг не запущен
        if (data.isAuthenticated && data.currentProfile && data.proxyStatus && data.proxyStatus.expectedIP) {
            // Проверяем, запущен ли мониторинг
            if (!proxyStatus.checkInterval) {
                await addLog('WARN', 'SYSTEM', 'Обнаружено отсутствие мониторинга, восстанавливаем', {
                    expectedIP: data.proxyStatus.expectedIP,
                    currentProfile: data.currentProfile
                });
                
                // Восстанавливаем мониторинг
                startProxyMonitoring(data.proxyStatus.expectedIP);
            }
        }
    } catch (error) {
        console.error('Ошибка периодической проверки мониторинга:', error);
    }
}, 60000); // Проверяем каждую минуту

// Отслеживание изменений профиля
chrome.management.onEnabled.addListener(async (info) => {
    // console.log removed
    
    // Проверяем что конфигурация загружена
    if (!PROXY_CONFIG) {
        // console.log removed
        const configLoaded = await loadConfig();
        if (!configLoaded) {
            // console.error removed
            return;
        }
    }
    
    isConnecting = false;
    connectionRetryCount = 0;
    setupDirectProxy();
});

// Отслеживание изменений в настройках прокси
chrome.proxy.onProxyError.addListener((details) => {
    const now = Date.now();
    if (isSwitching || (now - lastSwitchAtMs) < 10000) {
        // console.log removed
        return;
    }

    const ignorableErrors = [
        'net::ERR_TUNNEL_CONNECTION_FAILED',
        'net::ERR_PROXY_AUTH_UNSUPPORTED',
        'net::ERR_PROXY_CONNECTION_FAILED'
    ];

    if (ignorableErrors.includes(details.error)) {
        // console.log removed
        return;
    }

    // console.log removed

    chrome.storage.sync.get(['proxyEnabled', 'currentProfile'], (result) => {
        if (result.proxyEnabled && result.currentProfile) {
            // console.log removed
            return;
        }

        connectionRetryCount++;

        const criticalErrors = ['net::ERR_TUNNEL_CONNECTION_FAILED', 'net::ERR_PROXY_CONNECTION_FAILED'];
        const isCriticalError = criticalErrors.includes(details.error);

        if (isCriticalError && connectionRetryCount <= 3) {
            // console.log removed
            setTimeout(async () => {
                // Проверяем что конфигурация загружена
                if (!PROXY_CONFIG) {
                    // console.log removed
                    const configLoaded = await loadConfig();
                    if (!configLoaded) {
                        // console.error removed
                        return;
                    }
                }
                setupDirectProxy();
            }, 10000);
        } else if (connectionRetryCount > 3) {
            // console.log removed
            isConnecting = false;
        }
    });
});

// Сообщения от popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'authenticate') {
        // Используем асинхронную обработку
        (async () => {
            const userInfo = await authenticateUser(request.password);

            if (!userInfo) {
                sendResponse({success: false, message: 'Неверный пароль'});
                return;
            }

            await completeAuthentication(userInfo, sendResponse);
        })();
        return true;
    }

    if (request.action === 'getLogs') {
        // Получить все логи
        (async () => {
            const logs = await getAllLogs();
            sendResponse({ success: true, logs: logs });
        })();
        return true;
    }

    if (request.action === 'clearLogs') {
        // Очистить логи
        (async () => {
            await clearLogs();
            sendResponse({ success: true, message: 'Логи очищены' });
        })();
        return true;
    }

    if (request.action === 'exportLogs') {
        // Экспорт логов в текстовый формат
        (async () => {
            const logs = await getAllLogs();
            let logText = '=== ЛОГИ РАСШИРЕНИЯ ===\n\n';
            logs.forEach(log => {
                logText += `[${log.timestamp}] [${log.level}] [${log.category}] ${log.message}`;
                if (log.data) {
                    logText += `\nДанные: ${log.data}`;
                }
                logText += '\n\n';
            });
            sendResponse({ success: true, logText: logText });
        })();
        return true;
    }

    if (request.action === 'getProfileInfo') {
        chrome.storage.sync.get(['currentProfile', 'profileInfo', 'userType', 'currentUser', 'isAuthenticated', 'proxyStatus'], (result) => {
            if (!result) {
                return;
            }

            // Для админа возвращаем все доступные профили
            let availableProfiles = [];
            if (result.userType === 'admin' && PROXY_CONFIG) {
                availableProfiles = Object.keys(PROXY_CONFIG.profiles).map(key => ({
                    key,
                    name: PROXY_CONFIG.profiles[key].name,
                    ip: PROXY_CONFIG.profiles[key].ip,
                    port: PROXY_CONFIG.profiles[key].port,
                    region: PROXY_CONFIG.profiles[key].region
                }));
            }

            sendResponse({
                currentProfile: result.currentProfile,
                profileInfo: result.profileInfo,
                isAuthenticated: result.isAuthenticated,
                userType: result.userType,
                userName: result.currentUser?.name,
                availableProfiles: availableProfiles,
                proxyStatus: result.proxyStatus || {connected: false, realIP: null, expectedIP: null},
            });
        });
        return true;
    }

    if (request.action === 'autoConnect') {
        if (!isAuthenticated) {
            sendResponse({success: false, message: 'Требуется авторизация'});
            return;
        }

        if (!PROXY_CONFIG) {
            sendResponse({success: false, message: 'Конфигурация не загружена'});
            return;
        }

        // console.log removed
        setupDirectProxy();
        sendResponse({success: true, message: 'Автоматическое подключение запущено'});
        return true;
    }

    if (request.action === 'switchProfile') {
        if (!isAuthenticated) {
            sendResponse({success: false, message: 'Требуется авторизация'});
            return true;
        }

        if (!PROXY_CONFIG) {
            sendResponse({success: false, message: 'Конфигурация не загружена'});
            return true;
        }

        // Используем асинхронную обработку
        (async () => {
            await switchProfile(request.profileKey);
            sendResponse({success: true, message: `Переключен на ${request.profileKey}`});
        })();
        return true;
    }

    if (request.action === 'getProfiles') {
        if (!PROXY_CONFIG) {
            sendResponse({
                success: false,
                message: 'Конфигурация не загружена'
            });
            return true;
        }
        
        const profiles = Object.keys(PROXY_CONFIG.profiles).map(key => ({
            key,
            name: PROXY_CONFIG.profiles[key].name,
            ip: PROXY_CONFIG.profiles[key].ip,
            port: PROXY_CONFIG.profiles[key].port
        }));

        sendResponse({
            success: true,
            profiles: profiles,
            currentProfile: currentProfile
        });
        return true;
    }

    if (request.action === 'toggleProxy') {
        if (!isAuthenticated) {
            sendResponse({success: false, message: 'Требуется авторизация'});
            return;
        }

        if (request.enabled) {
            setupDirectProxy();
            sendResponse({success: true, message: 'Прокси включен'});
        } else {
            chrome.proxy.settings.clear({scope: 'regular'}, () => {
                // console.log removed
                chrome.storage.sync.set({proxyEnabled: false});
                sendResponse({success: true, message: 'Прокси отключен'});
            });
        }
        return true;
    }

    if (request.action === 'retryConnection') {
        // console.log removed

        isConnecting = false;
        connectionRetryCount = 0;
        lastConnectionAttempt = 0;

        setupDirectProxy();
        sendResponse({success: true, message: 'Попытка переподключения запущена'});
        return true;
    }

    if (request.action === 'unblockInternet') {
        // console.log removed
        
        // Проверяем права администратора
        if (userType !== 'admin') {
            sendResponse({success: false, message: 'Недостаточно прав для разблокировки'});
            return true;
        }
        
        // Разблокируем интернет асинхронно
        unblockInternet().then(() => {
            // Обновляем статус в storage
            chrome.storage.sync.set({
                internetBlocked: false,
                blockReason: null,
                blockTime: null
            });
            
            sendResponse({success: true, message: 'Интернет разблокирован администратором'});
        }).catch((error) => {
            // console.error removed
            sendResponse({success: false, message: 'Ошибка разблокировки: ' + error.message});
        });
        
        return true; // Указываем что ответ будет асинхронным
    }

    if (request.action === 'logout') {
        (async () => {
            chrome.storage.sync.get(['currentProfile', 'currentUser'], async (result) => {
                const profileToRelease = result.currentProfile;
                const userName = result.currentUser?.name || 'unknown';

                await addLog('AUTH', 'LOGOUT', `Выход пользователя: ${userName}`, { profile: profileToRelease });

                isAuthenticated = false;
                currentUser = null;
                userType = null;
                currentProfile = null;
                isConnecting = false;
                connectionRetryCount = 0;
                lastConnectionAttempt = 0;

                // Останавливаем мониторинг прокси
                stopProxyMonitoring();

                // Отключаем прокси в браузере
                chrome.proxy.settings.clear({scope: 'regular'}, async () => {
                    await addLog('INFO', 'PROXY', 'Прокси отключен');
                    
                    // Снимаем возможную блокировку интернета
                    await unblockInternet();
                    chrome.storage.sync.set({
                        internetBlocked: false,
                        blockReason: null,
                        blockTime: null
                    });

                    // Обновляем статус в storage
                    chrome.storage.sync.set({
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
                });

                // Очищаем все данные (кроме логов)
                chrome.storage.sync.clear();
                await addLog('INFO', 'AUTH', 'Storage очищен после выхода');
            });

            sendResponse({success: true, message: 'Выход выполнен, прокси отключен'});
        })();
        return true;
    }
});

// Функция завершения авторизации
async function completeAuthentication(userInfo, sendResponse) {
    isAuthenticated = true;
    currentUser = userInfo.user;
    userType = userInfo.type;

    isConnecting = false;
    connectionRetryCount = 0;

    await addLog('AUTH', 'AUTH', `Завершение авторизации для: ${userInfo.user.name}`, {
        userType: userInfo.type,
        profileKey: userInfo.profileKey
    });

    // Для админа очищаем выбранный профиль, чтобы всегда показывать админский интерфейс
    if (userInfo.type === 'admin') {
        currentProfile = null;
        chrome.storage.sync.remove(['currentProfile', 'profileInfo'], async () => {
            chrome.storage.sync.set({
                isAuthenticated: true,
                userType: 'admin',
                currentUser: {
                    name: 'Администратор',
                    ip: 'Админ',
                    region: 'Админ',
                    port: 'Админ'
                },
                currentProfile: null, // Админ не имеет предустановленного профиля
                profileInfo: null
            }, async () => {
                await addLog('INFO', 'AUTH', 'Данные авторизации администратора сохранены в storage');
                await addLog('INFO', 'AUTH', 'Администратор - автоподключение пропущено');
            });
        });
    } else {
        // Для обычных пользователей сохраняем их профиль
        currentProfile = userInfo.profileKey;
        chrome.storage.sync.remove(['currentProfile', 'profileInfo'], async () => {
            chrome.storage.sync.set({
                isAuthenticated: true,
                userType: userInfo.type,
                currentUser: userInfo.user,
                currentProfile: userInfo.profileKey,
                profileInfo: {
                    name: userInfo.user.name,
                    ip: userInfo.user.ip,
                    port: userInfo.user.port,
                    region: userInfo.user.region
                }
            }, async () => {
                await addLog('INFO', 'AUTH', 'Данные авторизации сохранены в storage');
                await addLog('INFO', 'PROXY', `Запуск автоподключения прокси для: ${userInfo.user.name}`);
                setTimeout(() => {
                    setupDirectProxy(); // Принудительное подключение после авторизации
                }, 1000);
            });
        });
    }

    sendResponse({
        success: true,
        message: `Авторизация успешна. Добро пожаловать, ${userInfo.user.name}!`,
        userType: userInfo.type,
        userName: userInfo.user.name
    });
}

// Освобождение профиля при закрытии браузера
chrome.runtime.onSuspend.addListener(async () => {
    // console.log removed

    // Останавливаем мониторинг
    stopProxyMonitoring();

    // Отключаем прокси
    chrome.proxy.settings.clear({scope: 'regular'}, async () => {
        // console.log removed
        // Снимаем возможную блокировку интернета
        await unblockInternet();
        chrome.storage.sync.set({
            internetBlocked: false,
            blockReason: null,
            blockTime: null
        });
    });

    const data = await chrome.storage.sync.get(['currentProfile']);
    if (data.currentProfile) {
        // console.log removed
    }
});

// Инициализация при загрузке
(async () => {
    // console.log removed
    // console.log removed
    
    // Загружаем конфигурацию
    const configLoaded = await loadConfig();
    if (configLoaded) {
        // console.log removed
        
        // Проверяем есть ли сохраненная авторизация
        chrome.storage.sync.get(['isAuthenticated'], (result) => {
            if (!result) {
                return;
            }
            
            if (result.isAuthenticated) {
                // console.log removed
                setupDirectProxy();
            } else {
                // console.log removed
            }
        });
    } else {
        // console.error removed
    }
})();
