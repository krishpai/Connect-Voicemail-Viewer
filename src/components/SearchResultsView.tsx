import React, { useMemo, useState, useCallback, useRef } from "react";
import { apiRequest } from "../authConfig";

import { 
  DataGridPro, 
  GridFooterContainer, 
  GridFooter, 
  GridColumnMenu, 
  type GridColDef, 
  type GridRowSelectionModel, 
  type GridColumnMenuProps, 
  type GridColumnVisibilityModel,
  type GridFooterContainerProps,
} from '@mui/x-data-grid-pro';

import { 
  Tooltip, 
  IconButton, 
  Dialog, 
  DialogActions, 
  DialogContent, 
  DialogContentText, 
  DialogTitle, 
  Button, 
  CircularProgress,
  Box,
} from '@mui/material';

import MailOutlineIcon from '@mui/icons-material/MailOutline';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PhoneIcon from '@mui/icons-material/Phone';
import DeleteIcon from '@mui/icons-material/Delete';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import TranscriptPopup from './TranscriptPopup'; 
import { useAcquireTokenWithRecovery } from "../hooks/useAcquireTokenWithRecovery";

// --- API Endpoints ---
const API_ENDPOINT_ENTRA_AUTH = import.meta.env.VITE_API_URL_ENTRA_AUTH;
const API_ENDPOINT_CONNECT_AUTH = import.meta.env.VITE_API_URL_CONNECT_AUTH;
const isIframe = window.self !== window.top;

// --- Interfaces ---
interface SearchResultsViewProps {
  searchResult: string | null;
  entraAuth: boolean;
  userName: string | null | undefined;
  vmx3Admin: string | null | undefined;
  onDialNumberClicked: (value: string) => void;
}

interface MatchedObject {
  vmx3_unread?: string;
  vmx3_contact_id: string;
  vmx3_customer_number: string;
  vmx3_queue_name: string;
  vmx3_target: string;
  vmx3_preferred_agent: string;
  vmx3_region: string;
  vmx3_timestamp: string;
  vmx3_lang_value: string;
  vmx3_call_category: string;
  vmx3_dialed_number: string;
  vmx3_queue: string;
  transcript: string;
  presigned_url: string;
}

interface GridRow extends MatchedObject {
  id: string;
  fileName: string;
}

interface CustomFooterProps extends GridFooterContainerProps {
  contactId?: string | null;
}

// --- Sub-Components ---

