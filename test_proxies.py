#!/usr/bin/env python3
"""
Скрипт для тестирования всех 5 прокси с проверкой IP адресов
"""

import requests
import time
import json
from typing import Dict, List, Tuple

# Конфигурация прокси
PROXY_CONFIGS = {
    'profile1': {
        'name': 'profile1',
        'squid_port': 3128,
        'expected_ip': '45.139.125.123',
        'upstream_proxy': '45.139.125.123:1050',
        'username': 'fOwk1c',
        'password': 'hBP8MJjtKg'
    },
    'profile2': {
        'name': 'profile2', 
        'squid_port': 3129,
        'expected_ip': '91.188.244.4',
        'upstream_proxy': '91.188.244.4:1050',
        'username': 'fOwk1c',
        'password': 'hBP8MJjtKg'
    },
    'profile3': {
        'name': 'profile3',
        'squid_port': 3130,
        'expected_ip': '185.181.245.211',
        'upstream_proxy': '185.181.245.211:1050',
        'username': 'fOwk1c',
        'password': 'hBP8MJjtKg'
    },
    'profile4': {
        'name': 'profile4',
        'squid_port': 3131,
        'expected_ip': '188.130.187.174',
        'upstream_proxy': '188.130.187.174:1050',
        'username': 'fOwk1c',
        'password': 'hBP8MJjtKg'
    },
    'profile5': {
        'name': 'profile5',
        'squid_port': 3132,
        'expected_ip': '45.140.53.190',
        'upstream_proxy': '45.140.53.190:1050',
        'username': 'fOwk1c',
        'password': 'hBP8MJjtKg'
    }
}

# Настройки тестирования
SQUID_SERVER = '94.241.175.200'  # IP вашего Squid сервера
TEST_URL = 'https://api.ipify.org?format=json'
TIMEOUT = 30

def test_direct_proxy(profile_name: str, config: Dict) -> Tuple[bool, str, str]:
    """
    Тестирует прямой доступ к upstream прокси
    """
    print(f"\n🔍 Тестирование прямого доступа к {profile_name}...")
    print(f"   Upstream: {config['upstream_proxy']}")
    print(f"   Ожидаемый IP: {config['expected_ip']}")
    
    try:
        # Формируем URL прокси с авторизацией
        proxy_url = f"http://{config['username']}:{config['password']}@{config['upstream_proxy']}"
        proxies = {
            'http': proxy_url,
            'https': proxy_url
        }
        
        # Делаем запрос через прокси
        response = requests.get(
            TEST_URL,
            proxies=proxies,
            timeout=TIMEOUT,
            verify=False
        )
        
        if response.status_code == 200:
            data = response.json()
            actual_ip = data.get('ip', '')
            
            print(f"   ✅ Статус: {response.status_code}")
            print(f"   📍 Полученный IP: {actual_ip}")
            print(f"   🎯 Ожидаемый IP: {config['expected_ip']}")
            
            if actual_ip == config['expected_ip']:
                print(f"   ✅ IP СОВПАДАЕТ!")
                return True, actual_ip, "IP совпадает"
            else:
                print(f"   ❌ IP НЕ СОВПАДАЕТ!")
                return False, actual_ip, f"IP не совпадает. Ожидался: {config['expected_ip']}, получен: {actual_ip}"
        else:
            print(f"   ❌ Ошибка HTTP: {response.status_code}")
            return False, "", f"HTTP ошибка: {response.status_code}"
            
    except requests.exceptions.ProxyError as e:
        print(f"   ❌ Ошибка прокси: {e}")
        return False, "", f"Ошибка прокси: {e}"
    except requests.exceptions.Timeout as e:
        print(f"   ❌ Таймаут: {e}")
        return False, "", f"Таймаут: {e}"
    except requests.exceptions.RequestException as e:
        print(f"   ❌ Ошибка запроса: {e}")
        return False, "", f"Ошибка запроса: {e}"
    except Exception as e:
        print(f"   ❌ Неожиданная ошибка: {e}")
        return False, "", f"Неожиданная ошибка: {e}"

def test_squid_proxy(profile_name: str, config: Dict) -> Tuple[bool, str, str]:
    """
    Тестирует доступ через Squid прокси
    """
    print(f"\n🔍 Тестирование через Squid для {profile_name}...")
    print(f"   Squid порт: {config['squid_port']}")
    print(f"   Ожидаемый IP: {config['expected_ip']}")
    
    try:
        # Подключаемся к Squid без авторизации
        squid_proxy = f"http://{SQUID_SERVER}:{config['squid_port']}"
        proxies = {
            'http': squid_proxy,
            'https': squid_proxy
        }
        
        # Делаем запрос через Squid
        response = requests.get(
            TEST_URL,
            proxies=proxies,
            timeout=TIMEOUT,
            verify=False
        )
        
        if response.status_code == 200:
            data = response.json()
            actual_ip = data.get('ip', '')
            
            print(f"   ✅ Статус: {response.status_code}")
            print(f"   📍 Полученный IP: {actual_ip}")
            print(f"   🎯 Ожидаемый IP: {config['expected_ip']}")
            
            if actual_ip == config['expected_ip']:
                print(f"   ✅ IP СОВПАДАЕТ!")
                return True, actual_ip, "IP совпадает"
            else:
                print(f"   ❌ IP НЕ СОВПАДАЕТ!")
                return False, actual_ip, f"IP не совпадает. Ожидался: {config['expected_ip']}, получен: {actual_ip}"
        else:
            print(f"   ❌ Ошибка HTTP: {response.status_code}")
            return False, "", f"HTTP ошибка: {response.status_code}"
            
    except requests.exceptions.ProxyError as e:
        print(f"   ❌ Ошибка прокси: {e}")
        return False, "", f"Ошибка прокси: {e}"
    except requests.exceptions.Timeout as e:
        print(f"   ❌ Таймаут: {e}")
        return False, "", f"Таймаут: {e}"
    except requests.exceptions.RequestException as e:
        print(f"   ❌ Ошибка запроса: {e}")
        return False, "", f"Ошибка запроса: {e}"
    except Exception as e:
        print(f"   ❌ Неожиданная ошибка: {e}")
        return False, "", f"Неожиданная ошибка: {e}"

