'use client';

import React from 'react';
import {
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Close as CloseIcon,
  ClearAll,
} from '@mui/icons-material';

interface TabContextMenuProps {
  open: boolean;
  onClose: () => void;
  anchorPosition?: { top: number; left: number };
  onRefresh: () => void;
  onCloseTab: () => void;
  onCloseOtherTabs: () => void;
}

export const TabContextMenu: React.FC<TabContextMenuProps> = ({
  open,
  onClose,
  anchorPosition,
  onRefresh,
  onCloseTab,
  onCloseOtherTabs,
}) => {
  return (
    <Menu
      open={open}
      onClose={onClose}
      anchorReference="anchorPosition"
      anchorPosition={anchorPosition}
    >
      <MenuItem onClick={onRefresh}>
        <ListItemIcon>
          <RefreshIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText>刷新</ListItemText>
      </MenuItem>
      <Divider />
      <MenuItem onClick={onCloseTab}>
        <ListItemIcon>
          <CloseIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText>关闭</ListItemText>
      </MenuItem>
      <MenuItem onClick={onCloseOtherTabs}>
        <ListItemIcon>
          <ClearAll fontSize="small" />
        </ListItemIcon>
        <ListItemText>关闭其他</ListItemText>
      </MenuItem>
    </Menu>
  );
};