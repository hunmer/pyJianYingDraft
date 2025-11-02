'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  TextField,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  IconButton,
  Chip,
  Alert,
  Tooltip,
  Divider,
  Switch,
  FormControlLabel,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  AccountCircle as AccountIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Check as CheckIcon,
  Close as CloseIcon,
  ExpandMore as ExpandMoreIcon,
  Key as KeyIcon,
  CloudQueue as CloudIcon,
  Science as TestIcon,
} from '@mui/icons-material';
import { CozeAccount, CreateAccountRequest, UpdateAccountRequest } from '@/types/coze';
import api from '@/lib/api';

interface AccountManagerProps {
  open: boolean;
  onClose: () => void;
}

const AccountManager: React.FC<AccountManagerProps> = ({
  open,
  onClose,
}) => {
  const [accounts, setAccounts] = useState<CozeAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [newAccount, setNewAccount] = useState({
    name: '',
    api_key: '',
    base_url: 'https://api.coze.cn',
  });
  const [editingAccount, setEditingAccount] = useState<CozeAccount | null>(null);
  const [testResults, setTestResults] = useState<{ [key: string]: boolean }>({});
  const [testing, setTesting] = useState<{ [key: string]: boolean }>({});

  // 加载账号列表
  const loadAccounts = async () => {
    try {
      setLoading(true);
      const response = await api.coze.getAccounts();
      setAccounts(response.accounts);
    } catch (error) {
      console.error('加载账号列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 重置表单
  const resetForm = () => {
    setNewAccount({
      name: '',
      api_key: '',
      base_url: 'https://api.coze.cn',
    });
    setEditingAccount(null);
    setTestResults({});
    setTesting({});
  };

  // 关闭对话框
  const handleClose = () => {
    resetForm();
    onClose();
  };

  // 添加账号
  const handleAddAccount = async () => {
    if (!newAccount.name.trim() || !newAccount.api_key.trim()) {
      return;
    }

    try {
      const accountData = {
        name: newAccount.name,
        api_key: newAccount.api_key,
        base_url: newAccount.base_url,
        description: '',
        is_active: true,
        timeout: 600,
        max_retries: 3,
      };
      await api.coze.createAccount(accountData);
      await loadAccounts(); // 重新加载账号列表
      resetForm();
    } catch (error) {
      console.error('添加账号失败:', error);
    }
  };

  // 删除账号
  const handleDeleteAccount = async (accountId: string) => {
    if (window.confirm('确定要删除这个账号吗？此操作不可撤销。')) {
      try {
        await api.coze.deleteAccount(accountId);
        await loadAccounts(); // 重新加载账号列表
      } catch (error) {
        console.error('删除账号失败:', error);
      }
    }
  };

  // 开始编辑账号
  const handleEditAccount = (account: CozeAccount) => {
    setEditingAccount({ ...account });
    setTestResults({});
  };

  // 取消编辑
  const handleCancelEdit = () => {
    setEditingAccount(null);
    setTestResults({});
  };

  // 更新账号
  const handleUpdateAccount = async () => {
    if (!editingAccount) return;

    try {
      const updates: UpdateAccountRequest = {
        name: editingAccount.name,
        api_key: editingAccount.api_key,
        base_url: editingAccount.base_url,
      };

      await api.coze.updateAccount(editingAccount.id, updates);
      await loadAccounts(); // 重新加载账号列表
      setEditingAccount(null);
      setTestResults({});
    } catch (error) {
      console.error('更新账号失败:', error);
    }
  };

  // 测试账号
  const handleTestAccount = async (apiKey: string, baseUrl?: string, accountId?: string) => {
    const testKey = accountId || 'new';

    setTesting(prev => ({ ...prev, [testKey]: true }));
    setTestResults(prev => ({ ...prev, [testKey]: false }));

    try {
      const response = await api.coze.validateAccount(apiKey, baseUrl);
      setTestResults(prev => ({ ...prev, [testKey]: response.is_valid }));
    } catch (error) {
      setTestResults(prev => ({ ...prev, [testKey]: false }));
    } finally {
      setTesting(prev => ({ ...prev, [testKey]: false }));
    }
  };

  // 对话框打开时加载账号列表
  React.useEffect(() => {
    if (open) {
      loadAccounts();
    }
  }, [open]);

  // 获取测试结果显示
  const getTestResultDisplay = (accountId?: string) => {
    const testKey = accountId || 'new';
    const isTesting = testing[testKey];
    const hasResult = testResults.hasOwnProperty(testKey);
    const isValid = testResults[testKey];

    if (isTesting) {
      return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <TestIcon sx={{ animation: 'spin 1s linear infinite' }} />
          <Typography variant="caption" component="span">测试中...</Typography>
        </Box>
      );
    }

    if (hasResult) {
      return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {isValid ? (
            <>
              <CheckIcon color="success" fontSize="small" />
              <Typography variant="caption" color="success.main" component="span">连接成功</Typography>
            </>
          ) : (
            <>
              <CloseIcon color="error" fontSize="small" />
              <Typography variant="caption" color="error.main" component="span">连接失败</Typography>
            </>
          )}
        </Box>
      );
    }

    return null;
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AccountIcon />
          Coze 账号管理
        </Box>
      </DialogTitle>

      <DialogContent sx={{ pb: 0 }}>
        {/* 现有账号列表 */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            已配置的账号
          </Typography>

          {accounts.length === 0 ? (
            <Alert severity="info" sx={{ mb: 2 }}>
              暂无配置的账号，请添加新账号以开始使用
            </Alert>
          ) : (
            <List>
              {accounts.map((account) => (
                <Box key={account.id}>
                  <ListItem>
                    <ListItemIcon>
                      <AccountIcon color={account.is_active ? 'primary' : 'disabled'} />
                    </ListItemIcon>

                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Typography variant="subtitle1" sx={{ fontWeight: 'medium' }}>
                            {account.name}
                          </Typography>
                          <Box sx={{ display: 'flex', gap: 0.5 }}>
                            {/* 测试按钮 */}
                            <Tooltip title="测试连接">
                              <IconButton
                                size="small"
                                onClick={() => handleTestAccount(account.api_key, account.base_url, account.id)}
                                disabled={testing[account.id]}
                              >
                                <TestIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>

                            {/* 编辑按钮 */}
                            <Tooltip title="编辑">
                              <IconButton
                                size="small"
                                onClick={() => handleEditAccount(account)}
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>

                            {/* 删除按钮 */}
                            <Tooltip title="删除">
                              <IconButton
                                size="small"
                                onClick={() => handleDeleteAccount(account.id)}
                                color="error"
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        </Box>
                      }
                      secondary={
                        <Box component="span" sx={{ display: 'block', mt: 0.5 }}>
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }} component="span">
                            API URL: {account.base_url}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" component="span">
                            API 密钥: {account.api_key.substring(0, 8)}...{account.api_key.substring(account.api_key.length - 4)}
                          </Typography>

                          {/* 测试结果显示 */}
                          <Box component="span" sx={{ display: 'block', mt: 1 }}>
                            {getTestResultDisplay(account.id)}
                          </Box>
                        </Box>
                      }
                    />
                  </ListItem>
                  <Divider variant="inset" component="li" />
                </Box>
              ))}
            </List>
          )}
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* 添加/编辑账号表单 */}
        <Accordion defaultExpanded>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="h6">
              {editingAccount ? '编辑账号' : '添加新账号'}
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {/* 账号名称 */}
              <TextField
                label="账号名称"
                value={editingAccount ? editingAccount.name : newAccount.name}
                onChange={(e) => {
                  if (editingAccount) {
                    setEditingAccount({ ...editingAccount, name: e.target.value });
                  } else {
                    setNewAccount({ ...newAccount, name: e.target.value });
                  }
                }}
                placeholder="输入账号名称，如：我的Coze账号"
                fullWidth
                size="small"
              />

              {/* API密钥 */}
              <TextField
                label="API 密钥"
                type="password"
                value={editingAccount ? editingAccount.api_key : newAccount.api_key}
                onChange={(e) => {
                  if (editingAccount) {
                    setEditingAccount({ ...editingAccount, api_key: e.target.value });
                  } else {
                    setNewAccount({ ...newAccount, api_key: e.target.value });
                  }
                }}
                placeholder="输入 Coze API 密钥"
                fullWidth
                size="small"
                helperText="在 Coze 开放平台获取 API 密钥"
              />

              {/* 基础URL */}
              <TextField
                label="基础 URL"
                value={editingAccount ? editingAccount.base_url : newAccount.base_url}
                onChange={(e) => {
                  if (editingAccount) {
                    setEditingAccount({ ...editingAccount, base_url: e.target.value });
                  } else {
                    setNewAccount({ ...newAccount, base_url: e.target.value });
                  }
                }}
                placeholder="https://api.coze.cn"
                fullWidth
                size="small"
                helperText="API 服务器地址，国内用户通常使用默认值"
              />

              {/* 操作按钮 */}
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                {editingAccount ? (
                  <>
                    <Button
                      variant="contained"
                      onClick={handleUpdateAccount}
                      startIcon={<CheckIcon />}
                    >
                      保存更新
                    </Button>
                    <Button
                      variant="outlined"
                      onClick={handleCancelEdit}
                      startIcon={<CloseIcon />}
                    >
                      取消编辑
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant="contained"
                      onClick={handleAddAccount}
                      startIcon={<AccountIcon />}
                      disabled={!newAccount.name.trim() || !newAccount.api_key.trim()}
                    >
                      添加账号
                    </Button>
                    <Button
                      variant="outlined"
                      onClick={() => handleTestAccount(newAccount.api_key, newAccount.base_url)}
                      disabled={!newAccount.api_key.trim() || testing['new']}
                      startIcon={<TestIcon />}
                    >
                      测试连接
                    </Button>
                  </>
                )}

                {/* 测试结果显示 */}
                {getTestResultDisplay()}
              </Box>

              {/* 帮助信息 */}
              <Alert severity="info">
                <Typography variant="body2" sx={{ mb: 1 }}>
                  如何获取 API 密钥：
                </Typography>
                <Box component="ol" sx={{ pl: 2, mt: 0, mb: 0 }}>
                  <Typography component="li" variant="body2">
                    访问 Coze 开放平台 (https://www.coze.cn/open)
                  </Typography>
                  <Typography component="li" variant="body2">
                    登录并进入开发者控制台
                  </Typography>
                  <Typography component="li" variant="body2">
                    创建应用或选择现有应用
                  </Typography>
                  <Typography component="li" variant="body2">
                    在应用设置中找到 API 密钥
                  </Typography>
                </Box>
              </Alert>
            </Box>
          </AccordionDetails>
        </Accordion>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose}>关闭</Button>
      </DialogActions>
    </Dialog>
  );
};

export default AccountManager;