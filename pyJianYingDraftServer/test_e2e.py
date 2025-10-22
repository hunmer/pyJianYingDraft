"""
端到端测试脚本 - 验证完整的异步任务提交和处理流程

测试流程:
1. 提交异步任务 (POST /api/tasks/submit)
2. 查询任务状态 (GET /api/tasks/{task_id})
3. 列出任务列表 (GET /api/tasks)
4. 验证WebSocket进度推送 (如果可用)
5. 取消任务 (POST /api/tasks/{task_id}/cancel)
"""

import asyncio
import json
import aiohttp
from typing import Optional, Dict, Any


class E2ETestClient:
    """端到端测试客户端"""

    def __init__(self, base_url: str = "http://localhost:8000"):
        self.base_url = base_url
        self.session: Optional[aiohttp.ClientSession] = None
        self.test_results = []

    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()

    async def _make_request(
        self,
        method: str,
        endpoint: str,
        **kwargs
    ) -> Dict[str, Any]:
        """发起HTTP请求"""
        if not self.session:
            raise RuntimeError("Session not initialized")

        url = f"{self.base_url}{endpoint}"
        async with self.session.request(method, url, **kwargs) as resp:
            data = await resp.json()
            return {
                "status": resp.status,
                "data": data,
                "headers": dict(resp.headers)
            }

    async def test_submit_task(self) -> Optional[str]:
        """测试1: 提交异步任务"""
        print("\n" + "="*60)
        print("测试1: 提交异步任务 (POST /api/tasks/submit)")
        print("="*60)

        # 构造测试请求数据
        payload = {
            "ruleGroup": {
                "id": "group_1761116967876",
                "title": "竖屏人物图片",
                "rules": [
                    {
                        "type": "image",
                        "title": "图片",
                        "material_ids": ["ff5f7281-945f-4250-ab60-5c26176c35c1"]
                    },
                    {
                        "type": "subtitle",
                        "title": "字幕",
                        "material_ids": ["be2883f3-eed8-4526-8381-49876dfbabe3"]
                    }
                ]
            },
            "materials": [
                {
                    "id": "ff5f7281-945f-4250-ab60-5c26176c35c1",
                    "name": "test_image.jpg",
                    "type": "image",
                    "path": "C:/path/to/image.jpg"
                },
                {
                    "id": "be2883f3-eed8-4526-8381-49876dfbabe3",
                    "name": "test_subtitle.srt",
                    "type": "text",
                    "content": "测试字幕"
                }
            ],
            "draft_config": {
                "canvas_config": {
                    "canvas_width": 1080,
                    "canvas_height": 1920
                },
                "fps": 30
            }
        }

        try:
            result = await self._make_request(
                "POST",
                "/api/tasks/submit",
                json=payload
            )

            status = result["status"]
            data = result["data"]

            print(f"HTTP状态: {status}")
            print(f"响应数据: {json.dumps(data, ensure_ascii=False, indent=2)}")

            if status == 200:
                task_id = data.get("task_id")
                print(f"[OK] 任务提交成功! 任务ID: {task_id}")
                self.test_results.append(("submit_task", "PASS", task_id))
                return task_id
            else:
                print(f"[FAIL] 任务提交失败! 状态码: {status}")
                if "detail" in data:
                    print(f"错误详情: {data['detail']}")
                self.test_results.append(("submit_task", "FAIL", str(status)))
                return None

        except Exception as e:
            print(f"[ERROR] 请求异常: {e}")
            self.test_results.append(("submit_task", "ERROR", str(e)))
            return None

    async def test_get_task(self, task_id: str) -> bool:
        """测试2: 查询任务状态"""
        print("\n" + "="*60)
        print(f"测试2: 查询任务状态 (GET /api/tasks/{task_id})")
        print("="*60)

        try:
            result = await self._make_request(
                "GET",
                f"/api/tasks/{task_id}"
            )

            status = result["status"]
            data = result["data"]

            print(f"HTTP状态: {status}")
            print(f"响应数据: {json.dumps(data, ensure_ascii=False, indent=2)}")

            if status == 200:
                print(f"[OK] 任务查询成功!")
                print(f"  任务ID: {data.get('task_id')}")
                print(f"  任务状态: {data.get('status')}")
                print(f"  创建时间: {data.get('created_at')}")
                print(f"  更新时间: {data.get('updated_at')}")
                self.test_results.append(("get_task", "PASS", "OK"))
                return True
            else:
                print(f"[FAIL] 任务查询失败! 状态码: {status}")
                self.test_results.append(("get_task", "FAIL", str(status)))
                return False

        except Exception as e:
            print(f"[ERROR] 请求异常: {e}")
            self.test_results.append(("get_task", "ERROR", str(e)))
            return False

    async def test_list_tasks(self) -> bool:
        """测试3: 列出任务列表"""
        print("\n" + "="*60)
        print("测试3: 列出任务列表 (GET /api/tasks)")
        print("="*60)

        try:
            result = await self._make_request(
                "GET",
                "/api/tasks?limit=10&offset=0"
            )

            status = result["status"]
            data = result["data"]

            print(f"HTTP状态: {status}")
            print(f"总任务数: {data.get('total')}")
            print(f"当前分页: limit={data.get('limit')}, offset={data.get('offset')}")

            if status == 200:
                tasks = data.get("tasks", [])
                print(f"[OK] 任务列表查询成功! 找到 {len(tasks)} 个任务")

                for task in tasks[:3]:  # 只显示前3个
                    print(f"  - {task.get('task_id')}: {task.get('status')}")

                self.test_results.append(("list_tasks", "PASS", f"{len(tasks)} tasks"))
                return True
            else:
                print(f"[FAIL] 任务列表查询失败! 状态码: {status}")
                self.test_results.append(("list_tasks", "FAIL", str(status)))
                return False

        except Exception as e:
            print(f"[ERROR] 请求异常: {e}")
            self.test_results.append(("list_tasks", "ERROR", str(e)))
            return False

    async def test_cancel_task(self, task_id: str) -> bool:
        """测试4: 取消任务"""
        print("\n" + "="*60)
        print(f"测试4: 取消任务 (POST /api/tasks/{task_id}/cancel)")
        print("="*60)

        try:
            result = await self._make_request(
                "POST",
                f"/api/tasks/{task_id}/cancel"
            )

            status = result["status"]
            data = result["data"]

            print(f"HTTP状态: {status}")
            print(f"响应数据: {json.dumps(data, ensure_ascii=False, indent=2)}")

            if status == 200:
                success = data.get("success", False)
                message = data.get("message", "")

                if success:
                    print(f"[OK] 任务取消成功! {message}")
                    self.test_results.append(("cancel_task", "PASS", "Cancelled"))
                    return True
                else:
                    print(f"[WARN] 任务取消失败! {message}")
                    self.test_results.append(("cancel_task", "WARN", message))
                    return False
            else:
                print(f"[FAIL] 任务取消请求失败! 状态码: {status}")
                self.test_results.append(("cancel_task", "FAIL", str(status)))
                return False

        except Exception as e:
            print(f"[ERROR] 请求异常: {e}")
            self.test_results.append(("cancel_task", "ERROR", str(e)))
            return False

    def print_summary(self):
        """打印测试总结"""
        print("\n" + "="*60)
        print("测试总结")
        print("="*60)

        for test_name, result, detail in self.test_results:
            status_icon = "[OK]" if result == "PASS" else "[FAIL]" if result == "FAIL" else "[WARN]"
            print(f"{status_icon} {test_name:20} {result:10} {detail}")

        passed = sum(1 for _, r, _ in self.test_results if r == "PASS")
        total = len(self.test_results)
        print(f"\n总体结果: {passed}/{total} 测试通过")


async def main():
    """主测试流程"""
    print("\n[START] 开始端到端测试...")
    print(f"服务器地址: http://localhost:8000")

    async with E2ETestClient() as client:
        # 测试1: 提交任务
        task_id = await client.test_submit_task()

        if task_id:
            # 等待一段时间，让服务器处理任务
            await asyncio.sleep(1)

            # 测试2: 查询任务
            await client.test_get_task(task_id)

            # 等待一段时间
            await asyncio.sleep(1)

            # 测试3: 列出任务
            await client.test_list_tasks()

            # 等待一段时间
            await asyncio.sleep(1)

            # 测试4: 取消任务
            await client.test_cancel_task(task_id)

        # 打印总结
        client.print_summary()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n\n[WARN] 测试被中断")
    except Exception as e:
        print(f"\n\n[ERROR] 测试异常: {e}")
