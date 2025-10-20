"""测试异步高并发下载功能"""

import os
import json
import tempfile
import shutil
from pyJianYingDraft import ScriptFile

def test_async_download():
    """测试异步高并发下载功能"""

    print("=" * 60)
    print("测试异步高并发远程素材下载功能")
    print("=" * 60)

    # 创建临时测试目录
    test_dir = tempfile.mkdtemp(prefix="jy_async_test_")
    print(f"\n[设置] 测试目录: {test_dir}")

    try:
        # 创建草稿
        script = ScriptFile(1920, 1080, fps=30)

        # 模拟添加多个远程素材
        # 使用 picsum.photos 提供的随机图片服务作为测试
        test_urls = [
            f"https://picsum.photos/seed/{i}/400/300" for i in range(1, 11)
        ]

        print(f"\n[准备] 添加 {len(test_urls)} 个远程素材URL")

        script.imported_materials["videos"] = [
            {
                "id": f"test-video-{i}",
                "path": url,
                "material_name": f"test_remote_video_{i}",
                "duration": 5000000,
                "width": 400,
                "height": 300,
                "material_type": "photo"
            }
            for i, url in enumerate(test_urls, 1)
        ]

        # 测试1: 不使用代理的下载
        print("\n" + "=" * 60)
        print("测试1: 标准异步下载 (无代理)")
        print("=" * 60)

        draft_file = os.path.join(test_dir, "draft_content.json")

        script.dump(
            draft_file,
            download_remote=True,
            max_concurrent=5,  # 限制并发数避免触发速率限制
            proxy=None,
            download_verbose=True
        )

        # 验证结果
        print("\n" + "-" * 60)
        print("验证下载结果...")
        print("-" * 60)

        assert os.path.exists(draft_file), "草稿文件未创建"
        print("[OK] 草稿文件已创建")

        with open(draft_file, "r", encoding="utf-8") as f:
            saved_content = json.load(f)

        # 检查路径更新
        updated_count = 0
        local_path_count = 0

        if "videos" in saved_content["materials"]:
            for video in saved_content["materials"]["videos"]:
                path = video.get("path", "")

                if path.startswith("##_draftpath_placeholder"):
                    updated_count += 1

                    # 检查文件是否实际下载
                    draft_id = saved_content.get("id", "")
                    download_dir = os.path.join(test_dir, draft_id)

                    if os.path.exists(download_dir):
                        # 提取文件名
                        filename = path.split("\\")[-1]
                        file_path = os.path.join(download_dir, filename)

                        if os.path.exists(file_path):
                            local_path_count += 1

        print(f"[结果] 路径已更新: {updated_count}/{len(test_urls)}")
        print(f"[结果] 文件已下载: {local_path_count}/{len(test_urls)}")

        if local_path_count > 0:
            draft_id = saved_content.get("id", "")
            download_dir = os.path.join(test_dir, draft_id)
            files = os.listdir(download_dir)
            print(f"[详情] 下载目录: {download_dir}")
            print(f"[详情] 文件数量: {len(files)}")
            print(f"[详情] 文件列表: {files[:3]}..." if len(files) > 3 else f"[详情] 文件列表: {files}")

        # 测试2: 测试禁用下载
        print("\n" + "=" * 60)
        print("测试2: 禁用远程下载")
        print("=" * 60)

        test_dir2 = tempfile.mkdtemp(prefix="jy_no_download_")
        draft_file2 = os.path.join(test_dir2, "draft_content.json")

        script2 = ScriptFile(1920, 1080, fps=30)
        script2.imported_materials["videos"] = [
            {
                "id": "test-video-1",
                "path": "https://example.com/video.mp4",
                "material_name": "test",
                "duration": 5000000,
                "width": 400,
                "height": 300,
                "material_type": "video"
            }
        ]

        script2.dump(draft_file2, download_remote=False)

        with open(draft_file2, "r", encoding="utf-8") as f:
            content2 = json.load(f)

        path2 = content2["materials"]["videos"][0]["path"]
        if path2.startswith("http"):
            print("[OK] 禁用下载后路径保持为远程URL")
        else:
            print("[FAIL] 路径被意外修改")

        shutil.rmtree(test_dir2)

        print("\n" + "=" * 60)
        print("测试完成!")
        print("=" * 60)

    except Exception as e:
        print(f"\n[错误] 测试失败: {str(e)}")
        import traceback
        traceback.print_exc()

    finally:
        # 清理测试目录
        if os.path.exists(test_dir):
            print(f"\n[清理] 删除测试目录: {test_dir}")
            shutil.rmtree(test_dir)

if __name__ == "__main__":
    print("\n提示: 此测试需要网络连接")
    print("提示: 可选安装 aiohttp aiohttp-retry 以启用异步下载")
    print("      安装命令: pip install aiohttp aiohttp-retry")
    print()

    input("按回车键开始测试...")

    test_async_download()
