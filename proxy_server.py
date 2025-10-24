#!/usr/bin/env python3
"""
Многопользовательский прокси-сервер для браузерного расширения
Поддерживает 10-15 аккаунтов с разными прокси
"""

import asyncio
import json
import logging
from typing import Dict, Optional, Tuple
from dataclasses import dataclass
from datetime import datetime, timedelta
import aiohttp
from aiohttp import web, ClientSession, ClientTimeout
import httpx
import uvicorn
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import Response
from pydantic import BaseModel
import threading
import time
import hashlib
import os

# Настройка логирования
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@dataclass
class ProxyConfig:
    """Конфигурация прокси-сервера"""
    ip: str
    port: int
    username: str
    password: str
    region: str
    local_port: int
    profile_id: str
    is_active: bool = False
    last_used: Optional[datetime] = None
    connection_count: int = 0

class ProxyManager:
    """Менеджер прокси-серверов"""
    
    def __init__(self):
        self.proxies: Dict[str, ProxyConfig] = {}
        self.active_connections: Dict[str, int] = {}
        self.server_tasks: Dict[str, web.AppRunner] = {}
        self.setup_default_proxies()
    
    def setup_default_proxies(self):
        """Настройка прокси по умолчанию из вашего расширения"""
        default_proxies = [
            {
                "profile_id": "profile1",
                "ip": "45.139.125.123",
                "port": 1050,
                "username": "fOwk1c",
                "password": "hBP8MJjtKg",
                "region": "Россия",
                "local_port": 3128
            },
            {
                "profile_id": "profile2", 
                "ip": "91.188.244.4",
                "port": 1050,
                "username": "fOwk1c",
                "password": "hBP8MJjtKg",
                "region": "Россия",
                "local_port": 3129
            },
            {
                "profile_id": "profile3",
                "ip": "185.181.245.211", 
                "port": 1050,
                "username": "fOwk1c",
                "password": "hBP8MJjtKg",
                "region": "Россия",
                "local_port": 3130
            },
            {
                "profile_id": "profile4",
                "ip": "188.130.187.174",
                "port": 1050, 
                "username": "fOwk1c",
                "password": "hBP8MJjtKg",
                "region": "Россия",
                "local_port": 3131
            }
        ]
        
        # Добавляем дополнительные прокси для поддержки 10-15 аккаунтов
        for i in range(5, 16):  # profile5-profile15
            default_proxies.append({
                "profile_id": f"profile{i}",
                "ip": f"192.168.1.{i+10}",  # Примерные IP
                "port": 1050,
                "username": "fOwk1c",
                "password": "hBP8MJjtKg",
                "region": "Россия",
                "local_port": 3128 + i
            })
        
        for proxy_data in default_proxies:
            self.proxies[proxy_data["profile_id"]] = ProxyConfig(**proxy_data)
            logger.info(f"Настроен прокси {proxy_data['profile_id']} на порту {proxy_data['local_port']}")
    
    async def start_proxy_server(self, profile_id: str) -> bool:
        """Запуск прокси-сервера для конкретного профиля"""
        if profile_id not in self.proxies:
            logger.error(f"Профиль {profile_id} не найден")
            return False
        
        proxy_config = self.proxies[profile_id]
        
        if proxy_config.is_active:
            logger.info(f"Прокси для {profile_id} уже активен")
            return True
        
        try:
            # Создаем HTTP прокси сервер
            app = web.Application()
            
            # Добавляем обработчик для всех запросов включая CONNECT
            app.router.add_route('*', '/{path:.*}', self.create_proxy_handler(proxy_config))
            app.router.add_route('CONNECT', '/{path:.*}', self.create_proxy_handler(proxy_config))
            app.router.add_route('CONNECT', '/', self.create_proxy_handler(proxy_config))
            
            # Запускаем сервер
            runner = web.AppRunner(app)
            await runner.setup()
            
            site = web.TCPSite(runner, '0.0.0.0', proxy_config.local_port)
            await site.start()
            
            # Сохраняем ссылку на сервер для остановки
            self.server_tasks[profile_id] = runner
            
            proxy_config.is_active = True
            proxy_config.last_used = datetime.now()
            proxy_config.connection_count += 1
            
            logger.info(f"✅ Прокси сервер запущен для {profile_id} на порту {proxy_config.local_port}")
            logger.info(f"🔗 Сервер доступен по адресу: http://0.0.0.0:{proxy_config.local_port}")
            return True
            
        except Exception as e:
            logger.error(f"❌ Ошибка запуска прокси для {profile_id}: {e}")
            return False
    
    def create_proxy_handler(self, proxy_config):
        """Создает обработчик прокси для конкретной конфигурации"""
        async def proxy_handler(request):
            try:
                logger.info(f"Прокси запрос: {request.method} {request.url}")
                
                # Обрабатываем CONNECT запросы для HTTPS
                if request.method == 'CONNECT':
                    logger.info(f"CONNECT запрос получен для {request.url}")
                    # Для CONNECT запросов возвращаем 200 OK
                    return web.Response(status=200, text='Connection established')
                
                # Получаем целевой URL, убираем прокси-префикс
                target_url = str(request.url)
                # Убираем прокси-префикс если он есть
                if 'localhost:3128/' in target_url:
                    target_url = target_url.split('localhost:3128/')[1]
                elif '127.0.0.1:3128/' in target_url:
                    target_url = target_url.split('127.0.0.1:3128/')[1]
                
                # Добавляем http:// если нет протокола
                if not target_url.startswith('http://') and not target_url.startswith('https://'):
                    target_url = 'http://' + target_url
                
                logger.info(f"Целевой URL: {target_url}")
                
                # Используем httpx для лучшей поддержки прокси
                async with httpx.AsyncClient(
                    proxies={
                        'http://': f'http://{proxy_config.username}:{proxy_config.password}@{proxy_config.ip}:{proxy_config.port}',
                        'https://': f'http://{proxy_config.username}:{proxy_config.password}@{proxy_config.ip}:{proxy_config.port}'
                    }
                ) as client:
                    
                    # Выполняем запрос через прокси
                    response = await client.request(
                        method=request.method,
                        url=target_url,
                        headers=dict(request.headers),
                        content=await request.read() if request.method in ['POST', 'PUT', 'PATCH'] else None
                    )
                    
                    # Возвращаем ответ
                    return web.Response(
                        body=response.content,
                        status=response.status_code,
                        headers=dict(response.headers)
                    )
                        
            except Exception as e:
                logger.error(f"Ошибка прокси-запроса: {e}")
                logger.error(f"Тип ошибки: {type(e)}")
                import traceback
                logger.error(f"Traceback: {traceback.format_exc()}")
                return web.Response(text=f"Ошибка прокси: {e}", status=500)
        
        return proxy_handler
    
    async def stop_proxy_server(self, profile_id: str) -> bool:
        """Остановка прокси-сервера для конкретного профиля"""
        if profile_id not in self.proxies:
            return False
        
        proxy_config = self.proxies[profile_id]
        
        if proxy_config.is_active and profile_id in self.server_tasks:
            # Останавливаем сервер
            runner = self.server_tasks[profile_id]
            await runner.cleanup()
            del self.server_tasks[profile_id]
        
        proxy_config.is_active = False
        
        logger.info(f"🛑 Прокси сервер остановлен для {profile_id}")
        return True
    
    def get_profile_by_port(self, port: int) -> Optional[str]:
        """Получение профиля по порту"""
        for profile_id, config in self.proxies.items():
            if config.local_port == port:
                return profile_id
        return None
    
    def get_proxy_status(self, profile_id: str) -> Dict:
        """Получение статуса прокси"""
        if profile_id not in self.proxies:
            return {"error": "Профиль не найден"}
        
        config = self.proxies[profile_id]
        return {
            "profile_id": profile_id,
            "is_active": config.is_active,
            "local_port": config.local_port,
            "target_ip": config.ip,
            "target_port": config.port,
            "region": config.region,
            "last_used": config.last_used.isoformat() if config.last_used else None,
            "connection_count": config.connection_count
        }
    
    def get_all_proxies_status(self) -> Dict:
        """Получение статуса всех прокси"""
        return {
            profile_id: self.get_proxy_status(profile_id)
            for profile_id in self.proxies.keys()
        }

