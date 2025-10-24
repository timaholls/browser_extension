#!/usr/bin/env python3
"""
Тест исправления аутентификации прокси
"""

import requests
import time

def test_auth_fix():
    """Тестирует исправление аутентификации"""
    
    print("🧪 Тест исправления аутентификации прокси...")
    
    # 1. Проверка API
    print("\n1. Проверка API сервера...")
    try:
        response = requests.get("http://94.241.175.200:8765/health", timeout=5)
        if response.status_code == 200:
            print("✅ API сервер работает")
        else:
            print(f"❌ API сервер не работает: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Ошибка API: {e}")
        return False
    
    # 2. Применение прокси
    print("\n2. Применение прокси...")
    try:
        response = requests.post("http://94.241.175.200:8765/apply", 
                               json={"profile_id": "profile2", "user_type": "user"})
        if response.status_code == 200:
            data = response.json()
            local_port = data.get('local_port', 3129)
            print(f"✅ Прокси применен на порту {local_port}")
        else:
            print(f"❌ Ошибка применения прокси: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Ошибка: {e}")
        return False
    
    # 3. Тест HTTP запроса через прокси
    print(f"\n3. Тест HTTP запроса через прокси (порт {local_port})...")
    try:
        response = requests.get("http://httpbin.org/ip", 
                              proxies={'http': f'http://94.241.175.200:{local_port}',
                                      'https': f'http://94.241.175.200:{local_port}'},
                              timeout=15)
        if response.status_code == 200:
            data = response.json()
            print(f"✅ HTTP запрос работает: {data}")
            return True
        else:
            print(f"❌ HTTP запрос не работает: {response.status_code}")
            print(f"Ответ: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Ошибка HTTP запроса: {e}")
        return False

if __name__ == "__main__":
    success = test_auth_fix()
    if success:
        print("\n🎉 Аутентификация исправлена!")
    else:
        print("\n💥 Проблема с аутентификацией!")
