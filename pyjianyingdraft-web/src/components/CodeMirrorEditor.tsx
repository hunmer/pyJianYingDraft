'use client';

import React, { useEffect, useRef } from 'react';
import { EditorView, keymap, lineNumbers, highlightActiveLineGutter, highlightSpecialChars, drawSelection, dropCursor, rectangularSelection, crosshairCursor, highlightActiveLine } from '@codemirror/view';
import { EditorState, Extension } from '@codemirror/state';
import { defaultKeymap, history, historyKeymap, indentMore, indentLess } from '@codemirror/commands';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { autocompletion, completionKeymap, closeBrackets, closeBracketsKeymap, acceptCompletion } from '@codemirror/autocomplete';
import { foldGutter, indentOnInput, syntaxHighlighting, defaultHighlightStyle, bracketMatching, foldKeymap } from '@codemirror/language';
import { lintKeymap } from '@codemirror/lint';
import { json } from '@codemirror/lang-json';
import { javascript } from '@codemirror/lang-javascript';
import { typescript } from '@codemirror/lang-typescript';
import { python } from '@codemirror/lang-python';
import { oneDark } from '@codemirror/theme-one-dark';
import { Box } from '@mui/material';

/**
 * 自定义 Tab 键绑定
 * 确保 Tab 键只用于缩进，不会导致焦点切换
 */
const customTabKeymap = [
  {
    key: 'Tab',
    run: (view: EditorView) => {
      // 如果有自动补全菜单显示，则接受补全
      if (acceptCompletion(view)) {
        return true;
      }
      // 否则执行缩进
      return indentMore(view);
    },
    preventDefault: true, // 阻止默认行为（焦点切换）
  },
  {
    key: 'Shift-Tab',
    run: indentLess,
    preventDefault: true, // 阻止默认行为
  },
];

/**
 * 基础设置扩展 (替代 basicSetup)
 */
const basicSetup: Extension = [
  lineNumbers(),
  highlightActiveLineGutter(),
  highlightSpecialChars(),
  history(),
  foldGutter(),
  drawSelection(),
  dropCursor(),
  EditorState.allowMultipleSelections.of(true),
  indentOnInput(),
  syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
  bracketMatching(),
  closeBrackets(),
  autocompletion(),
  rectangularSelection(),
  crosshairCursor(),
  highlightActiveLine(),
  highlightSelectionMatches(),
  keymap.of([
    ...customTabKeymap,      // Tab 键优先级最高，放在最前面
    ...closeBracketsKeymap,
    ...defaultKeymap,
    ...searchKeymap,
    ...historyKeymap,
    ...foldKeymap,
    ...completionKeymap,
    ...lintKeymap,
  ]),
];

/**
 * CodeMirror 编辑器属性接口
 */
export interface CodeMirrorEditorProps {
  /** 编辑器内容 */
  value?: string;
  /** 内容变化回调 */
  onChange?: (value: string) => void;
  /** 编辑器高度 */
  height?: string | number;
  /** 编辑器语言 */
  language?: 'json' | 'javascript' | 'typescript' | 'python';
  /** 主题 (light 或 dark) */
  theme?: 'light' | 'dark';
  /** 只读模式 */
  readOnly?: boolean;
  /** 编辑器加载时的回调 */
  onMount?: (view: EditorView) => void;
  /** 编辑器选项 */
  options?: {
    lineNumbers?: boolean;
    lineWrapping?: boolean;
    tabSize?: number;
  };
}

/**
 * CodeMirror 6 编辑器包装组件
 * 替代 Monaco Editor
 */
export default function CodeMirrorEditor({
  value = '',
  onChange,
  height = '100%',
  language = 'json',
  theme = 'light',
  readOnly = false,
  onMount,
  options = {},
}: CodeMirrorEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  useEffect(() => {
    if (!editorRef.current) return;

    // 根据语言类型添加对应的语法高亮
    let languageExtension;
    switch (language) {
      case 'javascript':
        languageExtension = javascript({ typescript: false });
        break;
      case 'typescript':
        languageExtension = javascript({ typescript: true });
        break;
      case 'python':
        languageExtension = python();
        break;
      case 'json':
      default:
        languageExtension = json();
        break;
    }

    // 创建编辑器状态
    const extensions = [
      basicSetup,
      languageExtension, // 语言语法高亮
      EditorView.lineWrapping, // 自动换行
      EditorView.updateListener.of((update) => {
        if (update.docChanged && onChange) {
          const newValue = update.state.doc.toString();
          onChange(newValue);
        }
      }),
    ];

    // 添加主题
    if (theme === 'dark') {
      extensions.push(oneDark);
    }

    // 只读模式
    if (readOnly) {
      extensions.push(EditorState.readOnly.of(true));
    }

    // 创建编辑器视图
    const startState = EditorState.create({
      doc: value,
      extensions,
    });

    const view = new EditorView({
      state: startState,
      parent: editorRef.current,
    });

    viewRef.current = view;

    // 调用 onMount 回调
    if (onMount) {
      onMount(view);
    }

    // 清理函数
    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, []); // 只在组件挂载时创建一次

  // 当 value 从外部更新时，同步到编辑器
  useEffect(() => {
    if (!viewRef.current) return;

    const currentValue = viewRef.current.state.doc.toString();
    if (currentValue !== value) {
      viewRef.current.dispatch({
        changes: {
          from: 0,
          to: currentValue.length,
          insert: value,
        },
      });
    }
  }, [value]);

  // 当主题、只读状态或 onChange 变化时，需要重新创建编辑器
  // 注意：由于 CodeMirror 的限制，我们不在这里动态更新这些属性
  // 如果需要动态更新，应该使用 compartments 或重新创建编辑器

  return (
    <Box
      ref={editorRef}
      sx={{
        height,
        width: '100%',
        overflow: 'hidden',
        '& .cm-editor': {
          height: '100%',
          fontSize: '14px',
        },
        '& .cm-scroller': {
          overflow: 'auto',
          fontFamily: 'Consolas, Monaco, "Courier New", monospace',
        },
        '& .cm-content': {
          fontFamily: 'Consolas, Monaco, "Courier New", monospace',
          fontSize: '14px',
          lineHeight: '1.6',
        },
        '& .cm-gutters': {
          fontSize: '14px',
        },
      }}
    />
  );
}
