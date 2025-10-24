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
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import threading
import time
import hashlib
import os
import subprocess
import asyncio

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
        # Старые прокси (закомментированы)
        # default_proxies = [
        #     {
        #         "profile_id": "profile1",
        #         "ip": "45.139.125.123",
        #         "port": 1050,
        #         "username": "fOwk1c",
        #         "password": "hBP8MJjtKg",
        #         "region": "Россия",
        #         "local_port": 3128
        #     },
        #     {
        #         "profile_id": "profile2", 
        #         "ip": "91.188.244.4",
        #         "port": 1050,
        #         "username": "fOwk1c",
        #         "password": "hBP8MJjtKg",
        #         "region": "Россия",
        #         "local_port": 3129
        #     },
        #     {
        #         "profile_id": "profile3",
        #         "ip": "185.181.245.211", 
        #         "port": 1050,
        #         "username": "fOwk1c",
        #         "password": "hBP8MJjtKg",
        #         "region": "Россия",
        #         "local_port": 3130
        #     },
        #     {
        #         "profile_id": "profile4",
        #         "ip": "188.130.187.174",
        #         "port": 1050, 
        #         "username": "fOwk1c",
        #         "password": "hBP8MJjtKg",
        #         "region": "Россия",
        #         "local_port": 3131
        #     }
        # ]
        
        # Новые прокси pool.proxy.market
        default_proxies = [
            {
                "profile_id": "profile1",
                "ip": "pool.proxy.market",
                "port": 10050,
                "username": "JhCkljdaqJvL",
                "password": "57MjVdoa",
                "region": "Россия",
                "local_port": 3128
            },
            {
                "profile_id": "profile2", 
                "ip": "pool.proxy.market",
                "port": 10050,
                "username": "CRlaRkToaY9J",
                "password": "7mEZj019",
                "region": "Россия",
                "local_port": 3129
            },
            {
                "profile_id": "profile3",
                "ip": "pool.proxy.market", 
                "port": 10050,
                "username": "qoTweJTfbBF5",
                "password": "qe7C5b1h",
                "region": "Россия",
                "local_port": 3130
            },
            {
                "profile_id": "profile4",
                "ip": "pool.proxy.market",
                "port": 10050, 
                "username": "d9LfwLJoTpRA",
                "password": "byRTx5tw",
                "region": "Россия",
                "local_port": 3131
            },
            {
                "profile_id": "profile5",
                "ip": "pool.proxy.market",
                "port": 10050, 
                "username": "Kp8a9dXI5cP4",
                "password": "1AeYMBul",
                "region": "Россия",
                "local_port": 3132
            }
        ]
        
        # Добавляем дополнительные профили (используем те же прокси для экономии)
        # Поскольку у нас только 5 рабочих прокси, будем их переиспользовать
        for i in range(6, 16):  # profile6-profile15
            # Циклически используем доступные прокси
            proxy_index = (i - 6) % 5  # 0-4 для наших 5 прокси
            working_proxies = [
                {"username": "JhCkljdaqJvL", "password": "57MjVdoa"},
                {"username": "CRlaRkToaY9J", "password": "7mEZj019"},
                {"username": "qoTweJTfbBF5", "password": "qe7C5b1h"},
                {"username": "d9LfwLJoTpRA", "password": "byRTx5tw"},
                {"username": "Kp8a9dXI5cP4", "password": "1AeYMBul"}
            ]
            
            default_proxies.append({
                "profile_id": f"profile{i}",
                "ip": "pool.proxy.market",
                "port": 10050,
                "username": working_proxies[proxy_index]["username"],
                "password": working_proxies[proxy_index]["password"],
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
        
        # Останавливаем предыдущий прокси если он запущен
        if profile_id in self.server_tasks:
            logger.info(f"🔄 Перезапуск прокси для {profile_id}")
            await self.stop_proxy_server(profile_id)
        
        # Принудительно освобождаем порт
        self._kill_port_process(proxy_config.local_port)
        
        try:
            # Создаем HTTP прокси сервер
            app = web.Application()
            
            # Добавляем специальный обработчик для CONNECT запросов ПЕРВЫМ
            async def connect_handler(request):
                logger.info(f"CONNECT запрос: {request.method} {request.url}")
                logger.info(f"CONNECT заголовки: {dict(request.headers)}")
                
                # Получаем целевой хост и порт из URL
                target_host = str(request.url.host)
                target_port = request.url.port or 443
                
                logger.info(f"CONNECT к {target_host}:{target_port}")
                
                # Для HTTPS туннелирования просто возвращаем 200 OK
                # Браузер будет использовать это соединение для HTTPS трафика
                return web.Response(
                    status=200,
                    text="Connection established",
                    headers={
                        "Connection": "keep-alive",
                        "Proxy-Agent": "ProxyServer/1.0",
                        "Content-Length": "0",
                        "Proxy-Connection": "keep-alive"
                    }
                )
            
            # Регистрируем CONNECT обработчики ПЕРВЫМИ
            app.router.add_route('CONNECT', '/', connect_handler)
            app.router.add_route('CONNECT', '/{path:.*}', connect_handler)
            
            # Добавляем обработчик для всех пустых запросов
            async def empty_handler(request):
                logger.info(f"Пустой запрос: {request.method} {request.url}")
                return web.Response(
                    status=200,
                    text="OK",
                    headers={"Content-Length": "0"}
                )
            
            app.router.add_route('*', '/', empty_handler)
            
            # Добавляем универсальный обработчик для остальных запросов
            app.router.add_route('*', '/{path:.*}', self.create_proxy_handler(proxy_config))
            
            # Добавляем специальный обработчик для CONNECT без пути
            async def universal_connect_handler(request):
                logger.info(f"Универсальный CONNECT: {request.method} {request.url}")
                return web.Response(
                    status=200,
                    text="Connection established",
                    headers={
                        "Connection": "keep-alive",
                        "Proxy-Agent": "ProxyServer/1.0",
                        "Content-Length": "0",
                        "Proxy-Connection": "keep-alive"
                    }
                )
            
            # Регистрируем универсальный CONNECT обработчик
            app.router.add_route('CONNECT', '*', universal_connect_handler)
            
            # Запускаем сервер
            runner = web.AppRunner(app)
            await runner.setup()
            
            site = web.TCPSite(runner, '0.0.0.0', proxy_config.local_port)
            await site.start()
            
            # Сохраняем ссылку на сервер для остановки
            self.server_tasks[profile_id] = runner
            
            # Прокси запущен
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
                    
                    # Проверяем, что URL не пустой
                    if not str(request.url).strip() or str(request.url) == 'http://':
                        logger.warning("Пустой CONNECT запрос, возвращаем 200 OK")
                        return web.Response(
                            status=200,
                            text="Connection established",
                            headers={
                                "Connection": "keep-alive",
                                "Proxy-Agent": "ProxyServer/1.0",
                                "Content-Length": "0"
                            }
                        )
                    
                    # Для CONNECT запросов возвращаем 200 OK
                    return web.Response(
                        status=200,
                        text="Connection established",
                        headers={
                            "Connection": "keep-alive",
                            "Proxy-Agent": "ProxyServer/1.0",
                            "Content-Length": "0"
                        }
                    )
                
                # Обрабатываем обычные HTTP запросы
                target_url = str(request.url)
                
                # Убираем прокси-префикс если он есть
                if f'localhost:{proxy_config.local_port}/' in target_url:
                    target_url = target_url.split(f'localhost:{proxy_config.local_port}/')[1]
                elif f'127.0.0.1:{proxy_config.local_port}/' in target_url:
                    target_url = target_url.split(f'127.0.0.1:{proxy_config.local_port}/')[1]
                
                # Добавляем http:// если нет протокола
                if not target_url.startswith('http://') and not target_url.startswith('https://'):
                    target_url = 'http://' + target_url
                
                logger.info(f"Целевой URL: {target_url}")
                
                # Проверяем, не является ли запрос к самому API серверу
                if '94.241.175.200:8765' in target_url or 'localhost:8765' in target_url:
                    logger.warning("Запрос к API серверу через прокси - пропускаем прокси")
                    # Для запросов к API серверу не используем прокси
                    async with httpx.AsyncClient(timeout=30.0) as client:
                        response = await client.request(
                            method=request.method,
                            url=target_url,
                            headers=dict(request.headers),
                            content=await request.read() if request.method in ['POST', 'PUT', 'PATCH'] else None
                        )
                else:
                    # Используем httpx для лучшей поддержки прокси
                    proxy_url = f'http://{proxy_config.username}:{proxy_config.password}@{proxy_config.ip}:{proxy_config.port}'
                    
                    # Создаем заголовки без Proxy-Authorization (httpx обрабатывает это автоматически)
                    headers = dict(request.headers)
                    headers.pop('Proxy-Authorization', None)
                    headers.pop('Proxy-Connection', None)
                    
                    # Добавляем retry логику для нестабильных прокси
                    max_retries = 2
                    for attempt in range(max_retries):
                        try:
                            async with httpx.AsyncClient(
                                proxies={
                                    'http://': proxy_url, 
                                    'https://': proxy_url
                                },
                                timeout=60.0,
                                follow_redirects=True,
                                limits=httpx.Limits(max_keepalive_connections=5, max_connections=10)
                            ) as client:
                                
                                # Выполняем запрос через прокси
                                response = await client.request(
                                    method=request.method,
                                    url=target_url,
                                    headers=headers,
                                    content=await request.read() if request.method in ['POST', 'PUT', 'PATCH'] else None
                                )
                                
                                # Если запрос успешен, выходим из retry цикла
                                break
                                
                        except (httpx.ReadTimeout, httpx.ConnectTimeout) as e:
                            if attempt < max_retries - 1:
                                logger.warning(f"Попытка {attempt + 1} неудачна, повторяем: {e}")
                                await asyncio.sleep(1)
                                continue
                            else:
                                raise
                    
                # Возвращаем ответ
                return web.Response(
                    body=response.content,
                    status=response.status_code,
                    headers=dict(response.headers)
                )
                       
            except httpx.ReadTimeout as e:
                logger.warning(f"Таймаут прокси-запроса: {e}")
                return web.Response(
                    text="Прокси таймаут - попробуйте еще раз", 
                    status=504,
                    headers={"Retry-After": "5"}
                )
            except httpx.ConnectTimeout as e:
                logger.warning(f"Таймаут подключения к прокси: {e}")
                return web.Response(
                    text="Прокси недоступен - проверьте соединение", 
                    status=503,
                    headers={"Retry-After": "10"}
                )
            except Exception as e:
                logger.error(f"Ошибка прокси-запроса: {e}")
                logger.error(f"Тип ошибки: {type(e)}")
                import traceback
                logger.error(f"Traceback: {traceback.format_exc()}")
                return web.Response(text=f"Ошибка прокси: {e}", status=500)
        
        return proxy_handler
    
    def _encode_auth(self, username: str, password: str) -> str:
        """Кодирует аутентификацию для Basic Auth"""
        import base64
        auth_string = f"{username}:{password}"
        encoded = base64.b64encode(auth_string.encode('utf-8')).decode('utf-8')
        logger.info(f"Аутентификация для {username}: {encoded}")
        return encoded
    
    async def stop_proxy_server(self, profile_id: str) -> bool:
        """Остановка прокси-сервера для конкретного профиля"""
        if profile_id not in self.proxies:
            return False
        
        proxy_config = self.proxies[profile_id]
        
        # Останавливаем сервер если он запущен
        if profile_id in self.server_tasks:
            runner = self.server_tasks[profile_id]
            await runner.cleanup()
            del self.server_tasks[profile_id]
        
        # Прокси остановлен
        
        logger.info(f"🛑 Прокси сервер остановлен для {profile_id}")
        return True
    
    def _kill_port_process(self, port: int):
        """Принудительно освобождает порт"""
        try:
            # Используем fuser для поиска и убийства процесса на порту
            result = subprocess.run(
                ['fuser', '-k', f'{port}/tcp'],
                capture_output=True,
                text=True,
                timeout=5
            )
            if result.returncode == 0:
                logger.info(f"🔫 Освобожден порт {port}")
            else:
                logger.debug(f"Порт {port} уже свободен")
        except Exception as e:
            logger.warning(f"Не удалось освободить порт {port}: {e}")
    
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
    
    async def check_proxy_health(self, profile_id: str) -> bool:
        """Проверяет здоровье прокси-соединения"""
        if profile_id not in self.proxies:
            return False
        
        proxy_config = self.proxies[profile_id]
        
        try:
            import requests
            
            # Тестируем подключение через прокси
            proxy_url = f'http://{proxy_config.username}:{proxy_config.password}@{proxy_config.ip}:{proxy_config.port}'
            
            # Быстрый тест подключения
            response = requests.get(
                'http://httpbin.org/ip', 
                proxies={'http': proxy_url, 'https': proxy_url}, 
                timeout=10,
                headers={'User-Agent': 'Proxy-Health-Check/1.0'}
            )
            
            if response.status_code == 200:
                logger.info(f"✅ Прокси здоров: {profile_id} -> {proxy_config.ip}:{proxy_config.port}")
                return True
            else:
                logger.warning(f"⚠️ Прокси отвечает с кодом {response.status_code}: {profile_id}")
                return False
                
        except Exception as e:
            logger.error(f"❌ Прокси нездоров: {profile_id} - {e}")
            return False

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

# Добавляем CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
        "total_profiles": len(proxy_manager.proxies),
        "total_proxies": len(proxy_manager.proxies)
    }

@app.get("/health/{profile_id}")
async def check_proxy_health_endpoint(profile_id: str):
    """Проверяет здоровье конкретного прокси"""
    try:
        is_healthy = await proxy_manager.check_proxy_health(profile_id)
        return {
            "healthy": is_healthy,
            "profile_id": profile_id,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Ошибка проверки здоровья прокси {profile_id}: {e}")
        return {"healthy": False, "error": str(e)}

@app.get("/test/{profile_id}")
async def test_proxy_connection(profile_id: str):
    """Тестирует подключение через прокси"""
    try:
        if profile_id not in proxy_manager.proxies:
            raise HTTPException(status_code=404, detail="Профиль не найден")
        
        proxy_config = proxy_manager.proxies[profile_id]
        
        # Тестируем подключение
        import requests
        proxy_url = f'http://{proxy_config.username}:{proxy_config.password}@{proxy_config.ip}:{proxy_config.port}'
        
        response = requests.get('http://httpbin.org/ip', 
                              proxies={'http': proxy_url, 'https': proxy_url}, 
                              timeout=10)
        
        return {
            "success": response.status_code == 200,
            "status_code": response.status_code,
            "response": response.json() if response.status_code == 200 else None,
            "profile_id": profile_id,
            "proxy": f"{proxy_config.ip}:{proxy_config.port}"
        }
        
    except Exception as e:
        logger.error(f"Ошибка тестирования прокси {profile_id}: {e}")
        return {"success": False, "error": str(e)}

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