#!/usr/bin/env python3
import os
import signal
import subprocess
import shutil
import hashlib
import hmac
import logging
from pathlib import Path
from typing import Optional, Dict, Any
from datetime import datetime, timedelta

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

APP = FastAPI(title="Auto Proxy Connector Helper", version="1.0.0")

# Добавляем CORS middleware
APP.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Разрешаем все домены
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Middleware для проверки лицензии
@APP.middleware("http")
async def license_check_middleware(request: Request, call_next):
    # Исключаем некоторые endpoints из проверки
    excluded_paths = ["/health", "/license/status", "/docs", "/openapi.json"]
    
    if request.url.path not in excluded_paths:
        if not license_status["valid"]:
            return JSONResponse(
                status_code=402,  # Payment Required
                content={
                    "error": "Лицензия недействительна",
                    "detail": license_status.get("error", "Требуется действующая лицензия"),
                    "license_status": license_status
                }
            )
    
    response = await call_next(request)
    return response

BASE_DIR = Path.home() / ".config" / "apc_helper"
BASE_DIR.mkdir(parents=True, exist_ok=True)

# Настройка логирования
LOG_FILE = BASE_DIR / "server.log"

# Создаем логгер
logger = logging.getLogger("apc_server")
logger.setLevel(logging.INFO)

# Файловый handler
file_handler = logging.FileHandler(LOG_FILE, encoding='utf-8')
file_handler.setLevel(logging.INFO)

# Консольный handler
console_handler = logging.StreamHandler()
console_handler.setLevel(logging.INFO)

# Формат логов
formatter = logging.Formatter('%(asctime)s | %(levelname)s | %(message)s', datefmt='%Y-%m-%d %H:%M:%S')
file_handler.setFormatter(formatter)
console_handler.setFormatter(formatter)

logger.addHandler(file_handler)
logger.addHandler(console_handler)

logger.info("=" * 80)
logger.info("🚀 AUTO PROXY CONNECTOR SERVER STARTED")
logger.info("=" * 80)

# Секретный ключ для подписи лицензий (в продакшене должен быть уникальным)
SECRET_KEY = "apc_proxy_connector_secret_2025"

# Словарь для отслеживания активных tinyproxy процессов по портам
active_processes: Dict[int, subprocess.Popen] = {}

# Убрали отслеживание активных сеансов

# Состояние лицензии
license_status = {
    "valid": False,
    "client_id": None,
    "expire_date": None,
    "days_remaining": 0
}


# ==================== СИСТЕМА ЛИЦЕНЗИРОВАНИЯ ====================

def generate_signature(client_id: str, expire_date: str, secret: str = SECRET_KEY) -> str:
    """Генерирует подпись для лицензионного ключа"""
    data = f"{client_id}:{expire_date}"
    signature = hmac.new(secret.encode(), data.encode(), hashlib.sha256).hexdigest()[:16]
    return signature


def generate_license_key(client_id: str, days: int = 30) -> str:
    """Генерирует лицензионный ключ на указанное количество дней"""
    expire_date = (datetime.now() + timedelta(days=days)).strftime("%Y-%m-%d")
    signature = generate_signature(client_id, expire_date)
    license_key = f"{client_id}:{expire_date}:{signature}"
    return license_key


def verify_license_key(license_key: str) -> Dict[str, Any]:
    """Проверяет лицензионный ключ"""
    try:
        parts = license_key.strip().split(":")
        if len(parts) != 3:
            return {"valid": False, "error": "Неверный формат лицензии"}
        
        client_id, expire_date, signature = parts
        
        # Проверяем подпись
        expected_signature = generate_signature(client_id, expire_date)
        if signature != expected_signature:
            return {"valid": False, "error": "Неверная подпись лицензии"}
        
        # Проверяем дату окончания
        expire_dt = datetime.strptime(expire_date, "%Y-%m-%d")
        now = datetime.now()
        
        if now > expire_dt:
            days_expired = (now - expire_dt).days
            return {
                "valid": False, 
                "error": f"Лицензия истекла {days_expired} дней назад",
                "client_id": client_id,
                "expire_date": expire_date,
                "days_remaining": -days_expired
            }
        
        days_remaining = (expire_dt - now).days
        
        return {
            "valid": True,
            "client_id": client_id,
            "expire_date": expire_date,
            "days_remaining": days_remaining
        }
    
    except Exception as e:
        return {"valid": False, "error": f"Ошибка проверки лицензии: {str(e)}"}


def load_license() -> Dict[str, Any]:
    """Загружает и проверяет лицензию из файла"""
    license_file = Path("license.key")
    
    if not license_file.exists():
        return {"valid": False, "error": "Файл лицензии не найден"}
    
    try:
        license_key = license_file.read_text().strip()
        return verify_license_key(license_key)
    except Exception as e:
        return {"valid": False, "error": f"Ошибка чтения лицензии: {str(e)}"}


