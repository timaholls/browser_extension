#!/usr/bin/env python3
"""
Скрипт для тестирования всех 5 прокси с проверкой IP адресов
"""
import requests
import time
import json
import urllib3
from typing import Dict, List, Tuple

# Отключаем предупреждения SSL
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
# rm -rf extensions_obfuscated && node obfuscate.js
# Конфигурация прокси
PROXY_CONFIGS = {
    'profile1': {
        'name': 'profile1',
        'expected_ip': '195.158.255.144',
        'upstream_proxy': '195.158.255.144:60341',
        'username': 'pD3eAehGmG',
        'password': 'M2E7nVW38B'
    },
    # 'profile2': {
    #     'name': 'profile2',
    #     'expected_ip': '91.188.244.4',
    #     'upstream_proxy': '91.188.244.4:1050',
    #     'username': 'fOwk1c',
    #     'password': 'hBP8MJjtKg'
    # },
    # 'profile3': {
    #     'name': 'profile3',
    #     'expected_ip': '185.181.245.211',
    #     'upstream_proxy': '185.181.245.211:1050',
    #     'username': 'fOwk1c',
    #     'password': 'hBP8MJjtKg'
    # },
    # 'profile4': {
    #     'name': 'profile4',
    #     'expected_ip': '188.130.187.174',
    #     'upstream_proxy': '188.130.187.174:1050',
    #     'username': 'fOwk1c',
    #     'password': 'hBP8MJjtKg'
    # },
    # 'profile5': {
    #     'name': 'profile5',
    #     'expected_ip': '45.140.53.190',
    #     'upstream_proxy': '45.140.53.190:1050',
    #     'username': 'fOwk1c',
    #     'password': 'hBP8MJjtKg'
    # }
}

# Настройки тестирования
TEST_URL = 'https://api.ipify.org?format=json'
TIMEOUT = 30


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


def test_direct_upstream_proxy(config: Dict, server_ip: str) -> Tuple[bool, str, str]:
    """
    Тестирует прямой доступ к upstream прокси
    """
    print(f"   🔗 Тестирование прямого доступа к upstream прокси...")
    
    proxy_url = f"http://{config['username']}:{config['password']}@{config['upstream_proxy']}"
    proxies = {
        'http': proxy_url,
        'https': proxy_url
    }
    
    try:
        response = requests.get(TEST_URL, timeout=TIMEOUT, proxies=proxies, verify=False)
        
        if response.status_code == 200:
            data = response.json()
            actual_ip = data.get('ip', '')
            expected_ip = config['expected_ip']
            
            # Проверяем, что IP отличается от IP сервера (значит прокси работает)
            if actual_ip != server_ip:
                if actual_ip == expected_ip:
                    print(f"      ✅ IP совпадает: {actual_ip} (прокси работает)")
                    return True, actual_ip, ""
                else:
                    print(f"      ⚠️  IP не совпадает: получен {actual_ip}, ожидался {expected_ip}")
                    return False, actual_ip, f"IP не совпадает: получен {actual_ip}, ожидался {expected_ip}"
            else:
                print(f"      ❌ Прокси не работает: получен IP сервера {actual_ip}")
                return False, actual_ip, f"Прокси не работает: получен IP сервера {actual_ip}"
        else:
            print(f"      ❌ Ошибка HTTP: {response.status_code}")
            return False, "", f"HTTP ошибка: {response.status_code}"
            
    except Exception as e:
        print(f"      ❌ Ошибка подключения: {e}")
        return False, "", f"Ошибка подключения: {e}"


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
        'direct_proxy': {}
    }

    # Тестируем каждый профиль
    for profile_name, config in PROXY_CONFIGS.items():
        print(f"\n{'=' * 60}")
        print(f"🧪 ТЕСТИРОВАНИЕ {profile_name.upper()}")
        print(f"{'=' * 60}")
        
        # Тестируем прямой доступ к upstream прокси
        direct_success, direct_ip, direct_message = test_direct_upstream_proxy(config, direct_ip)
        results['direct_proxy'][profile_name] = {
            'success': direct_success,
            'ip': direct_ip,
            'expected_ip': config['expected_ip'],
            'message': direct_message
        }
        
        # Пауза между профилями
        time.sleep(2)

    # Выводим итоговый отчет
    print(f"\n{'=' * 80}")
    print("📊 ИТОГОВЫЙ ОТЧЕТ")
    print(f"{'=' * 80}")

    print(f"\n🔗 ПРЯМОЙ ДОСТУП К UPSTREAM ПРОКСИ:")
    print(f"   📍 IP сервера: {direct_ip}")
    for profile_name, result in results['direct_proxy'].items():
        status = "✅" if result['success'] else "❌"
        print(f"   {status} {profile_name}: {result['ip']} (ожидался: {result['expected_ip']})")
        if not result['success']:
            print(f"      ❌ {result['message']}")

    # Статистика
    direct_success_count = sum(1 for r in results['direct_proxy'].values() if r['success'])

    print(f"\n📈 СТАТИСТИКА:")
    print(f"   Прямой доступ: {direct_success_count}/5 успешно")

    if direct_success_count == 5:
        print(f"\n🎉 ВСЕ ТЕСТЫ UPSTREAM ПРОКСИ ПРОШЛИ УСПЕШНО!")
    else:
        print(f"\n❌ ЕСТЬ ПРОБЛЕМЫ С UPSTREAM ПРОКСИ СЕРВЕРАМИ")

    print(f"\n{'=' * 80}")


if __name__ == "__main__":
    main()
