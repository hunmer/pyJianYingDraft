#!/usr/bin/env python3
"""
测试通过 URL 提交草稿功能

使用方法:
1. 启动 Python 后端服务
2. 运行此脚本: python test_submit_with_url.py
"""

import json
import http.server
import socketserver
import threading
import time
import requests
from pathlib import Path

# 配置
TEST_PORT = 8765
API_BASE_URL = "http://127.0.0.1:8000"
TEST_JSON_FILE = "test_draft_data.json"


def create_test_json_data():
    """创建测试用的 JSON 数据"""
    test_data = {
        "ruleGroup": {
            "id": "test_group_001",
            "title": "测试草稿 - URL提交",
            "rules": []
        },
        "materials": [
            {
                "id": "mat_1",
                "name": "test_video.mp4",
                "type": "video",
                "path": "https://example.com/test_video.mp4",
                "duration": 10000000
            },
            {
                "id": "mat_2",
                "name": "test_audio.mp3",
                "type": "audio",
                "path": "https://example.com/test_audio.mp3",
                "duration": 10000000
            }
        ],
        "testData": {
            "tracks": [
                {
                    "id": "track_1",
                    "type": "video",
                    "name": "主视频轨道"
                }
            ],
            "items": [
                {
                    "id": "item_1",
                    "materialId": "mat_1",
                    "trackId": "track_1",
                    "data": {
                        "path": "https://example.com/test_video.mp4",
                        "ext": ".mp4"
                    }
                }
            ]
        },
        "segment_styles": {},
        "use_raw_segments": False,
        "raw_segments": [],
        "raw_materials": [],
        "draft_config": {
            "canvas_width": 1920,
            "canvas_height": 1080,
            "fps": 30
        }
    }

    # 保存到文件
    with open(TEST_JSON_FILE, 'w', encoding='utf-8') as f:
        json.dump(test_data, f, ensure_ascii=False, indent=2)

    print(f"✓ 已创建测试数据文件: {TEST_JSON_FILE}")
    return test_data


def start_test_server():
    """启动测试 HTTP 服务器"""
    handler = http.server.SimpleHTTPRequestHandler

    class QuietHandler(handler):
        def log_message(self, format, *args):
            pass  # 禁用日志输出

    httpd = socketserver.TCPServer(("", TEST_PORT), QuietHandler)

    print(f"✓ 测试服务器已启动: http://localhost:{TEST_PORT}")

    # 在后台线程运行服务器
    server_thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    server_thread.start()

    return httpd


def test_api_endpoint():
    """测试 API 端点"""
    print("\n" + "="*60)
    print("开始测试 /api/tasks/submit_with_url 端点")
    print("="*60)

    # 构建测试 URL
    test_url = f"http://localhost:{TEST_PORT}/{TEST_JSON_FILE}"
    api_url = f"{API_BASE_URL}/api/tasks/submit_with_url"

    print(f"\n1. 测试数据 URL: {test_url}")
    print(f"2. API 端点: {api_url}")

    # 发送请求
    print(f"\n3. 发送 POST 请求...")
    try:
        response = requests.post(
            api_url,
            params={"url": test_url},
            timeout=30
        )

        print(f"   状态码: {response.status_code}")

        if response.status_code == 200:
            result = response.json()
            print(f"\n✓ 请求成功!")
            print(f"   任务 ID: {result.get('task_id')}")
            print(f"   状态: {result.get('status')}")
            print(f"   消息: {result.get('message')}")
            print(f"\n完整响应:")
            print(json.dumps(result, indent=2, ensure_ascii=False))
            return result.get('task_id')
        else:
            print(f"\n✗ 请求失败!")
            print(f"   响应内容: {response.text}")
            return None

    except requests.exceptions.ConnectionError:
        print(f"\n✗ 无法连接到 API 服务器 ({API_BASE_URL})")
        print("   请确保 Python 后端服务已启动")
        return None
    except Exception as e:
        print(f"\n✗ 请求异常: {e}")
        return None


def query_task_status(task_id):
    """查询任务状态"""
    if not task_id:
        return

    print("\n" + "="*60)
    print(f"查询任务状态: {task_id}")
    print("="*60)

    status_url = f"{API_BASE_URL}/api/tasks/{task_id}"

    try:
        response = requests.get(status_url, timeout=10)

        if response.status_code == 200:
            result = response.json()
            print(f"\n任务状态:")
            print(f"   状态: {result.get('status')}")
            print(f"   消息: {result.get('message')}")
            if result.get('draft_path'):
                print(f"   草稿路径: {result.get('draft_path')}")
            if result.get('error_message'):
                print(f"   错误信息: {result.get('error_message')}")
            print(f"\n完整响应:")
            print(json.dumps(result, indent=2, ensure_ascii=False))
        else:
            print(f"\n✗ 查询失败: {response.status_code}")
            print(f"   响应内容: {response.text}")

    except Exception as e:
        print(f"\n✗ 查询异常: {e}")


def main():
    """主函数"""
    print("\n" + "="*60)
    print("测试通过 URL 提交草稿功能")
    print("="*60)

    # 1. 创建测试数据
    print("\n步骤 1: 创建测试数据")
    create_test_json_data()

    # 2. 启动测试服务器
    print("\n步骤 2: 启动测试 HTTP 服务器")
    httpd = start_test_server()
    time.sleep(1)  # 等待服务器启动

    # 3. 测试 API
    print("\n步骤 3: 测试 API 端点")
    task_id = test_api_endpoint()

    # 4. 查询任务状态
    if task_id:
        print("\n步骤 4: 查询任务状态")
        time.sleep(2)  # 等待任务处理
        query_task_status(task_id)

    # 5. 清理
    print("\n" + "="*60)
    print("测试完成")
    print("="*60)
    print("\n提示:")
    print(f"- 测试服务器仍在运行: http://localhost:{TEST_PORT}")
    print(f"- 测试数据文件: {TEST_JSON_FILE}")
    print("- 按 Ctrl+C 停止测试服务器")

    try:
        # 保持服务器运行
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n\n正在关闭测试服务器...")
        httpd.shutdown()
        print("✓ 测试服务器已关闭")


if __name__ == "__main__":
    main()
