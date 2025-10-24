#!/usr/bin/env python3
"""
Быстрый тест прокси
"""

import requests
import json

# Настройки
SQUID_SERVER = '94.241.175.200'
TEST_URL = 'https://api.ipify.org?format=json'

# Прокси конфигурации
PROXIES = {
    'profile1': {'port': 3128, 'expected_ip': '45.139.125.123'},
    'profile2': {'port': 3129, 'expected_ip': '91.188.244.4'},
    'profile3': {'port': 3130, 'expected_ip': '185.181.245.211'},
    'profile4': {'port': 3131, 'expected_ip': '188.130.187.174'},
    'profile5': {'port': 3132, 'expected_ip': '45.140.53.190'}
}

def test_proxy(profile_name, port, expected_ip):
    """Тестирует один прокси"""
    print(f"\n🔍 Тестирование {profile_name} (порт {port})...")
    
    try:
        proxy_url = f"http://{SQUID_SERVER}:{port}"
        proxies = {'http': proxy_url, 'https': proxy_url}
        
        response = requests.get(TEST_URL, proxies=proxies, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            actual_ip = data.get('ip', '')
            
            print(f"   📍 Полученный IP: {actual_ip}")
            print(f"   🎯 Ожидаемый IP: {expected_ip}")
            
            if actual_ip == expected_ip:
                print(f"   ✅ УСПЕХ! IP совпадает")
                return True
            else:
                print(f"   ❌ ОШИБКА! IP не совпадает")
                return False
        else:
            print(f"   ❌ HTTP ошибка: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"   ❌ Ошибка: {e}")
        return False

def main():
    print("🚀 БЫСТРЫЙ ТЕСТ ПРОКСИ")
    print("=" * 50)
    
    success_count = 0
    total_count = len(PROXIES)
    
    for profile_name, config in PROXIES.items():
        if test_proxy(profile_name, config['port'], config['expected_ip']):
            success_count += 1
    
    print(f"\n📊 РЕЗУЛЬТАТ: {success_count}/{total_count} успешно")
    
    if success_count == total_count:
        print("🎉 ВСЕ ПРОКСИ РАБОТАЮТ!")
    else:
        print("❌ ЕСТЬ ПРОБЛЕМЫ С ПРОКСИ")

if __name__ == "__main__":
    main()