def test_without_proxy() -> Tuple[bool, str]:
    """
    Тестирует прямой доступ без прокси (для сравнения)
    """
    print(f"\n🔍 Тестирование прямого доступа без прокси...")
    
    try:
        response = requests.get(TEST_URL, timeout=TIMEOUT, verify=False)
        
        if response.status_code == 200:
            data = response.json()
            actual_ip = data.get('ip', '')
            print(f"   ✅ Прямой IP: {actual_ip}")
            return True, actual_ip
        else:
            print(f"   ❌ Ошибка: {response.status_code}")
            return False, ""
            
    except Exception as e:
        print(f"   ❌ Ошибка: {e}")
        return False, ""

def main():
    """
    Основная функция тестирования
    """
    print("=" * 80)
    print("🚀 ТЕСТИРОВАНИЕ ПРОКСИ СЕРВЕРОВ")
    print("=" * 80)
    
    # Тестируем прямой доступ
    direct_success, direct_ip = test_without_proxy()
    print(f"\n📍 Прямой IP сервера: {direct_ip}")
    
    # Результаты тестирования
    results = {
        'direct_proxy': {},
        'squid_proxy': {}
    }
    
    # Тестируем каждый профиль
    for profile_name, config in PROXY_CONFIGS.items():
        print(f"\n{'='*60}")
        print(f"🧪 ТЕСТИРОВАНИЕ {profile_name.upper()}")
        print(f"{'='*60}")
        
        # Тест 1: Прямой доступ к upstream прокси
        success, ip, message = test_direct_proxy(profile_name, config)
        results['direct_proxy'][profile_name] = {
            'success': success,
            'ip': ip,
            'message': message,
            'expected_ip': config['expected_ip']
        }
        
        # Небольшая пауза между тестами
        time.sleep(2)
        
        # Тест 2: Доступ через Squid
        success, ip, message = test_squid_proxy(profile_name, config)
        results['squid_proxy'][profile_name] = {
            'success': success,
            'ip': ip,
            'message': message,
            'expected_ip': config['expected_ip']
        }
        
        # Пауза между профилями
        time.sleep(3)
    
    # Выводим итоговый отчет
    print(f"\n{'='*80}")
    print("📊 ИТОГОВЫЙ ОТЧЕТ")
    print(f"{'='*80}")
    
    print(f"\n🔗 ПРЯМОЙ ДОСТУП К UPSTREAM ПРОКСИ:")
    for profile_name, result in results['direct_proxy'].items():
        status = "✅" if result['success'] else "❌"
        print(f"   {status} {profile_name}: {result['ip']} (ожидался: {result['expected_ip']})")
        if not result['success']:
            print(f"      ❌ {result['message']}")
    
    print(f"\n🌐 ДОСТУП ЧЕРЕЗ SQUID:")
    for profile_name, result in results['squid_proxy'].items():
        status = "✅" if result['success'] else "❌"
        print(f"   {status} {profile_name}: {result['ip']} (ожидался: {result['expected_ip']})")
        if not result['success']:
            print(f"      ❌ {result['message']}")
    
    # Статистика
    direct_success_count = sum(1 for r in results['direct_proxy'].values() if r['success'])
    squid_success_count = sum(1 for r in results['squid_proxy'].values() if r['success'])
    
    print(f"\n📈 СТАТИСТИКА:")
    print(f"   Прямой доступ: {direct_success_count}/5 успешно")
    print(f"   Squid доступ: {squid_success_count}/5 успешно")
    
    if direct_success_count == 5 and squid_success_count == 5:
        print(f"\n🎉 ВСЕ ТЕСТЫ ПРОШЛИ УСПЕШНО!")
    elif direct_success_count == 5:
        print(f"\n⚠️  Upstream прокси работают, но есть проблемы с Squid")
    elif squid_success_count == 5:
        print(f"\n⚠️  Squid работает, но есть проблемы с upstream прокси")
    else:
        print(f"\n❌ ЕСТЬ ПРОБЛЕМЫ С ПРОКСИ СЕРВЕРАМИ")
    
    print(f"\n{'='*80}")

if __name__ == "__main__":
    main()
