"""
测试序列化功能
"""

import json
from app.services.execution_history_service import get_execution_history_service

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

    service = get_execution_history_service()

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
        serialized = service._safe_serialize(item)
        print(f"基础类型 {item} -> {serialized}")

    # 测试列表
    test_list = [1, "test", {"key": "value"}, [1, 2, 3]]
    serialized_list = service._safe_serialize(test_list)
    print(f"列表 {test_list} -> {serialized_list}")

    # 测试字典
    test_dict = {
        "string": "value",
        "number": 123,
        "nested": {"inner": "value"},
        "array": [1, 2, 3]
    }
    serialized_dict = service._safe_serialize(test_dict)
    print(f"字典 {test_dict} -> {serialized_dict}")

    # 测试自定义对象
    test_obj = TestObject()
    serialized_obj = service._safe_serialize(test_obj)
    print(f"自定义对象 -> {serialized_obj}")

    # 测试模拟的 WorkflowEventMessage
    message_obj = WorkflowEventMessage()
    serialized_message = service._safe_serialize(message_obj)
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

    serialized_complex = service._safe_serialize(complex_data)
    print(f"复杂数据结构 -> {json.dumps(serialized_complex, ensure_ascii=False, indent=2)}")

    # 测试 JSON 序列化
    try:
        json_str = json.dumps(serialized_complex, ensure_ascii=False)
        print("✅ JSON 序列化成功")
        print(f"JSON 长度: {len(json_str)}")
    except Exception as e:
        print(f"❌ JSON 序列化失败: {e}")

    print("序列化测试完成")

if __name__ == "__main__":
    test_serialization()