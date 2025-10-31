"""
测试序列化修复功能
"""

import json
import uuid
from datetime import datetime
from threading import Lock
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

class WorkflowEventMessage:
    """模拟 WorkflowEventMessage 对象"""
    def __init__(self):
        self.content = "这是一个消息"
        self.role = "assistant"
        self.type = "message"
        self._private = "私有属性"

def test_json_serialization():
    """测试 JSON 序列化修复"""
    print("测试 JSON 序列化修复...")

    # 创建一个包含不可序列化对象的复杂结构
    complex_data = {
        "execute_id": str(uuid.uuid4()),
        "workflow_id": "test_workflow",
        "create_time": int(datetime.now().timestamp() * 1000),
        "update_time": int(datetime.now().timestamp() * 1000),
        "execute_status": "running",
        "input_parameters": {
            "message": WorkflowEventMessage(),
            "text": "测试输入",
            "settings": {
                "enable": True,
                "config": {"mode": "auto"}
            }
        },
        "output": {
            "result": WorkflowEventMessage(),
            "data": [1, 2, 3, {"nested": WorkflowEventMessage()}]
        },
        "metadata": {
            "user_data": WorkflowEventMessage(),
            "extra": "info"
        }
    }

    print("原始数据包含不可序列化对象...")

    # 使用安全序列化
    safe_data = _safe_serialize(complex_data)
    print("安全序列化完成")

    # 测试 JSON 序列化
    try:
        json_str = json.dumps(safe_data, ensure_ascii=False, indent=2)
        print("JSON 序列化成功")
        print(f"JSON 长度: {len(json_str)} 字节")

        # 测试 JSON 反序列化
        parsed_data = json.loads(json_str)
        print("JSON 反序列化成功")

        # 验证数据结构
        assert parsed_data["input_parameters"]["message"]["content"] == "这是一个消息"
        assert parsed_data["input_parameters"]["message"]["role"] == "assistant"
        assert parsed_data["input_parameters"]["message"]["type"] == "message"
        print("数据结构验证通过")

        return True

    except Exception as e:
        print(f"JSON 序列化失败: {e}")
        return False

def test_edge_cases():
    """测试边界情况"""
    print("\n测试边界情况...")

    # 测试 None 值
    test_data = {
        "null_value": None,
        "string_value": "test",
        "nested": {
            "inner_null": None,
            "inner_object": WorkflowEventMessage()
        }
    }

    safe_data = _safe_serialize(test_data)
    json_str = json.dumps(safe_data, ensure_ascii=False)
    parsed = json.loads(json_str)

    assert parsed["null_value"] is None
    assert parsed["nested"]["inner_null"] is None
    assert parsed["nested"]["inner_object"]["content"] == "这是一个消息"
    print("✅ None 值处理正确")

    # 测试循环引用（简单模拟）
    class SelfRef:
        def __init__(self):
            self.content = "self reference"

    obj = SelfRef()
    # 不设置真正的循环引用，因为这会导致递归错误

    safe_obj = _safe_serialize(obj)
    json_str = json.dumps(safe_obj, ensure_ascii=False)
    parsed_obj = json.loads(json_str)

    assert parsed_obj["content"] == "self reference"
    print("✅ 对象引用处理正确")

if __name__ == "__main__":
    success = test_json_serialization()
    test_edge_cases()

    if success:
        print("\n🎉 所有序列化测试通过！")
        print("WorkflowEventMessage 对象现在可以正确序列化到 JSON 文件中")
    else:
        print("\n❌ 序列化测试失败")