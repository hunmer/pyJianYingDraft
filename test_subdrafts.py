"""
测试 subdrafts (复合片段) 读取功能

此测试脚本验证 ScriptFile.read_subdrafts() 和 ScriptFile.print_subdrafts_info() 方法的正确性
"""

import os
import sys
import json
import unittest
from typing import List, Dict, Any

# 设置UTF-8编码输出（Windows兼容）
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# 添加项目路径到 sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import pyJianYingDraft as draft


class TestSubdrafts(unittest.TestCase):
    """测试复合片段读取功能"""

    @classmethod
    def setUpClass(cls):
        """设置测试环境"""
        # 使用实际的测试文件路径
        cls.test_draft_path = r"D:\programming\pyJianYingDraft\subcrafts\B8C83597-9403-4e63-AF4D-BAB1EF066F87\draft_content.json"

        # 检查文件是否存在
        if not os.path.exists(cls.test_draft_path):
            raise FileNotFoundError(f"测试文件不存在: {cls.test_draft_path}")

    def test_load_template_with_subdrafts(self):
        """测试加载包含复合片段的模板"""
        script = draft.ScriptFile.load_template(self.test_draft_path)

        self.assertIsNotNone(script)
        self.assertIsInstance(script, draft.ScriptFile)
        print(f"✓ 成功加载草稿文件: {self.test_draft_path}")

    def test_read_subdrafts_returns_list(self):
        """测试 read_subdrafts 返回列表"""
        script = draft.ScriptFile.load_template(self.test_draft_path)
        subdrafts = script.read_subdrafts()

        self.assertIsInstance(subdrafts, list)
        print(f"✓ read_subdrafts() 返回列表类型")

    def test_subdrafts_structure(self):
        """测试复合片段的数据结构"""
        script = draft.ScriptFile.load_template(self.test_draft_path)
        subdrafts = script.read_subdrafts()

        if len(subdrafts) > 0:
            # 检查第一个复合片段的结构
            subdraft = subdrafts[0]

            # 必须包含的字段
            required_fields = ['id', 'name', 'type', 'draft']
            for field in required_fields:
                self.assertIn(field, subdraft, f"复合片段缺少必需字段: {field}")

            # 检查嵌套的 draft 结构
            nested_draft = subdraft['draft']
            self.assertIsInstance(nested_draft, dict)

            # 检查嵌套 draft 的关键字段
            draft_fields = ['canvas_config', 'duration', 'fps', 'tracks', 'materials']
            for field in draft_fields:
                self.assertIn(field, nested_draft, f"嵌套草稿缺少字段: {field}")

            print(f"✓ 复合片段数据结构正确")
            print(f"  - 复合片段名称: {subdraft['name']}")
            print(f"  - 复合片段ID: {subdraft['id']}")
            print(f"  - 嵌套草稿时长: {nested_draft['duration'] / 1000000:.2f} 秒")
            print(f"  - 嵌套草稿轨道数: {len(nested_draft['tracks'])}")
        else:
            print("⚠ 此草稿文件不包含复合片段")

    def test_subdrafts_draft_canvas_config(self):
        """测试复合片段的画布配置"""
        script = draft.ScriptFile.load_template(self.test_draft_path)
        subdrafts = script.read_subdrafts()

        if len(subdrafts) > 0:
            subdraft = subdrafts[0]
            canvas = subdraft['draft']['canvas_config']

            self.assertIn('width', canvas)
            self.assertIn('height', canvas)
            self.assertIsInstance(canvas['width'], int)
            self.assertIsInstance(canvas['height'], int)
            self.assertGreater(canvas['width'], 0)
            self.assertGreater(canvas['height'], 0)

            print(f"✓ 画布配置正确")
            print(f"  - 分辨率: {canvas['width']}x{canvas['height']}")

    def test_subdrafts_tracks_and_materials(self):
        """测试复合片段的轨道和素材"""
        script = draft.ScriptFile.load_template(self.test_draft_path)
        subdrafts = script.read_subdrafts()

        if len(subdrafts) > 0:
            subdraft = subdrafts[0]
            nested_draft = subdraft['draft']

            # 检查轨道
            tracks = nested_draft['tracks']
            self.assertIsInstance(tracks, list)

            # 检查素材
            materials = nested_draft['materials']
            self.assertIsInstance(materials, dict)

            # 统计各类素材
            video_count = len(materials.get('videos', []))
            audio_count = len(materials.get('audios', []))
            text_count = len(materials.get('texts', []))

            print(f"✓ 轨道和素材结构正确")
            print(f"  - 轨道数量: {len(tracks)}")
            print(f"  - 视频素材: {video_count}")
            print(f"  - 音频素材: {audio_count}")
            print(f"  - 文本素材: {text_count}")

    def test_print_subdrafts_info(self):
        """测试打印复合片段信息"""
        script = draft.ScriptFile.load_template(self.test_draft_path)

        print("\n" + "="*60)
        print("调用 print_subdrafts_info() 输出:")
        print("="*60)

        # 这个方法会直接打印信息
        script.print_subdrafts_info()

        print("="*60)
        print("✓ print_subdrafts_info() 执行成功")

    def test_multiple_subdrafts(self):
        """测试处理多个复合片段"""
        script = draft.ScriptFile.load_template(self.test_draft_path)
        subdrafts = script.read_subdrafts()

        print(f"\n✓ 草稿包含 {len(subdrafts)} 个复合片段")

        for idx, subdraft in enumerate(subdrafts, 1):
            self.assertIn('id', subdraft)
            self.assertIn('name', subdraft)
            self.assertIn('draft', subdraft)
            print(f"  {idx}. {subdraft['name']} (ID: {subdraft['id']})")

    def test_empty_subdrafts(self):
        """测试没有复合片段的情况"""
        # 创建一个不包含 subdrafts 的草稿
        script = draft.ScriptFile(1920, 1080, 30)
        subdrafts = script.read_subdrafts()

        self.assertIsInstance(subdrafts, list)
        self.assertEqual(len(subdrafts), 0)
        print(f"✓ 空复合片段列表处理正确")


def run_tests():
    """运行所有测试"""
    # 创建测试套件
    loader = unittest.TestLoader()
    suite = loader.loadTestsFromTestCase(TestSubdrafts)

    # 运行测试
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)

    # 打印总结
    print("\n" + "="*60)
    print("测试总结:")
    print("="*60)
    print(f"运行测试: {result.testsRun}")
    print(f"成功: {result.testsRun - len(result.failures) - len(result.errors)}")
    print(f"失败: {len(result.failures)}")
    print(f"错误: {len(result.errors)}")

    if result.wasSuccessful():
        print("\n✓ 所有测试通过!")
        return 0
    else:
        print("\n✗ 部分测试失败")
        return 1


if __name__ == "__main__":
    sys.exit(run_tests())
