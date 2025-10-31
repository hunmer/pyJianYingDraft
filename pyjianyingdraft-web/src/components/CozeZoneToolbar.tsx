'use client';

/**
 * CozeZone 工具栏 - 简化版本
 *
 * 移除前端账号管理，账号配置在后端
 * 只保留工作空间选择和刷新功能
 */

import React from 'react';
import {
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Typography,
  Tooltip,
  Chip,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  CloudQueue as WorkspaceIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { CozeWorkspace } from '@/types/coze';

interface CozeZoneToolbarProps {
  accounts: string[];
  currentAccount: string | null;
  workspaces: CozeWorkspace[];
  currentWorkspace: CozeWorkspace | null;
  refreshing: boolean;
  onAccountSwitch: (accountId: string) => void;
  onWorkspaceSwitch: (workspaceId: string) => void;
  onRefresh: () => void;
}

const CozeZoneToolbar: React.FC<CozeZoneToolbarProps> = ({
  accounts,
  currentAccount,
  workspaces,
  currentWorkspace,
  refreshing,
  onAccountSwitch,
  onWorkspaceSwitch,
  onRefresh,
}) => {
  const handleAccountChange = (event: any) => {
    onAccountSwitch(String(event.target.value));
  };

  const handleWorkspaceChange = (event: any) => {
    onWorkspaceSwitch(String(event.target.value));
  };

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        p: 2,
        borderBottom: 1,
        borderColor: 'divider',
        backgroundColor: 'background.paper',
      }}
    >
      {/* 账号选择 */}
      <FormControl size="small" sx={{ minWidth: 150 }}>
        <InputLabel
          sx={{
            backgroundColor: 'background.paper',
            px: 1,
          }}
        >
          账号
        </InputLabel>
        <Select
          value={String(currentAccount ?? '')}
          label="账号"
          onChange={handleAccountChange}
          displayEmpty
          startAdornment={<InfoIcon sx={{ mr: 1, fontSize: 20 }} />}
          sx={{
            '& .MuiSelect-select': {
              display: 'flex',
              alignItems: 'center',
            },
          }}
        >
          {accounts.length === 0 ? (
            <MenuItem value="" disabled>
              <Typography variant="body2" color="text.secondary">
                暂无账号
              </Typography>
            </MenuItem>
          ) : (
            accounts.map((accountId) => (
              <MenuItem key={accountId} value={accountId}>
                <Typography variant="body2">
                  {accountId}
                </Typography>
              </MenuItem>
            ))
          )}
        </Select>
      </FormControl>

      {/* 工作空间选择 */}
      <FormControl size="small" sx={{ minWidth: 200 }}>
        <InputLabel
          sx={{
            backgroundColor: 'background.paper',
            px: 1,
          }}
        >
          工作空间
        </InputLabel>
        <Select
          value={String(currentWorkspace?.id ?? '')}
          label="工作空间"
          onChange={handleWorkspaceChange}
          displayEmpty
          startAdornment={<WorkspaceIcon sx={{ mr: 1, fontSize: 20 }} />}
          sx={{
            '& .MuiSelect-select': {
              display: 'flex',
              alignItems: 'center',
            },
          }}
        >
          {workspaces.length === 0 ? (
            <MenuItem value="" disabled>
              <Typography variant="body2" color="text.secondary">
                暂无工作空间
              </Typography>
            </MenuItem>
          ) : (
            workspaces.map((workspace) => (
              <MenuItem key={workspace.id} value={String(workspace.id)}>
                <Typography variant="body2">
                  {workspace.name}
                </Typography>
              </MenuItem>
            ))
          )}
        </Select>
      </FormControl>

      {/* 操作按钮 */}
      <Box sx={{ ml: 'auto', display: 'flex', gap: 1 }}>
        {/* 刷新按钮 */}
        <Tooltip title={refreshing ? "刷新中..." : "刷新工作空间"}>
          <span>
            <Button
              variant="outlined"
              size="small"
              startIcon={<RefreshIcon />}
              onClick={onRefresh}
              disabled={refreshing}
            >
              {refreshing ? '刷新中...' : '刷新'}
            </Button>
          </span>
        </Tooltip>
      </Box>
    </Box>
  );
};

export default CozeZoneToolbar;
