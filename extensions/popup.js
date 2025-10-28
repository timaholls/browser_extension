// Элементы DOM
const authForm = document.getElementById('authForm');
const userInterface = document.getElementById('userInterface');
const adminInterface = document.getElementById('adminInterface');
const passwordInput = document.getElementById('passwordInput');
const btnLogin = document.getElementById('btnLogin');
const messageDiv = document.getElementById('message');

// Элементы для обычных пользователей
const userName = document.getElementById('userName');
const userStatus = document.getElementById('userStatus');
const userProxyHost = document.getElementById('userProxyHost');
const userProxyPort = document.getElementById('userProxyPort');
const userProxyRegion = document.getElementById('userProxyRegion');
const btnUserLogout = document.getElementById('btnUserLogout');

// Элементы для администратора
const adminUserName = document.getElementById('adminUserName');
const adminStatusText = document.getElementById('adminStatusText');
const adminStatusDot = document.getElementById('adminStatusDot');
const adminProxyHost = document.getElementById('adminProxyHost');
const adminProxyPort = document.getElementById('adminProxyPort');
const adminProxyRegion = document.getElementById('adminProxyRegion');
const adminProfileSelect = document.getElementById('adminProfileSelect');
const btnAdminAuto = null; // удалено из UI
const btnAdminSave = null; // удалено из UI
const btnAdminEnable = null;
const btnAdminDisable = null;
const btnAdminLogout = document.getElementById('btnAdminLogout');
const btnAdminUnblock = document.getElementById('btnAdminUnblock');

// Отладочная информация
// console.log removed
// console.log removed
// console.log removed
// console.log removed

// Показать форму авторизации
function showAuthForm() {
  authForm.style.display = 'block';
  userInterface.style.display = 'none';
  adminInterface.style.display = 'none';
}

// Показать интерфейс пользователя
function showUserInterface() {
  authForm.style.display = 'none';
  userInterface.style.display = 'block';
  adminInterface.style.display = 'none';
}

// Показать интерфейс администратора
function showAdminInterface() {
  authForm.style.display = 'none';
  userInterface.style.display = 'none';
  adminInterface.style.display = 'block';
}

// Обновление UI
function updateUI(data) {
  // console.log removed
  
  if (data.isAuthenticated) {
    if (data.userType === 'user') {
      // Интерфейс для обычного пользователя
      // console.log removed
      showUserInterface();
      
      if (userName) userName.textContent = data.userName || 'Пользователь';
      
      // Обновляем статус в зависимости от proxyStatus
      if (data.proxyStatus && data.proxyStatus.connected) {
        if (userStatus) {
          userStatus.textContent = 'Статус: Подключен';
          userStatus.className = 'user-status connected';
        }
      } else {
        if (userStatus) {
          userStatus.textContent = 'Статус: Не подключен';
          userStatus.className = 'user-status disconnected';
        }
      }
      
      if (data.profileInfo) {
        if (userProxyHost) userProxyHost.textContent = data.profileInfo.ip;
        if (userProxyPort) userProxyPort.textContent = String(data.profileInfo.port ?? '—');
        if (userProxyRegion) userProxyRegion.textContent = data.profileInfo.region;
      } else {
        // Очищаем данные если профиль отсутствует
        if (userProxyHost) userProxyHost.textContent = 'Не подключен';
        if (userProxyPort) userProxyPort.textContent = '-';
        if (userProxyRegion) userProxyRegion.textContent = '-';
      }
      
    } else if (data.userType === 'admin') {
      // Интерфейс для администратора
      // console.log removed
      showAdminInterface();
      
      if (adminUserName) adminUserName.textContent = data.userName || 'Администратор';

      // Прячем неиспользуемые кнопки для админа
      if (btnAdminAuto) btnAdminAuto.style.display = 'none';
      if (btnAdminSave) btnAdminSave.style.display = 'none';
      
      // Обновляем информацию о профиле
      if (data.profileInfo) {
        if (adminProxyHost) adminProxyHost.textContent = data.profileInfo.ip;
        if (adminProxyPort) adminProxyPort.textContent = String(data.profileInfo.port ?? '—');
        if (adminProxyRegion) adminProxyRegion.textContent = data.profileInfo.region;
      } else {
        // Очищаем данные если профиль отсутствует
        if (adminProxyHost) adminProxyHost.textContent = 'Не подключен';
        if (adminProxyPort) adminProxyPort.textContent = '-';
        if (adminProxyRegion) adminProxyRegion.textContent = '-';
      }
      
      // Заполняем список профилей
      // console.log removed
      // console.log removed
      
      if (adminProfileSelect && data.availableProfiles) {
        adminProfileSelect.innerHTML = '<option value="">Выберите профиль...</option>';
        data.availableProfiles.forEach(profile => {
          const option = document.createElement('option');
          option.value = profile.key;
          option.textContent = `${profile.name} (${profile.region})`;
          if (profile.key === data.currentProfile) {
            option.selected = true;
          }
          adminProfileSelect.appendChild(option);
        });
      }
      
      // Обновляем статус
      const isEnabled = data.currentProfile !== null;
      if (isEnabled) {
        if (adminStatusText) adminStatusText.textContent = 'Статус: Подключен';
        if (adminStatusDot) adminStatusDot.classList.add('active');
      } else {
        if (adminStatusText) adminStatusText.textContent = 'Статус: Отключен';
        if (adminStatusDot) adminStatusDot.classList.remove('active');
      }
    }
  } else {
    // console.log removed
    showAuthForm();
  }
}

