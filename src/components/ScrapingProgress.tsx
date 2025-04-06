import React, { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { Box, Typography, LinearProgress, Paper, List, ListItem, ListItemText } from '@mui/material';

interface ScrapingProgress {
  totalCompanies: number;
  processedCompanies: number;
  totalJobs: number;
  processedJobs: number;
  totalCandidates: number;
  processedCandidates: number;
  currentCompany: string;
  currentJob: string;
  currentCandidate: string;
  status: string;
  logs: string[];
}

const ScrapingProgress: React.FC = () => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [progress, setProgress] = useState<ScrapingProgress>({
    totalCompanies: 0,
    processedCompanies: 0,
    totalJobs: 0,
    processedJobs: 0,
    totalCandidates: 0,
    processedCandidates: 0,
    currentCompany: '',
    currentJob: '',
    currentCandidate: '',
    status: '準備中',
    logs: []
  });

  useEffect(() => {
    // WebSocket接続を確立
    const newSocket = io();
    setSocket(newSocket);

    // スクレイピング進捗状況の更新を監視
    newSocket.on('scraping-progress', (data: ScrapingProgress) => {
      setProgress(data);
    });

    // コンポーネントのアンマウント時にWebSocket接続を切断
    return () => {
      newSocket.disconnect();
    };
  }, []);

  // 進捗率を計算
  const calculateProgress = () => {
    if (progress.totalCompanies === 0 && progress.totalJobs === 0 && progress.totalCandidates === 0) {
      return 0;
    }

    const total = progress.totalCompanies + progress.totalJobs + progress.totalCandidates;
    const processed = progress.processedCompanies + progress.processedJobs + progress.processedCandidates;
    return (processed / total) * 100;
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>
        スクレイピング進捗状況
      </Typography>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="h6" gutterBottom>
          現在の状態: {progress.status}
        </Typography>

        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle1" gutterBottom>
            全体の進捗
          </Typography>
          <LinearProgress variant="determinate" value={calculateProgress()} sx={{ height: 10, borderRadius: 5 }} />
          <Typography variant="body2" sx={{ mt: 1 }}>
            {Math.round(calculateProgress())}%
          </Typography>
        </Box>

        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle1" gutterBottom>
            企業情報
          </Typography>
          <LinearProgress
            variant="determinate"
            value={(progress.processedCompanies / Math.max(progress.totalCompanies, 1)) * 100}
            sx={{ height: 10, borderRadius: 5 }}
          />
          <Typography variant="body2" sx={{ mt: 1 }}>
            {progress.processedCompanies} / {progress.totalCompanies} 企業
          </Typography>
          {progress.currentCompany && (
            <Typography variant="body2" color="text.secondary">
              現在処理中: {progress.currentCompany}
            </Typography>
          )}
        </Box>

        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle1" gutterBottom>
            求人情報
          </Typography>
          <LinearProgress
            variant="determinate"
            value={(progress.processedJobs / Math.max(progress.totalJobs, 1)) * 100}
            sx={{ height: 10, borderRadius: 5 }}
          />
          <Typography variant="body2" sx={{ mt: 1 }}>
            {progress.processedJobs} / {progress.totalJobs} 求人
          </Typography>
          {progress.currentJob && (
            <Typography variant="body2" color="text.secondary">
              現在処理中: {progress.currentJob}
            </Typography>
          )}
        </Box>

        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle1" gutterBottom>
            候補者情報
          </Typography>
          <LinearProgress
            variant="determinate"
            value={(progress.processedCandidates / Math.max(progress.totalCandidates, 1)) * 100}
            sx={{ height: 10, borderRadius: 5 }}
          />
          <Typography variant="body2" sx={{ mt: 1 }}>
            {progress.processedCandidates} / {progress.totalCandidates} 候補者
          </Typography>
          {progress.currentCandidate && (
            <Typography variant="body2" color="text.secondary">
              現在処理中: {progress.currentCandidate}
            </Typography>
          )}
        </Box>
      </Paper>

      <Paper sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>
          ログ
        </Typography>
        <List sx={{ maxHeight: 300, overflow: 'auto' }}>
          {progress.logs.map((log, index) => (
            <ListItem key={index} sx={{ py: 0.5 }}>
              <ListItemText primary={log} />
            </ListItem>
          ))}
        </List>
      </Paper>
    </Box>
  );
};

export default ScrapingProgress; 