'use client';

import React, { useState } from 'react';
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
  Tabs,
  Tab,
  Paper
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import type { TestData } from '@/types/rule';
import { EXAMPLE_TEST_DATA } from '@/config/defaultRules';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`test-data-tabpanel-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 2 }}>{children}</Box>}
    </div>
  );
}

interface TestDataDialogProps {
  /** 对话框是否打开 */
  open: boolean;
  /** 关闭对话框回调 */
  onClose: () => void;
  /** 测试回调 */
  onTest: (testData: TestData) => void;
}

/**
 * 测试数据对话框组件
 */
export const TestDataDialog: React.FC<TestDataDialogProps> = ({ open, onClose, onTest }) => {
  const [activeTab, setActiveTab] = useState(0);
  const [testDataJson, setTestDataJson] = useState(JSON.stringify(EXAMPLE_TEST_DATA, null, 2));
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // 处理测试
  const handleTest = () => {
    setError('');
    setSuccess('');

    try {
      const testData: TestData = JSON.parse(testDataJson);

      // 基本验证
      if (!testData.tracks || !Array.isArray(testData.tracks)) {
        throw new Error('测试数据必须包含 tracks 数组');
      }

      if (!testData.items || !Array.isArray(testData.items)) {
        throw new Error('测试数据必须包含 items 数组');
      }

      // 验证轨道
      testData.tracks.forEach((track, index) => {
        if (!track.id || !track.type) {
          throw new Error(`轨道 ${index} 缺少必要字段 (id 或 type)`);
        }
      });

      // 验证素材项
      testData.items.forEach((item, index) => {
        if (!item.type) {
          throw new Error(`素材项 ${index} 缺少 type 字段`);
        }
        if (!item.meta || !item.meta.timeline) {
          throw new Error(`素材项 ${index} 缺少 meta.timeline 字段`);
        }
        if (!item.data) {
          throw new Error(`素材项 ${index} 缺少 data 字段`);
        }
      });

      setSuccess('测试数据验证通过!');
      onTest(testData);

      // 延迟关闭对话框,让用户看到成功消息
      setTimeout(() => {
        onClose();
        setSuccess('');
      }, 1000);
    } catch (err: any) {
      setError(err.message || '无效的JSON格式');
    }
  };

  // 重置为示例数据
  const handleReset = () => {
    setTestDataJson(JSON.stringify(EXAMPLE_TEST_DATA, null, 2));
    setError('');
    setSuccess('');
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6">测试规则数据</Typography>
          <Button size="small" onClick={handleReset} variant="outlined">
            重置为示例数据
          </Button>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)} sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tab label="JSON 编辑器" />
          <Tab label="数据说明" />
        </Tabs>

        <TabPanel value={activeTab} index={0}>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
              {error}
            </Alert>
          )}

          {success && (
            <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>
              {success}
            </Alert>
          )}

          <TextField
            fullWidth
            multiline
            rows={16}
            value={testDataJson}
            onChange={(e) => setTestDataJson(e.target.value)}
            placeholder="请输入测试数据的JSON格式"
            variant="outlined"
            sx={{
              '& .MuiInputBase-input': {
                fontFamily: 'monospace',
                fontSize: '13px'
              }
            }}
          />
        </TabPanel>

        <TabPanel value={activeTab} index={1}>
          <Paper elevation={0} sx={{ p: 2, bgcolor: 'grey.50' }}>
            <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
              数据结构说明:
            </Typography>

            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" sx={{ fontWeight: 500, mt: 1 }}>
                1. tracks (轨道列表)
              </Typography>
              <Typography variant="caption" component="div" sx={{ pl: 2, color: 'text.secondary' }}>
                - id: 轨道唯一标识<br />
                - type: 轨道类型 (video/audio/text/effect/filter/sticker)
              </Typography>
            </Box>

            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                2. items (素材项列表)
              </Typography>
              <Typography variant="caption" component="div" sx={{ pl: 2, color: 'text.secondary' }}>
                - type: 规则类型,必须与规则组中的某个规则匹配<br />
                - meta: 元数据<br />
                &nbsp;&nbsp;- timeline: 时间轴信息<br />
                &nbsp;&nbsp;&nbsp;&nbsp;- track: 所属轨道ID<br />
                &nbsp;&nbsp;&nbsp;&nbsp;- start: 开始时间(秒)<br />
                &nbsp;&nbsp;&nbsp;&nbsp;- duration: 持续时长(秒)<br />
                &nbsp;&nbsp;- position: 位置信息(可选)<br />
                - data: 具体数据,字段由规则的 inputs 定义
              </Typography>
            </Box>

            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                3. 示例规则类型:
              </Typography>
              <Typography variant="caption" component="div" sx={{ pl: 2, color: 'text.secondary' }}>
                - top-left-title: 视频左上角标题<br />
                - top-right-logo: 视频右上角水印<br />
                - subtitle: 字幕<br />
                - image: 轨道图片<br />
                - clip_type1: 视频片段类型1
              </Typography>
            </Box>

            <Alert severity="info" sx={{ mt: 2 }}>
              <Typography variant="caption">
                提示: 点击"重置为示例数据"可以查看完整的示例结构
              </Typography>
            </Alert>
          </Paper>
        </TabPanel>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>取消</Button>
        <Button onClick={handleTest} variant="contained" startIcon={<PlayArrowIcon />}>
          运行测试
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default TestDataDialog;
