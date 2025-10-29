'use client';

import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardMedia,
  Chip,
  IconButton,
  Grid2 as Grid,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  Badge,
  Tooltip,
} from '@mui/material';
import {
  OpenInNew as OpenIcon,
  Download as DownloadIcon,
  Visibility as ViewIcon,
  ContentCopy as CopyIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { WorkflowMonitorData, CozePluginData } from '@/types/coze';

interface DataDisplayGridProps {
  data: WorkflowMonitorData[];
  monitoredWorkflows: Array<{
    workflowId: string;
    workflowName: string;
    clientId: string;
    isActive: boolean;
    startedAt: string;
    dataCount: number;
  }>;
  onWorkflowSelect?: (workflowId: string) => void;
}

interface DataCardProps {
  item: WorkflowMonitorData;
  onView?: (data: CozePluginData) => void;
  onMarkRead?: (id: string) => void;
}

interface DataDetailDialogProps {
  open: boolean;
  data: CozePluginData | null;
  onClose: () => void;
}

const DataCard: React.FC<DataCardProps> = ({ item, onView, onMarkRead }) => {
  const [imageError, setImageError] = useState(false);

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'audio':
        return 'secondary';
      case 'image':
        return 'primary';
      case 'video':
        return 'warning';
      case 'text':
        return 'info';
      default:
        return 'default';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'audio':
        return '🎵';
      case 'image':
        return '🖼️';
      case 'video':
        return '🎬';
      case 'text':
        return '📝';
      default:
        return '📄';
    }
  };

  const handleView = () => {
    if (onView) {
      onView(item.data);
    }
    if (onMarkRead) {
      onMarkRead(item.id);
    }
  };

  const formatFileSize = (url: string) => {
    // 简单的文件大小模拟显示
    return Math.floor(Math.random() * 1000) + 1 + ' KB';
  };

  const renderContent = () => {
    const { type, data } = item.data;
    const url = data.url;

    switch (type) {
      case 'image':
        if (url && !imageError) {
          return (
            <CardMedia
              component="img"
              height="160"
              image={url}
              alt={data.title}
              onError={() => setImageError(true)}
              sx={{ objectFit: 'cover' }}
            />
          );
        }
        return (
          <Box sx={{
            height: 160,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'grey.100',
            color: 'text.secondary',
          }}>
            <Typography variant="h4">🖼️</Typography>
          </Box>
        );

      case 'video':
        return (
          <Box sx={{
            height: 160,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'grey.900',
            color: 'white',
            position: 'relative',
          }}>
            <Typography variant="h4">🎬</Typography>
            {url && (
              <Box sx={{ position: 'absolute', bottom: 8, left: 8, right: 8 }}>
                <Typography variant="caption" sx={{ opacity: 0.8 }}>
                  {formatFileSize(url)}
                </Typography>
              </Box>
            )}
          </Box>
        );

      case 'audio':
        return (
          <Box sx={{
            height: 160,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'grey.100',
            color: 'text.secondary',
            gap: 1,
          }}>
            <Typography variant="h4">🎵</Typography>
            {url && (
              <Typography variant="caption" sx={{ textAlign: 'center', px: 1 }}>
                音频文件
              </Typography>
            )}
          </Box>
        );

      case 'text':
        return (
          <Box sx={{
            height: 160,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'grey.50',
            color: 'text.secondary',
            p: 2,
            overflow: 'hidden',
          }}>
            <Typography variant="h4">📝</Typography>
            <Typography
              variant="body2"
              sx={{
                textAlign: 'center',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 3,
                WebkitBoxOrient: 'vertical',
              }}
            >
              {data.title || data.description || '文本内容'}
            </Typography>
          </Box>
        );

      default:
        return (
          <Box sx={{
            height: 160,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'grey.100',
            color: 'text.secondary',
          }}>
            <Typography variant="h4">📄</Typography>
          </Box>
        );
    }
  };

  return (
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        cursor: 'pointer',
        transition: 'all 0.2s',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: 4,
        },
        border: item.isRead ? '1px solid transparent' : '2px solid',
        borderColor: item.isRead ? 'transparent' : 'primary.main',
      }}
      onClick={handleView}
    >
      {renderContent()}

      <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
            {getTypeIcon(item.data.type)} {item.data.type}
          </Typography>
          {!item.isRead && (
            <Badge variant="dot" color="primary" />
          )}
        </Box>

        <Typography
          variant="body2"
          sx={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            mb: 1,
            flexGrow: 1,
          }}
        >
          {item.data.data.title || '无标题'}
        </Typography>

        {item.data.data.description && (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              mb: 1,
            }}
          >
            {item.data.data.description}
          </Typography>
        )}

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="caption" color="text.secondary">
            {new Date(item.receivedAt).toLocaleTimeString()}
          </Typography>

          <Box sx={{ display: 'flex', gap: 0.5 }}>
            {item.data.data.url && (
              <Tooltip title="在新窗口打开">
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(item.data.data.url, '_blank');
                  }}
                >
                  <OpenIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}

            <Tooltip title="查看详情">
              <IconButton size="small">
                <ViewIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