def save_license(license_key: str) -> bool:
    """Сохраняет лицензионный ключ в файл"""
    license_file = Path("license.key")
    try:
        license_file.write_text(license_key)
        print(f"✅ Лицензия сохранена в {license_file}")
        return True
    except Exception as e:
        print(f"❌ Ошибка сохранения лицензии: {e}")
        return False


# Загружаем лицензию при старте
license_info = load_license()
license_status.update(license_info)

if license_status["valid"]:
    logger.info(f"✅ Лицензия действительна")
    logger.info(f"   Клиент: {license_status['client_id']}")
    logger.info(f"   Действует до: {license_status['expire_date']}")
    logger.info(f"   Осталось дней: {license_status['days_remaining']}")
else:
    logger.warning(f"❌ Лицензия недействительна: {license_status.get('error', 'Неизвестная ошибка')}")
    logger.warning(f"⚠️  СЕРВЕР РАБОТАЕТ В ОГРАНИЧЕННОМ РЕЖИМЕ")

# ==================== КОНЕЦ СИСТЕМЫ ЛИЦЕНЗИРОВАНИЯ ====================


class ApplyPayload(BaseModel):
    ip: str
    port: int
    username: str
    password: str
    listen_port: int = Field(3128, description="Local HTTP proxy port")
    user_type: str = Field("user", description="User type: 'admin' or 'user'")
    profile_id: Optional[str] = Field(None, description="Unique profile identifier")


def write_config(payload: ApplyPayload) -> None:
    # Создаем уникальный конфиг для каждого порта
    cfg_path = BASE_DIR / f"tinyproxy_{payload.listen_port}.cfg"
    pid_path = BASE_DIR / f"tinyproxy_{payload.listen_port}.pid"
    
    cfg = f"""User tinyproxy
Group tinyproxy
Port {payload.listen_port}
Listen 0.0.0.0
Timeout 600
DefaultErrorFile "/usr/share/tinyproxy/default.html"
Logfile "{BASE_DIR}/tinyproxy_{payload.listen_port}.log"
LogLevel Info
PidFile "{pid_path}"
MaxClients 100
MinSpareServers 5
MaxSpareServers 20
StartServers 10
MaxRequestsPerChild 0
ViaProxyName "tinyproxy"
Upstream http {payload.username}:{payload.password}@{payload.ip}:{payload.port}
"""
    cfg_path.write_text(cfg)
    return cfg_path, pid_path


def stop_tinyproxy_on_port(port: int) -> None:
    """Останавливает tinyproxy на конкретном порту"""
    if port in active_processes:
        try:
            active_processes[port].terminate()
            active_processes[port].wait(timeout=5)
        except Exception:
            try:
                active_processes[port].kill()
            except Exception:
                pass
        finally:
            del active_processes[port]
    
    # Также попробуем убить по PID файлу
    pid_path = BASE_DIR / f"tinyproxy_{port}.pid"
    if pid_path.exists():
        try:
            pid = int(pid_path.read_text().strip())
            os.kill(pid, signal.SIGTERM)
        except Exception:
            pass
        finally:
            try:
                pid_path.unlink()
            except Exception:
                pass


def start_tinyproxy_on_port(payload: ApplyPayload) -> None:
    """Запускает tinyproxy на конкретном порту"""
    # Сначала останавливаем существующий процесс на этом порту
    stop_tinyproxy_on_port(payload.listen_port)
    
    # Создаем конфиг
    cfg_path, pid_path = write_config(payload)
    
    # Запускаем новый процесс
    proc = subprocess.Popen(
        ["tinyproxy", "-c", str(cfg_path)], 
        stdout=subprocess.DEVNULL, 
        stderr=subprocess.DEVNULL
    )
    
    # Сохраняем процесс в словаре
    active_processes[payload.listen_port] = proc
    pid_path.write_text(str(proc.pid))


