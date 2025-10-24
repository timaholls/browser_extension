#!/usr/bin/env python3
"""
Простой тест прокси-сервера
"""

import asyncio
import aiohttp
import json

async def test_proxy_server():
    """Тестирование прокси-сервера"""
    
    base_url = "http://localhost:8765"
    
    print("🧪 Тестирование прокси-сервера...")
    
    async with aiohttp.ClientSession() as session:
        
        # 1. Проверка здоровья
        print("\n1. Проверка здоровья сервиса...")
        try:
            async with session.get(f"{base_url}/health") as response:
                if response.status == 200:
                    data = await response.json()
                    print(f"✅ Сервис здоров: {data}")
                else:
                    print(f"❌ Ошибка здоровья: {response.status}")
        except Exception as e:
            print(f"❌ Сервис недоступен: {e}")
            return
        
        # 2. Получение статуса всех прокси
        print("\n2. Статус всех прокси...")
        try:
            async with session.get(f"{base_url}/status") as response:
                if response.status == 200:
                    data = await response.json()
                    print(f"✅ Статус получен: {len(data)} профилей")
                    for profile_id, status in data.items():
                        print(f"   {profile_id}: {'🟢 Активен' if status['is_active'] else '🔴 Неактивен'} (порт {status['local_port']})")
                else:
                    print(f"❌ Ошибка получения статуса: {response.status}")
        except Exception as e:
            print(f"❌ Ошибка: {e}")
        
        # 3. Проверка лицензии
        print("\n3. Проверка лицензии...")
        try:
            async with session.get(f"{base_url}/license/status") as response:
                if response.status == 200:
                    data = await response.json()
                    print(f"✅ Лицензия: {data['license_status']}")
                else:
                    print(f"❌ Ошибка проверки лицензии: {response.status}")
        except Exception as e:
            print(f"❌ Ошибка: {e}")
        
        # 4. Применение прокси для profile1
        print("\n4. Применение прокси для profile1...")
        try:
            async with session.post(f"{base_url}/apply", json={
                "profile_id": "profile1",
                "user_type": "user"
            }) as response:
                if response.status == 200:
                    data = await response.json()
                    print(f"✅ Прокси применен: {data}")
                else:
                    error_data = await response.json()
                    print(f"❌ Ошибка применения: {error_data}")
        except Exception as e:
            print(f"❌ Ошибка: {e}")
        
        # 5. Проверка статуса profile1
        print("\n5. Проверка статуса profile1...")
        try:
            async with session.get(f"{base_url}/status/profile1") as response:
                if response.status == 200:
                    data = await response.json()
                    print(f"✅ Статус profile1: {data}")
                else:
                    print(f"❌ Ошибка получения статуса: {response.status}")
        except Exception as e:
            print(f"❌ Ошибка: {e}")
        
        # 6. Тест прокси запроса
        print("\n6. Тест прокси запроса...")
        try:
            # Тестируем запрос через прокси
            async with session.get("http://localhost:3128/httpbin.org/ip") as response:
                if response.status == 200:
                    data = await response.json()
                    print(f"✅ Прокси запрос успешен: {data}")
                else:
                    print(f"❌ Ошибка прокси запроса: {response.status}")
        except Exception as e:
            print(f"❌ Ошибка прокси запроса: {e}")
        
        # 7. Освобождение profile1
        print("\n7. Освобождение profile1...")
        try:
            async with session.post(f"{base_url}/release/profile1") as response:
                if response.status == 200:
                    data = await response.json()
                    print(f"✅ Профиль освобожден: {data}")
                else:
                    print(f"❌ Ошибка освобождения: {response.status}")
        except Exception as e:
            print(f"❌ Ошибка: {e}")
        
        # 8. Финальная проверка статуса
        print("\n8. Финальная проверка статуса...")
        try:
            async with session.get(f"{base_url}/status/profile1") as response:
                if response.status == 200:
                    data = await response.json()
                    print(f"✅ Финальный статус profile1: {data}")
                else:
                    print(f"❌ Ошибка получения статуса: {response.status}")
        except Exception as e:
            print(f"❌ Ошибка: {e}")

if __name__ == "__main__":
    asyncio.run(test_proxy_server())