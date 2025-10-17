"""
复合片段(Subdrafts)详细信息输出演示

本脚本深入展示如何读取和解析复合片段中的轨道、视频、音频等详细信息
"""

import os
import sys

# 设置UTF-8编码输出（Windows兼容）
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

import pyJianYingDraft as draft


def format_time(microseconds):
    """将微秒转换为易读的时间格式"""
    seconds = microseconds / 1000000
    if seconds < 60:
        return f"{seconds:.2f}秒"
    elif seconds < 3600:
        minutes = int(seconds // 60)
        secs = seconds % 60
        return f"{minutes}分{secs:.2f}秒"
    else:
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        secs = seconds % 60
        return f"{hours}小时{minutes}分{secs:.2f}秒"


def demo_tracks_detail():
    """详细输出轨道信息"""
    print("="*80)
    print("演示 1: 详细输出轨道信息")
    print("="*80)

    draft_path = r"D:\programming\pyJianYingDraft\subcrafts\B8C83597-9403-4e63-AF4D-BAB1EF066F87\draft_content.json"

    if not os.path.exists(draft_path):
        print(f"错误: 文件不存在 - {draft_path}")
        return

    script = draft.ScriptFile.load_template(draft_path)
    subdrafts = script.read_subdrafts()

    if not subdrafts:
        print("此草稿不包含复合片段")
        return

    subdraft = subdrafts[0]
    nested_draft = subdraft['draft']
    tracks = nested_draft['tracks']

    print(f"\n复合片段: {subdraft.get('name', '(无名称)')}")
    print(f"总轨道数: {len(tracks)}\n")

    # 按类型分组轨道
    video_tracks = []
    audio_tracks = []
    text_tracks = []
    effect_tracks = []
    other_tracks = []

    for track in tracks:
        track_type = track.get('type', 'unknown')
        if track_type == 'video':
            video_tracks.append(track)
        elif track_type == 'audio':
            audio_tracks.append(track)
        elif track_type == 'text':
            text_tracks.append(track)
        elif track_type == 'effect':
            effect_tracks.append(track)
        else:
            other_tracks.append(track)

    # 详细输出视频轨道
    if video_tracks:
        print(f"{'='*80}")
        print(f"视频轨道 ({len(video_tracks)} 条)")
        print(f"{'='*80}")
        for idx, track in enumerate(video_tracks, 1):
            print(f"\n视频轨道 {idx}:")
            print(f"  ID: {track.get('id', 'N/A')}")
            print(f"  名称: {track.get('name', 'N/A')}")
            print(f"  类型: {track.get('type', 'N/A')}")
            print(f"  渲染索引: {track.get('render_index', 'N/A')}")
            print(f"  片段数量: {len(track.get('segments', []))}")

            segments = track.get('segments', [])
            if segments:
                print(f"\n  片段列表:")
                for seg_idx, segment in enumerate(segments, 1):
                    target_time = segment.get('target_timerange', {})
                    source_time = segment.get('source_timerange', {})

                    print(f"\n    片段 {seg_idx}:")
                    print(f"      片段ID: {segment.get('id', 'N/A')}")
                    print(f"      素材ID: {segment.get('material_id', 'N/A')}")

                    if target_time:
                        start = target_time.get('start', 0)
                        duration = target_time.get('duration', 0)
                        print(f"      目标时间范围: 开始 {format_time(start)}, 时长 {format_time(duration)}")

                    if source_time:
                        start = source_time.get('start', 0)
                        duration = source_time.get('duration', 0)
                        print(f"      素材时间范围: 开始 {format_time(start)}, 时长 {format_time(duration)}")

                    # 速度信息
                    speed = segment.get('speed', 1.0)
                    if speed != 1.0:
                        print(f"      播放速度: {speed}x")

                    # 音量信息
                    volume = segment.get('volume', None)
                    if volume is not None:
                        print(f"      音量: {volume}")

                    # 裁剪信息
                    clip = segment.get('clip', None)
                    if clip:
                        print(f"      裁剪设置: 存在")

    # 详细输出音频轨道
    if audio_tracks:
        print(f"\n{'='*80}")
        print(f"音频轨道 ({len(audio_tracks)} 条)")
        print(f"{'='*80}")
        for idx, track in enumerate(audio_tracks, 1):
            print(f"\n音频轨道 {idx}:")
            print(f"  ID: {track.get('id', 'N/A')}")
            print(f"  名称: {track.get('name', 'N/A')}")
            print(f"  类型: {track.get('type', 'N/A')}")
            print(f"  渲染索引: {track.get('render_index', 'N/A')}")
            print(f"  片段数量: {len(track.get('segments', []))}")

            segments = track.get('segments', [])
            if segments:
                print(f"\n  片段列表:")
                for seg_idx, segment in enumerate(segments, 1):
                    target_time = segment.get('target_timerange', {})

                    print(f"\n    片段 {seg_idx}:")
                    print(f"      片段ID: {segment.get('id', 'N/A')}")
                    print(f"      素材ID: {segment.get('material_id', 'N/A')}")

                    if target_time:
                        start = target_time.get('start', 0)
                        duration = target_time.get('duration', 0)
                        print(f"      目标时间范围: 开始 {format_time(start)}, 时长 {format_time(duration)}")

                    # 音量信息
                    volume = segment.get('volume', None)
                    if volume is not None:
                        print(f"      音量: {volume}")

                    # 淡入淡出
                    fade_in = segment.get('fade_in', None)
                    fade_out = segment.get('fade_out', None)
                    if fade_in:
                        print(f"      淡入: {format_time(fade_in)}")
                    if fade_out:
                        print(f"      淡出: {format_time(fade_out)}")

    # 详细输出文本轨道
    if text_tracks:
        print(f"\n{'='*80}")
        print(f"文本轨道 ({len(text_tracks)} 条)")
        print(f"{'='*80}")
        for idx, track in enumerate(text_tracks, 1):
            print(f"\n文本轨道 {idx}:")
            print(f"  ID: {track.get('id', 'N/A')}")
            print(f"  名称: {track.get('name', 'N/A')}")
            print(f"  类型: {track.get('type', 'N/A')}")
            print(f"  渲染索引: {track.get('render_index', 'N/A')}")
            print(f"  片段数量: {len(track.get('segments', []))}")

            segments = track.get('segments', [])
            if segments:
                print(f"\n  片段列表:")
                for seg_idx, segment in enumerate(segments, 1):
                    target_time = segment.get('target_timerange', {})

                    print(f"\n    片段 {seg_idx}:")
                    print(f"      片段ID: {segment.get('id', 'N/A')}")
                    print(f"      素材ID: {segment.get('material_id', 'N/A')}")

                    if target_time:
                        start = target_time.get('start', 0)
                        duration = target_time.get('duration', 0)
                        print(f"      时间范围: 开始 {format_time(start)}, 时长 {format_time(duration)}")

    # 输出其他轨道
    if effect_tracks or other_tracks:
        print(f"\n{'='*80}")
        print(f"其他轨道 (特效: {len(effect_tracks)}, 其他: {len(other_tracks)})")
        print(f"{'='*80}")


def demo_videos_detail():
    """详细输出视频素材信息"""
    print("\n" + "="*80)
    print("演示 2: 详细输出视频素材信息")
    print("="*80)

    draft_path = r"D:\programming\pyJianYingDraft\subcrafts\B8C83597-9403-4e63-AF4D-BAB1EF066F87\draft_content.json"

    if not os.path.exists(draft_path):
        print(f"错误: 文件不存在 - {draft_path}")
        return

    script = draft.ScriptFile.load_template(draft_path)
    subdrafts = script.read_subdrafts()

    if not subdrafts:
        print("此草稿不包含复合片段")
        return

    subdraft = subdrafts[0]
    nested_draft = subdraft['draft']
    materials = nested_draft['materials']
    videos = materials.get('videos', [])

    print(f"\n复合片段: {subdraft.get('name', '(无名称)')}")
    print(f"视频素材总数: {len(videos)}\n")

    for idx, video in enumerate(videos, 1):
        print(f"{'='*80}")
        print(f"视频素材 {idx}")
        print(f"{'='*80}")

        # 基本信息
        print(f"\n基本信息:")
        print(f"  ID: {video.get('id', 'N/A')}")
        print(f"  名称: {video.get('material_name', 'N/A')}")
        print(f"  类型: {video.get('material_type', 'N/A')}")  # video, photo等
        print(f"  路径: {video.get('path', 'N/A')}")

        # 视频属性
        print(f"\n视频属性:")
        print(f"  宽度: {video.get('width', 'N/A')} px")
        print(f"  高度: {video.get('height', 'N/A')} px")
        print(f"  时长: {format_time(video.get('duration', 0))}")
        print(f"  帧率: {video.get('fps', 'N/A')}")

        # 裁剪设置
        crop = video.get('crop', None)
        if crop:
            print(f"\n裁剪设置:")
            print(f"  左下角X: {crop.get('lower_left_x', 'N/A')}")
            print(f"  左下角Y: {crop.get('lower_left_y', 'N/A')}")
            print(f"  右上角X: {crop.get('upper_right_x', 'N/A')}")
            print(f"  右上角Y: {crop.get('upper_right_y', 'N/A')}")

        # 元数据
        metetype = video.get('metetype', None)
        if metetype:
            print(f"\n元数据:")
            print(f"  创建时间: {metetype.get('ctime', 'N/A')}")
            print(f"  修改时间: {metetype.get('mtime', 'N/A')}")

        # 文件信息
        file_info = video.get('file_info', None)
        if file_info:
            print(f"\n文件信息:")
            print(f"  文件大小: {file_info.get('size', 'N/A')} 字节")

        print()


def demo_audios_detail():
    """详细输出音频素材信息"""
    print("="*80)
    print("演示 3: 详细输出音频素材信息")
    print("="*80)

    draft_path = r"D:\programming\pyJianYingDraft\subcrafts\B8C83597-9403-4e63-AF4D-BAB1EF066F87\draft_content.json"

    if not os.path.exists(draft_path):
        print(f"错误: 文件不存在 - {draft_path}")
        return

    script = draft.ScriptFile.load_template(draft_path)
    subdrafts = script.read_subdrafts()

    if not subdrafts:
        print("此草稿不包含复合片段")
        return

    subdraft = subdrafts[0]
    nested_draft = subdraft['draft']
    materials = nested_draft['materials']
    audios = materials.get('audios', [])

    print(f"\n复合片段: {subdraft.get('name', '(无名称)')}")
    print(f"音频素材总数: {len(audios)}\n")

    for idx, audio in enumerate(audios, 1):
        print(f"{'='*80}")
        print(f"音频素材 {idx}")
        print(f"{'='*80}")

        # 基本信息
        print(f"\n基本信息:")
        print(f"  ID: {audio.get('id', 'N/A')}")
        print(f"  名称: {audio.get('name', 'N/A')}")
        print(f"  路径: {audio.get('path', 'N/A')}")
        print(f"  类型: {audio.get('type', 'N/A')}")

        # 音频属性
        print(f"\n音频属性:")
        print(f"  时长: {format_time(audio.get('duration', 0))}")

        # 元数据
        metetype = audio.get('metetype', None)
        if metetype:
            print(f"\n元数据:")
            print(f"  创建时间: {metetype.get('ctime', 'N/A')}")
            print(f"  修改时间: {metetype.get('mtime', 'N/A')}")

        # 文件信息
        file_info = audio.get('file_info', None)
        if file_info:
            print(f"\n文件信息:")
            print(f"  文件大小: {file_info.get('size', 'N/A')} 字节")

        print()


def demo_texts_detail():
    """详细输出文本素材信息"""
    print("="*80)
    print("演示 4: 详细输出文本素材信息")
    print("="*80)

    draft_path = r"D:\programming\pyJianYingDraft\subcrafts\B8C83597-9403-4e63-AF4D-BAB1EF066F87\draft_content.json"

    if not os.path.exists(draft_path):
        print(f"错误: 文件不存在 - {draft_path}")
        return

    script = draft.ScriptFile.load_template(draft_path)
    subdrafts = script.read_subdrafts()

    if not subdrafts:
        print("此草稿不包含复合片段")
        return

    subdraft = subdrafts[0]
    nested_draft = subdraft['draft']
    materials = nested_draft['materials']
    texts = materials.get('texts', [])

    print(f"\n复合片段: {subdraft.get('name', '(无名称)')}")
    print(f"文本素材总数: {len(texts)}\n")

    for idx, text in enumerate(texts, 1):
        print(f"{'='*80}")
        print(f"文本素材 {idx}")
        print(f"{'='*80}")

        # 基本信息
        print(f"\n基本信息:")
        print(f"  ID: {text.get('id', 'N/A')}")
        print(f"  类型: {text.get('type', 'N/A')}")

        # 解析内容
        import json
        try:
            content = json.loads(text.get('content', '{}'))

            print(f"\n文本内容:")
            print(f"  文本: {content.get('text', 'N/A')}")

            # 字体样式
            styles = content.get('styles', [])
            if styles:
                print(f"\n字体样式 ({len(styles)} 个):")
                for style_idx, style in enumerate(styles, 1):
                    print(f"    样式 {style_idx}:")
                    print(f"      范围: {style.get('range', 'N/A')}")
                    print(f"      字体ID: {style.get('font_id', 'N/A')}")
                    print(f"      字体大小: {style.get('size', 'N/A')}")
                    print(f"      颜色: {style.get('color', 'N/A')}")

        except (json.JSONDecodeError, AttributeError):
            print(f"  内容: {text.get('content', 'N/A')}")

        print()


def demo_materials_summary():
    """素材汇总统计"""
    print("="*80)
    print("演示 5: 素材汇总统计")
    print("="*80)

    draft_path = r"D:\programming\pyJianYingDraft\subcrafts\B8C83597-9403-4e63-AF4D-BAB1EF066F87\draft_content.json"

    if not os.path.exists(draft_path):
        print(f"错误: 文件不存在 - {draft_path}")
        return

    script = draft.ScriptFile.load_template(draft_path)
    subdrafts = script.read_subdrafts()

    if not subdrafts:
        print("此草稿不包含复合片段")
        return

    subdraft = subdrafts[0]
    nested_draft = subdraft['draft']
    materials = nested_draft['materials']

    print(f"\n复合片段: {subdraft.get('name', '(无名称)')}")
    print(f"\n素材类型统计:\n")

    # 统计所有素材类型
    material_stats = {}
    for material_type, material_list in materials.items():
        if isinstance(material_list, list) and len(material_list) > 0:
            material_stats[material_type] = len(material_list)

    # 按数量排序
    sorted_stats = sorted(material_stats.items(), key=lambda x: x[1], reverse=True)

    for material_type, count in sorted_stats:
        print(f"  {material_type:30s} : {count:4d} 个")

    # 计算总时长
    print(f"\n时长统计:\n")

    total_video_duration = sum(v.get('duration', 0) for v in materials.get('videos', []))
    total_audio_duration = sum(a.get('duration', 0) for a in materials.get('audios', []))

    print(f"  视频素材总时长: {format_time(total_video_duration)}")
    print(f"  音频素材总时长: {format_time(total_audio_duration)}")
    print(f"  草稿总时长: {format_time(nested_draft['duration'])}")


def main():
    """主函数"""
    print("\n" + "="*80)
    print(" pyJianYingDraft - 复合片段详细信息输出演示")
    print("="*80 + "\n")

    try:
        # 演示 1: 轨道详细信息
        demo_tracks_detail()
        print()

        # 演示 2: 视频素材详细信息
        demo_videos_detail()
        print()

        # 演示 3: 音频素材详细信息
        demo_audios_detail()
        print()

        # 演示 4: 文本素材详细信息
        demo_texts_detail()
        print()

        # 演示 5: 素材汇总统计
        demo_materials_summary()
        print()

        print("="*80)
        print("演示完成!")
        print("="*80)

    except FileNotFoundError as e:
        print(f"\n错误: {e}")
        print("请确保测试文件路径正确")
    except Exception as e:
        print(f"\n发生错误: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()
