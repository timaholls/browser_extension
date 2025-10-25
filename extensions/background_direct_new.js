// Флаг режима работы
const PRODUCTION_MODE = false; // true = продакшен, false = тестирование

// Конфигурация прокси (загружается из config.json)
let PROXY_CONFIG = null;

// Загрузка конфигурации из JSON файла
async function loadConfig() {
    try {
        console.log('=== ЗАГРУЗКА КОНФИГУРАЦИИ ===');
        const response = await fetch(chrome.runtime.getURL('config.json'));
        console.log('Ответ от config.json:', response);
        const config = await response.json();
        console.log('Загруженная конфигурация:', config);
        
        // Преобразуем конфигурацию в нужный формат
        const firstProfileKey = Object.keys(config.profiles)[0];
        const firstProfile = config.profiles[firstProfileKey];
        
        PROXY_CONFIG = {
            proxy: firstProfile.proxy, // Основной прокси (первый профиль)
            profiles: {}
        };
        
        // Преобразуем профили
        Object.keys(config.profiles).forEach(key => {
            const profile = config.profiles[key];
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
        
        console.log('Загруженные профили:', PROXY_CONFIG.profiles);
        
        console.log('Конфигурация загружена:', PROXY_CONFIG);
        return true;
    } catch (error) {
        console.error('Ошибка загрузки конфигурации:', error);
        return false;
    }
}

// Автоматическая авторизация через webRequestAuthProvider
function setupAutoAuth() {
    console.log('Настройка автоматической авторизации через webRequestAuthProvider...');
    
    chrome.webRequest.onAuthRequired.addListener(
        function(details, callbackFn) {
            console.log('Перехват запроса авторизации:', details);
            
            // Проверяем что конфигурация загружена
            if (!PROXY_CONFIG) {
                console.error('Конфигурация не загружена!');
                callbackFn({});
                return;
            }
            
            // Определяем профиль по порту
            const port = details.challenger?.port;
            let credentials = null;
            
            // Динамически ищем профиль по порту
            let foundProfile = null;
            let foundProfileKey = null;
            
            console.log(`Ищем профиль для порта: ${port}`);
            console.log('Доступные профили:', Object.keys(PROXY_CONFIG.profiles));
            
            for (const [key, profile] of Object.entries(PROXY_CONFIG.profiles)) {
                console.log(`Проверяем профиль ${key}: порт ${profile.port}`);
                if (profile.port === port) {
                    foundProfile = profile;
                    foundProfileKey = key;
                    console.log(`✅ Найден профиль ${key} для порта ${port}`);
                    break;
                }
            }
            
            if (foundProfile) {
                credentials = {
                    username: foundProfile.username,
                    password: foundProfile.password
                };
                console.log(`Авторизация для ${foundProfile.name} (порт ${port})`);
            } else {
                // Fallback на основной профиль
                credentials = {
                    username: PROXY_CONFIG.proxy.username,
                    password: PROXY_CONFIG.proxy.password
                };
                console.log(`Профиль для порта ${port} не найден, используем основной профиль`);
            }
            
            console.log('Подставляем учетные данные:', credentials.username);
            console.log('Полные учетные данные:', credentials);
            callbackFn({ authCredentials: credentials });
        },
        { urls: ["<all_urls>"] },
        ['asyncBlocking']
    );
    
    console.log('Автоматическая авторизация настроена для всех профилей');
}

// Настройка прокси через fixed_servers
function setupProxy(profileKey = null) {
    // Если профиль не указан, используем первый доступный
    if (!profileKey) {
        profileKey = Object.keys(PROXY_CONFIG.profiles)[0];
    }
    
    console.log(`Настройка прокси через fixed_servers для ${profileKey}...`);
    
    const profile = PROXY_CONFIG.profiles[profileKey];
    
    if (!profile) {
        console.error(`Профиль ${profileKey} не найден`);
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
        console.log(`Прокси настроен через fixed_servers для ${profileKey}`);
        console.log(`Прокси: ${profile.host}:${profile.port}`);
        console.log(`Профиль: ${profile.name} (${profile.ip})`);
        console.log(`Учетные данные: ${profile.username}:${profile.password}`);
        
        // Проверяем настройку прокси
        chrome.proxy.settings.get({}, (config) => {
            console.log('Текущие настройки прокси:', config);
        });
    });
}

// Переключение между профилями
function switchProfile(profileKey) {
    console.log(`Переключение на профиль: ${profileKey}`);
    
    if (!PROXY_CONFIG.profiles[profileKey]) {
        // Используем первый доступный профиль
        const firstProfileKey = Object.keys(PROXY_CONFIG.profiles)[0];
        console.log(`Профиль ${profileKey} не найден, используем ${firstProfileKey}`);
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
    
    console.log(`Переключен на профиль: ${profile.name} (${profile.ip})`);
    
    // Запускаем мониторинг для админа тоже
    console.log(`Запуск мониторинга для админа`);
    console.log(`Ожидаемый IP для мониторинга: ${profile.ip}`);
    console.log(`Режим: ${PRODUCTION_MODE ? 'ПРОДАКШЕН' : 'ТЕСТИРОВАНИЕ'}`);
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

// Статус прокси
let proxyStatus = {
    connected: false,
    realIP: null,
    expectedIP: null,
    lastCheck: 0,
    checkInterval: null
};

// Динамическая авторизация с выбором профиля по паролю
function authenticateUser(password) {
    console.log('=== ОТЛАДКА АВТОРИЗАЦИИ ===');
    console.log('Введенный пароль:', password);
    console.log('PROXY_CONFIG загружена:', !!PROXY_CONFIG);
    
    if (!PROXY_CONFIG) {
        console.error('Конфигурация не загружена');
        return null;
    }
    
    // Проверяем админскую учетку
    if (password === 'admin123') {
        console.log(`Админская авторизация: ${password}`);
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
        console.log(`Найден профиль для пароля: ${password} -> ${selectedProfile.name}`);
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
    
    console.log(`Профиль для пароля "${password}" не найден`);
    return null;
}

// Автоматическое подключение для авторизованных пользователей
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
        setupDirectProxy();
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

        isConnecting = false;
    });

    console.log('=== КОНЕЦ АВТОПОДКЛЮЧЕНИЯ ===');
}

// Функция для проверки реального IP
async function checkRealIP() {
    const apis = [
        'https://api.ipify.org?format=json'
    ];

    for (let i = 0; i < apis.length; i++) {
        try {
            console.log(`Проверка IP через API ${i + 1}/${apis.length}: ${apis[i]}`);

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
                console.log(`API ${i + 1} вернул ошибку: ${response.status} ${response.statusText}`);
                continue;
            }

            const data = await response.json();
            console.log(`API ${i + 1} ответ получен: ${JSON.stringify(data)}`);

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
                console.log(`Реальный IP адрес получен: ${ip}`);
                return ip;
            } else {
                console.log(`API ${i + 1}: IP не найден или невалиден в ответе`);
            }
        } catch (e) {
            console.log(`API ${i + 1} ошибка:`, e.name, e.message);
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
        console.log(`Режим: ${PRODUCTION_MODE ? 'ПРОДАКШЕН' : 'ТЕСТИРОВАНИЕ'}`);
        console.log(`Ожидаемый IP: ${expectedIP}`);

        // В режиме тестирования пропускаем проверку IP
        if (!PRODUCTION_MODE) {
            console.log(`[ТЕСТИРОВАНИЕ] Пропускаем проверку IP - считаем прокси подключенным`);
            return {connected: true, ip: 'test_ip', reason: 'Тестовый режим'};
        }

        const realIP = await checkRealIP();
        if (!realIP) {
            console.log(`Не удалось получить реальный IP`);
            return {connected: false, ip: null, reason: 'Не удалось получить IP'};
        }

        console.log(`Сравнение IP адресов:`);
        console.log(`   Ожидаемый: ${expectedIP}`);
        console.log(`   Реальный:  ${realIP}`);
        console.log(`   Совпадают: ${realIP === expectedIP ? 'ДА' : 'НЕТ'}`);

        if (realIP === expectedIP) {
            console.log(`Прокси работает корректно! IP совпадает.`);
            return {connected: true, ip: realIP};
        } else {
            console.log(`Прокси не работает! IP не совпадает.`);
            return {
                connected: false,
                ip: realIP,
                expectedIP: expectedIP,
                reason: `IP не совпадает. Ожидался: ${expectedIP}, получен: ${realIP}`
            };
        }
    } catch (e) {
        console.log('Ошибка проверки статуса прокси:', e);
        return {connected: false, ip: null, reason: 'Ошибка проверки'};
    }
}

