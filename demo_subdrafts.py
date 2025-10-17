"""
复合片段(Subdrafts)功能演示脚本

展示如何使用 pyJianYingDraft 读取和解析剪映草稿中的复合片段信息
"""

import os
import sys

# 设置UTF-8编码输出（Windows兼容）
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

import pyJianYingDraft as draft


def demo_basic_usage():
    """基础使用演示"""
    print("="*70)
    print("演示 1: 基础使用 - 读取复合片段列表")
    print("="*70)

    # 加载包含复合片段的草稿文件
    draft_path = r"D:\programming\pyJianYingDraft\subcrafts\B8C83597-9403-4e63-AF4D-BAB1EF066F87\draft_content.json"

    if not os.path.exists(draft_path):
        print(f"错误: 文件不存在 - {draft_path}")
        return

    # 加载草稿
    script = draft.ScriptFile.load_template(draft_path)
    print(f"✓ 已加载草稿文件\n")

    # 读取复合片段
    subdrafts = script.read_subdrafts()
    print(f"复合片段数量: {len(subdrafts)}\n")

    # 遍历每个复合片段
    for idx, subdraft in enumerate(subdrafts, 1):
        print(f"复合片段 {idx}:")
        print(f"  ID: {subdraft['id']}")
        print(f"  名称: {subdraft.get('name', '(无名称)')}")
        print(f"  类型: {subdraft['type']}")
        print()


def demo_detailed_info():
    """详细信息演示"""
    print("="*70)
    print("演示 2: 使用 print_subdrafts_info() 打印详细信息")
    print("="*70)

    draft_path = r"D:\programming\pyJianYingDraft\subcrafts\B8C83597-9403-4e63-AF4D-BAB1EF066F87\draft_content.json"

    if not os.path.exists(draft_path):
        print(f"错误: 文件不存在 - {draft_path}")
        return

    script = draft.ScriptFile.load_template(draft_path)

    # 使用便捷方法打印详细信息
    script.print_subdrafts_info()


def demo_nested_draft_access():
    """访问嵌套草稿数据演示"""
    print("="*70)
    print("演示 3: 访问嵌套的草稿数据")
    print("="*70)

    draft_path = r"D:\programming\pyJianYingDraft\subcrafts\B8C83597-9403-4e63-AF4D-BAB1EF066F87\draft_content.json"

    if not os.path.exists(draft_path):
        print(f"错误: 文件不存在 - {draft_path}")
        return

    script = draft.ScriptFile.load_template(draft_path)
    subdrafts = script.read_subdrafts()

    if not subdrafts:
        print("此草稿不包含复合片段")
        return

    # 访问第一个复合片段的嵌套草稿
    subdraft = subdrafts[0]
    nested_draft = subdraft['draft']

    print(f"复合片段名称: {subdraft.get('name', '(无名称)')}")
    print(f"\n嵌套草稿详细信息:")

    # 画布配置
    canvas = nested_draft['canvas_config']
    print(f"\n1. 画布配置:")
    print(f"   - 宽度: {canvas['width']} px")
    print(f"   - 高度: {canvas['height']} px")
    print(f"   - 比例: {canvas.get('ratio', 'N/A')}")

    # 基本信息
    print(f"\n2. 基本信息:")
    print(f"   - FPS: {nested_draft['fps']}")
    print(f"   - 时长: {nested_draft['duration'] / 1000000:.2f} 秒")
    print(f"   - 版本: {nested_draft.get('version', 'N/A')}")

    # 轨道信息
    tracks = nested_draft['tracks']
    print(f"\n3. 轨道信息:")
    print(f"   - 总轨道数: {len(tracks)}")

    track_types = {}
    for track in tracks:
        track_type = track.get('type', 'unknown')
        track_types[track_type] = track_types.get(track_type, 0) + 1

    for track_type, count in track_types.items():
        print(f"   - {track_type} 轨道: {count} 条")

    # 素材统计
    materials = nested_draft['materials']
    print(f"\n4. 素材统计:")
    print(f"   - 视频素材: {len(materials.get('videos', []))} 个")
    print(f"   - 音频素材: {len(materials.get('audios', []))} 个")
    print(f"   - 文本素材: {len(materials.get('texts', []))} 个")
    print(f"   - 特效素材: {len(materials.get('video_effects', []))} 个")
    print(f"   - 滤镜素材: {len(materials.get('effects', []))} 个")
    print(f"   - 转场素材: {len(materials.get('transitions', []))} 个")


def demo_programmatic_analysis():
    """编程分析演示"""
    print("="*70)
    print("演示 4: 编程方式分析复合片段")
    print("="*70)

    draft_path = r"D:\programming\pyJianYingDraft\subcrafts\B8C83597-9403-4e63-AF4D-BAB1EF066F87\draft_content.json"

    if not os.path.exists(draft_path):
        print(f"错误: 文件不存在 - {draft_path}")
        return

    script = draft.ScriptFile.load_template(draft_path)
    subdrafts = script.read_subdrafts()

    if not subdrafts:
        print("此草稿不包含复合片段")
        return

    print("分析所有复合片段:\n")

    total_duration = 0
    total_tracks = 0
    total_videos = 0
    total_audios = 0

    for idx, subdraft in enumerate(subdrafts, 1):
        nested_draft = subdraft['draft']
        duration = nested_draft['duration']
        tracks = len(nested_draft['tracks'])
        videos = len(nested_draft['materials'].get('videos', []))
        audios = len(nested_draft['materials'].get('audios', []))

        total_duration += duration
        total_tracks += tracks
        total_videos += videos
        total_audios += audios

        print(f"复合片段 {idx}: {subdraft.get('name', '(无名称)')}")
        print(f"  - 时长: {duration / 1000000:.2f} 秒")
        print(f"  - 轨道: {tracks} 条")
        print(f"  - 视频: {videos} 个")
        print(f"  - 音频: {audios} 个")
        print()

    print("汇总统计:")
    print(f"  - 复合片段总数: {len(subdrafts)}")
    print(f"  - 总时长: {total_duration / 1000000:.2f} 秒")
    print(f"  - 平均时长: {total_duration / len(subdrafts) / 1000000:.2f} 秒")
    print(f"  - 总轨道数: {total_tracks}")
    print(f"  - 总视频素材: {total_videos}")
    print(f"  - 总音频素材: {total_audios}")


def main():
    """主函数"""
    print("\n" + "="*70)
    print(" pyJianYingDraft - 复合片段(Subdrafts)功能演示")
    print("="*70 + "\n")

    try:
        # 演示 1: 基础使用
        demo_basic_usage()
        print()

        # 演示 2: 详细信息
        demo_detailed_info()
        print()

        # 演示 3: 访问嵌套数据
        demo_nested_draft_access()
        print()

        # 演示 4: 编程分析
        demo_programmatic_analysis()
        print()

        print("="*70)
        print("演示完成!")
        print("="*70)

    except FileNotFoundError as e:
        print(f"\n错误: {e}")
        print("请确保测试文件路径正确")
    except Exception as e:
        print(f"\n发生错误: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()
