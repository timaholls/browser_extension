// Флаг режима работы
const PRODUCTION_MODE = false; // true = продакшен, false = тестирование

// Прямое подключение к прокси без дополнительных серверов
const PROXY_CONFIG = {
    // Прямое подключение к pool.proxy.market
    proxy: {
        host: 'pool.proxy.market',
        port: 10050,
        username: 'JhCkljdaqJvL',
        password: '57MjVdoa'
    }
};

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

// Простая авторизация - только один пользователь
function authenticateUser(password) {
    if (password === 'user123') {
        return {
            type: 'user',
            user: {
                name: 'Direct User',
                ip: '93.170.248.211', // IP который должен быть через прокси
                region: 'Россия'
            }
        };
    }
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
        console.log(`Время первой проверки наступило!`);
        await performProxyCheck();
    }, 5000);

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

        stopProxyMonitoring();

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

// Прямое подключение к прокси
async function setupDirectProxy() {
    console.log(`Настройка прямого подключения к прокси`);
    console.log(`Прокси: ${PROXY_CONFIG.proxy.host}:${PROXY_CONFIG.proxy.port}`);
    console.log(`Аутентификация: ${PROXY_CONFIG.proxy.username}:${PROXY_CONFIG.proxy.password}`);

    isSwitching = true;
    lastSwitchAtMs = Date.now();

    // Создаем PAC скрипт с аутентификацией
    const pacData = `function FindProxyForURL(url, host) { 
      return "PROXY ${PROXY_CONFIG.proxy.host}:${PROXY_CONFIG.proxy.port}"; 
    }`;

    chrome.proxy.settings.set(
        {value: {mode: 'pac_script', pacScript: {data: pacData}}, scope: 'regular'},
        () => {
            console.log(`Прямой прокси ${PROXY_CONFIG.proxy.host}:${PROXY_CONFIG.proxy.port} установлен`);

            currentProfile = 'direct_user';
            isConnecting = false;
            connectionRetryCount = 0;
            isSwitching = false;

            // Автоматически считаем пользователя авторизованным
            isAuthenticated = true;
            currentUser = {
                name: 'Direct User',
                ip: '93.170.248.211',
                region: 'Россия'
            };
            userType = 'user';

            chrome.storage.local.set({
                proxyEnabled: false, // Временно false до проверки IP
                currentProfile: 'direct_user',
                profileInfo: {
                    name: 'Direct User',
                    ip: '93.170.248.211',
                    region: 'Россия'
                },
                isAuthenticated: true,
                authTime: Date.now(),
                userType: 'user',
                currentUser: {
                    name: 'Direct User',
                    ip: '93.170.248.211',
                    region: 'Россия'
                }
            });

            console.log(`Профиль сохранен в storage: direct_user`);
            console.log(`Статус: "Подключение..." (ожидаем проверки IP)`);

            // Запускаем мониторинг прокси
            console.log(`Запуск мониторинга для прямого подключения`);
            console.log(`Ожидаемый IP для мониторинга: 93.170.248.211`);
            startProxyMonitoring('93.170.248.211');

            // Убираем первое уведомление - оставляем только второе с IP
            console.log(`Прокси настроен, ожидаем проверки IP`);
        }
    );
}

// Автоматическое подключение при установке расширения
chrome.runtime.onInstalled.addListener(async () => {
    console.log('Расширение установлено - автоматическое подключение');
    // При установке сразу подключаемся без авторизации
    setupDirectProxy();
});

// Автоматическое подключение при запуске браузера
chrome.runtime.onStartup.addListener(async () => {
    console.log('Браузер запущен - автоматическое подключение');
    // При запуске браузера сразу подключаемся без авторизации
    setupDirectProxy();
});

// Восстановление мониторинга при инициализации расширения
async function restoreProxyMonitoring() {
    try {
        const data = await chrome.storage.local.get(['proxyEnabled', 'currentProfile', 'proxyStatus']);

        if (data.proxyEnabled && data.currentProfile && data.proxyStatus && data.proxyStatus.expectedIP) {
            console.log('Восстановление мониторинга прокси после перезапуска');
            console.log(`Профиль: ${data.currentProfile}`);
            console.log(`Ожидаемый IP: ${data.proxyStatus.expectedIP}`);

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
            setTimeout(() => {
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
        const userInfo = authenticateUser(request.password);

        if (!userInfo) {
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

            sendResponse({
                currentProfile: result.currentProfile,
                profileInfo: result.profileInfo,
                isAuthenticated: isAuthValid,
                userType: result.userType,
                userName: result.currentUser?.name,
                availableProfiles: [],
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

        console.log('Запуск автоподключения...');
        setupDirectProxy();
        sendResponse({success: true, message: 'Автоматическое подключение запущено'});
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

                // Уведомляем popup об отключении
                chrome.runtime.sendMessage({
                    action: 'proxyDisconnected',
                    message: 'ПрокСИ ОТКЛЮЧЕН!\n\nВыход из системы выполнен.\nПрокси отключен.',
                    showRetryButton: false
                }).catch(() => {
                    console.log('Popup не открыт, уведомление не отправлено');
                });
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

    isConnecting = false;
    connectionRetryCount = 0;

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
                console.log('Автоматическое подключение после авторизации...');
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
    console.log('Расширение запущено - автоматическое подключение');
    // При загрузке расширения сразу подключаемся без авторизации
    setupDirectProxy();
})();
