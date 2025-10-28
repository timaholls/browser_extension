// Встроенная конфигурация прокси
const EMBEDDED_CONFIG = {
  "profiles": {
    "user1": {
      "name": "Profile 1",
      "proxy": {
        "host": "195.158.255.144",
        "port": 60341,
        "username": "pD3eAehGmG",
        "password": "M2E7nVW38B"
      },
      "ip": "195.158.255.144",
      "region": "Россия"
    },
    "user2": {
      "name": "Profile 2",
      "proxy": {
        "host": "46.161.31.183",
        "port": 60888,
        "username": "4tS4WbbJfG",
        "password": "ZGVZFcKweB"
      },
      "ip": "46.161.31.183",
      "region": "Россия"
    },
    "user3": {
      "name": "Profile 3",
      "proxy": {
        "host": "5.8.16.192",
        "port": 60345,
        "username": "8ahPNVHTnC",
        "password": "7g7ZNvRCZ3"
      },
      "ip": "5.8.16.192",
      "region": "Россия"
    },
    "user4": {
      "name": "Profile 4",
      "proxy": {
        "host": "194.226.247.32",
        "port": 62498,
        "username": "U6W2kspYF6",
        "password": "V7bQPtwG5N"
      },
      "ip": "194.226.247.32",
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
    "installDate": "2025-10-28T09:35:50+05:00",
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
        // console.log removed
        // console.log removed
        
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
        
        // console.log removed
        
        // console.log removed
        return true;
    } catch (error) {
        // console.error removed
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
function switchProfile(profileKey) {
    // console.log removed
    
    if (!PROXY_CONFIG.profiles[profileKey]) {
        // Используем первый доступный профиль
        const firstProfileKey = Object.keys(PROXY_CONFIG.profiles)[0];
        // console.log removed
        profileKey = firstProfileKey;
    }
    
    const profile = PROXY_CONFIG.profiles[profileKey];
    
    // Настраиваем автоматическую авторизацию
    setupAutoAuth();
    
    // Настраиваем прокси для выбранного профиля
    setupProxy(profileKey);
    
    // Обновляем текущий профиль
    currentProfile = profileKey;
    
    // Сохраняем в storage
    chrome.storage.local.set({
        currentProfile: profileKey,
        profileInfo: {
            name: profile.name,
            ip: profile.ip,
            port: profile.port,
            region: 'Россия'
        }
    });
    
    // console.log removed
    
    // Запускаем мониторинг для админа тоже
    // console.log removed
    // console.log removed
    // console.log removed
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
        
        // Создаем правило блокировки всех запросов
        const blockRule = {
            id: 1,
            priority: 1,
            action: {
                type: 'block'
            },
            condition: {
                urlFilter: '*',
                resourceTypes: ['main_frame', 'sub_frame', 'stylesheet', 'script', 'image', 'font', 'object', 'xmlhttprequest', 'ping', 'csp_report', 'media', 'websocket', 'other']
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
    chrome.storage.local.set({
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
function authenticateUser(password) {
    // console.log removed
    // console.log removed
    // console.log removed
    
    if (!PROXY_CONFIG) {
        // console.error removed
        return null;
    }
    
    // Проверяем админскую учетку
    if (password === 'admin123') {
        // console.log removed
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
        // console.log removed
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
    
    // console.log removed
    return null;
}

// Автоматическое подключение для авторизованных пользователей
function autoConnectUser(userAccount) {
    // console.log removed
    // console.log removed

    // Проверяем, не подключен ли уже этот пользователь
    chrome.storage.local.get(['currentProfile', 'proxyEnabled'], (result) => {
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
function setupAutoProxy(force = false) {
    const now = Date.now();
    const minInterval = 10000; // Минимальный интервал между попытками подключения (10 секунд)

    // Проверяем, не слишком ли часто вызывается функция
    if (!force && (now - lastConnectionAttempt) < minInterval) {
        // console.log removed
        return;
    }

    // Проверяем, не идет ли уже подключение
    if (isConnecting && !force) {
        // console.log removed
        return;
    }

    // console.log removed
    lastConnectionAttempt = now;
    isConnecting = true;

    // Проверяем авторизацию
    chrome.storage.local.get(['isAuthenticated', 'userType', 'currentUser', 'authTime'], (result) => {
        // console.log removed

        // Проверяем валидность сессии
        if (!result) {
            isConnecting = false;
            return;
        }
        
        const now = Date.now();
        const authTime = result.authTime || 0;
        const sessionTimeout = 24 * 60 * 60 * 1000; // 24 часа

        if (!result.isAuthenticated || (now - authTime) >= sessionTimeout) {
            // console.log removed
            isConnecting = false;
            return;
        }

        // Если это обычный пользователь - автоматически подключаем его IP
        if (result.userType === 'user' && result.currentUser) {
            // console.log removed
            autoConnectUser(result.currentUser);
            return;
        }

        isConnecting = false;
    });

    // console.log removed
}

// Функция для проверки реального IP
async function checkRealIP() {
    const apis = [
        'https://api.ipify.org?format=json'
    ];

    for (let i = 0; i < apis.length; i++) {
        try {
            // console.log removed

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
                // console.log removed
                continue;
            }

            const data = await response.json();
            // console.log removed

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
                // console.log removed
                return ip;
            } else {
                // console.log removed
            }
        } catch (e) {
            // console.log removed
            continue;
        }
    }

    // console.log removed
    return null;
}

// Функция для проверки статуса прокси
async function checkProxyStatus(expectedIP) {
    try {
        // console.log removed
        // console.log removed
        // console.log removed

        // В режиме тестирования пропускаем проверку IP
        if (!PRODUCTION_MODE) {
            // console.log removed
            return {connected: true, ip: 'test_ip', reason: 'Тестовый режим'};
        }

        const realIP = await checkRealIP();
        if (!realIP) {
            // console.log removed
            return {connected: false, ip: null, reason: 'Не удалось получить IP'};
        }

        // console.log removed
        // console.log removed
        // console.log removed
        // console.log removed

        if (realIP === expectedIP) {
            // console.log removed
            return {connected: true, ip: realIP};
        } else {
            // console.log removed
            return {
                connected: false,
                ip: realIP,
                expectedIP: expectedIP,
                reason: `IP не совпадает. Ожидался: ${expectedIP}, получен: ${realIP}`
            };
        }
    } catch (e) {
        // console.log removed
        return {connected: false, ip: null, reason: 'Ошибка проверки'};
    }
}

// Функция для запуска периодической проверки прокси
function startProxyMonitoring(expectedIP) {
    stopProxyMonitoring();

    proxyStatus.expectedIP = expectedIP;
    proxyStatus.connected = false;

    // console.log removed
    // console.log removed

    // В режиме тестирования сразу считаем прокси подключенным
    if (!PRODUCTION_MODE) {
        // console.log removed
        proxyStatus.connected = true;
        proxyStatus.realIP = 'test_ip';
        
        chrome.storage.local.set({
            proxyEnabled: true,
            proxyStatus: {
                connected: true,
                realIP: 'test_ip',
                expectedIP: expectedIP,
                lastCheck: Date.now()
            }
        });

        // Убираем первое уведомление, оставляем только второе с IP
        // console.log removed

        return;
    }

    // console.log removed

    setTimeout(async () => {
        // console.log removed
        await performProxyCheck();
    }, 5000);

    proxyStatus.checkInterval = setInterval(async () => {
        // console.log removed
        await performProxyCheck();
    }, 15000);
    
    // console.log removed
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
        // console.log removed
        await emergencyDisconnect();
        
        chrome.runtime.sendMessage({
            action: 'proxyDisconnected',
            message: `🚨 ПРОКСИ НЕ ПОДКЛЮЧЕН!\n\nВремя: ${new Date().toLocaleTimeString()}\nОжидался IP: ${proxyStatus.expectedIP}\nПолучен IP: не получен\n\n🔒 ИНТЕРНЕТ ЗАБЛОКИРОВАН ДЛЯ ЗАЩИТЫ!\n\nОбратитесь к администратору для разблокировки.`,
            showRetryButton: false,
            internetBlocked: true
        }).catch(() => {
            // console.log removed
        });
        
        return;
    }

    const status = await checkProxyStatus(proxyStatus.expectedIP);
    const previousStatus = proxyStatus.connected;

    // console.log removed
    // console.log removed
    // console.log removed
    // console.log removed

    if (status.connected) {
        // console.log removed

        if (previousStatus !== true) {
            // console.log removed

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
            }).catch(() => {
                // console.log removed
            });

            // console.log removed
            // console.log removed
            // console.log removed
            // console.log removed
            
            // Автоматически переподключаемся при восстановлении
            // console.log removed
            setTimeout(() => {
                setupDirectProxy();
            }, 2000);
            // console.log removed
        } else {
            // console.log removed
        }
    } else {
        // console.log removed
    }

    if (status.connected) {
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

        // console.log removed
        // console.log removed
        // console.log removed
        // console.log removed
        // console.log removed

        // АКТИВАЦИЯ ЭКСТРЕННОГО ОТКЛЮЧЕНИЯ И БЛОКИРОВКИ ИНТЕРНЕТА
        await emergencyDisconnect();

        chrome.runtime.sendMessage({
            action: 'proxyDisconnected',
            message: `🚨 ПРОКСИ ${alertType}!\n\nВремя: ${currentTime}\nОжидался IP: ${expectedIP}\nПолучен IP: ${receivedIP}\n\n🔒 ИНТЕРНЕТ ЗАБЛОКИРОВАН ДЛЯ ЗАЩИТЫ!\n\nОбратитесь к администратору для разблокировки.`,
            showRetryButton: false,
            internetBlocked: true
        }).catch(() => {
            // console.log removed
        });

        // console.error removed
        // console.error removed
        // console.error removed
        // console.error removed
        // console.error removed
    }

    proxyStatus.connected = status.connected;
    proxyStatus.realIP = status.ip;
    proxyStatus.lastCheck = Date.now();

    chrome.storage.local.set({
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
    chrome.storage.local.get(['currentProfile', 'profileInfo'], (result) => {
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
            // console.log removed
            // console.log removed

            currentProfile = profileKey;
            isConnecting = false;
            connectionRetryCount = 0;
            isSwitching = false;

            // Автоматически считаем пользователя авторизованным
            isAuthenticated = true;
            currentUser = {
                name: profile.name,
                ip: profile.ip,
                region: 'Россия'
            };
            userType = 'user';

            chrome.storage.local.set({
                proxyEnabled: false, // Временно false до проверки IP
                currentProfile: profileKey,
                profileInfo: {
                    name: profile.name,
                    ip: profile.ip,
                    port: profile.port,
                    region: 'Россия'
                },
                isAuthenticated: true,
                authTime: Date.now(),
                userType: 'user',
                currentUser: {
                    name: profile.name,
                    ip: profile.ip,
                    region: 'Россия'
                }
        });

            // console.log removed
            // console.log removed

            // Запускаем мониторинг прокси
            // console.log removed
            // console.log removed
            startProxyMonitoring(profile.ip);
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
    // console.log removed
    
    // Загружаем конфигурацию
    const configLoaded = await loadConfig();
    if (configLoaded) {
        // console.log removed
        
        // Проверяем есть ли сохраненная авторизация
        chrome.storage.local.get(['isAuthenticated', 'authTime'], (result) => {
            if (!result) {
                return;
            }
            
            const now = Date.now();
            const authTime = result.authTime || 0;
            const sessionTimeout = 24 * 60 * 60 * 1000; // 24 часа
            const isAuthValid = !!(result.isAuthenticated && (now - authTime) < sessionTimeout);
            
            if (isAuthValid) {
                // console.log removed
                setupDirectProxy();
            } else {
                // console.log removed
            }
        });
    } else {
        // console.error removed
    }
});

// Восстановление мониторинга при инициализации расширения
async function restoreProxyMonitoring() {
    try {
        const data = await chrome.storage.local.get(['proxyEnabled', 'currentProfile', 'proxyStatus', 'isAuthenticated', 'authTime']);

        if (!data) {
            return;
        }

        // Проверяем авторизацию
        const now = Date.now();
        const authTime = data.authTime || 0;
        const sessionTimeout = 24 * 60 * 60 * 1000; // 24 часа
        const isAuthValid = !!(data.isAuthenticated && (now - authTime) < sessionTimeout);

        if (isAuthValid && data.proxyEnabled && data.currentProfile && data.proxyStatus && data.proxyStatus.expectedIP) {
            // console.log removed
            // console.log removed
            // console.log removed

            startProxyMonitoring(data.proxyStatus.expectedIP);
        } else {
            // console.log removed
        }
    } catch (error) {
        // console.log removed
    }
}

// Вызываем восстановление мониторинга при инициализации
restoreProxyMonitoring();

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

    chrome.storage.local.get(['proxyEnabled', 'currentProfile'], (result) => {
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
        // console.log removed
        // console.log removed
        
        const userInfo = authenticateUser(request.password);
        // console.log removed

        if (!userInfo) {
            // console.log removed
            sendResponse({success: false, message: 'Неверный пароль'});
            return true;
        }

        // console.log removed

        completeAuthentication(userInfo, sendResponse);
        return true;
    }

    if (request.action === 'getProfileInfo') {
        chrome.storage.local.get(['currentProfile', 'profileInfo', 'userType', 'currentUser', 'isAuthenticated', 'authTime', 'proxyStatus'], (result) => {
            if (!result) {
                return;
            }
            
            const nowTs = Date.now();
            const authTime = result.authTime || 0;
            const sessionTimeout = 24 * 60 * 60 * 1000; // 24 часа
            const isAuthValid = !!(result.isAuthenticated && (nowTs - authTime) < sessionTimeout);

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
                isAuthenticated: isAuthValid,
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
            return;
        }

        if (!PROXY_CONFIG) {
            sendResponse({success: false, message: 'Конфигурация не загружена'});
            return;
        }

        // console.log removed
        switchProfile(request.profileKey);
        sendResponse({success: true, message: `Переключен на ${request.profileKey}`});
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
                chrome.storage.local.set({proxyEnabled: false});
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
            chrome.storage.local.set({
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
        chrome.storage.local.get(['currentProfile'], async (result) => {
            const profileToRelease = result.currentProfile;

            // console.log removed

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
            chrome.proxy.settings.clear({scope: 'regular'}, () => {
                // console.log removed
                
                // Обновляем статус в storage
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

                // Уведомление об отключении отправит мониторинг
                // console.log removed
            });

            // Очищаем все данные
            chrome.storage.local.clear();
        });

        sendResponse({success: true, message: 'Выход выполнен, прокси отключен'});
        return true;
    }
});

// Функция завершения авторизации
function completeAuthentication(userInfo, sendResponse) {
    isAuthenticated = true;
    currentUser = userInfo.user;
    userType = userInfo.type;
    currentProfile = userInfo.profileKey;

    isConnecting = false;
    connectionRetryCount = 0;

    chrome.storage.local.remove(['currentProfile', 'profileInfo'], () => {
        chrome.storage.local.set({
            isAuthenticated: true,
            authTime: Date.now(),
            userType: userInfo.type,
            currentUser: userInfo.user,
            currentProfile: userInfo.profileKey,
            profileInfo: {
                name: userInfo.user.name,
                ip: userInfo.user.ip,
                port: userInfo.user.port,
                region: userInfo.user.region
            }
        }, () => {
            // console.log removed
            // console.log removed

            // Автоматически подключаем прокси только для обычных пользователей
            if (userInfo.type === 'user') {
                setTimeout(() => {
                    // console.log removed
                    setupDirectProxy(); // Принудительное подключение после авторизации
                }, 1000);
            } else {
                // console.log removed
            }
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
    // console.log removed

    // Останавливаем мониторинг
    stopProxyMonitoring();

    // Отключаем прокси
    chrome.proxy.settings.clear({scope: 'regular'}, () => {
        // console.log removed
    });

    const data = await chrome.storage.local.get(['currentProfile']);
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
        chrome.storage.local.get(['isAuthenticated', 'authTime'], (result) => {
            if (!result) {
                return;
            }
            
            const now = Date.now();
            const authTime = result.authTime || 0;
            const sessionTimeout = 24 * 60 * 60 * 1000; // 24 часа
            const isAuthValid = !!(result.isAuthenticated && (now - authTime) < sessionTimeout);
            
            if (isAuthValid) {
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