// Повторное обновление данных до появления profileInfo
function refreshProfileInfo(maxTries = 10, delayMs = 400) {
  let tries = 0;
  const tick = () => {
    chrome.runtime.sendMessage({ action: 'getProfileInfo' }, (data) => {
      if (data) {
        updateUI(data);
        // Обновляем статус прокси если есть
        if (data.proxyStatus) {
          updateProxyStatus(data.proxyStatus);
        }
        const hasInfo = !!(data && data.profileInfo && data.profileInfo.ip);
        if (hasInfo || tries >= maxTries) return;
      }
      tries += 1;
      setTimeout(tick, delayMs);
    });
  };
  tick();
}

// Функция для обновления статуса прокси
function updateProxyStatus(proxyStatus) {
  // console.log removed
  
  // Обновляем статус для обычных пользователей
  if (userStatus) {
    // console.log removed
    if (proxyStatus.connected) {
      userStatus.textContent = 'Статус: Подключен';
      userStatus.className = 'user-status connected';
      // console.log removed
    } else {
      userStatus.textContent = 'Статус: Не подключен';
      userStatus.className = 'user-status disconnected';
      // console.log removed
    }
  } else {
    // console.log removed
  }
  
  // Обновляем статус для админа
  if (adminStatusText && adminStatusDot) {
    if (proxyStatus.connected) {
      adminStatusText.textContent = 'Статус: Подключен';
      adminStatusDot.classList.add('active');
      adminStatusDot.classList.remove('disconnected');
    } else {
      adminStatusText.textContent = 'Статус: Не подключен';
      adminStatusDot.classList.remove('active');
      adminStatusDot.classList.add('disconnected');
    }
  }
  
  // Обновляем реальный IP если есть
  if (proxyStatus.realIP) {
    // Для обычных пользователей
    if (userProxyHost) {
      userProxyHost.textContent = proxyStatus.realIP;
    }
    // Для админа
    if (adminProxyHost) {
      adminProxyHost.textContent = proxyStatus.realIP;
    }
  }
  
  // Принудительно обновляем весь UI
  chrome.runtime.sendMessage({ action: 'getProfileInfo' }, (data) => {
    if (data) {
      updateUI(data);
    }
  });
}

