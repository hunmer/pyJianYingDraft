'use client';

import React from 'react';
import {
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Chip,
  Typography,
  Tooltip,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  AccountCircle as AccountIcon,
  CloudQueue as WorkspaceIcon,
} from '@mui/icons-material';
import { CozeAccount, CozeWorkspace } from '@/types/coze';

interface CozeZoneToolbarProps {
  accounts: CozeAccount[];
  currentAccount: CozeAccount | null;
  workspaces: CozeWorkspace[];
  currentWorkspace: CozeWorkspace | null;
  refreshing: boolean;
  onAccountSwitch: (accountId: string) => void;
  onWorkspaceSwitch: (workspaceId: string) => void;
  onRefresh: () => void;
  onAccountManager: () => void;
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
  onAccountManager,
}) => {
  const handleAccountChange = (event: any) => {
    onAccountSwitch(event.target.value);
  };

  const handleWorkspaceChange = (event: any) => {
    onWorkspaceSwitch(event.target.value);
  };

  const getAccountStatusColor = (account: CozeAccount) => {
    if (account.isActive) return 'success';
    return 'default';
  };

  const getWorkspaceStatusColor = (workspace: CozeWorkspace) => {
    if (workspace.status === 'active') return 'success';
    return 'default';
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
      <FormControl size="small" sx={{ minWidth: 180 }}>
        <InputLabel
          sx={{
            backgroundColor: 'background.paper',
            px: 1,
          }}
        >
          账号
        </InputLabel>
        <Select
          value={currentAccount?.id || ''}
          label="账号"
          onChange={handleAccountChange}
          displayEmpty
          startAdornment={<AccountIcon sx={{ mr: 1, fontSize: 20 }} />}
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
            accounts.map((account) => (
              <MenuItem key={account.id} value={account.id}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                  <Typography variant="body2" sx={{ flex: 1 }}>
                    {account.name}
                  </Typography>
                  <Chip
                    label={account.isActive ? '活跃' : '未激活'}
                    size="small"
                    color={getAccountStatusColor(account) as any}
                    variant="outlined"
                  />
                </Box>
              </MenuItem>
            ))
          )}
        </Select>
      </FormControl>

      {/* 工作空间选择 */}
      <FormControl size="small" sx={{ minWidth: 200 }} disabled={!currentAccount}>
        <InputLabel
          sx={{
            backgroundColor: 'background.paper',
            px: 1,
          }}
        >
          工作空间
        </InputLabel>
        <Select
          value={currentWorkspace?.id || ''}
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
                {currentAccount ? '暂无工作空间' : '请先选择账号'}
              </Typography>
            </MenuItem>
          ) : (
            workspaces.map((workspace) => (
              <MenuItem key={workspace.id} value={workspace.id}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                  <Typography variant="body2" sx={{ flex: 1 }}>
                    {workspace.name}
                  </Typography>
                  <Chip
                    label={workspace.status === 'active' ? '活跃' : '未激活'}
                    size="small"
                    color={getWorkspaceStatusColor(workspace) as any}
                    variant="outlined"
                  />
                </Box>
              </MenuItem>
            ))
          )}
        </Select>
      </FormControl>

      {/* 状态信息 */}
      {currentAccount && currentWorkspace && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body2" color="text.secondary">
            当前环境:
          </Typography>
          <Chip
            label={`${currentAccount.name} / ${currentWorkspace.name}`}
            size="small"
            color="primary"
            variant="outlined"
          />
        </Box>
      )}

      {/* 操作按钮 */}
      <Box sx={{ ml: 'auto', display: 'flex', gap: 1 }}>
        {/* 刷新按钮 */}
        <Tooltip title="刷新数据">
          <Button
            variant="outlined"
            size="small"
            startIcon={<RefreshIcon />}
            onClick={onRefresh}
            disabled={refreshing || !currentAccount}
          >
            刷新
          </Button>
        </Tooltip>

        {/* 账号管理按钮 */}
        <Tooltip title="账号管理">
          <Button
            variant="contained"
            size="small"
            startIcon={<AccountIcon />}
            onClick={onAccountManager}
          >
            账号管理
          </Button>
        </Tooltip>
      </Box>
    </Box>
  );
};

export default CozeZoneToolbar;