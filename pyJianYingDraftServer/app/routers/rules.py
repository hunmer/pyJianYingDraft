"""
规则组测试路由
"""

from fastapi import APIRouter, HTTPException

from app.models.rule_models import RuleGroupTestRequest, RuleGroupTestResponse
from app.services.rule_test_service import RuleTestService

router = APIRouter()


@router.post("/test", response_model=RuleGroupTestResponse)
async def run_rule_group_test(payload: RuleGroupTestRequest) -> RuleGroupTestResponse:
    """
    执行规则组测试，生成新的剪映草稿并返回结果
    """
    try:
        return RuleTestService.run_test(payload)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"执行规则测试失败: {exc}") from exc
