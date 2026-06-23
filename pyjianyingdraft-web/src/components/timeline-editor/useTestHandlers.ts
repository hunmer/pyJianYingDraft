import { useState } from 'react';
import type {
  TestData,
  RuleGroup,
  RuleGroupTestRequest,
  SegmentStylesPayload,
  RawSegmentPayload,
  RawMaterialPayload,
} from '@/types/rule';
import type { TrackInfo, MaterialInfo } from '@/types/draft';
import { ruleTestApi, tasksApi, generationRecordsApi } from '@/lib/api';

interface UseTestHandlersOptions {
  selectedRuleGroup: RuleGroup | null;
  tracks: TrackInfo[];
  materials: MaterialInfo[];
  rawSegmentPayloads: RawSegmentPayload[] | undefined;
  rawMaterialPayloads: RawMaterialPayload[] | undefined;
  canvasWidth?: number;
  canvasHeight?: number;
  fps?: number;
}

/**
 * 测试/异步任务相关状态与提交逻辑
 */
export function useTestHandlers({
  selectedRuleGroup,
  tracks,
  materials,
  rawSegmentPayloads,
  rawMaterialPayloads,
  canvasWidth,
  canvasHeight,
  fps,
}: UseTestHandlersOptions) {
  const [testResult, setTestResult] = useState('');
  const [fullRequestPayload, setFullRequestPayload] = useState<RuleGroupTestRequest | null>(null);
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  const [asyncDialogOpen, setAsyncDialogOpen] = useState(false);

  // 共享：校验 + 构建完整请求载荷（校验失败时 setTestResult 并抛出，行为与原内联逻辑一致）
  const buildTestRequestPayload = (testData: TestData): RuleGroupTestRequest => {
    if (!selectedRuleGroup) {
      const message = '请先选择规则组';
      setTestResult(message);
      throw new Error(message);
    }

    console.log('测试数据:', testData);
    console.log('当前规则组:', selectedRuleGroup);

    // 验证测试数据中的规则类型是否都存在于规则组中
    const missingRules: string[] = [];
    testData.items.forEach((item) => {
      const ruleExists = selectedRuleGroup.rules.some((rule) => rule.type === item.type);
      if (!ruleExists && !missingRules.includes(item.type)) {
        missingRules.push(item.type);
      }
    });

    if (missingRules.length > 0) {
      const message = `以下规则类型在当前规则组中不存在: ${missingRules.join(', ')}`;
      setTestResult(message);
      throw new Error(message);
    }

    // 预先构建素材样式映射，按素材ID与轨道ID关联
    const materialStyleMap = new Map<string, Record<string, any>>();
    tracks.forEach((track) => {
      track.segments.forEach((segment) => {
        if (!segment.material_id) {
          return;
        }
        const stylePayload: Record<string, any> = segment.style ? { ...segment.style } : {};
        if (segment.volume !== undefined && stylePayload.volume === undefined) {
          stylePayload.volume = segment.volume;
        }
        if (segment.speed !== undefined && stylePayload.speed === undefined) {
          stylePayload.speed = segment.speed;
        }
        if (Object.keys(stylePayload).length === 0) {
          return;
        }
        const existing = materialStyleMap.get(segment.material_id);
        const next = { ...(existing ?? {}) };
        if (!next[track.id]) {
          next[track.id] = stylePayload;
        }
        if (!next.__default__) {
          next.__default__ = stylePayload;
        }
        materialStyleMap.set(segment.material_id, next);
      });
    });

    // 收集测试所需的素材ID
    const requiredMaterialIds = new Set<string>();
    testData.items.forEach((item) => {
      const rule = selectedRuleGroup.rules.find((r) => r.type === item.type);
      if (rule) {
        rule.material_ids.forEach((id) => requiredMaterialIds.add(id));
      }
    });

    const missingMaterials: string[] = [];
    const segmentStylesPayload: SegmentStylesPayload = {};
    const resolvedMaterials = Array.from(requiredMaterialIds).reduce<MaterialInfo[]>((acc, id) => {
      const material = materials?.find((m) => m.id === id);
      if (material) {
        const styleMap = materialStyleMap.get(id);
        if (styleMap) {
          segmentStylesPayload[id] = styleMap;
        }
        acc.push(material);
      } else {
        missingMaterials.push(id);
      }
      return acc;
    }, []);

    if (missingMaterials.length > 0) {
      const message = `以下素材在当前草稿中未找到: ${missingMaterials.join(', ')}`;
      setTestResult(message);
      throw new Error(message);
    }

    const relevantRawSegments = (rawSegmentPayloads ?? []).filter((payload) => {
      const segmentMaterialId = payload.material_id ? String(payload.material_id) : undefined;
      if (segmentMaterialId && requiredMaterialIds.has(segmentMaterialId)) {
        return true;
      }
      const refs = Array.isArray(payload.segment?.extra_material_refs)
        ? payload.segment.extra_material_refs
          .filter((ref: any) => ref !== undefined && ref !== null)
          .map((ref: any) => String(ref))
        : [];
      return refs.some((refId) => requiredMaterialIds.has(refId));
    });
    const shouldUseRawSegments = relevantRawSegments.length > 0;
    const relevantRawMaterials = rawMaterialPayloads?.filter((material) =>
      requiredMaterialIds.has(String(material.id)),
    );

    const requestPayload: RuleGroupTestRequest = {
      ruleGroup: selectedRuleGroup,
      materials: resolvedMaterials,
      testData,
      segment_styles: Object.keys(segmentStylesPayload).length > 0 ? segmentStylesPayload : undefined,
      raw_segments: shouldUseRawSegments ? relevantRawSegments : undefined,
      raw_materials:
        shouldUseRawSegments && relevantRawMaterials && relevantRawMaterials.length > 0
          ? relevantRawMaterials
          : undefined,
      draft_config: {
        canvas_config: {
          canvas_width: canvasWidth,
          canvas_height: canvasHeight,
        },
        config: {
          maintrack_adsorb: false,
        },
        fps: fps,
      },
    };

    return requestPayload;
  };

  // 处理异步任务提交
  const handleAsyncSubmit = async (testData: TestData) => {
    const requestPayload = buildTestRequestPayload(testData);

    try {
      setTestResult('异步任务提交中...');

      // 保存完整载荷
      setFullRequestPayload(requestPayload);

      // 生成唯一的记录ID
      const recordId = `rec_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      // 提交异步任务
      const response = await tasksApi.submit(requestPayload);
      console.log('[Timeline] 异步任务已提交, task_id:', response.task_id);

      // 保存生成记录到后端
      try {
        await generationRecordsApi.create({
          record_id: recordId,
          task_id: response.task_id,
          rule_group_id: selectedRuleGroup!.id,
          rule_group_title: selectedRuleGroup!.title,
          rule_group: selectedRuleGroup!,
          draft_config: requestPayload.draft_config,
          materials: materials || [],
          test_data: testData,
          segment_styles: requestPayload.segment_styles,
          raw_segments: requestPayload.raw_segments,
          raw_materials: requestPayload.raw_materials,
        });
        console.log('[Timeline] 生成记录已保存, record_id:', recordId);
      } catch (error) {
        console.error('[Timeline] 保存生成记录失败:', error);
        // 即使保存失败也不影响主流程
      }

      setCurrentTaskId(response.task_id);
      setAsyncDialogOpen(true);
      setTestResult(`✅ 异步任务已提交\n任务ID: ${response.task_id}\n记录ID: ${recordId}\n\n提示: 你可以在下载管理页面查看实时下载进度`);

      // 保存完整载荷供下载使用
      setFullRequestPayload(requestPayload);

      // 返回包含task_id、record_id和完整请求载荷的响应，供TestDataEditor显示进度和下载
      return {
        ...response,
        ...requestPayload,
        record_id: recordId,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '异步任务提交失败';
      setTestResult(`异步任务提交失败: ${message}`);
      throw error instanceof Error ? error : new Error(String(error));
    }
  };

  // 处理测试数据
  const handleTestData = async (testData: TestData) => {
    const requestPayload = buildTestRequestPayload(testData);

    try {
      setTestResult('测试请求处理中...');

      // 保存完整载荷供下载使用
      setFullRequestPayload(requestPayload);

      // 发送请求
      const response = await ruleTestApi.runTest(requestPayload);
      const status = response.status_code;
      const path = response.draft_path || '未知';
      const extra = response.message ? ` | ${response.message}` : '';
      setTestResult(`状态码: ${status} | 草稿目录: ${path}${extra}`);

      // 保存完整载荷供下载使用
      setFullRequestPayload(requestPayload);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '测试失败';
      setTestResult(`测试失败: ${message}`);
      throw error instanceof Error ? error : new Error(String(error));
    }
  };

  return {
    testResult,
    setTestResult,
    fullRequestPayload,
    setFullRequestPayload,
    currentTaskId,
    setCurrentTaskId,
    asyncDialogOpen,
    setAsyncDialogOpen,
    handleAsyncSubmit,
    handleTestData,
  };
}
