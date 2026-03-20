import React, { useState, useRef } from 'react';
import { Popover, Typography, Box, IconButton, Tooltip } from '@mui/material';
import TextSnippetIcon from '@mui/icons-material/TextSnippet';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';

// Define the shape of the props
interface TranscriptPopupProps {
  text: string;
}

const TranscriptPopup: React.FC<TranscriptPopupProps> = ({ text }) => {
  // Use SVGSVGElement to match the Icon's type and avoid TS overload errors
  const [anchorEl, setAnchorEl] = useState<SVGSVGElement | null>(null);
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleHoverOpen = (event: React.MouseEvent<SVGSVGElement>) => {
    // Clear any pending close timer if the user moves back to the icon or into the box
    if (timerRef.current) clearTimeout(timerRef.current);
    setAnchorEl(event.currentTarget);
  };

  const handleHoverClose = () => {
    // 200ms delay provides a "bridge" so the user can move the mouse from 
    // the icon into the popover without it closing instantly.
    timerRef.current = setTimeout(() => {
      setAnchorEl(null);
      setCopied(false);
    }, 200);
  };

  const handleCopy = async () => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy transcript:", err);
    }
  };

  const open = Boolean(anchorEl);

  return (
    <Box 
      onMouseLeave={handleHoverClose}
      sx={{ display: 'flex', alignItems: 'center', height: '100%' }}
    >
      <TextSnippetIcon 
        onMouseEnter={handleHoverOpen}
        color={open ? "primary" : "action"} 
        sx={{ cursor: 'pointer', fontSize: '1.2rem' }} 
      />
      <Popover
        id="transcript-popover"
        open={open}
        anchorEl={anchorEl}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        disableRestoreFocus
        // pointerEvents: 'none' on the Popover container prevents it from 
        // capturing hover events that should belong to the Box inside.
        sx={{ pointerEvents: 'none' }} 
      >
        <Box 
          // Re-triggering Open/Close on the Box keeps the popover alive while hovering inside
          onMouseEnter={() => {
            if (timerRef.current) clearTimeout(timerRef.current);
          }}
          onMouseLeave={handleHoverClose}
          sx={{ 
            p: 2, 
            maxWidth: 350, 
            maxHeight: 300, 
            overflowY: 'auto', 
            bgcolor: 'background.paper',
            boxShadow: 3,
            pointerEvents: 'auto', // Re-enables interaction for buttons and text selection
            userSelect: 'text',   // Explicitly allows text highlighting
            '&::-webkit-scrollbar': { width: '6px' },
            '&::-webkit-scrollbar-thumb': {
              backgroundColor: 'rgba(0,0,0,0.2)',
              borderRadius: '10px',
            },
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
              Call Transcript
            </Typography>
            {text && (
              <Tooltip title={copied ? "Copied!" : "Copy to clipboard"}>
                <IconButton size="small" onClick={handleCopy} sx={{ ml: 1 }}>
                  {copied ? (
                    <CheckIcon fontSize="small" color="success" />
                  ) : (
                    <ContentCopyIcon fontSize="small" />
                  )}
                </IconButton>
              </Tooltip>
            )}
          </Box>
          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
            {text || "No transcript available for this record."}
          </Typography>
        </Box>
      </Popover>
    </Box>
  );
};

export default TranscriptPopup;