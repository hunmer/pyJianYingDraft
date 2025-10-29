'use client';

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
          value={String(currentAccount?.id ?? '')}
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
              <MenuItem key={account.id} value={String(account.id)}>
                <Typography variant="body2">
                  {account.name}
                </Typography>
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
                {currentAccount ? '暂无工作空间' : '请先选择账号'}
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
        <Tooltip title={refreshing || !currentAccount ? "" : "刷新数据"}>
          <span>
            <Button
              variant="outlined"
              size="small"
              startIcon={<RefreshIcon />}
              onClick={onRefresh}
              disabled={refreshing || !currentAccount}
            >
              刷新
            </Button>
          </span>
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