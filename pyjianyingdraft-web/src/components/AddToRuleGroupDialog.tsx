'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  Alert,
  IconButton,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Paper
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import type { Rule, RuleInput, RuleGroup } from '@/types/rule';
import type { MaterialInfo } from '@/types/draft';

interface AddToRuleGroupDialogProps {
  /** 对话框是否打开 */
  open: boolean;
  /** 关闭对话框回调 */
  onClose: () => void;
  /** 当前选中的素材 */
  material: MaterialInfo | null;
  /** 当前规则组 */
  ruleGroup: RuleGroup | null;
  /** 添加成功回调 */
  onSuccess: (updatedRuleGroup: RuleGroup) => void;
}

/**
 * 添加到预设组对话框
 */
export const AddToRuleGroupDialog: React.FC<AddToRuleGroupDialogProps> = ({
  open,
  onClose,
  material,
  ruleGroup,
  onSuccess
}) => {
  // 表单状态
  const [ruleType, setRuleType] = useState('');
  const [ruleTitle, setRuleTitle] = useState('');
  const [inputs, setInputs] = useState<{ key: string; type: string; desc: string; value?: string }[]>([]);
  const [error, setError] = useState('');

  // 重置表单
  const resetForm = () => {
    setRuleType('');
    setRuleTitle('');
    setInputs([]);
    setError('');
  };

  // 当对话框打开/关闭时重置表单
  useEffect(() => {
    if (!open) {
      resetForm();
    }
  }, [open]);

  // 添加输入字段
  const handleAddInput = () => {
    setInputs([...inputs, { key: '', type: 'string', desc: '', value: '' }]);
  };

  // 删除输入字段
  const handleRemoveInput = (index: number) => {
    setInputs(inputs.filter((_, i) => i !== index));
  };

  // 更新输入字段
  const handleUpdateInput = (index: number, field: string, value: string) => {
    const newInputs = [...inputs];
    (newInputs[index] as any)[field] = value;
    setInputs(newInputs);
  };

  // 验证表单
  const validateForm = (): boolean => {
    setError('');

    if (!material) {
      setError('请先选择素材');
      return false;
    }

    if (!ruleGroup) {
      setError('请先选择规则组');
      return false;
    }

    if (!ruleType.trim()) {
      setError('请输入规则类型');
      return false;
    }

    if (!ruleTitle.trim()) {
      setError('请输入规则标题');
      return false;
    }

    // 检查规则类型是否重复
    if (ruleGroup.rules.some(r => r.type === ruleType.trim())) {
      setError('规则类型已存在于当前规则组');
      return false;
    }

    // 验证输入字段
    for (let i = 0; i < inputs.length; i++) {
      const input = inputs[i];
      if (!input.key.trim()) {
        setError(`输入字段 ${i + 1}: 字段名不能为空`);
        return false;
      }
      if (!input.desc.trim()) {
        setError(`输入字段 ${i + 1}: 字段描述不能为空`);
        return false;
      }
    }

    // 检查字段名是否重复
    const keys = inputs.map(i => i.key.trim());
    const uniqueKeys = new Set(keys);
    if (keys.length !== uniqueKeys.size) {
      setError('输入字段名不能重复');
      return false;
    }

    return true;
  };

  // 处理提交
  const handleSubmit = () => {
    if (!validateForm()) {
      return;
    }

    if (!material || !ruleGroup) {
      return;
    }

    // 构建输入字段对象
    const inputsObj: { [key: string]: RuleInput } = {};
    inputs.forEach(input => {
      const inputData: RuleInput = {
        type: input.type as any,
        desc: input.desc.trim()
      };
      if (input.value?.trim()) {
        inputData.value = input.value.trim();
      }
      inputsObj[input.key.trim()] = inputData;
    });

    // 创建新规则
    const newRule: Rule = {
      type: ruleType.trim(),
      title: ruleTitle.trim(),
      material_ids: [material.id],
      meta: {},
      inputs: inputsObj
    };

    // 更新规则组
    const updatedRuleGroup: RuleGroup = {
      ...ruleGroup,
      rules: [...ruleGroup.rules, newRule],
      updatedAt: new Date().toISOString()
    };

    // 保存到localStorage
    try {
      const saved = localStorage.getItem('ruleGroups');
      const allGroups: RuleGroup[] = saved ? JSON.parse(saved) : [];
      const updatedGroups = allGroups.map(g =>
        g.id === updatedRuleGroup.id ? updatedRuleGroup : g
      );
      localStorage.setItem('ruleGroups', JSON.stringify(updatedGroups));

      onSuccess(updatedRuleGroup);
      onClose();
    } catch (err: any) {
      setError('保存失败: ' + err.message);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>添加到预设组</DialogTitle>

      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          {error && (
            <Alert severity="error" onClose={() => setError('')}>
              {error}
            </Alert>
          )}

          {/* 规则组信息 */}
          {ruleGroup && (
            <Alert severity="info">
              将添加到规则组: <strong>{ruleGroup.title}</strong>
            </Alert>
          )}

          {/* 素材信息 */}
          {material && (
            <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
              <Typography variant="subtitle2" gutterBottom>
                当前素材
              </Typography>
              <Typography variant="body2">
                ID: {material.id}
              </Typography>
              <Typography variant="body2">
                类型: {material.type}
              </Typography>
              {material.name && (
                <Typography variant="body2">
                  名称: {material.name}
                </Typography>
              )}
            </Box>
          )}

          <Divider />

          {/* 规则类型 */}
          <TextField
            fullWidth
            label="规则类型"
            value={ruleType}
            onChange={(e) => setRuleType(e.target.value)}
            placeholder="例如: video-intro"
            helperText="唯一标识此规则的类型名称(英文,中划线分隔)"
            required
          />

          {/* 规则标题 */}
          <TextField
            fullWidth
            label="规则标题"
            value={ruleTitle}
            onChange={(e) => setRuleTitle(e.target.value)}
            placeholder="例如: 视频开场动画"
            helperText="规则的显示标题(中文)"
            required
          />

          <Divider />

          {/* 输入字段列表 */}
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="subtitle2">输入字段定义</Typography>
              <Button
                size="small"
                startIcon={<AddIcon />}
                onClick={handleAddInput}
                variant="outlined"
              >
                添加字段
              </Button>
            </Box>

            {inputs.length === 0 ? (
              <Alert severity="info">
                还没有添加输入字段。点击"添加字段"按钮来定义此规则需要的数据字段。
              </Alert>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {inputs.map((input, index) => (
                  <Paper
                    key={index}
                    elevation={0}
                    sx={{ p: 2, bgcolor: 'grey.50', border: 1, borderColor: 'divider' }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                        <TextField
                          size="small"
                          fullWidth
                          label="字段名"
                          value={input.key}
                          onChange={(e) => handleUpdateInput(index, 'key', e.target.value)}
                          placeholder="例如: title"
                          required
                        />

                        <FormControl size="small" fullWidth>
                          <InputLabel>字段类型</InputLabel>
                          <Select
                            value={input.type}
                            label="字段类型"
                            onChange={(e) => handleUpdateInput(index, 'type', e.target.value)}
                          >
                            <MenuItem value="string">string (文本)</MenuItem>
                            <MenuItem value="number">number (数字)</MenuItem>
                            <MenuItem value="boolean">boolean (布尔值)</MenuItem>
                            <MenuItem value="image">image (图片)</MenuItem>
                          </Select>
                        </FormControl>

                        <TextField
                          size="small"
                          fullWidth
                          label="字段描述"
                          value={input.desc}
                          onChange={(e) => handleUpdateInput(index, 'desc', e.target.value)}
                          placeholder="例如: 标题内容"
                          required
                        />

                        <TextField
                          size="small"
                          fullWidth
                          label="默认值(可选)"
                          value={input.value}
                          onChange={(e) => handleUpdateInput(index, 'value', e.target.value)}
                          placeholder="留空表示无默认值"
                        />
                      </Box>

                      <IconButton
                        size="small"
                        onClick={() => handleRemoveInput(index)}
                        color="error"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Box>
                  </Paper>
                ))}
              </Box>
            )}
          </Box>
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>取消</Button>
        <Button onClick={handleSubmit} variant="contained" disabled={!material || !ruleGroup}>
          添加规则
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AddToRuleGroupDialog;
