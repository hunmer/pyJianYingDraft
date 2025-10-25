#!/usr/bin/env python3
"""
测试通过 URL 提交草稿并展示 Web 状态页面

使用方法:
1. 启动 Python 后端服务 (在 pyJianYingDraftServer 目录运行 python run.py)
2. 运行此脚本: python test_web_submit.py
3. 浏览器会自动打开任务状态页面
"""

import json
import http.server
import socketserver
import threading
import time
import webbrowser
from pathlib import Path

# 配置
TEST_PORT = 8765
API_BASE_URL = "http://127.0.0.1:8000"
TEST_JSON_FILE = "test_draft_data.json"


def create_test_json_data():
    """创建测试用的 JSON 数据"""
    test_data = {
        "ruleGroup": {
            "id": "test_group_web_001",
            "title": "测试草稿 - Web页面展示",
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


def main():
    """主函数"""
    print("\n" + "="*60)
    print("测试通过 URL 提交草稿并展示 Web 状态页面")
    print("="*60)

    # 1. 创建测试数据
    print("\n步骤 1: 创建测试数据")
    create_test_json_data()

    # 2. 启动测试服务器
    print("\n步骤 2: 启动测试 HTTP 服务器")
    httpd = start_test_server()
    time.sleep(1)  # 等待服务器启动

    # 3. 构建提交 URL
    test_url = f"http://localhost:{TEST_PORT}/{TEST_JSON_FILE}"
    submit_url = f"{API_BASE_URL}/api/tasks/submit_with_url?url={test_url}"

    print("\n步骤 3: 构建提交 URL")
    print(f"   数据 URL: {test_url}")
    print(f"   提交 URL: {submit_url}")

    # 4. 打开浏览器
    print("\n步骤 4: 在浏览器中打开提交 URL")
    print(f"   提示: 浏览器将自动打开,并重定向到任务状态页面")
    print(f"   如果浏览器未自动打开,请手动访问: {submit_url}")

    # 使用 POST 请求提交任务,浏览器会被重定向到状态页面
    # 注意: webbrowser.open 使用 GET 请求,但我们需要 POST
    # 所以我们在浏览器中直接打开 URL (浏览器会发送 GET 请求)
    # 为了测试,我们需要修改 API 同时支持 GET 和 POST

    print(f"\n   正在打开浏览器...")
    webbrowser.open(submit_url)

    print("\n" + "="*60)
    print("✅ 浏览器已打开!")
    print("="*60)
    print("\n提示:")
    print(f"  - 浏览器已打开任务提交页面")
    print(f"  - 页面将自动重定向到任务状态展示页面")
    print(f"  - 任务状态页面会每 2 秒自动刷新")
    print(f"  - 测试服务器仍在运行: http://localhost:{TEST_PORT}")
    print(f"  - 测试数据文件: {TEST_JSON_FILE}")
    print(f"  - 按 Ctrl+C 停止测试服务器")

    print(f"\n注意:")
    print(f"  - 如果您看到错误 '405 Method Not Allowed'")
    print(f"  - 请使用以下 curl 命令手动测试:")
    print(f"    curl -X POST \"{submit_url}\"")

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
