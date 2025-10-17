"""
API 客户端使用示例

演示如何使用 Python 调用 pyJianYingDraftServer API
"""

import requests
import json
from typing import Dict, Any


class JianyingDraftClient:
    """剪映草稿 API 客户端"""

    def __init__(self, base_url: str = "http://localhost:8000"):
        self.base_url = base_url

    def _get(self, endpoint: str, params: Dict[str, Any] = None) -> Dict[str, Any]:
        """发送 GET 请求"""
        url = f"{self.base_url}{endpoint}"
        response = requests.get(url, params=params)
        response.raise_for_status()
        return response.json()

    def get_draft_info(self, file_path: str) -> Dict[str, Any]:
        """获取草稿文件基础信息"""
        return self._get("/api/draft/info", {"file_path": file_path})

    def validate_draft(self, file_path: str) -> Dict[str, Any]:
        """验证草稿文件"""
        return self._get("/api/draft/validate", {"file_path": file_path})

    def get_subdrafts(self, file_path: str) -> list:
        """获取复合片段列表"""
        return self._get("/api/subdrafts/list", {"file_path": file_path})

    def get_subdraft(self, file_path: str, index: int) -> Dict[str, Any]:
        """获取指定索引的复合片段"""
        return self._get(f"/api/subdrafts/{index}", {"file_path": file_path})

    def get_subdraft_tracks(self, file_path: str, index: int, track_type: str = None) -> Dict[str, Any]:
        """获取复合片段的轨道"""
        params = {"file_path": file_path}
        if track_type:
            params["track_type"] = track_type
        return self._get(f"/api/subdrafts/{index}/tracks", params)

    def get_all_materials(self, file_path: str) -> Dict[str, Any]:
        """获取所有素材"""
        return self._get("/api/materials/all", {"file_path": file_path})

    def get_materials_by_type(self, file_path: str, material_type: str) -> Dict[str, Any]:
        """根据类型获取素材"""
        return self._get(f"/api/materials/type/{material_type}", {"file_path": file_path})

    def get_material_statistics(self, file_path: str) -> Dict[str, Any]:
        """获取素材统计"""
        return self._get("/api/materials/statistics", {"file_path": file_path})

    def get_tracks_by_type(self, file_path: str, track_type: str) -> list:
        """根据类型获取轨道"""
        return self._get(f"/api/tracks/type/{track_type}", {"file_path": file_path})

    def get_track_statistics(self, file_path: str) -> Dict[str, Any]:
        """获取轨道统计"""
        return self._get("/api/tracks/statistics", {"file_path": file_path})


def print_json(data: Any, title: str = None):
    """格式化打印 JSON 数据"""
    if title:
        print(f"\n{'='*60}")
        print(f"  {title}")
        print(f"{'='*60}")
    print(json.dumps(data, ensure_ascii=False, indent=2))


def main():
    """主函数 - 演示 API 使用"""

    # 修改为你的草稿文件路径
    draft_path = r"D:\programming\pyJianYingDraft\subcrafts\B8C83597-9403-4e63-AF4D-BAB1EF066F87\draft_content.json"

    # 创建客户端
    client = JianyingDraftClient()

    try:
        # 1. 验证草稿文件
        print("\n" + "="*80)
        print("示例 1: 验证草稿文件")
        print("="*80)
        result = client.validate_draft(draft_path)
        print(f"验证结果: {result['valid']}")
        print(f"消息: {result['message']}")

        # 2. 获取草稿基础信息
        print("\n" + "="*80)
        print("示例 2: 获取草稿基础信息")
        print("="*80)
        draft_info = client.get_draft_info(draft_path)
        print(f"分辨率: {draft_info['width']}x{draft_info['height']}")
        print(f"帧率: {draft_info['fps']} fps")
        print(f"总时长: {draft_info['duration_seconds']:.2f} 秒")
        print(f"轨道数: {draft_info['track_count']}")

        # 3. 获取复合片段
        print("\n" + "="*80)
        print("示例 3: 获取复合片段列表")
        print("="*80)
        subdrafts = client.get_subdrafts(draft_path)
        print(f"复合片段数量: {len(subdrafts)}")
        for i, subdraft in enumerate(subdrafts):
            print(f"\n复合片段 {i}:")
            print(f"  名称: {subdraft['name']}")
            print(f"  ID: {subdraft['id']}")
            print(f"  时长: {subdraft['draft_info']['duration_seconds']:.2f} 秒")
            print(f"  轨道数: {subdraft['draft_info']['track_count']}")
            print(f"  素材统计: {subdraft['material_stats']}")

        # 4. 获取素材统计
        print("\n" + "="*80)
        print("示例 4: 获取素材统计")
        print("="*80)
        material_stats = client.get_material_statistics(draft_path)
        print(f"素材总数: {material_stats['total_count']}")
        print("\n各类型素材数量:")
        for mat_type, count in material_stats['by_type'].items():
            print(f"  {mat_type:30s}: {count:4d}")

        # 5. 获取轨道统计
        print("\n" + "="*80)
        print("示例 5: 获取轨道统计")
        print("="*80)
        track_stats = client.get_track_statistics(draft_path)
        print(f"轨道总数: {track_stats['total_tracks']}")
        print(f"片段总数: {track_stats['total_segments']}")
        print("\n各类型轨道统计:")
        for track_type, stats in track_stats['by_type'].items():
            print(f"  {track_type}:")
            print(f"    轨道数: {stats['track_count']}")
            print(f"    片段数: {stats['segment_count']}")

        # 6. 获取视频轨道详情
        print("\n" + "="*80)
        print("示例 6: 获取视频轨道详情")
        print("="*80)
        video_tracks = client.get_tracks_by_type(draft_path, "video")
        print(f"视频轨道数量: {len(video_tracks)}")
        for track in video_tracks:
            print(f"\n轨道: {track['name']}")
            print(f"  ID: {track['id']}")
            print(f"  片段数: {track['segment_count']}")
            print(f"  渲染索引: {track['render_index']}")

        # 7. 如果有复合片段，获取第一个复合片段的详细信息
        if subdrafts:
            print("\n" + "="*80)
            print("示例 7: 获取复合片段详细信息")
            print("="*80)
            subdraft_detail = client.get_subdraft(draft_path, 0)
            print(f"复合片段名称: {subdraft_detail['name']}")

            # 获取复合片段的轨道
            subdraft_tracks = client.get_subdraft_tracks(draft_path, 0)
            print(f"复合片段轨道数: {subdraft_tracks['track_count']}")

        print("\n" + "="*80)
        print("示例完成!")
        print("="*80)

    except requests.exceptions.ConnectionError:
        print("\n错误: 无法连接到服务器，请确保服务器已启动")
        print("启动服务器: python run.py")
    except requests.exceptions.HTTPError as e:
        print(f"\nHTTP 错误: {e}")
        print(f"响应内容: {e.response.text}")
    except Exception as e:
        print(f"\n发生错误: {type(e).__name__}: {e}")


if __name__ == "__main__":
    main()
