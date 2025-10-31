"""
测试序列化功能（独立版本）
"""

import json
from typing import Any
from pathlib import Path

def _safe_serialize(obj):
    """安全序列化对象，处理不可序列化的类型"""
    if obj is None:
        return None
    elif isinstance(obj, (str, int, float, bool)):
        return obj
    elif isinstance(obj, (list, tuple)):
        return [_safe_serialize(item) for item in obj]
    elif isinstance(obj, dict):
        return {key: _safe_serialize(value) for key, value in obj.items()}
    elif hasattr(obj, '__dict__'):
        # 对于有 __dict__ 的对象，尝试序列化其属性
        try:
            return {key: _safe_serialize(value) for key, value in obj.__dict__.items() if not key.startswith('_')}
        except:
            return str(obj)
    else:
        # 其他类型转换为字符串
        return str(obj)

class TestObject:
    def __init__(self):
        self.content = "测试内容"
        self.role = "assistant"
        self.type = "message"
        self._private = "私有属性"
        self.complex_data = {"nested": {"value": 123}}

class WorkflowEventMessage:
    """模拟 WorkflowEventMessage 对象"""
    def __init__(self):
        self.content = "这是一个消息"
        self.role = "assistant"
        self.type = "text"
        self._internal = "内部数据"

def test_serialization():
    print("测试序列化功能...")

    # 测试基础类型
    basic_types = [
        None,
        "string",
        123,
        123.45,
        True,
        False
    ]

    for item in basic_types:
        serialized = _safe_serialize(item)
        print(f"基础类型 {item} -> {serialized}")

    # 测试列表
    test_list = [1, "test", {"key": "value"}, [1, 2, 3]]
    serialized_list = _safe_serialize(test_list)
    print(f"列表 {test_list} -> {serialized_list}")

    # 测试字典
    test_dict = {
        "string": "value",
        "number": 123,
        "nested": {"inner": "value"},
        "array": [1, 2, 3]
    }
    serialized_dict = _safe_serialize(test_dict)
    print(f"字典 {test_dict} -> {serialized_dict}")

    # 测试自定义对象
    test_obj = TestObject()
    serialized_obj = _safe_serialize(test_obj)
    print(f"自定义对象 -> {serialized_obj}")

    # 测试模拟的 WorkflowEventMessage
    message_obj = WorkflowEventMessage()
    serialized_message = _safe_serialize(message_obj)
    print(f"WorkflowEventMessage -> {serialized_message}")

    # 测试复杂嵌套结构
    complex_data = {
        "input_parameters": {
            "text": "测试输入",
            "count": 42,
            "settings": {
                "enable": True,
                "config": {"mode": "auto"}
            }
        },
        "output": {
            "message": message_obj,
            "result": "success",
            "data": [1, 2, 3, {"nested": "value"}]
        }
    }

    serialized_complex = _safe_serialize(complex_data)
    print(f"复杂数据结构 -> {json.dumps(serialized_complex, ensure_ascii=False, indent=2)}")

    # 测试 JSON 序列化
    try:
        json_str = json.dumps(serialized_complex, ensure_ascii=False)
        print("JSON 序列化成功")
        print(f"JSON 长度: {len(json_str)}")
    except Exception as e:
        print(f"JSON 序列化失败: {e}")

    print("序列化测试完成")

if __name__ == "__main__":
    test_serialization()