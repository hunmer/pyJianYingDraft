'use client';

import React from 'react';
import { Button, RadioGroup, Radio } from '@heroui/react';
import { Language } from '../types';

interface ToolbarProps {
  language: Language;
  onLanguageChange: (lang: Language) => void;
  tsLoaded: boolean;
  pyodideLoaded: boolean;
  onReset: () => void;
}

/**
 * 顶部工具栏：语言选择 + 重置按钮
 */
export default function Toolbar({
  language,
  onLanguageChange,
  tsLoaded,
  pyodideLoaded,
  onReset,
}: ToolbarProps) {
  return (
    <div className="p-4 border-b border-[var(--border)]">
      <div className="flex justify-between items-center">
        <div className="text-base font-semibold">代码测试</div>
        <div className="flex gap-4 items-center">
          <RadioGroup
            name="language"
            orientation="horizontal"
            value={language}
            onChange={(value) => onLanguageChange(value as Language)}
          >
            {(['javascript', 'typescript', 'python'] as const).map((lang) => {
              const label = lang === 'javascript' ? 'JavaScript' : lang === 'typescript' ? 'TypeScript' : 'Python';
              const isLoading =
                (lang === 'typescript' && !tsLoaded) ||
                (lang === 'python' && !pyodideLoaded);
              return (
                <Radio key={lang} value={lang} className="text-sm">
                  <Radio.Content>
                    <Radio.Control>
                      <Radio.Indicator />
                    </Radio.Control>
                    {label}
                    {lang === language && isLoading && (
                      <span className="text-xs text-amber-600">(加载中...)</span>
                    )}
                  </Radio.Content>
                </Radio>
              );
            })}
          </RadioGroup>
          <Button size="sm" variant="outline" onPress={onReset}>
            重置全部
          </Button>
        </div>
      </div>
    </div>
  );
}
