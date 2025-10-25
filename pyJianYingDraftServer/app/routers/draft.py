"""
草稿文件基础操作路由
"""

from fastapi import APIRouter, HTTPException, Query, Body
from typing import Optional, List, Dict, Any
from pydantic import BaseModel

from app.models.draft_models import DraftInfo
from app.services.draft_service import DraftService
from app.config import get_config, update_config

router = APIRouter()


class DraftRootConfig(BaseModel):
    """草稿根目录配置"""
    draft_root: str


class RuleGroupsConfig(BaseModel):
    """规则组配置"""
    rule_groups: List[Dict[str, Any]]

class DraftRulesRequest(BaseModel):
    """草稿级规则组配置"""
    draft_path: str
    rule_groups: List[Dict[str, Any]]


class ImportZipRequest(BaseModel):
    """导入压缩包请求"""
    draft_root: str
    zip_path: str


DRAFT_ROOT_CONFIG_KEY = "PYJY_DRAFT_ROOT"
RULE_GROUPS_CONFIG_KEY = "PYJY_RULE_GROUPS"


@router.get("/info", response_model=DraftInfo)
async def get_draft_info(
    file_path: str = Query(..., description="草稿文件绝对路径")
):
    """
    获取草稿文件基础信息

    Args:
        file_path: draft_content.json文件的绝对路径

    Returns:
        草稿文件基础信息，包括分辨率、帧率、时长、轨道列表等
    """
    try:
        return DraftService.get_draft_info(file_path)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"解析草稿文件失败: {str(e)}")


@router.get("/raw")
async def get_draft_raw(
    file_path: str = Query(..., description="草稿文件绝对路径")
):
    """
    获取草稿完整原始内容
    """
    try:
        return DraftService.get_raw_content(file_path)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"读取草稿原始数据失败: {str(e)}")


@router.get("/validate")
async def validate_draft(
    file_path: str = Query(..., description="草稿文件绝对路径")
):
    """
    验证草稿文件是否有效

    Args:
        file_path: draft_content.json文件的绝对路径

    Returns:
        验证结果
    """
    try:
        DraftService.load_draft(file_path)
        return {
            "valid": True,
            "message": "草稿文件有效"
        }
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="文件不存在")
    except Exception as e:
        return {
            "valid": False,
            "message": f"草稿文件无效: {str(e)}"
        }


@router.get("/list")
async def list_drafts(
    base_path: str = Query(..., description="剪映草稿根目录路径")
):
    """
    列出指定目录下的所有草稿

    Args:
        base_path: 剪映草稿根目录路径 (例如: "D:\\JianyingPro Drafts")

    Returns:
        草稿列表,每个草稿包含:
        - name: 草稿名称
        - path: draft_content.json 文件路径
        - modified_time: 修改时间戳
        - folder_path: 草稿文件夹路径
    """
    try:
        drafts = DraftService.list_drafts(base_path)
        return {
            "count": len(drafts),
            "drafts": drafts
        }
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"列出草稿失败: {str(e)}")


