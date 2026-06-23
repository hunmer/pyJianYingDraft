'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useSnapshots } from '@/hooks/useSnapshots';
import { useDebounce } from '@/hooks/useDebounce';
import { CodeTestEditorProps, Language } from './types';
import { getDefaultCodeTemplate, isDefaultCode, JS_DEFAULT_CODE_TEMPLATE } from './templates';
import { useRuntimeLoader } from './useRuntimeLoader';
import { toast } from '@heroui/react';
import { compileTypeScript, runJavaScript, runPython } from './codeRunner';
import Toolbar from './components/Toolbar';
import CodeEditorPanel from './components/CodeEditorPanel';
import DataPanel from './components/DataPanel';
import BottomActions from './components/BottomActions';

/**
 * 代码测试编辑器组件
 */
export default function CodeTestEditor({
  initialCode = JS_DEFAULT_CODE_TEMPLATE,
  onExecute,
  testDataId,
  getJsonData,
  onSendTest,
}: CodeTestEditorProps) {
  const [code, setCode] = useState(() => {
    // 尝试从localStorage恢复上次编辑的快照
    const snapshotKey = `code-test-last-snapshot-${testDataId}`;
    const stored = localStorage.getItem(snapshotKey);
    return stored || initialCode;
  });
  const [jsonData, setJsonData] = useState(() => {
    // 尝试从localStorage恢复上次编辑的JSON快照
    const snapshotKey = `code-test-json-last-snapshot-${testDataId}`;
    const stored = localStorage.getItem(snapshotKey);
    return stored || '{}';
  });
  const [executing, setExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<any>(null);
  const [rightTabValue, setRightTabValue] = useState(0); // 右侧tab状态：0=输入数据，1=输出数据
  const [language, setLanguage] = useState<Language>('typescript'); // 当前语言选择
  const codeEditorRef = useRef<any>(null);
  const jsonEditorRef = useRef<any>(null);
  const previousLanguageRef = useRef(language); // 追踪上次的语言选择

  // 使用节流（1秒延迟）来保存编辑内容到"上次编辑快照"
  const debouncedCode = useDebounce(code, 1000);
  const debouncedJsonData = useDebounce(jsonData, 1000);

  // 快照管理 - 代码快照
  const {
    snapshots: codeSnapshots,
    createSnapshot: createCodeSnapshot,
    restoreSnapshot: restoreCodeSnapshot,
    deleteSnapshot: deleteCodeSnapshot,
    renameSnapshot: renameCodeSnapshot,
  } = useSnapshots({
    storageKey: `code-test-code-${testDataId}`,
    maxSnapshots: 20,
    autoSaveCurrent: false,
  });

  // 快照管理 - JSON数据快照
  const {
    snapshots: jsonSnapshots,
    createSnapshot: createJsonSnapshot,
    restoreSnapshot: restoreJsonSnapshot,
    deleteSnapshot: deleteJsonSnapshot,
    renameSnapshot: renameJsonSnapshot,
  } = useSnapshots({
    storageKey: `code-test-json-${testDataId}`,
    maxSnapshots: 20,
    autoSaveCurrent: false,
  });

  // 运行时加载（TypeScript编译器 / Pyodide）
  const { tsLoaded, pyodideLoaded, pyodide } = useRuntimeLoader({
    language,
  });

  // 当testDataId变化时，恢复对应的代码和JSON数据（从上次编辑快照恢复）
  useEffect(() => {
    const codeSnapshotKey = `code-test-last-snapshot-${testDataId}`;
    const jsonSnapshotKey = `code-test-json-last-snapshot-${testDataId}`;

    const storedCode = localStorage.getItem(codeSnapshotKey);
    const storedJson = localStorage.getItem(jsonSnapshotKey);
    const newCode = storedCode || initialCode;
    const newJsonData = storedJson || '{}';

    setCode(newCode);
    setJsonData(newJsonData);
    setExecutionResult(null);
    console.log('[CodeTestEditor] 从上次编辑快照恢复数据:', {
      testDataId,
      hasStoredCode: !!storedCode,
      hasStoredJson: !!storedJson,
      codeLength: newCode.length,
      jsonLength: newJsonData.length
    });
  }, [testDataId, initialCode]);

  // 节流保存代码到localStorage（上次编辑快照）
  useEffect(() => {
    if (debouncedCode) {
      const snapshotKey = `code-test-last-snapshot-${testDataId}`;
      localStorage.setItem(snapshotKey, debouncedCode);
      console.log('[CodeTestEditor] 代码快照已保存 (节流)');
    }
  }, [debouncedCode, testDataId]);

  // 节流保存JSON数据到localStorage（上次编辑快照）
  useEffect(() => {
    if (debouncedJsonData) {
      const snapshotKey = `code-test-json-last-snapshot-${testDataId}`;
      localStorage.setItem(snapshotKey, debouncedJsonData);
      console.log('[CodeTestEditor] JSON快照已保存 (节流)');
    }
  }, [debouncedJsonData, testDataId]);

  // 当切换语言时，更新代码模板（仅在语言真正变化时触发）
  useEffect(() => {
    // 只在语言真正变化时才考虑替换模板
    if (previousLanguageRef.current === language) {
      return;
    }

    console.log('[CodeTestEditor] 语言已切换:', {
      from: previousLanguageRef.current,
      to: language
    });

    console.log('[CodeTestEditor] 代码检测结果:', {
      isDefaultCode: isDefaultCode(code)
    });

    if (isDefaultCode(code)) {
      const newCode = getDefaultCodeTemplate(language);

      if (newCode && newCode !== code) {
        console.log('[CodeTestEditor] 正在加载新的语言模板...');
        setCode(newCode);
        toast.success(`已切换到 ${language.toUpperCase()} 模式并加载示例代码`);
      }
    } else {
      console.log('[CodeTestEditor] 检测到用户自定义代码，保留当前代码');
    }

    // 更新上次的语言
    previousLanguageRef.current = language;
  }, [language, code]);

  // 重置为默认代码和JSON
  const handleReset = () => {
    const defaultCode = getDefaultCodeTemplate(language);
    setCode(defaultCode);
    setJsonData('{}');
    setExecutionResult(null);

    // 清除上次编辑快照
    const codeSnapshotKey = `code-test-last-snapshot-${testDataId}`;
    const jsonSnapshotKey = `code-test-json-last-snapshot-${testDataId}`;
    localStorage.removeItem(codeSnapshotKey);
    localStorage.removeItem(jsonSnapshotKey);

    console.log('[CodeTestEditor] 已重置并清除上次编辑快照');
  };

  // 执行代码
  const handleExecute = async () => {
    setExecutionResult(null);

    try {
      setExecuting(true);

      // 构造params对象：先合并默认参数和JSON编辑器数据，再与testData合并
      let jsonParams = {};
      try {
        const parsedJson = JSON.parse(jsonData);
        jsonParams = parsedJson;
      } catch (jsonErr) {
        console.warn('[CodeTestEditor] JSON解析失败，使用空对象:', jsonErr);
      }

      // 获取testData数据（如果存在）
      let testDataParams = {};
      // if (getJsonData) {
      //   try {
      //     const testData = getJsonData();
      //     if (testData && typeof testData === 'object') {
      //       testDataParams = testData;
      //     }
      //   } catch (testDataErr) {
      //     console.warn('[CodeTestEditor] 获取testData失败:', testDataErr);
      //   }
      // }

      // 合并顺序：默认参数 -> JSON编辑器数据 -> testData数据（testData优先级最高）
      const mergedParams = {
        input: 'test_input',
        message: 'hello world',
        number: 42,
        ...jsonParams,
        ...testDataParams,
      };

      console.log('[CodeTestEditor] 合并后的参数:', mergedParams);

      // Python 执行逻辑
      if (language === 'python') {
        if (!pyodideLoaded || !pyodide) {
          throw new Error('Python运行环境未加载完成，请稍后再试');
        }

        try {
          const result = await runPython(pyodide, code, mergedParams);
          setExecutionResult(result);
          toast.success('Python代码执行成功');
          setRightTabValue(1);
        } catch (pyError: any) {
          // runPython 已构造好格式化的错误信息，直接抛出
          throw pyError;
        }

        // 早期返回，不执行后续的 JS/TS 逻辑
        return;
      }

      // 统一的编译逻辑（JavaScript/TypeScript）
      let finalCode = code;

      // 如果使用TypeScript，先编译成JavaScript
      if (language === 'typescript') {
        if (!tsLoaded || (window as any).ts === undefined) {
          throw new Error('TypeScript编译器未加载完成，请稍后再试');
        }

        finalCode = compileTypeScript(code);
      }

      // 执行逻辑：使用编译后的代码
      if (onExecute) {
        // 如果提供了执行回调，使用编译后的代码
        const result = await onExecute(finalCode, mergedParams);
        setExecutionResult(result);
        toast.success('代码执行成功');
        setRightTabValue(1); // 自动切换到输出数据tab
      } else {
        // 默认执行逻辑：动态创建函数并执行
        try {
          const result = await runJavaScript(finalCode, mergedParams);

          setExecutionResult(result);
          toast.success(language === 'typescript' ? 'TypeScript代码执行成功' : 'JavaScript代码执行成功');
          setRightTabValue(1); // 自动切换到输出数据tab
        } catch (execError: any) {
          throw new Error(`代码执行失败: ${execError.message}`);
        }
      }

    } catch (err: any) {
      toast.danger(`执行错误: ${err.message}`);
      console.error(err)
    } finally {
      setExecuting(false);
    }
  };

  // 格式化代码
  const handleFormatCode = () => {
    if (codeEditorRef.current) {
      try {
        // 使用CodeMirror的格式化功能（如果有）
        // 目前CodeMirror没有内置的格式化功能，这里可以手动实现或跳过
        toast.success('代码已刷新');
      } catch (err: any) {
        toast.danger(`刷新失败: ${err.message}`);
      }
    }
  };

  // 加载示例代码
  const handleLoadExample = () => {
    const exampleCode = getDefaultCodeTemplate(language);
    const langName = language === 'javascript' ? 'JavaScript' : language === 'typescript' ? 'TypeScript' : 'Python';
    setCode(exampleCode);
    toast.success(`已加载${langName}示例代码`);
  };

  // 格式化JSON
  const handleFormatJson = () => {
    try {
      const parsedJson = JSON.parse(jsonData);
      const formattedJson = JSON.stringify(parsedJson, null, 2);
      setJsonData(formattedJson);
      toast.success('JSON格式化成功');
    } catch (err: any) {
      toast.danger(`JSON格式错误: ${err.message}`);
    }
  };

  // 创建代码快照
  const handleCreateCodeSnapshot = (name: string, description?: string) => {
    try {
      createCodeSnapshot(name, code, description);
      toast.success(`代码快照"${name}"已创建`);
    } catch (err: any) {
      toast.danger(`创建快照失败: ${err.message}`);
    }
  };

  // 恢复代码快照
  const handleRestoreCodeSnapshot = (snapshotId: string) => {
    try {
      const restoredCode = restoreCodeSnapshot(snapshotId);
      setCode(restoredCode);

      const snapshot = codeSnapshots.find(s => s.id === snapshotId);
      toast.success(`已恢复代码到快照: ${snapshot?.name}`);
    } catch (err: any) {
      toast.danger(`恢复快照失败: ${err.message}`);
    }
  };

  // 创建JSON快照
  const handleCreateJsonSnapshot = (name: string, description?: string) => {
    try {
      createJsonSnapshot(name, jsonData, description);
      toast.success(`JSON快照"${name}"已创建`);
    } catch (err: any) {
      toast.danger(`创建快照失败: ${err.message}`);
    }
  };

  // 恢复JSON快照
  const handleRestoreJsonSnapshot = (snapshotId: string) => {
    try {
      const restoredJson = restoreJsonSnapshot(snapshotId);
      setJsonData(restoredJson);

      const snapshot = jsonSnapshots.find(s => s.id === snapshotId);
      toast.success(`已恢复JSON到快照: ${snapshot?.name}`);
    } catch (err: any) {
      toast.danger(`恢复快照失败: ${err.message}`);
    }
  };

  // 发送测试数据
  const handleSendTest = () => {
    console.log('[CodeTestEditor] handleSendTest 开始执行');
    console.log('[CodeTestEditor] 当前状态:', {
      hasOnSendTest: !!onSendTest,
      hasExecutionResult: !!executionResult,
      hasJsonData: !!jsonData,
      executionResult,
      jsonData
    });

    if (!onSendTest) {
      console.error('[CodeTestEditor] onSendTest 回调函数未定义');
      toast.danger('发送测试功能未实现');
      return;
    }

    try {
      // 获取执行结果作为发送数据
      const dataToSend = executionResult || {
        input: jsonData,
        result: null,
        message: '暂无执行结果'
      };

      console.log('[CodeTestEditor] 准备发送的数据:', {
        dataToSend,
        dataType: typeof dataToSend,
        dataKeys: Object.keys(dataToSend),
        isExecutionResult: !!executionResult
      });

      // 智能选择发送的数据
      let finalDataToSend = dataToSend;

      // 如果有执行结果，优先使用执行结果
      if (executionResult) {
        console.log('[CodeTestEditor] 使用执行结果作为发送数据');
        finalDataToSend = executionResult;
      } else {
        console.log('[CodeTestEditor] 使用备用数据作为发送数据');
      }

      // 如果数据包含 all_params，提取出来
      if (finalDataToSend.all_params) {
        console.log('[CodeTestEditor] 发现 all_params 字段，提取为测试数据');
        finalDataToSend = finalDataToSend.all_params;
      }

      console.log('[CodeTestEditor] 最终发送的数据:', {
        finalDataToSend,
        hasTracks: !!finalDataToSend.tracks,
        hasItems: !!finalDataToSend.items,
        tracks: finalDataToSend.tracks,
        items: finalDataToSend.items
      });

      console.log('[CodeTestEditor] 调用 onSendTest 回调函数...');
      onSendTest(finalDataToSend);
      console.log('[CodeTestEditor] onSendTest 回调函数调用完成');

      toast.success('测试数据已发送并应用到JSON数据Tab！请查看左侧编辑器中的数据。');
    } catch (err: any) {
      console.error('[CodeTestEditor] 发送过程中发生错误:', err);
      toast.danger(`发送失败: ${err.message}`);
    }
  };

  const currentLangLabel = language === 'typescript' ? 'TypeScript' : language === 'python' ? 'Python' : 'JavaScript';

  return (
    <div className="h-full flex flex-col">
      {/* 顶部工具栏 */}
      <Toolbar
        language={language}
        onLanguageChange={setLanguage}
        tsLoaded={tsLoaded}
        pyodideLoaded={pyodideLoaded}
        onReset={handleReset}
      />

      {/* 左右分栏编辑器 */}
      <div className="flex-1 flex overflow-hidden gap-2">
        {/* 左侧：代码编辑器 */}
        <CodeEditorPanel
          language={language}
          currentLangLabel={currentLangLabel}
          code={code}
          onCodeChange={setCode}
          codeSnapshots={codeSnapshots}
          onCreateSnapshot={handleCreateCodeSnapshot}
          onRestoreSnapshot={handleRestoreCodeSnapshot}
          onDeleteSnapshot={deleteCodeSnapshot}
          onRenameSnapshot={renameCodeSnapshot}
          onLoadExample={handleLoadExample}
          onFormatCode={handleFormatCode}
          onEditorMount={(view) => {
            codeEditorRef.current = view;
            console.log('[CodeTestEditor] 代码编辑器已挂载');
          }}
        />

        {/* 右侧：数据面板 */}
        <DataPanel
          rightTabValue={rightTabValue}
          onTabChange={setRightTabValue}
          jsonData={jsonData}
          onJsonDataChange={setJsonData}
          jsonSnapshots={jsonSnapshots}
          onCreateSnapshot={handleCreateJsonSnapshot}
          onRestoreSnapshot={handleRestoreJsonSnapshot}
          onDeleteSnapshot={deleteJsonSnapshot}
          onRenameSnapshot={renameJsonSnapshot}
          onFormatJson={handleFormatJson}
          executionResult={executionResult}
          onEditorMount={(view) => {
            jsonEditorRef.current = view;
            console.log('[CodeTestEditor] JSON编辑器已挂载');
          }}
        />
      </div>


      {/* 底部执行按钮 */}
      <BottomActions
        executing={executing}
        onExecute={handleExecute}
        canSend={!!executionResult || !!jsonData}
        onSendTest={handleSendTest}
      />
    </div>
  );
}