// Функция для показа кнопки "Попробовать снова"
function showRetryButton() {
  // console.log removed
  
  // Создаем кнопку если её нет
  let retryButton = document.getElementById('retryButton');
  if (!retryButton) {
    retryButton = document.createElement('button');
    retryButton.id = 'retryButton';
    retryButton.textContent = 'Попробовать снова';
    retryButton.className = 'btn-retry';
    retryButton.style.cssText = `
      background: #ff6b35;
      color: white;
      border: none;
      padding: 10px 20px;
      border-radius: 5px;
      cursor: pointer;
      font-weight: bold;
      margin: 10px 0;
      width: 100%;
    `;
    
    // Добавляем кнопку в интерфейс пользователя
    if (userInterface && userInterface.style.display !== 'none') {
      userInterface.appendChild(retryButton);
    }
    // Или в админский интерфейс
    if (adminInterface && adminInterface.style.display !== 'none') {
      adminInterface.appendChild(retryButton);
    }
  }
  
  // Добавляем обработчик клика
  retryButton.onclick = () => {
    // console.log removed
    chrome.runtime.sendMessage({ action: 'retryConnection' }, (response) => {
      if (response && response.success) {
        showMessage('Попытка переподключения...', 'info');
        // Скрываем кнопку
        retryButton.style.display = 'none';
        // Обновляем UI
        setTimeout(() => {
          chrome.runtime.sendMessage({ action: 'getProfileInfo' }, (data) => {
            if (data) {
              updateUI(data);
              if (data.proxyStatus) {
                updateProxyStatus(data.proxyStatus);
              }
            }
          });
        }, 2000);
      } else {
        showMessage('Ошибка переподключения', 'error');
      }
    });
  };
  
  // Показываем кнопку
  retryButton.style.display = 'block';
}

// Показать сообщение
function showMessage(text, type = 'success') {
  messageDiv.textContent = text;
  messageDiv.className = `message ${type} show`;
  setTimeout(() => {
    messageDiv.classList.remove('show');
  }, 3000);
}

// Обработчики для обычных пользователей
if (btnUserLogout) {
  btnUserLogout.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'logout' }, (response) => {
      if (response && response.success) {
        showMessage(response.message, 'success');
        showAuthForm();
      }
    });
  });
} else {
  // console.log removed
}

// Обработчики для администратора
if (btnAdminAuto) {
  btnAdminAuto.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'autoConnect' }, (response) => {
      if (response && response.success) {
        showMessage(response.message, 'success');
        chrome.runtime.sendMessage({ action: 'getProfileInfo' }, (data) => {
          updateUI(data);
        });
      } else {
        showMessage(response ? response.message : 'Ошибка автоподключения', 'error');
      }
    });
  });
} else {
  // console.log removed
}

if (btnAdminSave) {
  btnAdminSave.addEventListener('click', () => {
    const selectedProfile = adminProfileSelect ? adminProfileSelect.value : '';
    if (!selectedProfile) {
      showMessage('Выберите профиль из списка', 'error');
      return;
    }
    
    chrome.runtime.sendMessage({ action: 'saveProfile', profileKey: selectedProfile }, (response) => {
      if (response && response.success) {
        showMessage(`Профиль "${selectedProfile}" запомнен!`, 'success');
        chrome.runtime.sendMessage({ action: 'getProfileInfo' }, (data) => {
          updateUI(data);
        });
      } else {
        showMessage(response ? response.message : 'Ошибка сохранения профиля', 'error');
      }
    });
  });
} else {
  // console.log removed
}

// Управляющие кнопки включить/выключить удалены: подключение происходит автоматически при выборе профиля

if (btnAdminUnblock) {
  btnAdminUnblock.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'unblockInternet' }, (response) => {
      if (response && response.success) {
        showMessage(response.message, 'success');
        // Обновляем UI после разблокировки
        setTimeout(() => {
          chrome.runtime.sendMessage({ action: 'getProfileInfo' }, (data) => {
            if (data) {
              updateUI(data);
            }
          });
        }, 1000);
      } else {
        showMessage(response ? response.message : 'Ошибка разблокировки', 'error');
      }
    });
  });
} else {
  // console.log removed
}

