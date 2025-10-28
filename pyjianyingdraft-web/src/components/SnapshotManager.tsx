'use client';

import React, { useState } from 'react';
import {
  Box,
  Button,
  IconButton,
  Tooltip,
  Menu,
  MenuItem,
  ListItemText,
  ListItemIcon,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Typography,
  Chip,
  Divider,
  Alert,
} from '@mui/material';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import RestoreIcon from '@mui/icons-material/Restore';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import HistoryIcon from '@mui/icons-material/History';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import type { Snapshot } from '@/hooks/useSnapshots';

interface SnapshotManagerProps {
  snapshots: Snapshot[];
  onCreateSnapshot: (name: string, description?: string) => void;
  onRestoreSnapshot: (snapshotId: string) => void;
  onDeleteSnapshot: (snapshotId: string) => void;
  onRenameSnapshot?: (snapshotId: string, newName: string) => void;
  disabled?: boolean;
}

export default function SnapshotManager({
  snapshots,
  onCreateSnapshot,
  onRestoreSnapshot,
  onDeleteSnapshot,
  onRenameSnapshot,
  disabled = false,
}: SnapshotManagerProps) {
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [snapshotName, setSnapshotName] = useState('');
  const [snapshotDescription, setSnapshotDescription] = useState('');
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string | null>(null);

  const menuOpen = Boolean(menuAnchor);

  // 打开创建快照对话框
  const handleOpenCreateDialog = () => {
    setMenuAnchor(null);
    setSnapshotName(`快照 ${new Date().toLocaleString('zh-CN')}`);
    setSnapshotDescription('');
    setCreateDialogOpen(true);
  };

  // 创建快照
  const handleCreateSnapshot = () => {
    if (!snapshotName.trim()) {
      return;
    }
    onCreateSnapshot(snapshotName.trim(), snapshotDescription.trim() || undefined);
    setCreateDialogOpen(false);
    setSnapshotName('');
    setSnapshotDescription('');
  };

  // 打开重命名对话框
  const handleOpenRenameDialog = (snapshot: Snapshot) => {
    setMenuAnchor(null);
    setSelectedSnapshotId(snapshot.id);
    setSnapshotName(snapshot.name);
    setRenameDialogOpen(true);
  };

  // 重命名快照
  const handleRenameSnapshot = () => {
    if (!snapshotName.trim() || !selectedSnapshotId || !onRenameSnapshot) {
      return;
    }
    onRenameSnapshot(selectedSnapshotId, snapshotName.trim());
    setRenameDialogOpen(false);
    setSnapshotName('');
    setSelectedSnapshotId(null);
  };

  // 恢复快照
  const handleRestoreSnapshot = (snapshotId: string) => {
    setMenuAnchor(null);
    onRestoreSnapshot(snapshotId);
  };

  // 删除快照
  const handleDeleteSnapshot = (snapshotId: string) => {
    setMenuAnchor(null);
    const snapshot = snapshots.find(s => s.id === snapshotId);
    if (snapshot && confirm(`确定要删除快照"${snapshot.name}"吗？`)) {
      onDeleteSnapshot(snapshotId);
    }
  };

  // 格式化时间
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return '刚刚';
    if (diffMins < 60) return `${diffMins}分钟前`;
    if (diffHours < 24) return `${diffHours}小时前`;
    if (diffDays < 7) return `${diffDays}天前`;
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <>
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
        <Button
          size="small"
          variant="outlined"
          startIcon={<CameraAltIcon />}
          onClick={handleOpenCreateDialog}
          disabled={disabled}
        >
          创建快照
        </Button>

        {snapshots.length > 0 && (
          <>
            <Button
              size="small"
              variant="outlined"
              startIcon={<HistoryIcon />}
              endIcon={<ArrowDropDownIcon />}
              onClick={(e) => setMenuAnchor(e.currentTarget)}
              disabled={disabled}
            >
              快照 ({snapshots.length})
            </Button>

            <Menu
              anchorEl={menuAnchor}
              open={menuOpen}
              onClose={() => setMenuAnchor(null)}
              PaperProps={{
                sx: { minWidth: 320, maxWidth: 400 },
              }}
            >
              <Box sx={{ px: 2, py: 1 }}>
                <Typography variant="subtitle2" color="text.secondary">
                  已保存的快照
                </Typography>
              </Box>
              <Divider />

              {snapshots.length === 0 ? (
                <MenuItem disabled>
                  <ListItemText primary="暂无快照" />
                </MenuItem>
              ) : (
                snapshots
                  .slice()
                  .reverse()
                  .map((snapshot) => (
                    <Box key={snapshot.id}>
                      <MenuItem
                        onClick={() => handleRestoreSnapshot(snapshot.id)}
                        sx={{ py: 1.5 }}
                      >
                        <Box sx={{ flex: 1, mr: 1 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {snapshot.name}
                            </Typography>
                            <Chip
                              label={formatTime(snapshot.timestamp)}
                              size="small"
                              variant="outlined"
                              sx={{ height: 20, fontSize: '0.7rem' }}
                            />
                          </Box>
                          {snapshot.description && (
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                              {snapshot.description}
                            </Typography>
                          )}
                        </Box>
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                          {onRenameSnapshot && (
                            <Tooltip title="重命名">
                              <IconButton
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenRenameDialog(snapshot);
                                }}
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                          <Tooltip title="删除">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteSnapshot(snapshot.id);
                              }}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </MenuItem>
                      <Divider />
                    </Box>
                  ))
              )}
            </Menu>
          </>
        )}
      </Box>

      {/* 创建快照对话框 */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>创建快照</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <Alert severity="info">
              快照将保存当前的编辑内容，您可以随时恢复到任意快照状态
            </Alert>
            <TextField
              label="快照名称"
              value={snapshotName}
              onChange={(e) => setSnapshotName(e.target.value)}
              fullWidth
              required
              autoFocus
              placeholder="例如: 测试版本1"
            />
            <TextField
              label="描述（可选）"
              value={snapshotDescription}
              onChange={(e) => setSnapshotDescription(e.target.value)}
              fullWidth
              multiline
              rows={2}
              placeholder="简要描述这个快照的内容"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>取消</Button>
          <Button onClick={handleCreateSnapshot} variant="contained" startIcon={<CameraAltIcon />}>
            创建
          </Button>
        </DialogActions>
      </Dialog>

      {/* 重命名快照对话框 */}
      <Dialog open={renameDialogOpen} onClose={() => setRenameDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>重命名快照</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <TextField
              label="新名称"
              value={snapshotName}
              onChange={(e) => setSnapshotName(e.target.value)}
              fullWidth
              required
              autoFocus
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRenameDialogOpen(false)}>取消</Button>
          <Button onClick={handleRenameSnapshot} variant="contained" startIcon={<EditIcon />}>
            确定
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
