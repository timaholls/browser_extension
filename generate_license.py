#!/usr/bin/env python3
"""
Утилита для генерации лицензионных ключей
Auto Proxy Connector License Generator
"""

import sys
import hashlib
import hmac
from datetime import datetime, timedelta
from pathlib import Path

# Секретный ключ (должен совпадать с apc_server.py)
SECRET_KEY = "apc_proxy_connector_secret_2025"


def generate_signature(client_id: str, expire_date: str) -> str:
    """Генерирует подпись для лицензионного ключа"""
    data = f"{client_id}:{expire_date}"
    signature = hmac.new(SECRET_KEY.encode(), data.encode(), hashlib.sha256).hexdigest()[:16]
    return signature


def generate_license_key(client_id: str, days: int = 30) -> dict:
    """Генерирует лицензионный ключ на указанное количество дней"""
    expire_date = (datetime.now() + timedelta(days=days)).strftime("%Y-%m-%d")
    signature = generate_signature(client_id, expire_date)
    license_key = f"{client_id}:{expire_date}:{signature}"
    
    return {
        "client_id": client_id,
        "expire_date": expire_date,
        "days": days,
        "license_key": license_key
    }


def save_license_to_file(license_key: str, filename: str = None):
    """Сохраняет лицензию в файл"""
    if filename is None:
        # Сохраняем в текущую директорию проекта
        filename = "license.key"
    
    filepath = Path(filename)
    filepath.write_text(license_key)
    return filepath


def main():
    print("=" * 60)
    print("🔑 Auto Proxy Connector - Генератор лицензий")
    print("=" * 60)
    print()
    
    # Интерактивный режим
    if len(sys.argv) < 2:
        print("Использование:")
        print("  python generate_license.py <client_id> [days]")
        print()
        print("Примеры:")
        print("  python generate_license.py CLIENT_001 30")
        print("  python generate_license.py COMPANY_XYZ 365")
        print()
        
        # Интерактивный ввод
        try:
            client_id = input("Введите ID клиента: ").strip()
            if not client_id:
                print("❌ ID клиента не может быть пустым")
                sys.exit(1)
            
            days_input = input("Количество дней (по умолчанию 30): ").strip()
            days = int(days_input) if days_input else 30
            
        except KeyboardInterrupt:
            print("\n\n❌ Отменено пользователем")
            sys.exit(1)
    else:
        # Командная строка
        client_id = sys.argv[1]
        days = int(sys.argv[2]) if len(sys.argv) > 2 else 30
    
    # Генерируем лицензию
    print(f"\n⚙️  Генерация лицензии...")
    license_data = generate_license_key(client_id, days)
    
    print("\n✅ Лицензия успешно сгенерирована!")
    print("-" * 60)
    print(f"ID клиента:      {license_data['client_id']}")
    print(f"Срок действия:   {days} дней")
    print(f"Действует до:    {license_data['expire_date']}")
    print(f"\nЛИЦЕНЗИОННЫЙ КЛЮЧ:")
    print(f"{license_data['license_key']}")
    print("-" * 60)
    
    # Спрашиваем, сохранить ли в файл
    print()
    save_to_file = input("Сохранить лицензию в файл? (y/n): ").strip().lower()
    
    if save_to_file == 'y':
        filepath = save_license_to_file(license_data['license_key'])
        print(f"\n✅ Лицензия сохранена в файл: {filepath}")
        print("\n📋 Для активации лицензии:")
        print("   1. Файл license.key уже в директории проекта")
        print("   2. Перезапустите FastAPI сервер (apc_server.py)")
        print("   3. Перезагрузите расширение в браузере")
    else:
        print("\n📋 Для активации лицензии:")
        print("   1. Скопируйте лицензионный ключ выше")
        print(f"   2. Создайте файл: license.key в директории проекта")
        print("   3. Вставьте в него лицензионный ключ")
        print("   4. Перезапустите FastAPI сервер")
    
    print("\n" + "=" * 60)


if __name__ == "__main__":
    main()