if (btnAdminLogout) {
  btnAdminLogout.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'logout' }, (response) => {
      if (response && response.success) {
        showMessage(response.message, 'success');
        showAuthForm();
      }
    });
  });
} else {
  // console.log removed
}

// Авторизация по Enter
if (passwordInput) {
  passwordInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && btnLogin) {
      btnLogin.click();
    }
  });
} else {
  // console.log removed
}

// Загрузка информации при открытии popup
chrome.runtime.sendMessage({ action: 'getProfileInfo' }, (response) => {
  if (response) {
    updateUI(response);
    // Обновляем статус прокси если есть
    if (response.proxyStatus) {
      updateProxyStatus(response.proxyStatus);
      
      // Если прокси не подключен, показываем кнопку "Попробовать снова"
      if (!response.proxyStatus.connected && response.isAuthenticated) {
        showRetryButton();
      } else {
        // Если прокси подключен, скрываем кнопку "Попробовать снова"
        const retryButton = document.getElementById('retryButton');
        if (retryButton) {
          retryButton.style.display = 'none';
        }
      }
    }
  }
});

// Дополнительная проверка статуса при открытии popup
setTimeout(() => {
  chrome.runtime.sendMessage({ action: 'getProfileInfo' }, (response) => {
    if (response && response.proxyStatus) {
      // console.log removed
      updateProxyStatus(response.proxyStatus);
      
      // Скрываем кнопку "Попробовать снова" если прокси подключен
      if (response.proxyStatus.connected) {
        const retryButton = document.getElementById('retryButton');
        if (retryButton) {
          retryButton.style.display = 'none';
        }
      }
    }
  });
}, 1000);

// Периодическое обновление статуса прокси
let statusUpdateInterval = null;

function startStatusMonitoring() {
  // Останавливаем предыдущий интервал
  if (statusUpdateInterval) {
    clearInterval(statusUpdateInterval);
  }
  
  // Обновляем статус каждые 5 секунд для быстрого отклика
  statusUpdateInterval = setInterval(() => {
    chrome.runtime.sendMessage({ action: 'getProfileInfo' }, (data) => {
      if (data) {
        updateUI(data);
        if (data.proxyStatus) {
          updateProxyStatus(data.proxyStatus);
        }
      }
    });
  }, 5000);
}

function stopStatusMonitoring() {
  if (statusUpdateInterval) {
    clearInterval(statusUpdateInterval);
    statusUpdateInterval = null;
  }
}

// Запускаем мониторинг при загрузке
startStatusMonitoring();

