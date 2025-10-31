"""
事件日志服务
存储最近的工作流执行事件日志，持久化保存到JSON文件
"""

from typing import List, Optional, Dict, Any
from datetime import datetime
from collections import deque
from pathlib import Path
import uuid
import json
import threading


class EventLogEntry:
    """事件日志条目"""
    
    def __init__(
        self,
        event: str,
        workflow_id: str,
        workflow_name: Optional[str] = None,
        execute_id: Optional[str] = None,
        level: str = "info",
        message: Optional[str] = None,
        data: Optional[Any] = None,
        details: Optional[Any] = None,
    ):
        self.id = str(uuid.uuid4())
        self.event = event
        self.workflow_id = workflow_id
        self.workflow_name = workflow_name
        self.execute_id = execute_id
        self.level = level
        self.message = message
        self.data = data
        self.details = details
        self.timestamp = datetime.now().isoformat()
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            "id": self.id,
            "event": self.event,
            "workflowId": self.workflow_id,
            "workflowName": self.workflow_name,
            "executeId": self.execute_id,
            "level": self.level,
            "message": self.message,
            "data": self.data,
            "details": self.details,
            "timestamp": self.timestamp,
        }


class EventLogService:
    """事件日志服务 - 持久化存储"""
    
    MAX_LOGS = 1000  # 最多保存1000条日志
    STORAGE_FILE = "event_logs.json"  # 存储文件名
    
    def __init__(self):
        self._logs: deque[EventLogEntry] = deque(maxlen=self.MAX_LOGS)
        self._lock = threading.Lock()  # 线程锁，保护文件读写
        self._storage_path = self._get_storage_path()
        self._load_from_file()  # 启动时从文件加载
    
    def _get_storage_path(self) -> Path:
        """获取存储文件路径"""
        # 存储在服务器数据目录
        from app.config import get_config
        
        try:
            # 尝试从配置获取数据目录
            data_dir = get_config('DATA_DIR', None)
            if data_dir:
                storage_dir = Path(data_dir)
            else:
                # 默认使用服务器根目录下的data文件夹
                storage_dir = Path(__file__).parent.parent.parent / 'data'
        except:
            # 如果配置不可用，使用服务器根目录
            storage_dir = Path(__file__).parent.parent.parent / 'data'
        
        # 确保目录存在
        storage_dir.mkdir(parents=True, exist_ok=True)
        
        return storage_dir / self.STORAGE_FILE
    
    def _load_from_file(self):
        """从文件加载日志"""
        if not self._storage_path.exists():
            return
        
        try:
            with self._lock:
                with open(self._storage_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    
                    # 重建日志条目
                    for log_dict in data.get('logs', []):
                        log_entry = EventLogEntry(
                            event=log_dict['event'],
                            workflow_id=log_dict['workflowId'],
                            workflow_name=log_dict.get('workflowName'),
                            execute_id=log_dict.get('executeId'),
                            level=log_dict.get('level', 'info'),
                            message=log_dict.get('message'),
                            data=log_dict.get('data'),
                            details=log_dict.get('details'),
                        )
                        # 恢复时间戳
                        log_entry.timestamp = log_dict['timestamp']
                        log_entry.id = log_dict['id']
                        
                        self._logs.append(log_entry)
            
            print(f"✓ 事件日志已从文件加载: {len(self._logs)} 条")
        except Exception as e:
            print(f"✗ 加载事件日志文件失败: {e}")
    
    def _save_to_file(self):
        """保存日志到文件"""
        try:
            with self._lock:
                data = {
                    'logs': [log.to_dict() for log in self._logs],
                    'total': len(self._logs),
                    'last_updated': datetime.now().isoformat()
                }
                
                # 写入临时文件，然后重命名（原子操作）
                temp_path = self._storage_path.with_suffix('.tmp')
                with open(temp_path, 'w', encoding='utf-8') as f:
                    json.dump(data, f, ensure_ascii=False, indent=2)
                
                # 重命名为正式文件
                temp_path.replace(self._storage_path)
        except Exception as e:
            print(f"✗ 保存事件日志文件失败: {e}")
    
    def add_log(
        self,
        event: str,
        workflow_id: str,
        workflow_name: Optional[str] = None,
        execute_id: Optional[str] = None,
        level: str = "info",
        message: Optional[str] = None,
        data: Optional[Any] = None,
        details: Optional[Any] = None,
    ) -> EventLogEntry:
        """
        添加日志条目并保存到文件
        
        Args:
            event: 事件类型
            workflow_id: 工作流ID
            workflow_name: 工作流名称
            execute_id: 执行ID
            level: 日志级别 (info/warning/error/success)
            message: 日志消息
            data: 事件数据
            details: 详细信息
        
        Returns:
            添加的日志条目
        """
        log_entry = EventLogEntry(
            event=event,
            workflow_id=workflow_id,
            workflow_name=workflow_name,
            execute_id=execute_id,
            level=level,
            message=message,
            data=data,
            details=details,
        )
        
        self._logs.append(log_entry)
        
        # 保存到文件
        self._save_to_file()
        
        return log_entry
    
    def get_logs(
        self,
        limit: int = 200,
        offset: int = 0,
        workflow_id: Optional[str] = None,
        execute_id: Optional[str] = None,
        level: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        获取日志列表（分页）
        
        Args:
            limit: 返回数量限制
            offset: 偏移量
            workflow_id: 按工作流ID筛选
            execute_id: 按执行ID筛选
            level: 按日志级别筛选
        
        Returns:
            包含日志列表和总数的字典
        """
        # 转换为列表（从最新到最旧）
        all_logs = list(reversed(self._logs))
        
        # 筛选
        filtered_logs = all_logs
        
        if workflow_id:
            filtered_logs = [log for log in filtered_logs if log.workflow_id == workflow_id]
        
        if execute_id:
            filtered_logs = [log for log in filtered_logs if log.execute_id == execute_id]
        
        if level:
            filtered_logs = [log for log in filtered_logs if log.level == level]
        
        # 分页
        total = len(filtered_logs)
        paginated_logs = filtered_logs[offset:offset + limit]
        
        return {
            "logs": [log.to_dict() for log in paginated_logs],
            "total": total,
            "limit": limit,
            "offset": offset,
            "has_more": offset + limit < total,
        }
    
    def clear_logs(self):
        """清空所有日志并删除文件"""
        self._logs.clear()
        
        # 删除存储文件
        try:
            if self._storage_path.exists():
                self._storage_path.unlink()
                print(f"✓ 事件日志文件已删除: {self._storage_path}")
        except Exception as e:
            print(f"✗ 删除事件日志文件失败: {e}")
    
    def get_log_count(self) -> int:
        """获取日志总数"""
        return len(self._logs)


# 单例实例
_event_log_service: Optional[EventLogService] = None


def get_event_log_service() -> EventLogService:
    """获取事件日志服务单例"""
    global _event_log_service
    if _event_log_service is None:
        _event_log_service = EventLogService()
    return _event_log_service
