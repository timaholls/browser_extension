#!/usr/bin/env python3
"""
Тест HTTPS через прокси
"""

import requests
import time

def test_https_through_proxy():
    """Тестирует HTTPS запросы через прокси"""
    
    print("🧪 Тест HTTPS через прокси...")
    
    base_url = "http://94.241.175.200:8765"
    
    try:
        # 1. Применяем прокси
        print("\n1. Применение прокси...")
        apply_data = {
            "profile_id": "profile1",
            "user_type": "user"
        }
        
        response = requests.post(
            f"{base_url}/apply",
            json=apply_data,
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Прокси применен: {result}")
            local_port = result.get("local_port")
        else:
            print(f"❌ Ошибка применения прокси: {response.status_code}")
            return
        
        # 2. Тестируем HTTP запрос
        print(f"\n2. Тест HTTP запроса через прокси...")
        try:
            response = requests.get(
                "http://httpbin.org/ip",
                proxies={
                    'http': f'http://94.241.175.200:{local_port}',
                    'https': f'http://94.241.175.200:{local_port}'
                },
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                print(f"✅ HTTP запрос успешен: {data}")
            else:
                print(f"❌ HTTP запрос неуспешен: {response.status_code}")
                
        except Exception as e:
            print(f"❌ Ошибка HTTP запроса: {e}")
        
        # 3. Тестируем HTTPS запрос
        print(f"\n3. Тест HTTPS запроса через прокси...")
        try:
            response = requests.get(
                "https://httpbin.org/ip",
                proxies={
                    'http': f'http://94.241.175.200:{local_port}',
                    'https': f'http://94.241.175.200:{local_port}'
                },
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                print(f"✅ HTTPS запрос успешен: {data}")
            else:
                print(f"❌ HTTPS запрос неуспешен: {response.status_code}")
                
        except Exception as e:
            print(f"❌ Ошибка HTTPS запроса: {e}")
        
        # 4. Тестируем реальный сайт через HTTPS
        print(f"\n4. Тест реального сайта через HTTPS...")
        try:
            response = requests.get(
                "https://api.ipify.org?format=json",
                proxies={
                    'http': f'http://94.241.175.200:{local_port}',
                    'https': f'http://94.241.175.200:{local_port}'
                },
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                print(f"✅ Реальный сайт через HTTPS: {data}")
            else:
                print(f"❌ Реальный сайт неуспешен: {response.status_code}")
                
        except Exception as e:
            print(f"❌ Ошибка реального сайта: {e}")
        
        # 5. Очищаем прокси
        print(f"\n5. Очистка прокси...")
        response = requests.post(f"{base_url}/clear")
        if response.status_code == 200:
            print("✅ Прокси очищен")
        else:
            print(f"❌ Ошибка очистки: {response.status_code}")
        
        print(f"\n🎉 Тест завершен!")
        
    except Exception as e:
        print(f"❌ Общая ошибка: {e}")

if __name__ == "__main__":
    test_https_through_proxy()