// Слушаем уведомления от background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'proxyStatusChanged') {
    // console.log removed
    updateProxyStatus(request.proxyStatus);
  } else if (request.action === 'requestPassword') {
    // Запрос пароля от background script
    const { username, profileName } = request;
    // console.log removed
    
    // Показываем диалог запроса пароля
    const password = prompt(`Введите пароль для пользователя ${username} (${profileName}):`);
    if (password) {
      // Отправляем пароль обратно в background
      chrome.runtime.sendMessage({
        action: 'setPassword',
        username: username,
        password: password
      });
    }
    
  } else if (request.action === 'proxyConnected') {
    // console.log removed
    
    // Показываем красивое popup уведомление об успехе
    showSuccessNotification(request.message);
    
    // Скрываем кнопку "Попробовать снова" если она была показана
    const retryButton = document.getElementById('retryButton');
    if (retryButton) {
      retryButton.style.display = 'none';
    }
    
    // Обновляем статус прокси сразу из полученных данных
    if (request.proxyStatus) {
      // console.log removed
      updateProxyStatus(request.proxyStatus);
    } else {
      // console.log removed
    }
    
    // Обновляем UI
    chrome.runtime.sendMessage({ action: 'getProfileInfo' }, (data) => {
      if (data) {
        updateUI(data);
        if (data.proxyStatus) {
          updateProxyStatus(data.proxyStatus);
        }
      }
    });
  } else if (request.action === 'proxyDisconnected') {
    // console.log removed
    
    // Проверяем, заблокирован ли интернет
    if (request.internetBlocked) {
      // console.log removed
      
      // Показываем специальное уведомление о блокировке
      showInternetBlockedNotification(request.message);
      
      // Скрываем кнопку "Попробовать снова" - она бесполезна при блокировке
      const retryButton = document.getElementById('retryButton');
      if (retryButton) {
        retryButton.style.display = 'none';
      }
      
    } else {
      // Обычное отключение прокси
      showProxyErrorNotification(request.message);
      
      // Показываем кнопку "Попробовать снова" если нужно
      if (request.showRetryButton) {
        showRetryButton();
      }
    }
    
    // Дополнительно показываем системное уведомление
    try {
      if ('Notification' in window && Notification.permission === 'granted') {
        const title = request.internetBlocked ? '🔒 ИНТЕРНЕТ ЗАБЛОКИРОВАН!' : '🔌 ПРОКСИ НЕ ПОДКЛЮЧЕН!';
        new Notification(title, {
          body: request.message,
          icon: 'icons/icon.svg'
        });
      }
    } catch (e) {
      // Ошибка системного уведомления в popup
    }
    
    // Обновляем статус прокси сразу (устанавливаем как не подключен)
    updateProxyStatus({
      connected: false,
      realIP: null,
      expectedIP: null,
      lastCheck: Date.now()
    });
    
    // Обновляем UI
    chrome.runtime.sendMessage({ action: 'getProfileInfo' }, (data) => {
      if (data) {
        updateUI(data);
        if (data.proxyStatus) {
          updateProxyStatus(data.proxyStatus);
        }
      }
    });
  }
});

// Обновляем UI при фокусе на popup
window.addEventListener('focus', () => {
  // console.log removed
  chrome.runtime.sendMessage({ action: 'getProfileInfo' }, (data) => {
    if (data) {
      updateUI(data);
      if (data.proxyStatus) {
        updateProxyStatus(data.proxyStatus);
        
        // Скрываем кнопку "Попробовать снова" если прокси подключен
        if (data.proxyStatus.connected) {
          const retryButton = document.getElementById('retryButton');
          if (retryButton) {
            retryButton.style.display = 'none';
          }
        }
      }
    }
  });
});

// Обновляем UI при клике на popup
document.addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: 'getProfileInfo' }, (data) => {
    if (data && data.proxyStatus) {
      updateProxyStatus(data.proxyStatus);
      
      // Скрываем кнопку "Попробовать снова" если прокси подключен
      if (data.proxyStatus.connected) {
        const retryButton = document.getElementById('retryButton');
        if (retryButton) {
          retryButton.style.display = 'none';
        }
      }
    }
  });
});

// Обновляем UI при видимости popup
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    // console.log removed
    chrome.runtime.sendMessage({ action: 'getProfileInfo' }, (data) => {
      if (data) {
        updateUI(data);
        if (data.proxyStatus) {
          updateProxyStatus(data.proxyStatus);
        }
      }
    });
  }
});

