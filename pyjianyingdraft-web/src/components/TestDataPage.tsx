import { useState } from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField } from '@mui/material';
import { TestData } from '@/types/draft';

interface TestDataDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: TestData) => void;
  initialData?: TestData;
}

export default function TestDataPage({ 
  open, 
  onClose, 
  onSave,
  initialData 
}: TestDataDialogProps) {
  const [data, setData] = useState<TestData>(initialData || {});
  
  const handleSave = () => {
    onSave(data);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>测试数据编辑</DialogTitle>
      <DialogContent>
        <TextField
          multiline
          fullWidth
          minRows={10}
          maxRows={20}
          value={JSON.stringify(data, null, 2)}
          onChange={(e) => {
            try {
              setData(JSON.parse(e.target.value));
            } catch (error) {
              console.error('JSON解析错误', error);
            }
          }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>取消</Button>
        <Button onClick={handleSave} variant="contained">保存</Button>
      </DialogActions>
    </Dialog>
  );
}