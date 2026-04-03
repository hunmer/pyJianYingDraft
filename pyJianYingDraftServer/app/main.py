"""
FastAPI 主应用入口
"""

import sys
import io
import logging
import uuid
from datetime import datetime
from pathlib import Path
from contextlib import asynccontextmanager

# 设置标准输出/错误流为UTF-8编码(解决Windows GBK编码问题)
# 延迟执行，避免在某些环境下引起递归错误
try:
    if sys.platform == 'win32':
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')
except Exception:
    # 如果设置失败，使用默认配置
    pass

# 最小化日志配置 - 避免与其他库冲突
try:
    # 只配置我们应用的日志，不影响其他库
    logger = logging.getLogger("pyJianYingDraft")
    logger.setLevel(logging.INFO)
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(logging.Formatter('%(asctime)s - %(levelname)s - %(message)s'))
    logger.addHandler(handler)
    logger.propagate = False  # 防止传播到根日志记录器
except Exception:
    # 如果配置失败，跳过自定义日志配置
    pass

# 将父目录添加到 Python 路径,以便导入 pyJianYingDraft 模块
if getattr(sys, 'frozen', False):
    # 打包环境：使用 exe 所在目录
    parent_dir = Path(sys.executable).parent
else:
    # 开发环境：从 app/main.py 回到项目根目录
    parent_dir = Path(__file__).resolve().parent.parent.parent

if str(parent_dir) not in sys.path:
    sys.path.insert(0, str(parent_dir))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.routers import draft, subdrafts, materials, tracks, files, rules, tasks, aria2, generation_records


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    # ==================== 启动事件 ====================
    def flush_logs():
        """强制刷新日志缓冲区 - 简化版本避免递归"""
        try:
            sys.stdout.flush()
            sys.stderr.flush()
        except Exception:
            pass  # 忽略刷新错误

    print("=" * 60)
    print("🚀 pyJianYingDraft API Server 启动中...")
    print("=" * 60)
    flush_logs()  # 立即刷新输出

    # 启动Aria2进程管理器
    try:
        from app.services.aria2_manager import get_aria2_manager
        manager = get_aria2_manager()

        if manager.start():
            print(f"✓ Aria2进程已启动")
            print(f"  - RPC URL: {manager.get_rpc_url()}")
            print(f"  - 下载目录: {manager.download_dir}")
            flush_logs()  # 刷新输出

            # 启动健康检查
            manager.start_health_check(interval=30)
            print(f"✓ Aria2健康检查已启动（间隔: 30秒）")
            flush_logs()  # 刷新输出
        else:
            print("⚠ Aria2进程启动失败，异步下载功能将不可用")
            flush_logs()  # 刷新输出
    except Exception as e:
        print(f"✗ Aria2初始化失败: {e}")
        flush_logs()  # 刷新输出

    # 初始化数据库
    try:
        from app.db import get_database
        await get_database()
        print(f"✓ 数据库已初始化")
        flush_logs()  # 刷新输出
    except Exception as e:
        print(f"✗ 数据库初始化失败: {e}")
        flush_logs()  # 刷新输出

    # 启动任务队列和Aria2客户端
    try:
        from app.services.task_queue import get_task_queue
        queue = get_task_queue()

        # 启动任务队列(初始化Aria2客户端)
        if queue.start():
            print(f"✓ 任务队列已启动")
            print(f"  - Aria2客户端已初始化")
            flush_logs()  # 刷新输出
        else:
            print(f"⚠ 任务队列启动失败，Aria2客户端可能未初始化")
            flush_logs()  # 刷新输出

        # 从数据库加载历史任务
        await queue.load_tasks_from_db()
        flush_logs()  # 刷新异步操作输出

        # 启动进度监控
        await queue.start_progress_monitor()
        print(f"✓ 任务队列进度监控已启动（间隔: 1秒）")
        flush_logs()  # 刷新输出
    except Exception as e:
        print(f"✗ 任务队列启动失败: {e}")
        import traceback
        traceback.print_exc()
        flush_logs()  # 刷新输出

    print("=" * 60)
    print("✅ 服务器启动完成！")
    print("📚 API文档: http://localhost:8000/docs")
    print("=" * 60)
    flush_logs()  # 最终刷新输出

    yield

    # ==================== 关闭事件 ====================
    print("\n" + "=" * 60)
    print("🛑 pyJianYingDraft API Server 关闭中...")
    print("=" * 60)

    # 停止任务队列进度监控
    try:
        from app.services.task_queue import get_task_queue
        queue = get_task_queue()
        await queue.stop_progress_monitor()
        print("✓ 任务队列进度监控已停止")
    except Exception as e:
        print(f"✗ 停止任务队列失败: {e}")

    # 停止Aria2进程
    try:
        from app.services.aria2_manager import get_aria2_manager
        manager = get_aria2_manager()
        manager.stop_health_check()
        manager.stop()
        print("✓ Aria2进程已停止")
    except Exception as e:
        print(f"✗ 停止Aria2失败: {e}")

    print("=" * 60)
    print("✅ 服务器已关闭")
    print("=" * 60)