// Функция для запуска периодической проверки прокси
function startProxyMonitoring(expectedIP) {
    stopProxyMonitoring();

    proxyStatus.expectedIP = expectedIP;
    proxyStatus.connected = false;

    console.log(`Запуск мониторинга прокси для IP: ${expectedIP}`);
    console.log(`Режим: ${PRODUCTION_MODE ? 'ПРОДАКШЕН' : 'ТЕСТИРОВАНИЕ'}`);

    // В режиме тестирования сразу считаем прокси подключенным
    if (!PRODUCTION_MODE) {
        console.log(`[ТЕСТИРОВАНИЕ] Сразу устанавливаем прокси как подключенный`);
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
        console.log(`[ТЕСТИРОВАНИЕ] Прокси подключен в тестовом режиме`);

        return;
    }

    console.log(`Первая проверка через 5 секунд...`);

    setTimeout(async () => {
        console.log(`⏰ Время первой проверки наступило!`);
        await performProxyCheck();
    }, 5000);

    proxyStatus.checkInterval = setInterval(async () => {
        console.log(`⏰ Время периодической проверки наступило!`);
        await performProxyCheck();
    }, 60000);
    
    console.log(`✅ Мониторинг запущен! Интервал: 60 секунд`);
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
    
    // Проверяем что мониторинг еще активен
    if (!proxyStatus.checkInterval) {
        console.log(`Мониторинг остановлен, пропускаем проверку`);
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

    if (status.connected) {
        console.log(`ПРОКСИ ПОДКЛЮЧЕН! Устанавливаем proxyEnabled: true`);

        if (previousStatus !== true) {
            console.log(`Статус изменился: был не подключен, стал подключен - показываем уведомления`);

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
                console.log(`Popup не открыт, уведомление об успехе не отправлено`);
            });

            console.log(`ПРОКСИ УСПЕШНО ПОДКЛЮЧЕН!`);
            console.log(`Время: ${currentTime}`);
            console.log(`IP адрес: ${status.ip}`);
            console.log(`Ожидался: ${proxyStatus.expectedIP}`);
            
            // Автоматически переподключаемся при восстановлении
            console.log(`Автоматическое переподключение при восстановлении прокси...`);
            setTimeout(() => {
                setupDirectProxy();
            }, 2000);
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

        console.log(`IP не совпадает! Показываем уведомление пользователю`);
        console.log(`Детали несовпадения:`);
        console.log(`   Предыдущий статус: ${previousStatus ? 'подключен' : 'не подключен'}`);
        console.log(`   Текущий статус: не подключен`);

        const currentTime = new Date().toLocaleTimeString();
        const alertType = previousStatus === true ? 'ОТКЛЮЧИЛСЯ' : 'НЕ ПОДКЛЮЧЕН';
        const expectedIP = status.expectedIP || proxyStatus.expectedIP || 'неизвестен';
        const receivedIP = status.ip || 'не получен';

        console.log(`ПРОКСИ ${alertType}!`);
        console.log(`   Время: ${currentTime}`);
        console.log(`   Ожидался: ${expectedIP}`);
        console.log(`   Получен: ${receivedIP}`);
        console.log(`   Проверьте подключение!`);

        chrome.runtime.sendMessage({
            action: 'proxyDisconnected',
            message: `ПРОКСИ ${alertType}!\n\nВремя: ${currentTime}\nОжидался IP: ${expectedIP}\nПолучен IP: ${receivedIP}\n\nПроверьте подключение к интернету и настройки прокси.`,
            showRetryButton: true
        }).catch(() => {
            console.log(`Popup не открыт, уведомление не отправлено`);
        });

        console.error(`КРИТИЧЕСКАЯ ОШИБКА ПРОКСИ!`);
        console.error(`Время: ${currentTime}`);
        console.error(`Ожидался IP: ${expectedIP}`);
        console.error(`Получен IP: ${receivedIP}`);
        console.error(`Прокси отключен! Проверьте подключение!`);

        console.log(`ОТКЛЮЧАЕМ ПРОКСИ из-за несовпадения IP!`);

        chrome.proxy.settings.clear({scope: 'regular'}, () => {
            console.log(`Прокси отключен из-за ошибки проверки IP`);
        });

        // НЕ останавливаем мониторинг - продолжаем проверки каждые 60 секунд
        console.log(`Мониторинг продолжается - следующая проверка через 60 секунд`);

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

    console.log(`Статус сохранен в storage: connected=${proxyStatus.connected}, realIP=${proxyStatus.realIP}`);

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

// Прямое подключение к прокси с автоматической авторизацией
async function setupDirectProxy() {
    if (!PROXY_CONFIG) {
        console.error('Конфигурация не загружена, пропускаем подключение');
        return;
    }
    
    // Получаем текущий профиль из storage
    chrome.storage.local.get(['currentProfile', 'profileInfo'], (result) => {
        let profileKey = result.currentProfile;
        
        // Если профиль не найден, используем первый доступный
        if (!profileKey || !PROXY_CONFIG.profiles[profileKey]) {
            profileKey = Object.keys(PROXY_CONFIG.profiles)[0];
            console.log(`Профиль не найден в storage, используем ${profileKey}`);
        }
        
        const profile = PROXY_CONFIG.profiles[profileKey];
        
        console.log(`Настройка прямого подключения к прокси с автоматической авторизацией`);
        console.log(`Профиль: ${profile.name} (${profile.ip})`);
        console.log(`Прокси: ${profile.host}:${profile.port}`);
        console.log(`Аутентификация: ${profile.username}:${profile.password}`);

        isSwitching = true;
        lastSwitchAtMs = Date.now();

        // Настраиваем автоматическую авторизацию
        setupAutoAuth();
        
        // Настраиваем прокси для выбранного профиля
        setupProxy(profileKey);

        // Основная логика после настройки прокси
        setTimeout(() => {
            console.log(`Прокси ${profile.host}:${profile.port} настроен с автоматической авторизацией`);
            console.log(`Профиль: ${profile.name} (${profile.ip})`);

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

            console.log(`Профиль сохранен в storage: ${profileKey}`);
            console.log(`Статус: "Подключение..." (ожидаем проверки IP)`);

            // Запускаем мониторинг прокси
            console.log(`Запуск мониторинга для прямого подключения`);
            console.log(`Ожидаемый IP для мониторинга: ${profile.ip}`);
            startProxyMonitoring(profile.ip);
        }, 2000); // Даем время на настройку прокси
    });
}

// Автоматическое подключение при установке расширения
chrome.runtime.onInstalled.addListener(async (details) => {
    console.log('Расширение установлено - загрузка конфигурации');
    
    // Загружаем конфигурацию
    const configLoaded = await loadConfig();
    if (configLoaded) {
        console.log('Конфигурация загружена');
        console.log('Ожидаем авторизации пользователя');
    } else {
        console.error('Не удалось загрузить конфигурацию');
    }
});

// Автоматическое подключение при запуске браузера
chrome.runtime.onStartup.addListener(async () => {
    console.log('Браузер запущен - загрузка конфигурации');
    
    // Загружаем конфигурацию
    const configLoaded = await loadConfig();
    if (configLoaded) {
        console.log('Конфигурация загружена');
        
        // Проверяем есть ли сохраненная авторизация
        chrome.storage.local.get(['isAuthenticated', 'authTime'], (result) => {
            const now = Date.now();
            const authTime = result.authTime || 0;
            const sessionTimeout = 24 * 60 * 60 * 1000; // 24 часа
            const isAuthValid = !!(result.isAuthenticated && (now - authTime) < sessionTimeout);
            
            if (isAuthValid) {
                console.log('Найдена валидная авторизация, автоматическое подключение');
                setupDirectProxy();
            } else {
                console.log('Авторизация не найдена или истекла, ожидаем ввода пароля');
            }
        });
    } else {
        console.error('Не удалось загрузить конфигурацию');
    }
});

// Восстановление мониторинга при инициализации расширения
async function restoreProxyMonitoring() {
    try {
        const data = await chrome.storage.local.get(['proxyEnabled', 'currentProfile', 'proxyStatus', 'isAuthenticated', 'authTime']);

        // Проверяем авторизацию
        const now = Date.now();
        const authTime = data.authTime || 0;
        const sessionTimeout = 24 * 60 * 60 * 1000; // 24 часа
        const isAuthValid = !!(data.isAuthenticated && (now - authTime) < sessionTimeout);

        if (isAuthValid && data.proxyEnabled && data.currentProfile && data.proxyStatus && data.proxyStatus.expectedIP) {
            console.log('Восстановление мониторинга прокси после перезапуска');
            console.log(`Профиль: ${data.currentProfile}`);
            console.log(`Ожидаемый IP: ${data.proxyStatus.expectedIP}`);

            startProxyMonitoring(data.proxyStatus.expectedIP);
        } else {
            console.log('Авторизация не найдена или истекла, мониторинг не восстанавливается');
        }
    } catch (error) {
        console.log('Ошибка восстановления мониторинга:', error);
    }
}

// Вызываем восстановление мониторинга при инициализации
restoreProxyMonitoring();

// Отслеживание изменений профиля
chrome.management.onEnabled.addListener(async (info) => {
    console.log('Профиль изменен, переподключаем прокси...');
    
    // Проверяем что конфигурация загружена
    if (!PROXY_CONFIG) {
        console.log('Конфигурация не загружена, загружаем...');
        const configLoaded = await loadConfig();
        if (!configLoaded) {
            console.error('Не удалось загрузить конфигурацию');
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
        console.log('Игнорируем ошибку прокси в период переключения');
        return;
    }

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

    chrome.storage.local.get(['proxyEnabled', 'currentProfile'], (result) => {
        if (result.proxyEnabled && result.currentProfile) {
            console.log('Прокси подключен, игнорируем ошибку');
            return;
        }

        connectionRetryCount++;

        const criticalErrors = ['net::ERR_TUNNEL_CONNECTION_FAILED', 'net::ERR_PROXY_CONNECTION_FAILED'];
        const isCriticalError = criticalErrors.includes(details.error);

        if (isCriticalError && connectionRetryCount <= 3) {
            console.log(`Критическая ошибка прокси, попытка переподключения ${connectionRetryCount}/3`);
            setTimeout(async () => {
                // Проверяем что конфигурация загружена
                if (!PROXY_CONFIG) {
                    console.log('Конфигурация не загружена, загружаем...');
                    const configLoaded = await loadConfig();
                    if (!configLoaded) {
                        console.error('Не удалось загрузить конфигурацию');
                        return;
                    }
                }
                setupDirectProxy();
            }, 10000);
        } else if (connectionRetryCount > 3) {
            console.log('Превышено максимальное количество попыток переподключения');
            isConnecting = false;
        }
    });
});

// Сообщения от popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'authenticate') {
        console.log('=== ОБРАБОТКА ЗАПРОСА АВТОРИЗАЦИИ ===');
        console.log('Запрос:', request);
        
        const userInfo = authenticateUser(request.password);
        console.log('Результат авторизации:', userInfo);

        if (!userInfo) {
            console.log('Авторизация не удалась - отправляем ошибку');
            sendResponse({success: false, message: 'Неверный пароль'});
            return true;
        }

        console.log('Авторизация разрешена');

        completeAuthentication(userInfo, sendResponse);
        return true;
    }

    if (request.action === 'getProfileInfo') {
        chrome.storage.local.get(['currentProfile', 'profileInfo', 'userType', 'currentUser', 'isAuthenticated', 'authTime', 'proxyStatus'], (result) => {
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

        console.log('Запуск автоподключения...');
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

        console.log('Переключение профиля:', request.profileKey);
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
                console.log('Прокси отключен');
                chrome.storage.local.set({proxyEnabled: false});
                sendResponse({success: true, message: 'Прокси отключен'});
            });
        }
        return true;
    }

    if (request.action === 'retryConnection') {
        console.log('Попытка переподключения...');

        isConnecting = false;
        connectionRetryCount = 0;
        lastConnectionAttempt = 0;

        setupDirectProxy();
        sendResponse({success: true, message: 'Попытка переподключения запущена'});
        return true;
    }

    if (request.action === 'logout') {
        chrome.storage.local.get(['currentProfile'], async (result) => {
            const profileToRelease = result.currentProfile;

            console.log('Выход из системы - отключаем прокси...');

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
                console.log('Прокси отключен при выходе');
                
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
                console.log('Прокси отключен при выходе из системы');
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
            console.log('Авторизация сохранена в storage');
            console.log(`Выбран профиль: ${userInfo.user.name} (${userInfo.user.ip})`);

            // Автоматически подключаем прокси только для обычных пользователей
            if (userInfo.type === 'user') {
                setTimeout(() => {
                    console.log('Автоматическое подключение после авторизации...');
                    setupDirectProxy(); // Принудительное подключение после авторизации
                }, 1000);
            } else {
                console.log('Админская авторизация - ожидаем выбора профиля');
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
    console.log('Расширение завершает работу, отключаем прокси...');

    // Останавливаем мониторинг
    stopProxyMonitoring();

    // Отключаем прокси
    chrome.proxy.settings.clear({scope: 'regular'}, () => {
        console.log('Прокси отключен при закрытии браузера');
    });

    const data = await chrome.storage.local.get(['currentProfile']);
    if (data.currentProfile) {
        console.log(`Освобождаем профиль при suspend: ${data.currentProfile}`);
    }
});

// Инициализация при загрузке
(async () => {
    console.log('Инициализация расширения...');
    console.log('Расширение запущено - загрузка конфигурации');
    
    // Загружаем конфигурацию
    const configLoaded = await loadConfig();
    if (configLoaded) {
        console.log('Конфигурация загружена');
        
        // Проверяем есть ли сохраненная авторизация
        chrome.storage.local.get(['isAuthenticated', 'authTime'], (result) => {
            const now = Date.now();
            const authTime = result.authTime || 0;
            const sessionTimeout = 24 * 60 * 60 * 1000; // 24 часа
            const isAuthValid = !!(result.isAuthenticated && (now - authTime) < sessionTimeout);
            
            if (isAuthValid) {
                console.log('Найдена валидная авторизация, автоматическое подключение');
                setupDirectProxy();
            } else {
                console.log('Авторизация не найдена или истекла, ожидаем ввода пароля');
            }
        });
    } else {
        console.error('Не удалось загрузить конфигурацию');
    }
})();
