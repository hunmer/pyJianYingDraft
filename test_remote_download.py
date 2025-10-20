"""测试远程素材下载功能"""

import os
import json
import tempfile
import shutil
from pyJianYingDraft import ScriptFile

def test_remote_material_download():
    """测试远程素材下载功能"""

    # 创建临时测试目录
    test_dir = tempfile.mkdtemp(prefix="jy_test_")
    print(f"测试目录: {test_dir}")

    try:
        # 创建草稿
        script = ScriptFile(1920, 1080, fps=30)

        # 模拟添加远程素材到imported_materials
        # 注意: 这里使用一个公开可访问的测试图片URL
        test_image_url = "https://picsum.photos/200/300"

        script.imported_materials["videos"] = [
            {
                "id": "test-video-1",
                "path": test_image_url,
                "material_name": "test_remote_video",
                "duration": 5000000,
                "width": 200,
                "height": 300,
                "material_type": "photo"
            }
        ]

        # 保存草稿
        draft_file = os.path.join(test_dir, "draft_content.json")
        print(f"\n保存草稿到: {draft_file}")
        script.dump(draft_file, download_remote=True)

        # 验证文件已保存
        assert os.path.exists(draft_file), "草稿文件未创建"
        print("[OK] 草稿文件已创建")

        # 读取保存的内容
        with open(draft_file, "r", encoding="utf-8") as f:
            saved_content = json.load(f)

        # 验证path已被更新
        if "videos" in saved_content["materials"]:
            for video in saved_content["materials"]["videos"]:
                path = video.get("path", "")
                print(f"\n素材路径: {path}")

                # 检查路径是否已更新为本地路径
                if path.startswith("##_draftpath_placeholder"):
                    print("[OK] 路径已更新为本地相对路径")

                    # 检查文件是否实际下载
                    draft_id = saved_content.get("id", "")
                    download_dir = os.path.join(test_dir, draft_id)

                    if os.path.exists(download_dir):
                        files = os.listdir(download_dir)
                        print(f"[OK] 下载目录已创建: {download_dir}")
                        print(f"  包含文件: {files}")
                    else:
                        print("[FAIL] 下载目录未创建")
                elif path.startswith("http"):
                    print("[FAIL] 路径仍然是远程URL,下载可能失败")
                else:
                    print(f"[WARN] 路径格式未知: {path}")

        print("\n测试完成!")

    except Exception as e:
        print(f"\n测试失败: {str(e)}")
        import traceback
        traceback.print_exc()

    finally:
        # 清理测试目录
        if os.path.exists(test_dir):
            print(f"\n清理测试目录: {test_dir}")
            shutil.rmtree(test_dir)

if __name__ == "__main__":
    test_remote_material_download()