const DataDetailDialog: React.FC<DataDetailDialogProps> = ({
  open,
  data,
  onClose,
}) => {
  const [copySuccess, setCopySuccess] = useState(false);

  if (!data) return null;

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (error) {
      console.error('复制失败:', error);
    }
  };

  const renderJsonData = () => {
    return (
      <Box sx={{ position: 'relative' }}>
        <TextField
          fullWidth
          multiline
          rows={10}
          value={JSON.stringify(data.data, null, 2)}
          InputProps={{
            readOnly: true,
            sx: { fontFamily: 'monospace', fontSize: '0.875rem' }
          }}
        />
        <IconButton
          sx={{ position: 'absolute', top: 8, right: 8 }}
          onClick={() => handleCopy(JSON.stringify(data.data, null, 2))}
        >
          <CopyIcon />
        </IconButton>
        {copySuccess && (
          <Alert severity="success" sx={{ mt: 1 }}>
            已复制到剪贴板
          </Alert>
        )}
      </Box>
    );
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">
            数据详情 - {data.type}
          </Typography>
          <IconButton onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Grid container spacing={2}>
          <Grid size={12}>
            <Typography variant="subtitle2" gutterBottom>
              基本信息
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Typography variant="body2" sx={{ minWidth: 80 }}>
                  类型:
                </Typography>
                <Chip label={data.type} size="small" />
              </Box>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Typography variant="body2" sx={{ minWidth: 80 }}>
                  客户端ID:
                </Typography>
                <Typography variant="body2">
                  {data.clientId}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Typography variant="body2" sx={{ minWidth: 80 }}>
                  时间戳:
                </Typography>
                <Typography variant="body2">
                  {data.timestamp}
                </Typography>
              </Box>
              {data.data.url && (
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                  <Typography variant="body2" sx={{ minWidth: 80 }}>
                    URL:
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{ wordBreak: 'break-all', flex: 1 }}
                  >
                    {data.data.url}
                  </Typography>
                  <Button
                    size="small"
                    onClick={() => handleCopy(data.data.url!)}
                    startIcon={<CopyIcon />}
                  >
                    复制
                  </Button>
                </Box>
              )}
            </Box>
          </Grid>

          <Grid size={12}>
            <Typography variant="subtitle2" gutterBottom>
              完整数据
            </Typography>
            {renderJsonData()}
          </Grid>
        </Grid>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>关闭</Button>
        {data.data.url && (
          <Button
            variant="contained"
            onClick={() => window.open(data.data.url, '_blank')}
            startIcon={<OpenIcon />}
          >
            打开链接
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

const DataDisplayGrid: React.FC<DataDisplayGridProps> = ({
  data,
  monitoredWorkflows,
  onWorkflowSelect,
}) => {
  const [selectedData, setSelectedData] = useState<CozePluginData | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);

  const handleViewData = (pluginData: CozePluginData) => {
    setSelectedData(pluginData);
    setDetailDialogOpen(true);
  };

  const handleMarkRead = (dataId: string) => {
    // 这里可以调用父组件提供的标记已读函数
    console.log('标记为已读:', dataId);
  };

  const handleCloseDetail = () => {
    setDetailDialogOpen(false);
    setSelectedData(null);
  };

  if (data.length === 0) {
    return (
      <Box
        sx={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: 2,
        }}
      >
        <Typography variant="h6" color="text.secondary">
          暂无数据
        </Typography>
        <Typography variant="body2" color="text.secondary">
          启动工作流监控后，接收到的数据将在这里显示
        </Typography>

        {monitoredWorkflows.length > 0 && (
          <Alert severity="info" sx={{ maxWidth: 400 }}>
            <Typography variant="body2">
              当前正在监控 {monitoredWorkflows.length} 个工作流，但还没有接收到数据。
            </Typography>
            <Typography variant="body2">
              请确保Coze插件正在向对应的客户端ID发送数据。
            </Typography>
          </Alert>
        )}
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 数据筛选和统计 */}
      <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">
            数据列表 ({data.length} 条)
          </Typography>

          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              监控中: {monitoredWorkflows.filter(w => w.isActive).length} 个工作流
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* 数据网格 */}
      <Box sx={{ flex: 1, p: 2, overflow: 'auto' }}>
        <Grid container spacing={2}>
          {data.map((item) => (
            <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={item.id}>
              <DataCard
                item={item}
                onView={handleViewData}
                onMarkRead={handleMarkRead}
              />
            </Grid>
          ))}
        </Grid>
      </Box>

      {/* 数据详情对话框 */}
      <DataDetailDialog
        open={detailDialogOpen}
        data={selectedData}
        onClose={handleCloseDetail}
      />
    </Box>
  );
};

export default DataDisplayGrid;