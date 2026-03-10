import React, { useState } from 'react';
import { Popover, Typography, Box } from '@mui/material';
import TextSnippetIcon from '@mui/icons-material/TextSnippet';

// Define the shape of the props
interface TranscriptPopupProps {
  text: string;
}

const TranscriptPopup: React.FC<TranscriptPopupProps> = ({ text }) => {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const handleHoverOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleHoverClose = () => {
    setAnchorEl(null);
  };

  const open = Boolean(anchorEl);

  return (
    <Box 
      onMouseEnter={handleHoverOpen} 
      onMouseLeave={handleHoverClose}
      sx={{ display: 'flex', alignItems: 'center', height: '100%' }}
    >
      <TextSnippetIcon 
        color={open ? "primary" : "action"} 
        sx={{ cursor: 'help', fontSize: '1.2rem' }} 
      />
      <Popover
        id="transcript-popover"
        sx={{ pointerEvents: 'none' }} // Prevents flickering while moving mouse
        open={open}
        anchorEl={anchorEl}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        onClose={handleHoverClose}
        disableRestoreFocus
      >
        <Box 
          sx={{ 
            p: 2, 
            maxWidth: 350, 
            maxHeight: 300, 
            overflowY: 'auto', 
            bgcolor: 'background.paper',
            boxShadow: 3,
            pointerEvents: 'auto', // Re-enable pointer events so user can scroll
            '&::-webkit-scrollbar': { width: '6px' },
            '&::-webkit-scrollbar-thumb': {
              backgroundColor: 'rgba(0,0,0,0.2)',
              borderRadius: '10px',
            },
          }}
        >
          <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
            Call Transcript
          </Typography>
          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
            {text || "No transcript available for this record."}
          </Typography>
        </Box>
      </Popover>
    </Box>
  );
};

export default TranscriptPopup;