// Авторизация
if (btnLogin) {
  btnLogin.addEventListener('click', () => {
    const password = passwordInput ? passwordInput.value : '';
    if (!password) {
      showMessage('Введите пароль', 'error');
      return;
    }
    
    // Показываем индикатор загрузки
    showMessage('Проверка доступности профиля...', 'info');
    
    chrome.runtime.sendMessage({ action: 'authenticate', password }, (response) => {
      if (response && response.success) {
        showMessage(response.message, 'success');
        if (passwordInput) passwordInput.value = '';
        // Ждём, пока фон применит настройки, и обновляем UI
        refreshProfileInfo();
      } else {
        // Проверяем, истекла ли лицензия
        if (response && response.licenseExpired) {
          // console.log removed
          
          // Показываем красивое модальное окно об истечении лицензии
          showLicenseExpiredNotification(response.message || 'Лицензия истекла.\n\nОбратитесь к администратору для продления.');
          
          // Показываем сообщение в интерфейсе
          showMessage('⚠️ Лицензия истекла! Обратитесь к администратору.', 'error');
        } else {
          // Обычная ошибка авторизации (неверный пароль)
          showMessage(response ? response.message : 'Ошибка авторизации', 'error');
        }
      }
    });
  });
} else {
  // console.log removed
}

// Переключение профиля для администратора
if (adminProfileSelect) {
  adminProfileSelect.addEventListener('change', () => {
    const selectedProfile = adminProfileSelect.value;
    if (selectedProfile) {
      // Показываем сообщение о смене IP
      showMessage('Подождите, происходит смена IP...', 'info');
      
      chrome.runtime.sendMessage({ action: 'switchProfile', profileKey: selectedProfile }, (response) => {
        if (response && response.success) {
          // Задержка 5 секунд перед обновлением UI
          setTimeout(() => {
            showMessage('IP успешно изменен!', 'success');
            refreshProfileInfo();
          }, 5000);
        } else {
          showMessage(response ? response.message : 'Ошибка переключения', 'error');
        }
      });
    }
  });
} else {
  // console.log removed
}

