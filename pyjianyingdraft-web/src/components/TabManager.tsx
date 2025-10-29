'use client';

import React, { useCallback } from 'react';
import {
  Box,
  Tabs,
  Tab,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Close as CloseIcon,
} from '@mui/icons-material';
import type { TabData } from '@/hooks/useTabs';

interface TabManagerProps {
  tabs: TabData[];
  activeTabId: string | null;
  onTabChange: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
  onTabContextMenu: (event: React.MouseEvent, tabId: string) => void;
}

export const TabManager: React.FC<TabManagerProps> = ({
  tabs,
  activeTabId,
  onTabChange,
  onCloseTab,
  onTabContextMenu,
}) => {
  const handleTabChange = useCallback((_event: React.SyntheticEvent, newValue: string) => {
    onTabChange(newValue);
  }, [onTabChange]);

  if (tabs.length === 0) {
    return null;
  }

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}>
      <Tabs
        value={activeTabId || false}
        onChange={handleTabChange}
        variant="scrollable"
        scrollButtons="auto"
        sx={{
          flex: 1,
          minWidth: 0,
          maxWidth: '100%',
          '& .MuiTabs-flexContainer': {
            gap: 0.5,
          },
          '& .MuiTabs-scroller': {
            overflow: 'auto !important',
          },
        }}
      >
        {tabs.map(tab => (
          <Tab
            key={tab.id}
            value={tab.id}
            onContextMenu={(e) => onTabContextMenu(e, tab.id)}
            sx={{
              minWidth: 120,
              maxWidth: 200,
              flex: '0 0 auto',
              '& .MuiTab-wrapper': {
                width: '100%',
              }
            }}
            label={
              <Box sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                width: '100%',
                overflow: 'hidden'
              }}>
                <Box
                  component="span"
                  sx={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    flex: 1,
                    minWidth: 0
                  }}
                >
                  {tab.label}
                </Box>
                <Box
                  component="span"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseTab(tab.id);
                  }}
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    cursor: 'pointer',
                    ml: 0.5,
                    '&:hover': {
                      backgroundColor: 'action.hover',
                    },
                  }}
                >
                  <CloseIcon sx={{ fontSize: 16 }} />
                </Box>
              </Box>
            }
          />
        ))}
      </Tabs>
    </Box>
  );
};