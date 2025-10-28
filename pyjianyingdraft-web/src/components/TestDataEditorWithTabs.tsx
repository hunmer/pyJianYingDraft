'use client';

import React, { useState, useRef, useCallback, useImperativeHandle, forwardRef } from 'react';
import {
  Box,
  Tabs,
  Tab,
  Typography,
} from '@mui/material';
import TestDataEditor, { TestDataEditorRef } from './TestDataEditor';
import CodeTestEditor from './CodeTestEditor';
import type { TestData, RuleGroup, MaterialInfo } from '@/types/rule';
import type { RawSegmentPayload, RawMaterialPayload } from '@/types/rule';

interface TestDataEditorWithTabsProps {
  /** 测试数据ID */
  testDataId: string;
  /** 测试回调(必需) - 返回完整的请求载荷或包含task_id的响应 */
  onTest: (testData: TestData) => Promise<any> | any;
  /** 当前规则组ID(用于关联数据集) */
  ruleGroupId?: string;
  /** 当前规则组(用于转换数据) */
  ruleGroup?: RuleGroup | null;
  /** 素材列表(用于提取素材属性) */
  materials?: MaterialInfo[];
  /** 可用的原始片段载荷(用于调试展示) */
  rawSegments?: RawSegmentPayload[] | undefined;
  /** 可用的原始素材载荷(用于调试展示) */
  rawMaterials?: RawMaterialPayload[] | undefined;
  /** 当前是否会在测试时启用原始片段模式 */
  useRawSegmentsHint?: boolean;
  /** 预设测试数据 */
  initialTestData?: TestData | null;
}

/** 暴露给父组件的方法 */
export interface TestDataEditorWithTabsRef {
  /** 设置JSON数据并跳转到json数据tab */
  setJsonDataAndSwitchTab: (data: any) => void;
}

/**
 * 带Tab切换的测试数据编辑器
 * 包含【json数据】和【代码测试】两个tab
 */
