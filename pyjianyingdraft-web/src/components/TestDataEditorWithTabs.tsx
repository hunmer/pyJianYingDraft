'use client';

import React, { useState, useRef, useCallback, useImperativeHandle, forwardRef } from 'react';
import {
  Box,
  Tabs,
  Tab,
  Typography,
} from '@mui/material';
import TestDataEditor from './TestDataEditor';
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
  const [sendTestData, setSendTestData] = useState<TestData | null>(null); // 用于发送测试的数据
  const [editorKey, setEditorKey] = useState(0); // 用于强制重新渲染编辑器

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

  // 添加引用方法
  const testDataEditorRef = useRef<any>(null);

  // 暴露给父组件的方法
  useImperativeHandle(ref, () => ({
    setJsonDataAndSwitchTab: (data: any) => {
      // 切换到json数据tab
      setCurrentTab(0);

      // 设置JSON数据
      if (data && typeof data === 'object') {
        const jsonString = JSON.stringify(data, null, 2);
        // 通过ref调用TestDataEditor的方法来设置数据
        // 由于TestDataEditor没有直接暴露设置方法,我们需要通过其他方式
        // 这里可以使用一个setTimeout来确保tab切换完成后再设置数据
        setTimeout(() => {
          // 触发数据更新
          const newTestData: TestData = {
            tracks: data.tracks || [],
            items: data.items || []
          };
          setSendTestData(newTestData);
          setCurrentTestData(newTestData);

          // 延迟执行测试,确保数据更新完成
          setTimeout(() => {
            // 查找并点击测试按钮
            const testButton = document.querySelector('[data-testid="test-run-button"]') as HTMLButtonElement;
            if (testButton && !testButton.disabled) {
              testButton.click();
            }
          }, 300);
        }, 100);
      }
    }
  }), [ruleGroupId]);

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
            key={editorKey}
            testDataId={testDataId}
            onTest={onTest}
            ruleGroupId={ruleGroupId}
            ruleGroup={ruleGroup}
            materials={materials}
            rawSegments={rawSegments}
            rawMaterials={rawMaterials}
            useRawSegmentsHint={useRawSegmentsHint}
            initialTestData={sendTestData || currentTestData || initialTestData}
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
                tracksValue: data.tracks,
                itemsValue: data.items
              });

              // 先处理和转换数据
              if (data && typeof data === 'object') {
                console.log('[TestDataEditorWithTabs] 开始处理发送的数据');
                // 智能数据转换:如果数据没有 tracks/items 结构,尝试转换
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

                  // 尝试将 all_params 转换为测试数据结构
                  const convertedData = data.all_params;
                  if (convertedData.tracks && convertedData.items) {
                    newTestData = {
                      tracks: convertedData.tracks,
                      items: convertedData.items
                    };
                  } else if (Array.isArray(convertedData)) {
                    // 如果是数组,假设是 items
                    newTestData = {
                      tracks: [],
                      items: convertedData
                    };
                  } else {
                    // 作为通用对象,尝试构建测试数据
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

                // 立即更新数据状态
                setSendTestData(newTestData);
                setCurrentTestData(newTestData);
                // 强制重新渲染编辑器以确保数据更新
                setEditorKey(prev => prev + 1);

                // 延迟切换tab,确保数据状态更新完成
                setTimeout(() => {
                  console.log('[TestDataEditorWithTabs] 切换到 json 数据 tab');
                  setCurrentTab(0);

                  // 数据已设置到编辑器,等待用户手动点击"测试运行"按钮
                  console.log('[TestDataEditorWithTabs] 数据已设置到编辑器,等待用户手动执行测试');
                }, 100);
              } else {
                console.warn('[TestDataEditorWithTabs] 数据格式无效,跳过设置:', { data, dataType: typeof data });
              }
            }}
            onExecute={async (code: string, params?: any) => {
              // 注意:传入的code已经是编译后的纯JavaScript代码(如果启用了TypeScript)
              console.log('[代码测试] 执行代码:', { code: code.substring(0, 100) + '...', params });

              try {
                // 模拟代码执行环境
                const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;

                // 构建完整的可执行代码
                // 代码已经由CodeTestEditor编译过,无需再次清理TypeScript语法
                const fullCode = `
                  ${code}

                  // 如果代码中定义了main函数,返回它
                  if (typeof main === 'function') {
                    return main;
                  }
                `;

                console.log('[代码测试] 即将执行的完整代码:', fullCode);

                // 创建执行环境
                const createMainFunction = new AsyncFunction(fullCode);
                const mainFunction = await createMainFunction();

                // 执行代码
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