@router.get("/config/root")
async def get_draft_root():
    """
    获取草稿根目录配置

    Returns:
        草稿根目录路径，如果未配置则返回空字符串
    """
    try:
        draft_root = get_config(DRAFT_ROOT_CONFIG_KEY, "")
        return {
            "draft_root": draft_root
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取配置失败: {str(e)}")


@router.post("/config/root")
async def set_draft_root(config: DraftRootConfig):
    """
    设置草稿根目录配置

    Args:
        config: 包含draft_root的配置对象

    Returns:
        更新后的配置
    """
    try:
        # 验证路径是否存在
        import os
        if config.draft_root and not os.path.exists(config.draft_root):
            raise HTTPException(status_code=400, detail=f"目录不存在: {config.draft_root}")

        # 更新配置
        update_config(DRAFT_ROOT_CONFIG_KEY, config.draft_root)

        return {
            "draft_root": config.draft_root,
            "message": "草稿根目录配置已更新"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"更新配置失败: {str(e)}")


@router.get("/config/rule-groups")
async def get_rule_groups():
    """
    获取规则组配置

    Returns:
        规则组列表,如果未配置则返回空列表
    """
    try:
        rule_groups = get_config(RULE_GROUPS_CONFIG_KEY, [])
        return {
            "rule_groups": rule_groups
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取规则组配置失败: {str(e)}")


@router.get("/all-rule-groups")
async def get_all_rule_groups(
    base_path: Optional[str] = Query(None, description="草稿根目录路径,不提供则使用配置的根目录")
):
    """
    从所有草稿目录收集规则组

    Args:
        base_path: 草稿根目录路径,如果不提供则使用配置的根目录

    Returns:
        所有规则组列表,每个规则组包含 draft_name 和 draft_path 字段标识来源
    """
    try:
        # 如果没有提供base_path,尝试从配置中获取
        if not base_path:
            base_path = get_config(DRAFT_ROOT_CONFIG_KEY, "")
            if not base_path:
                raise HTTPException(
                    status_code=400,
                    detail="未提供草稿根目录,且配置中也没有设置草稿根目录"
                )

        groups = DraftService.get_all_rule_groups(base_path)
        return {
            "rule_groups": groups,
            "count": len(groups)
        }
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"收集规则组失败: {str(e)}")


@router.post("/config/rule-groups")
async def set_rule_groups(config: RuleGroupsConfig):
    """
    设置规则组配置

    Args:
        config: 包含rule_groups的配置对象

    Returns:
        更新后的配置
    """
    try:
        # 更新配置
        update_config(RULE_GROUPS_CONFIG_KEY, config.rule_groups)

        return {
            "rule_groups": config.rule_groups,
            "message": "规则组配置已更新"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"更新规则组配置失败: {str(e)}")


@router.get("/rules")
async def get_draft_rules(
    draft_path: str = Query(..., description="草稿文件绝对路径或草稿目录")
):
    """
    获取指定草稿绑定的规则组
    """
    try:
        groups = DraftService.get_draft_rule_groups(draft_path)
        return {
            "rule_groups": groups
        }
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取草稿规则组失败: {str(e)}")


@router.post("/rules")
async def set_draft_rules(payload: DraftRulesRequest):
    """
    保存指定草稿的规则组
    """
    try:
        groups = DraftService.set_draft_rule_groups(payload.draft_path, payload.rule_groups)
        return {
            "rule_groups": groups,
            "message": "草稿规则组已更新"
        }
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"更新草稿规则组失败: {str(e)}")


@router.post("/import-zip")
async def import_zip(payload: ImportZipRequest):
    """
    导入压缩包草稿

    Args:
        payload: 包含草稿根目录和压缩包路径的请求体

    Returns:
        导入结果，包含草稿名称
    """
    import os
    import zipfile
    import shutil
    from pathlib import Path

    try:
        # 验证路径
        if not os.path.exists(payload.draft_root):
            raise HTTPException(status_code=400, detail=f"草稿根目录不存在: {payload.draft_root}")

        if not os.path.exists(payload.zip_path):
            raise HTTPException(status_code=400, detail=f"压缩包不存在: {payload.zip_path}")

        # 检查文件扩展名
        zip_ext = os.path.splitext(payload.zip_path)[1].lower()
        if zip_ext not in ['.zip', '.rar', '.7z']:
            raise HTTPException(status_code=400, detail=f"不支持的压缩格式: {zip_ext}")

        # 目前只支持 zip 格式
        if zip_ext != '.zip':
            raise HTTPException(status_code=400, detail=f"当前仅支持 .zip 格式，后续将支持更多格式")

        # 获取压缩包文件名（不含扩展名）作为草稿名称
        draft_name = os.path.splitext(os.path.basename(payload.zip_path))[0]
        target_dir = os.path.join(payload.draft_root, draft_name)

        # 检查目标目录是否已存在
        if os.path.exists(target_dir):
            # 生成唯一名称
            counter = 1
            while os.path.exists(f"{target_dir}_{counter}"):
                counter += 1
            draft_name = f"{draft_name}_{counter}"
            target_dir = f"{target_dir}_{counter}"

        # 创建临时解压目录
        temp_dir = os.path.join(payload.draft_root, f"_temp_{draft_name}")
        os.makedirs(temp_dir, exist_ok=True)

        try:
            # 解压文件
            with zipfile.ZipFile(payload.zip_path, 'r') as zip_ref:
                zip_ref.extractall(temp_dir)

            # 查找 draft_content.json 文件
            draft_content_path = None
            for root, dirs, files in os.walk(temp_dir):
                if 'draft_content.json' in files:
                    draft_content_path = os.path.join(root, 'draft_content.json')
                    break

            if not draft_content_path:
                raise HTTPException(status_code=400, detail="压缩包中未找到 draft_content.json 文件")

            # 获取包含 draft_content.json 的目录
            draft_folder = os.path.dirname(draft_content_path)

            # 移动到目标位置
            shutil.move(draft_folder, target_dir)

            # 清理临时目录
            shutil.rmtree(temp_dir, ignore_errors=True)

            return {
                "message": "导入成功",
                "draft_name": draft_name
            }

        except Exception as e:
            # 清理临时目录
            if os.path.exists(temp_dir):
                shutil.rmtree(temp_dir, ignore_errors=True)
            raise e

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"导入失败: {str(e)}")
