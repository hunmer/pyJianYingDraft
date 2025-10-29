'use client';

import React, { useState, useCallback, useRef } from 'react';
import {
  Box,
  Button,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Tooltip,
  Chip,
  LinearProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  Download as DownloadIcon,
  Delete as DeleteIcon,
  Visibility as PreviewIcon,
  Refresh as RefreshIcon,
  InsertDriveFile as FileIcon,
} from '@mui/icons-material';
import { CozeFile } from '@/types/coze';

interface FilesPanelProps {
  files: CozeFile[];
  uploading: boolean;
  onFileUpload: (files: FileList) => void;
  onFileDelete: (fileId: string) => void;
  onFileDownload: (file: CozeFile) => void;
}

const FilesPanel: React.FC<FilesPanelProps> = ({
  files,
  uploading,
  onFileUpload,
  onFileDelete,
  onFileDownload,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewFile, setPreviewFile] = useState<CozeFile | null>(null);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);

  // 处理文件选择
  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = event.target.files;
    if (selectedFiles && selectedFiles.length > 0) {
      onFileUpload(selectedFiles);
    }
    // 清空输入框，允许重复选择同一文件
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [onFileUpload]);

  // 处理拖拽上传
  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
  }, []);

  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();

    const droppedFiles = event.dataTransfer.files;
    if (droppedFiles && droppedFiles.length > 0) {
      onFileUpload(droppedFiles);
    }
  }, [onFileUpload]);

  // 触发文件选择
  const triggerFileSelect = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // 文件预览
  const handlePreview = useCallback((file: CozeFile) => {
    setPreviewFile(file);
    setPreviewDialogOpen(true);
  }, []);

  const closePreviewDialog = useCallback(() => {
    setPreviewDialogOpen(false);
    setPreviewFile(null);
  }, []);

  // 文件大小格式化
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // 获取文件类型颜色
  const getFileTypeColor = (type: string) => {
    if (type.startsWith('image/')) return 'success';
    if (type.startsWith('video/')) return 'warning';
    if (type.startsWith('audio/')) return 'info';
    if (type.includes('pdf')) return 'error';
    if (type.includes('json') || type.includes('text')) return 'primary';
    return 'default';
  };

  // 获取文件类型显示文本
  const getFileTypeText = (type: string) => {
    if (type.startsWith('image/')) return '图片';
    if (type.startsWith('video/')) return '视频';
    if (type.startsWith('audio/')) return '音频';
    if (type.includes('pdf')) return 'PDF';
    if (type.includes('json')) return 'JSON';
    if (type.includes('text')) return '文本';
    if (type.includes('excel') || type.includes('spreadsheet')) return '表格';
    return type || '未知';
  };

  // 检查文件是否可预览
  const isPreviewable = (file: CozeFile) => {
    return file.type.startsWith('image/') ||
           file.type.includes('text') ||
           file.type.includes('json') ||
           file.type.includes('pdf');
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', p: 2 }}>
      {/* 头部信息 */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h6" component="h2">
          文件管理
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body2" color="text.secondary">
            共 {files.length} 个文件
          </Typography>
        </Box>
      </Box>

      {/* 上传区域 */}
      <Box
        sx={{
          mb: 2,
          p: 3,
          border: 2,
          borderColor: 'divider',
          borderRadius: 2,
          borderStyle: 'dashed',
          textAlign: 'center',
          cursor: 'pointer',
          backgroundColor: 'grey.50',
          transition: 'all 0.2s ease-in-out',
          '&:hover': {
            borderColor: 'primary.main',
            backgroundColor: 'primary.50',
          },
        }}
        onClick={triggerFileSelect}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />

        <UploadIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
        <Typography variant="h6" gutterBottom>
          点击或拖拽文件到此处上传
        </Typography>
        <Typography variant="body2" color="text.secondary">
          支持多文件上传，单个文件最大 100MB
        </Typography>

        <Button variant="outlined" sx={{ mt: 2 }}>
          选择文件
        </Button>
      </Box>

      {/* 上传进度 */}
      {uploading && (
        <Box sx={{ mb: 2 }}>
          <Alert severity="info">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <LinearProgress sx={{ flex: 1 }} />
              <Typography variant="body2">文件上传中...</Typography>
            </Box>
          </Alert>
        </Box>
      )}

      {/* 文件列表 */}
      <Box sx={{ flex: 1, overflow: 'hidden' }}>
        <TableContainer component={Paper} sx={{ height: '100%' }}>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell width="40">类型</TableCell>
                <TableCell>文件名</TableCell>
                <TableCell width="100">大小</TableCell>
                <TableCell width="120">文件类型</TableCell>
                <TableCell width="150">上传时间</TableCell>
                <TableCell width="120">操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {files.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ height: 200 }}>
                    <Box sx={{ textAlign: 'center' }}>
                      <FileIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                      <Typography variant="h6" color="text.secondary" gutterBottom>
                        暂无文件
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        点击上方区域或拖拽文件开始上传
                      </Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              ) : (
                files.map((file) => (
                  <TableRow
                    key={file.id}
                    hover
                    sx={{
                      '&:hover': {
                        backgroundColor: 'action.hover',
                      },
                    }}
                  >
                    {/* 文件类型图标 */}
                    <TableCell>
                      <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                        {file.type.startsWith('image/') ? (
                          <img
                            src={file.url}
                            alt={file.name}
                            style={{
                              width: 32,
                              height: 32,
                              objectFit: 'cover',
                              borderRadius: 4,
                            }}
                          />
                        ) : (
                          <FileIcon color="action" />
                        )}
                      </Box>
                    </TableCell>

                    {/* 文件名 */}
                    <TableCell>
                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: 'medium',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          maxWidth: 200,
                        }}
                        title={file.name}
                      >
                        {file.name}
                      </Typography>
                    </TableCell>

                    {/* 文件大小 */}
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {formatFileSize(file.size)}
                      </Typography>
                    </TableCell>

                    {/* 文件类型 */}
                    <TableCell>
                      <Chip
                        label={getFileTypeText(file.type)}
                        size="small"
                        color={getFileTypeColor(file.type) as any}
                        variant="outlined"
                      />
                    </TableCell>

                    {/* 上传时间 */}
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {new Date(file.upload_time).toLocaleString()}
                      </Typography>
                    </TableCell>

                    {/* 操作按钮 */}
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        {/* 预览按钮 */}
                        {isPreviewable(file) && (
                          <Tooltip title="预览">
                            <IconButton
                              size="small"
                              onClick={() => handlePreview(file)}
                            >
                              <PreviewIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}

                        {/* 下载按钮 */}
                        <Tooltip title="下载">
                          <IconButton
                            size="small"
                            onClick={() => onFileDownload(file)}
                            disabled={!file.url}
                          >
                            <DownloadIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>

                        {/* 删除按钮 */}
                        <Tooltip title="删除">
                          <IconButton
                            size="small"
                            onClick={() => onFileDelete(file.id)}
                            color="error"
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>

      {/* 文件预览对话框 */}
      <Dialog
        open={previewDialogOpen}
        onClose={closePreviewDialog}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: { height: '80vh' }
        }}
      >
        <DialogTitle>
          文件预览: {previewFile?.name}
        </DialogTitle>
        <DialogContent sx={{ p: 0 }}>
          {previewFile && (
            <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              {/* 图片预览 */}
              {previewFile.type.startsWith('image/') && previewFile.url && (
                <Box
                  sx={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    p: 2,
                    backgroundColor: 'black',
                  }}
                >
                  <img
                    src={previewFile.url}
                    alt={previewFile.name}
                    style={{
                      maxWidth: '100%',
                      maxHeight: '100%',
                      objectFit: 'contain',
                    }}
                  />
                </Box>
              )}

              {/* 其他文件类型预览 */}
              {!previewFile.type.startsWith('image/') && (
                <Box
                  sx={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    p: 2,
                  }}
                >
                  <Box sx={{ textAlign: 'center' }}>
                    <FileIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                    <Typography variant="h6" color="text.secondary" gutterBottom>
                      此文件类型不支持预览
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      文件名: {previewFile.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      大小: {formatFileSize(previewFile.size)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      类型: {previewFile.type}
                    </Typography>
                  </Box>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closePreviewDialog}>关闭</Button>
          {previewFile?.url && (
            <Button
              variant="contained"
              onClick={() => onFileDownload(previewFile)}
              startIcon={<DownloadIcon />}
            >
              下载
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default FilesPanel;