class LicenseManager:
    """Менеджер лицензий - только чтение и проверка"""
    
    def __init__(self):
        self.license_file = "license.key"
    
    def check_license(self):
        """Проверка действительности лицензии"""
        try:
            # Читаем файл лицензии
            if not os.path.exists(self.license_file):
                return {
                    "valid": False,
                    "client_id": None,
                    "expire_date": None,
                    "days_remaining": 0,
                    "error": "Файл лицензии не найден"
                }
            
            with open(self.license_file, 'r') as f:
                content = f.read().strip()
                if not content:
                    return {
                        "valid": False,
                        "client_id": None,
                        "expire_date": None,
                        "days_remaining": 0,
                        "error": "Файл лицензии пустой"
                    }
                
                # Парсим формат: CLIENT_001:2025-12-23:a4f357e89c932609
                parts = content.split(':')
                if len(parts) != 3:
                    return {
                        "valid": False,
                        "client_id": None,
                        "expire_date": None,
                        "days_remaining": 0,
                        "error": "Неверный формат лицензии"
                    }
                
                license_data = {
                    "client_id": parts[0],
                    "expire_date": parts[1],
                    "hash": parts[2]
                }
            
            # Проверяем дату истечения
            expire_date = datetime.fromisoformat(license_data["expire_date"])
            now = datetime.now()
            
            if now > expire_date:
                license_data["valid"] = False
                license_data["error"] = "Лицензия истекла"
                license_data["days_remaining"] = 0
            else:
                days_remaining = (expire_date - now).days
                license_data["days_remaining"] = days_remaining
                license_data["valid"] = True
                license_data["error"] = None
            
            return license_data
            
        except Exception as e:
            logger.error(f"Ошибка проверки лицензии: {e}")
            return {
                "valid": False,
                "client_id": None,
                "expire_date": None,
                "days_remaining": 0,
                "error": str(e)
            }

