'use client';

import React, { useState, useRef, useCallback, useImperativeHandle, forwardRef } from 'react';
import TestDataEditor, { TestDataEditorRef } from './TestDataEditor';
import CodeTestEditor from './CodeTestEditor';
import type { TestData, RuleGroup, MaterialInfo } from '@/types/rule';
import type { RawSegmentPayload, RawMaterialPayload } from '@/types/rule';

interface TestDataEditorWithTabsProps {
  /** 测试数据ID */
  testDataId: string;
  /** 测试回调(可选) - 返回完整的请求载荷或包含task_id的响应。如果未提供，将使用内部默认实现 */
  onTest?: (testData: TestData) => Promise<any> | any;
  /** 当前规则组ID(用于关联数据集) */
  ruleGroupId?: string;
  /** 当前规则组(用于转换数据和内部测试) */
  ruleGroup?: RuleGroup | null;
  /** 素材列表(用于提取素材属性和内部测试) */
  materials?: MaterialInfo[];
  /** 可用的原始片段载荷(用于调试展示和内部测试) */
  rawSegments?: RawSegmentPayload[] | undefined;
  /** 可用的原始素材载荷(用于调试展示和内部测试) */
  rawMaterials?: RawMaterialPayload[] | undefined;
  /** 预设测试数据 */
  initialTestData?: TestData | null;
  /** 草稿配置(用于内部测试，包含canvas尺寸和fps) */
  draftConfig?: {
    canvasWidth?: number;
    canvasHeight?: number;
    fps?: number;
  };
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
  initialTestData = null,
  draftConfig,
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

  const tabs = ['json数据', '代码测试'];

  return (
    <div className="flex flex-col h-full">
      {/* Tab切换器 */}
      <div className="flex border-b border-[var(--border)]">
        {tabs.map((label, idx) => (
          <button
            key={label}
            type="button"
            onClick={() => setCurrentTab(idx)}
            className={
              'flex items-center gap-1 px-4 py-2 text-sm font-medium transition-colors ' +
              (currentTab === idx
                ? 'border-b-2 border-[var(--accent)] text-[var(--accent)]'
                : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]')
            }
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab内容 */}
      <div className="flex-1 overflow-hidden">
        {/* json数据Tab - 使用display控制显示/隐藏而非条件渲染 */}
        <div
          className="flex flex-col h-full"
          style={{ display: currentTab === 0 ? 'flex' : 'none' }}
        >
          <TestDataEditor
            ref={testDataEditorRef}
            testDataId={testDataId}
            onTest={onTest}
            ruleGroupId={ruleGroupId}
            ruleGroup={ruleGroup}
            materials={materials}
            rawSegments={rawSegments}
            rawMaterials={rawMaterials}
            initialTestData={initialTestData}
            onDataChange={handleTestDataChange}
            draftConfig={draftConfig}
          />
        </div>

        {/* 代码测试Tab - 使用display控制显示/隐藏而非条件渲染 */}
        <div
          className="flex flex-col h-full"
          style={{ display: currentTab === 1 ? 'flex' : 'none' }}
        >
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
              // console.log('[代码测试] 执行代码:', { code: code.substring(0, 100) + '...', params });

              try {
                const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;

                const fullCode = `
                  ${code}

                  if (typeof main === 'function') {
                    return main;
                  }
                `;

                // console.log('[代码测试] 即将执行的完整代码:', fullCode);

                const createMainFunction = new AsyncFunction(fullCode);
                const mainFunction = await createMainFunction();

                const result = typeof mainFunction === 'function'
                  ? await mainFunction({ params })
                  : null;

                // console.log('[代码测试] 执行结果:', result);

                return result;
              } catch (error: any) {
                console.error('[代码测试] 执行错误:', error);
                throw error;
              }
            }}
          />
        </div>
      </div>
    </div>
  );
});

TestDataEditorWithTabs.displayName = 'TestDataEditorWithTabs';

export default TestDataEditorWithTabs;
