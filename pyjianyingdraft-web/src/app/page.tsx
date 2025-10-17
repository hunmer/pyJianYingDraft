'use client';

import {
  Container,
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Grid
} from '@mui/material';
import { Celebration, Timeline } from '@mui/icons-material';
import Link from 'next/link';

export default function Home() {
  return (
    <Container maxWidth="lg">
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          py: 4,
        }}
      >
        <Card
          elevation={3}
          sx={{
            maxWidth: 800,
            width: '100%',
            borderRadius: 2,
          }}
        >
          <CardContent sx={{ p: 6 }}>
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 3,
              }}
            >
              <Celebration
                sx={{
                  fontSize: 80,
                  color: 'primary.main',
                  animation: 'pulse 2s ease-in-out infinite',
                  '@keyframes pulse': {
                    '0%, 100%': {
                      opacity: 1,
                      transform: 'scale(1)',
                    },
                    '50%': {
                      opacity: 0.8,
                      transform: 'scale(1.1)',
                    },
                  },
                }}
              />

              <Typography
                variant="h2"
                component="h1"
                gutterBottom
                sx={{
                  fontWeight: 700,
                  background: 'linear-gradient(45deg, #1976d2 30%, #dc004e 90%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  textAlign: 'center',
                }}
              >
                Hello World!
              </Typography>

              <Typography
                variant="h5"
                color="text.secondary"
                sx={{ textAlign: 'center', mb: 2 }}
              >
                欢迎使用 pyJianYingDraft Web
              </Typography>

              <Typography
                variant="body1"
                color="text.secondary"
                sx={{ textAlign: 'center', mb: 3 }}
              >
                基于 React + Next.js + Material-UI 构建的现代化 Web 应用
              </Typography>

              <Grid container spacing={2} sx={{ width: '100%', mt: 2 }}>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <Card variant="outlined" sx={{ height: '100%' }}>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        React 19
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        最新的 React 版本
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <Card variant="outlined" sx={{ height: '100%' }}>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        Next.js 15
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        强大的 React 框架
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <Card variant="outlined" sx={{ height: '100%' }}>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        Material-UI
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        优雅的 UI 组件库
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              <Box sx={{ mt: 4, display: 'flex', gap: 2 }}>
                <Button
                  component={Link}
                  href="/editor"
                  variant="contained"
                  size="large"
                  startIcon={<Timeline />}
                >
                  打开编辑器
                </Button>
                <Button
                  variant="outlined"
                  size="large"
                  onClick={() => window.open('https://github.com/JulyWitch/pyJianYingDraft', '_blank')}
                >
                  查看文档
                </Button>
              </Box>
            </Box>
          </CardContent>
        </Card>

        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mt: 4 }}
        >
          Powered by pyJianYingDraft © 2025
        </Typography>
      </Box>
    </Container>
  );
}
