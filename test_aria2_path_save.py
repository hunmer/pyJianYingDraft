#!/usr/bin/env python3
"""
测试aria2c路径自动保存到config.json功能

测试步骤：
1. 备份原config.json
2. 临时移除config.json中的ARIA2_PATH配置
3. 初始化Aria2ProcessManager（触发智能查找）
4. 验证config.json是否自动保存了ARIA2_PATH
5. 恢复原config.json
"""

import json
import shutil
from pathlib import Path
import sys

# 添加项目根目录到Python路径
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root / "pyJianYingDraftServer"))

from app.services.aria2_manager import Aria2ProcessManager


def test_aria2_path_save():
    print("=" * 60)
    print("测试：智能查找aria2c后自动保存到config.json")
    print("=" * 60)

    config_path = project_root / "config.json"
    backup_path = project_root / "config.json.backup"

    # 1. 备份原config.json
    if config_path.exists():
        shutil.copy2(config_path, backup_path)
        print(f"✓ 已备份config.json -> {backup_path}")

        # 读取原配置
        with open(config_path, "r", encoding="utf-8") as f:
            original_config = json.load(f)
            original_aria2_path = original_config.get("ARIA2_PATH")
            print(f"  原始ARIA2_PATH: {original_aria2_path}")

        # 2. 临时移除ARIA2_PATH配置
        config_without_aria2 = {k: v for k, v in original_config.items() if k != "ARIA2_PATH"}
        with open(config_path, "w", encoding="utf-8") as f:
            json.dump(config_without_aria2, f, indent=2, ensure_ascii=False)
        print("✓ 已临时移除config.json中的ARIA2_PATH配置")
    else:
        print("⚠ config.json不存在，将创建新文件")
        original_aria2_path = None

    try:
        # 3. 初始化Aria2ProcessManager（触发智能查找）
        print("\n" + "=" * 60)
        print("开始智能查找aria2c...")
        print("=" * 60)

        manager = Aria2ProcessManager(verbose=True)

        print("\n" + "=" * 60)
        print(f"查找结果: {manager.aria2c_path}")
        print("=" * 60)

        # 4. 验证config.json是否自动保存了ARIA2_PATH
        print("\n验证config.json...")
        if config_path.exists():
            with open(config_path, "r", encoding="utf-8") as f:
                updated_config = json.load(f)
                saved_aria2_path = updated_config.get("ARIA2_PATH")

            if saved_aria2_path:
                print(f"✓ 成功！ARIA2_PATH已保存到config.json: {saved_aria2_path}")

                # 验证保存的路径是否正确
                expected_dir = str(Path(manager.aria2c_path).parent)
                if saved_aria2_path == expected_dir:
                    print(f"✓ 路径正确：保存的目录路径与找到的aria2c可执行文件的父目录一致")
                else:
                    print(f"⚠ 路径不一致！")
                    print(f"  保存的路径: {saved_aria2_path}")
                    print(f"  预期的路径: {expected_dir}")
            else:
                print("✗ 失败！config.json中未找到ARIA2_PATH配置")
        else:
            print("✗ 失败！config.json文件不存在")

    except Exception as e:
        print(f"✗ 测试失败: {e}")
        import traceback
        traceback.print_exc()
    finally:
        # 5. 恢复原config.json
        print("\n" + "=" * 60)
        if backup_path.exists():
            shutil.copy2(backup_path, config_path)
            backup_path.unlink()
            print(f"✓ 已恢复原config.json")
        print("=" * 60)


if __name__ == "__main__":
    test_aria2_path_save()
