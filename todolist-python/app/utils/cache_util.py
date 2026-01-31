import os
import json
import time
from app.utils.config_util import config_util
from app.utils.constants import USE_CACHE, CACHE_DIR

class CacheUtil:
    """
    提供内存缓存和文件缓存两级缓存功能
    核心设计：
    - 异步优先：所有文件I/O操作均为异步，返回Promise，避免阻塞事件循环。
    - 自动刷新：支持loadDataFn函数，在缓存未命中或过期时自动异步加载。
    - 永久缓存：支持permanent标志，永久数据仅存留于内存中。
    """
    def __init__(self, options=None):
        """
        构造函数
        
        Args:
            options: 配置选项
                - cache_dir: 缓存文件目录
                - default_ttl: 默认过期时间（毫秒），0表示永不过期
                - file_extension: 缓存文件扩展名
        """
        if options is None:
            options = {}
        self.memory_cache = {}
        self.cache_dir = options.get("cache_dir", CACHE_DIR)
        self.default_ttl = options.get("default_ttl", 3600000)  # 默认1小时
        self.file_extension = options.get("file_extension", "json")
        # 确保缓存目录存在
        os.makedirs(self.cache_dir, exist_ok=True)
    
    # 统一日志方法
    def _log(self, level, message, meta=None):
        if meta is None:
            meta = {}
        if os.environ.get("NODE_ENV") == "production" and level == "debug":
            return
        
        if level == "error":
            print(f"ERROR: {message}")
            if "error" in meta and os.environ.get("NODE_ENV") != "production":
                print(f"ERROR: {str(meta['error'])}")
        elif level == "warn":
            print(f"WARN: {message}")
        elif level == "debug":
            print(f"DEBUG: {message}")
        else:
            print(f"INFO: {message}")
    
    # 创建缓存项的通用方法
    def _create_cache_item(self, data, options, timestamp=None):
        ttl = options.get("ttl", self.default_ttl)
        permanent = options.get("permanent", False)
        return {
            "data": data,
            "timestamp": timestamp or time.time() * 1000,
            "ttl": ttl,
            "permanent": permanent
        }
    
    # 保存缓存项的同步方法
    def _save_cache_item(self, key, cache_item):
        # 更新内存缓存
        self.memory_cache[key] = cache_item
        
        # 只有非永久数据才写入文件缓存
        if not cache_item["permanent"]:
            try:
                file_path = self._get_file_path(key)
                dir_path = os.path.dirname(file_path)
                # 同步按需创建目录
                os.makedirs(dir_path, exist_ok=True)
                with open(file_path, "w", encoding="utf8") as f:
                    json.dump(cache_item, f, ensure_ascii=False, indent=2)
                return True
            except Exception as error:
                self._log("error", f"写入缓存文件失败: {key}", {"error": error})
                return False
        return True
    
    # 生成安全的缓存键名
    def _get_safe_key(self, key):
        import re
        return re.sub(r"[^a-zA-Z0-9_-]", "_", key)
    
    # 生成文件缓存键
    def generate_file_cache_key(self, filename):
        # 生成安全的文件名，确保点被替换为下划线
        safe_filename = filename.replace(".", "_")
        return f"file_read_{safe_filename}"
    
    # 获取缓存文件路径
    def _get_file_path(self, key):
        safe_key = self._get_safe_key(key)
        return os.path.join(self.cache_dir, f"{safe_key}.{self.file_extension}")
    
    # 从指定源文件同步加载数据
    def _load_from_source_file(self, key, options, now):
        source_file = options.get("source_file")
        if not source_file:
            return None
        
        try:
            self._log("debug", f"尝试从源文件同步加载数据: key={key}, file={source_file}")
            
            # 检查文件是否存在
            if not os.path.exists(source_file):
                self._log("warn", f"源文件不存在: {source_file}")
                return None
            
            with open(source_file, "r", encoding="utf8") as f:
                file_content = f.read()
            
            try:
                file_data = json.loads(file_content)
            except json.JSONDecodeError as parse_error:
                self._log("error", f"解析源文件JSON失败: {source_file}", {"error": parse_error})
                return None
            
            data_to_return = file_data.get("data")
            file_timestamp = file_data.get("timestamp")
            ttl = file_data.get("ttl")
            
            if ttl is None:
                if options.get("permanent") and "ttl" not in options:
                    ttl = 0
                else:
                    ttl = options.get("ttl", self.default_ttl)
            
            if data_to_return is None or file_timestamp is None:
                data_to_return = file_data
                stats = os.stat(source_file)
                file_timestamp = stats.st_mtime * 1000 or now
                self._log("debug", f"检测到非缓存格式数据，进行转换: key={key}")
            
            is_expired = ttl != 0 and now > file_timestamp + ttl
            
            if not is_expired or options.get("allowExpired", False):
                status = "已过期" if is_expired else "未过期"
                self._log("debug", f"成功从源文件同步加载数据: key={key}, {status}")
                
                cache_item = self._create_cache_item(data_to_return, options, file_timestamp)
                self.memory_cache[key] = cache_item
                
                return {
                    "data": data_to_return,
                    "timestamp": file_timestamp,
                    "expired": is_expired,
                    "permanent": bool(options.get("permanent"))
                }
            else:
                self._log("debug", f"数据已过期且不允许使用过期缓存: key={key}")
        except Exception as error:
            self._log("error", f"从源文件同步加载数据时出错: key={key}, file={source_file}", {"error": error})
        return None
    
    # 从默认缓存文件同步加载数据
    def _load_from_default_cache(self, key, options, now):
        try:
            self._log("debug", f"尝试从默认缓存文件同步加载数据: key={key}")
            
            file_path = self._get_file_path(key)
            
            if not os.path.exists(file_path):
                self._log("debug", f"默认缓存文件不存在: {file_path}")
                return None
            
            with open(file_path, "r", encoding="utf8") as f:
                file_content = f.read()
            
            try:
                file_item = json.loads(file_content)
            except json.JSONDecodeError as parse_error:
                self._log("error", f"解析默认缓存文件JSON失败: {file_path}", {"error": parse_error})
                return None
            
            file_data = file_item.get("data")
            file_timestamp = file_item.get("timestamp")
            ttl = file_item.get("ttl")
            is_expired = ttl != 0 and now > file_timestamp + ttl
            
            if not is_expired or options.get("allowExpired", False):
                # 同步到内存缓存
                self.memory_cache[key] = {"data": file_data, "timestamp": file_timestamp, "ttl": ttl}
                
                status = "已过期" if is_expired else "未过期"
                self._log("debug", f"成功从默认缓存文件同步加载数据: key={key}, {status}")
                
                return {
                    "data": file_data,
                    "timestamp": file_timestamp,
                    "expired": is_expired,
                    "permanent": bool(file_item.get("permanent"))
                }
            else:
                self._log("debug", f"数据已过期且不允许使用过期缓存: key={key}")
        except Exception as error:
            self._log("error", f"从默认缓存文件同步加载数据时出错: key={key}", {"error": error})
        return None
    
    # 从自定义加载函数加载数据（同步）
    def _load_from_custom_loader(self, key, options):
        try:
            self._log("debug", f"尝试从自定义加载函数同步加载数据: key={key}")
            
            # 同步执行加载函数
            data = options.get("load_data_fn")()
            if data is None:
                self._log("warn", f"自定义加载函数返回无效数据: key={key}, 返回值={data}")
                return None
            
            self._log("debug", f"成功从自定义加载函数获取数据: key={key}")
            
            # 使用同步方法设置缓存
            set_result = self.set_data(key, data, {
                "ttl": options.get("ttl", self.default_ttl),
                "source_file": options.get("source_file"),
                "permanent": bool(options.get("permanent"))
            })
            
            if not set_result:
                self._log("warn", f"数据加载成功但缓存设置失败: key={key}")
            
            return {
                "data": data,
                "timestamp": time.time() * 1000,
                "expired": False,
                "permanent": bool(options.get("permanent"))
            }
        except Exception as error:
            self._log("error", f"从自定义加载函数同步加载数据时出错: key={key}", {"error": error})
            return None
    
    # 从自定义加载函数加载数据（异步）
    async def _load_from_custom_loader_async(self, key, options):
        try:
            self._log("debug", f"尝试从自定义加载函数异步加载数据: key={key}")
            
            # 异步执行加载函数
            data = await options.get("load_data_fn")()
            if data is None:
                self._log("warn", f"自定义加载函数返回无效数据: key={key}, 返回值={data}")
                return None
            
            self._log("debug", f"成功从自定义加载函数获取数据: key={key}")
            
            # 使用异步方法设置缓存
            set_result = self.set_data(key, data, {
                "ttl": options.get("ttl", self.default_ttl),
                "source_file": options.get("source_file"),
                "permanent": bool(options.get("permanent"))
            })
            
            if not set_result:
                self._log("warn", f"数据加载成功但缓存设置失败: key={key}")
            
            return {
                "data": data,
                "timestamp": time.time() * 1000,
                "expired": False,
                "permanent": bool(options.get("permanent"))
            }
        except Exception as error:
            self._log("error", f"从自定义加载函数异步加载数据时出错: key={key}", {"error": error})
            return None
    
    # 同步获取缓存数据（仅数据）
    def get_data(self, key, options=None):
        """
        同步获取缓存数据（仅数据）
        
        Args:
            key: 缓存键
            options: 选项
                - allowExpired: 是否允许使用过期缓存
                - sourceFile: 可选的源文件路径，直接将该文件作为缓存文件使用
                - permanent: 可选的是否永久数据，用于sourceFile配置文件只读，不修改原文件
                - loadDataFn: 可选的自定义数据加载函数，当缓存不存在或已过期时调用（必须是同步函数）
                - ttl: 可选的缓存过期时间，用于loadDataFn加载的数据
        
        Returns:
            缓存的数据，如果不存在则返回None
        """
        if options is None:
            options = {}
        wrapped_data = self.get_wrapped_data(key, options)
        return wrapped_data.get("data") if wrapped_data else None
    
    # 异步获取缓存数据（仅数据）
    async def get_data_async(self, key, options=None):
        """
        异步获取缓存数据（仅数据）
        
        Args:
            key: 缓存键
            options: 选项
                - allowExpired: 是否允许使用过期缓存
                - sourceFile: 可选的源文件路径，直接将该文件作为缓存文件使用
                - permanent: 可选的是否永久数据，用于sourceFile配置文件只读，不修改原文件
                - loadDataFn: 可选的自定义数据加载函数，当缓存不存在或已过期时调用（支持返回Promise的异步函数）
                - ttl: 可选的缓存过期时间，用于loadDataFn加载的数据
        
        Returns:
            缓存的数据，如果不存在则返回None
        """
        if options is None:
            options = {}
        wrapped_data = await self.get_wrapped_data_async(key, options)
        return wrapped_data.get("data") if wrapped_data else None
    
    # 同步获取缓存数据（返回包装后的数据）
    def get_wrapped_data(self, key, options=None):
        """
        同步获取缓存数据（返回包装后的数据 {data, timestamp, expired}）
        核心功能：同步获取缓存，如缓存不存在或已过期，可通过options.load_data_fn同步加载数据并更新缓存
        
        Args:
            key: 缓存键
            options: 选项
                - allowExpired: 是否允许使用过期缓存
                - source_file: 可选的源文件路径，直接将该文件作为缓存文件使用
                - permanent: 可选的是否永久数据，用于sourceFile配置文件只读，不修改原文件
                - load_data_fn: 可选的自定义数据加载函数，当缓存不存在或已过期时调用（必须是同步函数）
                - ttl: 可选的缓存过期时间，用于load_data_fn加载的数据
        
        Returns:
            包装后的缓存数据 {data, timestamp, expired, permanent}，如果不存在则返回None
        """
        if not USE_CACHE:
            return None
        if options is None:
            options = {}
        now = time.time() * 1000
        safe_key = self._get_safe_key(key)
        
        # 1. 尝试从内存缓存获取（同步）
        memory_item = self.memory_cache.get(safe_key)
        if memory_item:
            is_expired = memory_item["ttl"] != 0 and now > memory_item["timestamp"] + memory_item["ttl"]
            
            if not is_expired or options.get("allowExpired", False):
                return {
                    "data": memory_item["data"],
                    "timestamp": memory_item["timestamp"],
                    "expired": is_expired,
                    "permanent": bool(memory_item.get("permanent"))
                }
        
        # 2. 尝试从文件缓存获取 (同步)
        file_data = None
        if options.get("source_file"):
            file_data = self._load_from_source_file(safe_key, options, now)
        else:
            file_data = self._load_from_default_cache(safe_key, options, now)
        
        if file_data:
            return file_data
        
        # 3. 尝试使用自定义同步数据加载函数
        if options.get("load_data_fn") and callable(options.get("load_data_fn")):
            custom_data = self._load_from_custom_loader(safe_key, options)
            if custom_data:
                return custom_data
        
        return None
    
    # 异步获取缓存数据（返回包装后的数据）
    async def get_wrapped_data_async(self, key, options=None):
        """
        异步获取缓存数据（返回包装后的数据 {data, timestamp, expired}）
        核心功能：异步获取缓存，如缓存不存在或已过期，可通过options.load_data_fn异步加载数据并更新缓存
        
        Args:
            key: 缓存键
            options: 选项
                - allowExpired: 是否允许使用过期缓存
                - source_file: 可选的源文件路径，直接将该文件作为缓存文件使用
                - permanent: 可选的是否永久数据，用于sourceFile配置文件只读，不修改原文件
                - load_data_fn: 可选的自定义数据加载函数，当缓存不存在或已过期时调用（支持返回Promise的异步函数）
                - ttl: 可选的缓存过期时间，用于load_data_fn加载的数据
        
        Returns:
            包装后的缓存数据 {data, timestamp, expired, permanent}，如果不存在则返回None
        """
        if not USE_CACHE:
            return None
        if options is None:
            options = {}
        now = time.time() * 1000
        safe_key = self._get_safe_key(key)
        
        # 1. 尝试从内存缓存获取（同步）
        memory_item = self.memory_cache.get(safe_key)
        if memory_item:
            is_expired = memory_item["ttl"] != 0 and now > memory_item["timestamp"] + memory_item["ttl"]
            
            if not is_expired or options.get("allowExpired", False):
                return {
                    "data": memory_item["data"],
                    "timestamp": memory_item["timestamp"],
                    "expired": is_expired,
                    "permanent": bool(memory_item.get("permanent"))
                }
        
        # 2. 尝试从文件缓存获取 (同步)
        file_data = None
        if options.get("source_file"):
            file_data = self._load_from_source_file(safe_key, options, now)
        else:
            file_data = self._load_from_default_cache(safe_key, options, now)
        
        if file_data:
            return file_data
        
        # 3. 尝试使用自定义异步数据加载函数
        if options.get("load_data_fn") and callable(options.get("load_data_fn")):
            custom_data = await self._load_from_custom_loader_async(safe_key, options)
            if custom_data:
                return custom_data
        
        return None
    
    # 同步设置缓存数据
    def set_data(self, key, data, options=None):
        """
        同步设置缓存数据
        
        Args:
            key: 缓存键
            data: 要缓存的原始数据
            options: 选项
                - ttl: 过期时间（毫秒），0表示永不过期
                - permanent: 是否为永久数据（用户配置类型的数据）
        
        Returns:
            是否设置成功
        """
        if not USE_CACHE:
            return False
        if options is None:
            options = {}
        safe_key = self._get_safe_key(key)
        self._log("debug", f"开始设置缓存数据: key={safe_key}")
        
        try:
            cache_item = self._create_cache_item(data, options)
            return self._save_cache_item(safe_key, cache_item)
        except Exception as error:
            self._log("error", f"设置缓存数据时发生错误: key={safe_key}", {"error": error})
            return False
    
    # 同步删除缓存
    def delete(self, key):
        """
        同步删除缓存
        
        Args:
            key: 缓存键
        
        Returns:
            是否删除成功
        """
        safe_key = self._get_safe_key(key)
        self._log("debug", f"开始删除缓存数据: key={safe_key}")
        try:
            # 1. 从内存缓存删除
            if safe_key in self.memory_cache:
                del self.memory_cache[safe_key]
            
            # 2. 从文件缓存删除
            file_path = self._get_file_path(safe_key)
            if os.path.exists(file_path):
                os.remove(file_path)
            
            return True
        except Exception as error:
            self._log("error", f"删除缓存失败: key={safe_key}", {"error": error})
            return False
    
    # 同步检查缓存是否存在且未过期
    def has(self, key):
        """
        同步检查缓存是否存在且未过期
        
        Args:
            key: 缓存键
        
        Returns:
            是否存在且未过期
        """
        wrapped_data = self.get_wrapped_data(key, {"allowExpired": False})
        return wrapped_data is not None and not wrapped_data.get("expired", False)
    
    # 同步设置缓存数据（与Node.js项目兼容的别名方法）
    def set(self, key, data, ttl):
        """
        同步设置缓存数据（与Node.js项目兼容的别名方法）
        
        Args:
            key: 缓存键
            data: 要缓存的原始数据
            ttl: 过期时间（毫秒）
        
        Returns:
            是否设置成功
        """
        return self.set_data(key, data, {"ttl": ttl})
    
    # 同步获取缓存数据（与Node.js项目兼容的别名方法）
    def get(self, key, options):
        """
        同步获取缓存数据（与Node.js项目兼容的别名方法）
        
        Args:
            key: 缓存键
            options: 选项
                - allowExpired: 是否允许使用过期缓存
        
        Returns:
            包装后的缓存数据 {data, timestamp, expired, permanent}，如果不存在则返回None
        """
        return self.get_wrapped_data(key, options)

# 创建并导出默认缓存工具实例
cache_util = CacheUtil()

# 导出
def get_cache_util():
    return cache_util