# Глобальный менеджер прокси
proxy_manager = ProxyManager()

# Глобальный менеджер лицензий
license_manager = LicenseManager()

# FastAPI приложение
app = FastAPI(title="Multi-Proxy Server", version="1.0.0")

class ProxyRequest(BaseModel):
    profile_id: str
    user_type: str = "user"

class ProxyResponse(BaseModel):
    success: bool
    message: str
    local_port: Optional[int] = None
    profile_id: Optional[str] = None

@app.post("/apply", response_model=ProxyResponse)
async def apply_proxy(request: ProxyRequest):
    """Применение прокси для профиля"""
    try:
        # Сначала проверяем лицензию
        license_data = license_manager.check_license()
        if not license_data["valid"]:
            raise HTTPException(status_code=403, detail="Лицензия недействительна")
        
        if request.profile_id not in proxy_manager.proxies:
            raise HTTPException(status_code=404, detail="Профиль не найден")
        
        # Убираем проверку занятости - любой может подключиться к любому профилю
        config = proxy_manager.proxies[request.profile_id]
        
        # Запускаем прокси сервер
        success = await proxy_manager.start_proxy_server(request.profile_id)
        
        if success:
            return ProxyResponse(
                success=True,
                message=f"Прокси успешно применен для {request.profile_id}",
                local_port=config.local_port,
                profile_id=request.profile_id
            )
        else:
            raise HTTPException(status_code=500, detail="Ошибка запуска прокси")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка применения прокси: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/release/{profile_id}")
async def release_proxy(profile_id: str):
    """Освобождение профиля"""
    try:
        success = await proxy_manager.stop_proxy_server(profile_id)
        
        if success:
            return {"success": True, "message": f"Профиль {profile_id} освобожден"}
        else:
            raise HTTPException(status_code=404, detail="Профиль не найден")
            
    except Exception as e:
        logger.error(f"Ошибка освобождения профиля: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/status/{profile_id}")
async def get_proxy_status(profile_id: str):
    """Получение статуса прокси"""
    try:
        status = proxy_manager.get_proxy_status(profile_id)
        return status
    except Exception as e:
        logger.error(f"Ошибка получения статуса: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/status")
async def get_all_proxies_status():
    """Получение статуса всех прокси"""
    try:
        return proxy_manager.get_all_proxies_status()
    except Exception as e:
        logger.error(f"Ошибка получения статуса всех прокси: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
async def health_check():
    """Проверка здоровья сервиса"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "active_proxies": sum(1 for config in proxy_manager.proxies.values() if config.is_active),
        "total_proxies": len(proxy_manager.proxies)
    }

@app.get("/license/status")
async def check_license_status():
    """Проверка статуса лицензии"""
    try:
        # Проверяем лицензию через менеджер
        license_data = license_manager.check_license()
        
        logger.info(f"🔑 Проверка лицензии: {license_data}")
        return {"license_status": license_data}
        
    except Exception as e:
        logger.error(f"Ошибка проверки лицензии: {e}")
        return {
            "license_status": {
                "valid": False,
                "client_id": None,
                "expire_date": None,
                "days_remaining": 0,
                "error": str(e)
            }
        }

@app.post("/clear/{profile_id}")
async def clear_proxy(profile_id: str):
    """Очистка конкретного прокси"""
    try:
        success = await proxy_manager.stop_proxy_server(profile_id)
        return {"success": success, "message": f"Прокси {profile_id} очищен"}
    except Exception as e:
        logger.error(f"Ошибка очистки прокси: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/clear")
async def clear_all_proxies():
    """Очистка всех прокси"""
    try:
        for profile_id in proxy_manager.proxies.keys():
            await proxy_manager.stop_proxy_server(profile_id)
        
        return {"success": True, "message": "Все прокси очищены"}
    except Exception as e:
        logger.error(f"Ошибка очистки всех прокси: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Функция для запуска сервера
def run_server():
    """Запуск сервера"""
    logger.info("🚀 Запуск многопользовательского прокси-сервера...")
    logger.info(f"📊 Настроено {len(proxy_manager.proxies)} прокси профилей")
    
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8765,
        log_level="info"
    )

if __name__ == "__main__":
    run_server()