@APP.post("/apply")
def apply_proxy(payload: ApplyPayload):
    # Ensure tinyproxy is available
    if shutil.which("tinyproxy") is None:
        logger.error("❌ tinyproxy не установлен")
        raise HTTPException(status_code=500, detail="tinyproxy not installed. Install: sudo apt install tinyproxy")
    
    # Генерируем profile_id если не указан (для обратной совместимости)
    profile_id = payload.profile_id or f"{payload.ip}:{payload.listen_port}"
    
    logger.info("=" * 80)
    logger.info(f"📥 ЗАПРОС НА ПОДКЛЮЧЕНИЕ")
    logger.info(f"   Профиль: {profile_id}")
    logger.info(f"   Тип пользователя: {payload.user_type}")
    logger.info(f"   IP назначения: {payload.ip}")
    logger.info(f"   Локальный порт: {payload.listen_port}")
    
    # Убираем проверку занятости профилей - теперь любой может подключиться
    
    # Запускаем tinyproxy на конкретном порту
    start_tinyproxy_on_port(payload)
    
    # Убрали регистрацию активных сеансов
    
    logger.info(f"✅ УСПЕШНО ПОДКЛЮЧЕНО")
    logger.info(f"   Профиль: {profile_id}")
    logger.info(f"   Тип пользователя: {payload.user_type}")
    logger.info(f"   IP назначения: {payload.ip}")
    logger.info(f"   Локальный порт: {payload.listen_port}")
    logger.info(f"   Время подключения: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    logger.info("=" * 80)
    
    return {"ok": True, "listen": payload.listen_port, "profile_id": profile_id}


@APP.post("/clear")
def clear_proxy():
    logger.info(f"🧹 Очистка всех процессов | Активных процессов: {len(active_processes)}")
    
    # Останавливаем все активные процессы
    for port in list(active_processes.keys()):
        stop_tinyproxy_on_port(port)
    
    logger.info("✅ Все процессы очищены")
    return {"ok": True}


@APP.post("/clear/{port}")
def clear_proxy_on_port(port: int):
    logger.info(f"🧹 Очистка порта {port}")
    
    # Останавливаем tinyproxy на конкретном порту
    stop_tinyproxy_on_port(port)
    
    logger.info(f"✅ Порт {port} очищен")
    return {"ok": True, "port": port}


@APP.post("/release/{profile_id}")
def release_profile(profile_id: str):
    """Освобождает профиль при выходе пользователя"""
    logger.info("=" * 80)
    logger.info(f"🚪 ВЫХОД ПОЛЬЗОВАТЕЛЯ")
    logger.info(f"   Профиль: {profile_id}")
    logger.info("=" * 80)
    
    return {"ok": True, "profile_id": profile_id}


@APP.get("/sessions")
def get_active_sessions():
    """Возвращает список активных процессов"""
    logger.info(f"📊 Запрос списка активных процессов | Всего: {len(active_processes)}")
    return {"processes": list(active_processes.keys())}


# Убрали endpoint проверки занятости профилей

# Убрали endpoint'ы проверки прокси


@APP.get("/health")
def health():
    return {"status": "ok"}


# ==================== ENDPOINTS ДЛЯ УПРАВЛЕНИЯ ЛИЦЕНЗИЯМИ ====================

@APP.get("/license/status")
def get_license_status():
    """Возвращает статус текущей лицензии"""
    logger.info(f"🔑 Проверка статуса лицензии | Действительна: {license_status['valid']} | Клиент: {license_status.get('client_id', 'N/A')}")
    return {
        "license_status": license_status,
        "server_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }


@APP.post("/license/activate")
def activate_license(license_key: str):
    """Активирует лицензию"""
    global license_status
    
    logger.info(f"🔐 Попытка активации лицензии | Ключ: {license_key[:20]}...")
    
    # Проверяем лицензию
    result = verify_license_key(license_key)
    
    if result["valid"]:
        logger.info(f"✅ Лицензия валидна | Клиент: {result['client_id']} | До: {result['expire_date']}")
        
        # Сохраняем лицензию
        if save_license(license_key):
            license_status.update(result)
            logger.info(f"✅ ЛИЦЕНЗИЯ АКТИВИРОВАНА | Клиент: {result['client_id']} | Дней: {result['days_remaining']}")
            return {
                "success": True,
                "message": "Лицензия успешно активирована",
                "license_status": license_status
            }
        else:
            logger.error("❌ Ошибка сохранения лицензии в файл")
            return {
                "success": False,
                "message": "Ошибка сохранения лицензии"
            }
    else:
        logger.warning(f"❌ Невалидная лицензия | Ошибка: {result.get('error', 'Неизвестно')}")
        return {
            "success": False,
            "message": result.get("error", "Неверная лицензия"),
            "license_status": result
        }


@APP.post("/license/generate")
def generate_new_license(client_id: str, days: int = 30, admin_key: str = ""):
    """Генерирует новую лицензию (требуется админский ключ)"""
    # Простая защита - админский ключ
    ADMIN_KEY = "admin_generate_key_2025"
    
    logger.info(f"🔧 Запрос генерации лицензии | Клиент: {client_id} | Дней: {days}")
    
    if admin_key != ADMIN_KEY:
        logger.warning(f"❌ Неверный админский ключ при генерации лицензии")
        raise HTTPException(status_code=403, detail="Неверный админский ключ")
    
    license_key = generate_license_key(client_id, days)
    expire_date = (datetime.now() + timedelta(days=days)).strftime("%Y-%m-%d")
    
    logger.info(f"✅ ЛИЦЕНЗИЯ СГЕНЕРИРОВАНА | Клиент: {client_id} | До: {expire_date} | Дней: {days}")
    
    return {
        "success": True,
        "client_id": client_id,
        "days": days,
        "license_key": license_key,
        "expire_date": expire_date
    }

# ==================== КОНЕЦ ENDPOINTS ЛИЦЕНЗИЙ ====================


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(APP, host="127.0.0.1", port=8765)