const TestDataEditorWithTabs = forwardRef<TestDataEditorWithTabsRef, TestDataEditorWithTabsProps>(({
  testDataId,
  onTest,
  ruleGroupId,
  ruleGroup,
  materials = [],
  rawSegments,
  rawMaterials,
  useRawSegmentsHint,
  initialTestData = null,
}, ref) => {
  const [currentTab, setCurrentTab] = useState(0);
  const [currentTestData, setCurrentTestData] = useState<TestData | null>(initialTestData);

  // TestDataEditor 的 ref
  const testDataEditorRef = useRef<TestDataEditorRef>(null);

  // 处理测试数据变化
  const handleTestDataChange = useCallback((testData: TestData) => {
    setCurrentTestData(testData);
  }, []);

  // 获取当前JSON数据的函数
  const getJsonData = useCallback(() => {
    return currentTestData;
  }, [currentTestData]);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setCurrentTab(newValue);
  };

  // 暴露给父组件的方法
  useImperativeHandle(ref, () => ({
    setJsonDataAndSwitchTab: (data: any) => {
      // 切换到json数据tab
      setCurrentTab(0);

      // 通过ref调用TestDataEditor的setTestData方法
      if (data && typeof data === 'object' && testDataEditorRef.current) {
        const newTestData: TestData = {
          tracks: data.tracks || [],
          items: data.items || []
        };

        setTimeout(() => {
          testDataEditorRef.current?.setTestData(newTestData);

          // 延迟执行测试
          setTimeout(() => {
            testDataEditorRef.current?.runTest();
          }, 300);
        }, 100);
      }
    }
  }), []);

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Tab切换器 */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={currentTab} onChange={handleTabChange}>
          <Tab
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography>json数据</Typography>
              </Box>
            }
          />
          <Tab
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography>代码测试</Typography>
              </Box>
            }
          />
        </Tabs>
      </Box>

      {/* Tab内容 */}
      <Box sx={{ flex: 1, overflow: 'hidden' }}>
        {/* json数据Tab - 使用display控制显示/隐藏而非条件渲染 */}
        <Box sx={{ display: currentTab === 0 ? 'flex' : 'none', height: '100%', flexDirection: 'column' }}>
          <TestDataEditor
            ref={testDataEditorRef}
            testDataId={testDataId}
            onTest={onTest}
            ruleGroupId={ruleGroupId}
            ruleGroup={ruleGroup}
            materials={materials}
            rawSegments={rawSegments}
            rawMaterials={rawMaterials}
            useRawSegmentsHint={useRawSegmentsHint}
            initialTestData={initialTestData}
            onDataChange={handleTestDataChange}
          />
        </Box>

        {/* 代码测试Tab - 使用display控制显示/隐藏而非条件渲染 */}
        <Box sx={{ display: currentTab === 1 ? 'flex' : 'none', height: '100%', flexDirection: 'column' }}>
          <CodeTestEditor
            testDataId={`${testDataId}-code`}
            getJsonData={getJsonData}
            onSendTest={(data) => {
              console.log('[TestDataEditorWithTabs] onSendTest 回调被调用');
              console.log('[TestDataEditorWithTabs] 接收到的数据:', {
                data,
                dataType: typeof data,
                dataKeys: Object.keys(data),
                hasTracks: !!data.tracks,
                hasItems: !!data.items,
              });

              // 处理和转换数据
              if (data && typeof data === 'object') {
                console.log('[TestDataEditorWithTabs] 开始处理发送的数据');
                let newTestData: TestData;

                if (data.tracks && data.items) {
                  // 数据已经有正确的结构
                  newTestData = {
                    tracks: data.tracks,
                    items: data.items
                  };
                  console.log('[TestDataEditorWithTabs] 数据已包含 tracks/items 结构,直接使用');
                } else if (data.all_params) {
                  // 数据是执行结果格式,需要转换
                  console.log('[TestDataEditorWithTabs] 数据是执行结果格式,尝试转换');

                  const convertedData = data.all_params;
                  if (convertedData.tracks && convertedData.items) {
                    newTestData = {
                      tracks: convertedData.tracks,
                      items: convertedData.items
                    };
                  } else if (Array.isArray(convertedData)) {
                    newTestData = {
                      tracks: [],
                      items: convertedData
                    };
                  } else {
                    newTestData = {
                      tracks: convertedData.tracks || [],
                      items: convertedData.items || [convertedData]
                    };
                  }
                  console.log('[TestDataEditorWithTabs] 转换后的测试数据:', newTestData);
                } else {
                  // 通用数据,包装为 items
                  console.log('[TestDataEditorWithTabs] 通用数据格式,包装为 items');
                  newTestData = {
                    tracks: data.tracks || [],
                    items: data.items || [data]
                  };
                }

                console.log('[TestDataEditorWithTabs] 最终设置的测试数据:', newTestData);

                // 切换到json数据tab
                setCurrentTab(0);

                // 延迟调用TestDataEditor的方法
                setTimeout(() => {
                  console.log('[TestDataEditorWithTabs] 调用 TestDataEditor.setTestData');
                  testDataEditorRef.current?.setTestData(newTestData);
                  console.log('[TestDataEditorWithTabs] 数据已设置到编辑器,等待用户手动执行测试');
                }, 100);
              } else {
                console.warn('[TestDataEditorWithTabs] 数据格式无效,跳过设置:', { data, dataType: typeof data });
              }
            }}
            onExecute={async (code: string, params?: any) => {
              console.log('[代码测试] 执行代码:', { code: code.substring(0, 100) + '...', params });

              try {
                const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;

                const fullCode = `
                  ${code}

                  if (typeof main === 'function') {
                    return main;
                  }
                `;

                console.log('[代码测试] 即将执行的完整代码:', fullCode);

                const createMainFunction = new AsyncFunction(fullCode);
                const mainFunction = await createMainFunction();

                const result = typeof mainFunction === 'function'
                  ? await mainFunction({ params })
                  : null;

                console.log('[代码测试] 执行结果:', result);

                return result;
              } catch (error: any) {
                console.error('[代码测试] 执行错误:', error);
                throw error;
              }
            }}
          />
        </Box>
      </Box>
    </Box>
  );
});

TestDataEditorWithTabs.displayName = 'TestDataEditorWithTabs';

export default TestDataEditorWithTabs;