const CustomFooter = (props: CustomFooterProps) => {
  const { contactId, ...other } = props;
  const [copied, setCopied] = useState(false);

  const handleCopyContactId = async () => {
    if (!contactId) return;
    try {
      await navigator.clipboard.writeText(contactId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) { console.error("Copy failed", err); }
  };
  ;
  return (
    <GridFooterContainer {...other} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <Box sx={{ pl: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box sx={{ fontSize: '0.875rem', color: '#666', fontWeight: 500 }}>
          {contactId ? `Selected Contact ID: ${contactId}` : 'No row selected'}
        </Box>
        {contactId && (
          <Tooltip title={copied ? "Copied!" : "Copy Contact ID"}>
            <IconButton size="small" onClick={handleCopyContactId} sx={{ ml: 0.5 }}>
              {copied ? <CheckCircleIcon fontSize="small" color="success" /> : <ContentCopyIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
        )}
      </Box>
      <GridFooter sx={{ border: 'none' }} />
    </GridFooterContainer>
  );
};

const CustomColumnMenu = (props: GridColumnMenuProps) => (
  <GridColumnMenu 
    {...props} 
    slots={{ 
      columnMenuHideColumnItem: null, 
      columnMenuManageColumnsItem: null, 
      columnMenuColumnsItem: null 
    }} 
  />
);

const NoRowsOverlay = () => (
  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'gray' }}>
    No matching recordings found.
  </Box>
);

// --- Main Component ---

export const SearchResultsView: React.FC<SearchResultsViewProps> = ({ searchResult, userName, entraAuth, vmx3Admin, onDialNumberClicked }) => {
  const acquireTokenWithRecovery = useAcquireTokenWithRecovery();
  const playingAudioRef = useRef<HTMLAudioElement | null>(null);

  const [readMessages, setReadMessages] = useState<Set<string>>(new Set());
  const [deletedFileNames, setDeletedFileNames] = useState<Set<string>>(new Set());
  
  const [columnVisibilityModel, setColumnVisibilityModel] = useState<GridColumnVisibilityModel>({
    id: false,
    transcript: true,
  });

  const [rowSelectionModel, setRowSelectionModel] = useState<GridRowSelectionModel>({ type: 'include', ids: new Set() });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ id: string, fileName: string } | null>(null);
  const [paginationModel, setPaginationModel] = useState({ pageSize: 10, page: 0 });

  const gridRows = useMemo<GridRow[]>(() => {
    if (!searchResult) return [];
    try {
      const data = JSON.parse(searchResult);
      const rawData: Record<string, MatchedObject> = data.matched_objects || {};
      
      return Object.entries(rawData)
        .filter(([fileName]) => !deletedFileNames.has(fileName))
        .map(([fileName, details]) => ({
          id: details.vmx3_contact_id,
          fileName,
          ...details,
          vmx3_unread: readMessages.has(details.vmx3_contact_id) ? 'N' : details.vmx3_unread,
          vmx3_queue_name: (details.vmx3_target === "agent" && details.vmx3_preferred_agent?.toLowerCase() === userName?.toLowerCase()) 
            ? "Self" : (details.vmx3_queue_name === 'VMX3_VM_QUEUE' ? 'Self' : details.vmx3_queue_name)
        }));
    } catch (e) {
      console.error("Parse error", e);
      return [];
    }
  }, [searchResult, userName, readMessages, deletedFileNames]);

  const selectedContactId = useMemo(() => {
    const selectionIds = rowSelectionModel.ids;
    if (!selectionIds || selectionIds.size === 0 || selectionIds.size > 1) return null;
    const firstId = selectionIds.values().next().value as string;
    return gridRows.find((row) => row.id === firstId)?.vmx3_contact_id || null;
  }, [rowSelectionModel, gridRows]);

  /********************* handleAudioPlay *************/ 
  const handleAudioPlay = useCallback((e: React.SyntheticEvent<HTMLAudioElement>) => {
    if (playingAudioRef.current && playingAudioRef.current !== e.currentTarget) playingAudioRef.current.pause();
    playingAudioRef.current = e.currentTarget;
  }, []);

  /********************* handleMarkAsRead *************/ 
  const handleMarkAsRead = useCallback(async (contactId: string, fileName: string) => {
    setReadMessages(prev => new Set(prev).add(contactId));
    const apiUrl = entraAuth
      ? `${API_ENDPOINT_ENTRA_AUTH}?function_code=mark_voice_message_read&vmx3_file_name=${fileName}`
      : `${API_ENDPOINT_CONNECT_AUTH}?function_code=mark_voice_message_read&vmx3_file_name=${fileName}`;
    try {
      let token = "None";
      if (entraAuth) {
        const authResult = await acquireTokenWithRecovery({ ...apiRequest });
        if (authResult?.accessToken) token = authResult.accessToken;
      }
      await fetch(apiUrl, { headers: { Authorization: `Bearer ${token}` } });
    } catch (error) { console.error("Mark read error:", error); }
  }, [entraAuth, acquireTokenWithRecovery]);

  /********************* confirmDelete *************/ 
  const confirmDelete = useCallback(async () => {
    if (!itemToDelete) return;
    setIsDeleting(true);
    const apiUrl = entraAuth 
      ? `${API_ENDPOINT_ENTRA_AUTH}?function_code=delete_voice_message&vmx3_file_name=${itemToDelete.fileName}`
      : `${API_ENDPOINT_CONNECT_AUTH}?function_code=delete_voice_message&vmx3_file_name=${itemToDelete.fileName}`;
    try {
      let token = "None";
      if (entraAuth) {
        const authResult = await acquireTokenWithRecovery({ ...apiRequest });
        if (authResult?.accessToken) token = authResult.accessToken;
      }
      const resp = await fetch(apiUrl, { headers: { Authorization: `Bearer ${token}` } });
      if (resp.ok) {
        setDeletedFileNames(prev => new Set(prev).add(itemToDelete.fileName));
        setDeleteDialogOpen(false);
      }
    } catch (e) { console.error("Delete error:", e); } finally { setIsDeleting(false); }
  }, [itemToDelete, entraAuth, acquireTokenWithRecovery]);

  const columns = useMemo<GridColDef<GridRow>[]>(() => {
    const baseColumns: GridColDef<GridRow>[] = [
      { field: 'id', headerName: 'Contact ID', width: 120, headerAlign: 'center', filterable: false, align: 'center' },
      {
        field: 'vmx3_unread',
        headerName: '',
        width: 70,
        headerAlign: 'center',
        filterable: false,
        align: 'center',
        renderCell: (params) => (
          <Tooltip title={params.value === 'Y' ? "Unread" : "Played"}>
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
              {params.value === 'Y' ? <MailOutlineIcon color="primary" /> : <CheckCircleIcon color="action" />}
            </Box>
          </Tooltip>
        )
      },
      { 
        field: 'vmx3_timestamp', 
        headerName: 'Date', 
        width: 220, 
        headerAlign: 'center',
        align: 'center',
        valueFormatter: (value) => value ? new Date(value as string).toLocaleString() : '' 
      },
      { field: 'vmx3_queue_name', headerName: 'Queue', width: 200, headerAlign: 'center', align: 'center' },
      { field: 'vmx3_customer_number', headerName: 'Caller number', width: 130, headerAlign: 'center', align: 'center' },
      { field: 'vmx3_dialed_number', headerName: 'Dialed number', width: 130, headerAlign: 'center', align: 'center' },
      { field: 'vmx3_lang_value', headerName: 'Language', width: 100, headerAlign: 'center', align: 'center' },
      {
        field: 'presigned_url',
        headerName: 'Listen',
        width: 260,
        headerAlign: 'center',
        filterable: false,
        sortable: false,
        disableExport: true, // Corrected from exportable
        align: 'center',
        renderCell: (params) => (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <audio controls src={params.value as string} onPlay={handleAudioPlay} onEnded={() => handleMarkAsRead(params.row.id, params.row.fileName)} style={{ height: '24px', width: '250px' }} />
          </Box>
        )
      },
      {
        field: 'transcript',
        headerName: 'Transcript',
        width: 110,
        headerAlign: 'center',
        align: 'center',
        filterable: true, 
        sortable: false,   
        renderCell: (params) => (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <TranscriptPopup text={(params.value as string) ?? ""} />
          </Box>
        )
      },
      {
        field: 'dial_action',
        headerName: 'Call back',
        width: 90,
        headerAlign: 'center',
        align: 'center',
        filterable: false,
        sortable: false,
        disableExport: true, // Corrected from exportable
        renderCell: (params) => (
          <IconButton color="primary" onClick={() => onDialNumberClicked(params.row.vmx3_customer_number)}><PhoneIcon /></IconButton>
        )
      },
      {
        field: 'delete_action',
        headerName: '',
        width: 70,
        headerAlign: 'center',
        align: 'center',
        sortable: false,
        filterable: false,
        disableExport: true, // Corrected from exportable
        renderCell: (params) => (vmx3Admin === 'Y' || params.row.vmx3_queue_name === 'Self') ? (
          <IconButton onClick={() => { setItemToDelete({ id: params.row.id, fileName: params.row.fileName }); setDeleteDialogOpen(true); }}><DeleteIcon /></IconButton>
        ) : null
      }
    ];

    return baseColumns.filter(col => isIframe || col.field !== 'dial_action');
  }, [vmx3Admin, onDialNumberClicked, handleAudioPlay, handleMarkAsRead]);

  if (!searchResult) return <Box sx={{ p: 5, textAlign: 'center' }}>No search performed.</Box>;

  return (
    <Box sx={{ height: 600, width: '100%', pt: 2 }}>
      <DataGridPro
        showToolbar
        rows={gridRows}
        columns={columns}
        columnVisibilityModel={columnVisibilityModel}
        onColumnVisibilityModelChange={setColumnVisibilityModel}
        pageSizeOptions={[10, 25, 50]}
        paginationModel={paginationModel}
        onPaginationModelChange={setPaginationModel}
        rowSelectionModel={rowSelectionModel}
        onRowSelectionModelChange={setRowSelectionModel}
        hideFooterSelectedRowCount
        
        /*initialState={{
          pinnedColumns: { right: ['presigned_url', 'delete_action'] }
        }}*/

        sx={{
          '& .MuiDataGrid-columnHeader': { backgroundColor: '#2e2c2c33 !important', color: 'black !important' },
          '& .MuiDataGrid-columnHeaderTitle': { fontWeight: 'bold' },
          '& .MuiDataGrid-toolbarContainer': {
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: '#424242 !important',
          },
          
        }}
        slots={{ 
          columnMenu: CustomColumnMenu, 
          footer: CustomFooter, 
          noRowsOverlay: NoRowsOverlay,
        }}
        slotProps={{ 
          footer: { contactId: selectedContactId } as CustomFooterProps,
          toolbar: {
            showQuickFilter: true,
            // Hides the Columns button from the default toolbar layout
            printOptions: { disableToolbarButton: true },
             style: { backgroundColor: '#e0e0e0' },
          }
        }}
      />

      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Confirm Deletion</DialogTitle>
        <DialogContent><DialogContentText>Permanently delete this voicemail?</DialogContentText></DialogContent>
        <DialogActions sx={{ pb: 2, px: 3 }}>
          <Button onClick={() => setDeleteDialogOpen(false)} color="inherit">Cancel</Button>
          <Button color="error" variant="contained" disabled={isDeleting} onClick={confirmDelete}>
            {isDeleting ? <CircularProgress size={24} color="inherit" /> : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};