// Функция для показа красивого уведомления об успехе
function showSuccessNotification(message) {
  // Создаем модальное окно для уведомления об успехе
  const modal = document.createElement('div');
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 10000;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  `;
  
  const notification = document.createElement('div');
  notification.style.cssText = `
    background: linear-gradient(135deg, #4CAF50, #45a049);
    border-radius: 12px;
    padding: 24px;
    max-width: 400px;
    width: 90%;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    color: white;
    text-align: center;
  `;
  
  notification.innerHTML = `
    <div style="font-size: 24px; margin-bottom: 16px;">✅ ПРОКСИ ПОДКЛЮЧЕН!</div>
    <div style="font-size: 14px; line-height: 1.4; opacity: 0.9;">${(message || 'Прокси успешно подключен!').replace(/\n/g, '<br>')}</div>
  `;
  
  notification.className = 'notification-modal';
  modal.appendChild(notification);
  document.body.appendChild(modal);
  
  // Автоматически закрываем через 5 секунд
  setTimeout(() => {
    if (modal.parentNode) {
      modal.remove();
    }
  }, 5000);
}

// Функция для показа уведомления об истечении лицензии
function showLicenseExpiredNotification(message) {
  // Создаем модальное окно для уведомления об истечении лицензии
  const modal = document.createElement('div');
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.7);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 10000;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  `;
  
  const notification = document.createElement('div');
  notification.style.cssText = `
    background: linear-gradient(135deg, #ff9800, #f57c00);
    border-radius: 12px;
    padding: 24px;
    max-width: 400px;
    width: 90%;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    color: white;
    text-align: center;
  `;
  
  notification.innerHTML = `
    <div style="font-size: 48px; margin-bottom: 16px;">🔒</div>
    <div style="font-size: 24px; margin-bottom: 16px; font-weight: bold;">ЛИЦЕНЗИЯ ИСТЕКЛА!</div>
    <div style="font-size: 14px; line-height: 1.6; opacity: 0.95;">${(message || 'Лицензия истекла.').replace(/\n/g, '<br>')}</div>
  `;
  
  notification.className = 'notification-modal';
  modal.appendChild(notification);
  document.body.appendChild(modal);
  
  // Закрываем при клике
  modal.addEventListener('click', () => {
    if (modal.parentNode) {
      modal.remove();
    }
  });
  
  // Автоматически закрываем через 8 секунд
  setTimeout(() => {
    if (modal.parentNode) {
      modal.remove();
    }
  }, 8000);
}

// Функция для показа красивого уведомления об ошибке
function showErrorNotification(message) {
  // Создаем модальное окно для уведомления об ошибке
  const modal = document.createElement('div');
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 10000;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  `;
  
  const notification = document.createElement('div');
  notification.style.cssText = `
    background: linear-gradient(135deg, #f44336, #d32f2f);
    border-radius: 12px;
    padding: 24px;
    max-width: 400px;
    width: 90%;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    color: white;
    text-align: center;
  `;
  
  notification.innerHTML = `
    <div style="font-size: 24px; margin-bottom: 16px;">⚠️ ПРОФИЛЬ ЗАНЯТ!</div>
    <div style="font-size: 14px; line-height: 1.4; opacity: 0.9;">${(message || 'Профиль уже используется!').replace(/\n/g, '<br>')}</div>
  `;
  
  notification.className = 'notification-modal';
  modal.appendChild(notification);
  document.body.appendChild(modal);
  
  // Автоматически закрываем через 5 секунд
  setTimeout(() => {
    if (modal.parentNode) {
      modal.remove();
    }
  }, 5000);
}

// Функция для показа уведомления об ошибке прокси
function showProxyErrorNotification(message) {
  // Создаем модальное окно для уведомления об ошибке прокси
  const modal = document.createElement('div');
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.7);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 10000;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  `;
  
  const notification = document.createElement('div');
  notification.style.cssText = `
    background: linear-gradient(135deg, #ff9800, #f57c00);
    border-radius: 12px;
    padding: 24px;
    max-width: 400px;
    width: 90%;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    color: white;
    text-align: center;
  `;
  
  notification.innerHTML = `
    <div style="font-size: 48px; margin-bottom: 16px;">🔌</div>
    <div style="font-size: 24px; margin-bottom: 16px; font-weight: bold;">ПРОКСИ НЕ ПОДКЛЮЧЕН!</div>
    <div style="font-size: 14px; line-height: 1.6; opacity: 0.95;">${(message || 'Прокси не удалось проверить, попробуйте снова.').replace(/\n/g, '<br>')}</div>
  `;
  
  notification.className = 'proxy-error-modal';
  modal.appendChild(notification);
  document.body.appendChild(modal);
  
  // Автоматически закрываем через 8 секунд
  setTimeout(() => {
    if (modal.parentNode) {
      modal.remove();
    }
  }, 8000);
}

// Функция для показа уведомления о блокировке интернета
function showInternetBlockedNotification(message) {
  // Создаем модальное окно для уведомления о блокировке интернета
  const modal = document.createElement('div');
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.8);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 10000;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  `;
  
  const notification = document.createElement('div');
  notification.style.cssText = `
    background: linear-gradient(135deg, #f44336, #d32f2f);
    border-radius: 12px;
    padding: 24px;
    max-width: 400px;
    width: 90%;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
    color: white;
    text-align: center;
  `;
  
  notification.innerHTML = `
    <div style="font-size: 48px; margin-bottom: 16px;">🔒</div>
    <div style="font-size: 24px; margin-bottom: 16px; font-weight: bold;">ИНТЕРНЕТ ЗАБЛОКИРОВАН!</div>
    <div style="font-size: 14px; line-height: 1.6; opacity: 0.95;">${(message || 'Интернет заблокирован для защиты IP адреса.').replace(/\n/g, '<br>')}</div>
    <div style="font-size: 12px; margin-top: 16px; opacity: 0.8;">Обратитесь к администратору для разблокировки</div>
  `;
  
  notification.className = 'internet-blocked-modal';
  modal.appendChild(notification);
  document.body.appendChild(modal);
  
  // НЕ закрываем автоматически - пользователь должен обратиться к админу
  // Закрываем только при клике
  modal.addEventListener('click', () => {
    if (modal.parentNode) {
      modal.remove();
    }
  });
}