app = FastAPI(
    title="pyJianYingDraft API",
    description="剪映草稿文件解析和操作API服务",
    version="0.1.0",
    lifespan=lifespan
)

# 配置CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(draft.router, prefix="/api/draft", tags=["草稿基础"])
app.include_router(subdrafts.router, prefix="/api/subdrafts", tags=["复合片段"])
app.include_router(materials.router, prefix="/api/materials", tags=["素材管理"])
app.include_router(tracks.router, prefix="/api/tracks", tags=["轨道管理"])
app.include_router(files.router, prefix="/api/files", tags=["文件服务"])
app.include_router(rules.router, prefix="/api/rules", tags=["规则测试"])
app.include_router(tasks.router, tags=["异步任务"])
app.include_router(aria2.router, prefix="/api/aria2", tags=["Aria2下载管理"])
app.include_router(generation_records.router, tags=["生成记录"])

# 挂载静态文件目录
static_dir = Path(__file__).parent / "static"
if static_dir.exists():
    app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")
    print(f"✓ 静态文件目录已挂载: {static_dir}")

@app.get("/")
async def root():
    """根路径"""
    return {
        "message": "pyJianYingDraft API Server",
        "version": "0.1.0",
        "docs": "/docs"
    }


@app.get("/health")
async def health():
    """健康检查"""
    return {"status": "ok"}


@app.post("/shutdown")
async def shutdown():
    """优雅关闭服务器和所有子进程"""
    import asyncio
    import signal

    print("\n" + "=" * 60)
    print("📥 收到关闭请求,正在执行优雅关闭...")
    print("=" * 60)

    # 在后台执行关闭流程
    async def shutdown_sequence():
        # 给一点时间让响应返回
        await asyncio.sleep(0.5)

        # 停止任务队列进度监控
        try:
            from app.services.task_queue import get_task_queue
            queue = get_task_queue()
            await queue.stop_progress_monitor()
            print("✓ 任务队列进度监控已停止")
        except Exception as e:
            print(f"✗ 停止任务队列失败: {e}")

        # 停止 Aria2 进程
        try:
            from app.services.aria2_manager import get_aria2_manager
            manager = get_aria2_manager()
            manager.stop_health_check()
            manager.stop()
            print("✓ Aria2进程已停止")
        except Exception as e:
            print(f"✗ 停止Aria2失败: {e}")

        print("=" * 60)
        print("✅ 优雅关闭完成,服务器即将退出")
        print("=" * 60)

        # 发送退出信号
        import os
        os.kill(os.getpid(), signal.SIGTERM)

    # 异步启动关闭序列
    asyncio.create_task(shutdown_sequence())

    return {"status": "shutting down", "message": "服务器正在关闭..."}
