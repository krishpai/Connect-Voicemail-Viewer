import React, { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { apiRequest } from "../authConfig";
import { 
  DataGrid, 
  type GridColDef, 
  GridFooterContainer, 
  GridFooter, 
  type GridRowSelectionModel, 
  GridColumnMenu, 
  type GridColumnMenuProps,
  
} from '@mui/x-data-grid';
import { 
  Tooltip, 
  IconButton, 
  Dialog, 
  DialogActions, 
  DialogContent, 
  DialogContentText, 
  DialogTitle, 
  Button, 
  CircularProgress 
} from '@mui/material';

import MailOutlineIcon from '@mui/icons-material/MailOutline';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PhoneIcon from '@mui/icons-material/Phone';
import DeleteIcon from '@mui/icons-material/Delete';
import TranscriptPopup from './TranscriptPopup'; 
import { useAcquireTokenWithRecovery } from "../hooks/useAcquireTokenWithRecovery";

const API_ENDPOINT_ENTRA_AUTH = import.meta.env.VITE_API_URL_ENTRA_AUTH;
const API_ENDPOINT_CONNECT_AUTH = import.meta.env.VITE_API_URL_CONNECT_AUTH;

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

const isIframe = window.self !== window.top;

/**
 * STABLE COMPONENT REFERENCES
 * Defining these outside the main component prevents the infinite re-render loop.
 */
type CustomFooterProps = React.HTMLAttributes<HTMLDivElement> & {
  contactId?: string | null;
};

const CustomFooter = (props: CustomFooterProps) => {
  // We destructure contactId and pull out everything else to pass to the container
  const { contactId, ...other } = props;

  return (
    <GridFooterContainer 
      {...other} // This spreads the MUI internal props (sx, className, etc.)
      sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
    >
      <div style={{ paddingLeft: '16px', fontSize: '0.875rem', color: '#666', fontWeight: 500 }}>
        {contactId ? `Selected Contact ID: ${contactId}` : 'No row selected'}
      </div>
      <GridFooter />
    </GridFooterContainer>
  );
};

const CustomColumnMenu = (props: GridColumnMenuProps) => {
  return (
    <GridColumnMenu
      {...props}
      slots={{
        columnMenuHideColumnItem: null,
        // Removes 'Manage Columns' (naming convention 1)
        columnMenuManageColumnsItem: null,
        // Removes 'Manage Columns' (naming convention 2 - very common in v7)
        columnMenuColumnsItem: null,      
      }}
    />
  );
};

const NoRowsOverlay = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'gray' }}>
    No matching recordings found.
  </div>
);

export const SearchResultsView: React.FC<SearchResultsViewProps> = ({ searchResult, userName, entraAuth, vmx3Admin, onDialNumberClicked }) => {
  const [gridRows, setGridRows] = useState<GridRow[]>([]);
  const acquireTokenWithRecovery = useAcquireTokenWithRecovery();
  
  const [rowSelectionModel, setRowSelectionModel] = useState<GridRowSelectionModel>({
    type: 'include',
    ids: new Set()
  });

  const playingAudioRef = useRef<HTMLAudioElement | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ id: string, fileName: string } | null>(null);

  const [paginationModel, setPaginationModel] = useState({
    pageSize: 10,
    page: 0,
  });

  // Calculate selected ID - uses Set iterator for v7+ compatibility
  const selectedContactId = useMemo(() => {
    const selectionIds = rowSelectionModel.ids;
    if (!selectionIds || selectionIds.size === 0) return null;
    const firstId = selectionIds.values().next().value;
    const selectedRow = gridRows.find((row) => row.id === firstId);
    return selectedRow ? selectedRow.vmx3_contact_id : null;
  }, [rowSelectionModel, gridRows]);

  const handleAudioPlay = useCallback((e: React.SyntheticEvent<HTMLAudioElement>) => {
    const currentAudio = e.currentTarget;
    if (playingAudioRef.current && playingAudioRef.current !== currentAudio) {
      playingAudioRef.current.pause();
    }
    playingAudioRef.current = currentAudio;
  }, []);

  const parsedData = useMemo(() => {
    if (!searchResult) return [];
    try {
      const searchResultObj = JSON.parse(searchResult);
      const rawData: Record<string, MatchedObject> = searchResultObj.matched_objects || {};
      const loggedInUser = userName ?? "User";
      
      return Object.entries(rawData).map(([fileName, details]) => {
        const item = { ...details };
        if (item.vmx3_target === "agent" && item.vmx3_preferred_agent.toLowerCase() === loggedInUser.toLowerCase()) {
          item.vmx3_queue_name = "Self";
        }
        return {
          id: item.vmx3_contact_id,
          fileName: fileName,
          ...item
        };
      });
    } catch (error) {
      console.error("Failed to parse searchResult JSON:", error);
      return [];
    }
  }, [searchResult, userName]);

  useEffect(() => {
    setGridRows(parsedData);
  }, [parsedData]);

  const DialCustomer = useCallback((customerNumber: string) => {
    if (customerNumber) {
      onDialNumberClicked(customerNumber);
    }
  }, [onDialNumberClicked]);

  const handleMarkAsRead = useCallback(async (contactId: string, fileName: string) => {
    setGridRows(prevRows =>
      prevRows.map(row => row.id === contactId ? { ...row, vmx3_unread: 'N' } : row)
    );
    
    const apiUrl = entraAuth
      ? `${API_ENDPOINT_ENTRA_AUTH}?function_code=mark_voice_message_read&vmx3_file_name=${fileName}`
      : `${API_ENDPOINT_CONNECT_AUTH}?function_code=mark_voice_message_read&vmx3_file_name=${fileName}`;

    try {
      let accessToken = "None";
      if(entraAuth) {
        const authResult = await acquireTokenWithRecovery({ ...apiRequest });
        if (authResult?.accessToken) accessToken = authResult.accessToken;
      }
      await fetch(apiUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
    } catch (error) {
      console.error("API Error marking as read:", error);
    }
  }, [entraAuth, acquireTokenWithRecovery]);

  const handleOpenDeleteDialog = useCallback((contactId: string, fileName: string) => {
    setItemToDelete({ id: contactId, fileName: fileName });
    setDeleteDialogOpen(true);
  }, []);

  const handleCloseDeleteDialog = () => {
    if (isDeleting) return; 
    setDeleteDialogOpen(false);
    setItemToDelete(null);
  };
  
  const confirmDelete = useCallback(async () => {
    if (!itemToDelete) return;
    const { id: contactId, fileName } = itemToDelete;
    setIsDeleting(true);

    const apiUrl = entraAuth 
      ? `${API_ENDPOINT_ENTRA_AUTH}?function_code=delete_voice_message&vmx3_file_name=${fileName}`
      : `${API_ENDPOINT_CONNECT_AUTH}?function_code=delete_voice_message&vmx3_file_name=${fileName}`;

    try {
      let accessToken = "None";
      if (entraAuth) {
        const authResult = await acquireTokenWithRecovery({ ...apiRequest });
        if (authResult?.accessToken) accessToken = authResult.accessToken;
      }
      const response = await fetch(apiUrl, { method: 'GET', headers: { Authorization: `Bearer ${accessToken}` } });
      if (!response.ok) throw new Error("Failed to delete");
      setGridRows(prevRows => prevRows.filter(row => row.id !== contactId));
      setDeleteDialogOpen(false);
    } catch (error) {
      console.error("API Error deleting voicemail:", error);
    } finally {
      setIsDeleting(false);
    }
  }, [itemToDelete, entraAuth, acquireTokenWithRecovery]);

  const columns = useMemo<GridColDef<GridRow>[]>(() => [
    { field: 'id', headerName: 'Contact ID', width: 150, hideable: false },
    {
      field: 'vmx3_unread',
      headerName: '',
      width: 80,
      hideable: false,
      renderCell: (params) => (
        <Tooltip title={params.row.vmx3_unread === 'Y' ? "Unread" : "Played"}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            {params.row.vmx3_unread === 'Y' ? <MailOutlineIcon color="primary" /> : <CheckCircleIcon color="action" />}
          </div>
        </Tooltip>
      )
    },
    {
      field: 'vmx3_timestamp',
      headerName: 'Date',
      headerAlign: 'center',
      width: 200,
      hideable: false,
      valueFormatter: (value: string) => {
        if (!value) return '';
        const date = new Date(value);
        return `${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} at ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}`;
      },
    },
    {
      field: 'vmx3_queue_name',
      headerName: 'Queue',
      headerAlign: 'center',
      align: 'center',
      width: 210,
      hideable: false,
      valueGetter: (value) => (value === 'VMX3_VM_QUEUE' ? 'Self' : value),
    },
    { field: 'vmx3_customer_number', headerName: 'Caller number', width: 140, hideable: false },
    { field: 'vmx3_dialed_number', headerAlign: 'center', headerName: 'Dialed number', width: 130, hideable: false },
    { field: 'vmx3_lang_value', headerAlign: 'center', align: 'center', headerName: 'Language', width: 100, hideable: false },
    {
      field: 'presigned_url',
      headerName: 'Listen',
      headerAlign: 'center',
      width: 280,
      hideable: false,
      renderCell: (params) => (
        <div style={{ display: 'flex', alignItems: 'center', height: '100%' }}>
          <audio
            controls
            src={params.value}
            onPlay={handleAudioPlay}
            onEnded={() => {
              handleMarkAsRead(params.row.vmx3_contact_id, params.row.fileName);
              playingAudioRef.current = null;
            }}
            style={{ 
              height: '24px',      // Shorter than your previous 30px
              width: '250px',      // Narrower than default
              transform: 'scale(0.9)', // Optional: shrinks the whole widget proportionally
              outline: 'none' 
            }}
          >
            Your browser does not support audio.
          </audio>
        </div>
      )
    },   
    {
      field: 'transcript',
      headerName: 'Transcript',
      align: 'center',
      headerAlign: 'center',
      width: 90,
      sortable: false,
      hideable: false,
      renderCell: (params) => (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', width: '100%' }}>
          <TranscriptPopup text={params.value ?? ""} />
        </div>
      ),
    },
    {
      field: 'dial_action',
      headerName: 'Call back',
      headerAlign: 'center',
      align: 'center',
      width: 80,
      sortable: false,
      hideable: isIframe,
      renderCell: (params) => (
        <Tooltip title={`Call ${params.row.vmx3_customer_number}`}>
          <IconButton color="primary" size="small" onClick={() => DialCustomer(params.row.vmx3_customer_number)}>
            <PhoneIcon />
          </IconButton>
        </Tooltip>
      )
    },
    {
      field: 'delete_action',
      headerName: '',
      align: 'center',
      width: 70,
      sortable: false,
      hideable: false,
      renderCell: (params) => {
        const canDelete = vmx3Admin === 'Y' || params.row.vmx3_queue_name === 'Self';
        if (!canDelete) return null;
        return (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <Tooltip title="Delete Voicemail">
              <IconButton size="small" onClick={() => handleOpenDeleteDialog(params.row.vmx3_contact_id, params.row.fileName)}>
                <DeleteIcon />
              </IconButton>
            </Tooltip>
          </div>
        );
      }
    }
  ], [handleMarkAsRead, DialCustomer, vmx3Admin, handleOpenDeleteDialog, handleAudioPlay]);

  if (!searchResult) {
    return <div style={{ padding: '40px', textAlign: 'center', color: '#666', fontSize: '1.1rem' }}>No search performed.</div>;
  }

  return (
    <div style={{ height: 600, width: '100%', paddingTop: '20px' }}>
      <DataGrid
        key={gridRows.length}
        rows={gridRows}
        columns={columns}
        rowHeight={65}
        paginationModel={paginationModel}
        onPaginationModelChange={setPaginationModel}
        pageSizeOptions={[5, 10, 25]}
        rowSelectionModel={rowSelectionModel}
        onRowSelectionModelChange={(newModel) => setRowSelectionModel(newModel)}
        hideFooterSelectedRowCount
        disableMultipleRowSelection
        initialState={{
          columns: {
            columnVisibilityModel: { id: false, dial_action: isIframe, transcript: true },
          },
        }}
          
        sx={{
          '& .MuiDataGrid-columnHeader': { backgroundColor: '#2e2c2c33 !important', color: 'black !important' },
          '& .MuiDataGrid-columnHeaderTitle': { fontWeight: 'bold !important', fontSize: '0.9rem',  letterSpacing: '0.02em',},
          '& .MuiTablePagination-selectLabel': { margin: 0, lineHeight: 'inherit', alignSelf: 'center' },
          '& .MuiTablePagination-displayedRows': { margin: 0, alignSelf: 'center' },
          '& .MuiTablePagination-actions': { margin: 0 },
          '& .MuiTablePagination-select': { display: 'flex', alignItems: 'center', paddingTop: 0, paddingBottom: 0 },
          '& .MuiTablePagination-toolbar': { display: 'flex', alignItems: 'center', minHeight: '52px' },
          '& .MuiDataGrid-footerContainer': { borderTop: '1px solid rgba(224, 224, 224, 1)' }
        }}
        slots={{
          columnMenu: CustomColumnMenu,
          footer: CustomFooter,
          noRowsOverlay: NoRowsOverlay,
        }}
        slotProps={{
          footer: {
            contactId: selectedContactId,
          } as CustomFooterProps
        }}
      />
      
      <Dialog open={deleteDialogOpen} onClose={handleCloseDeleteDialog}>
        <DialogTitle>Confirm Deletion</DialogTitle>
        <DialogContent>
          <DialogContentText>Permanently delete this voicemail? This action cannot be undone.</DialogContentText>
        </DialogContent>
        <DialogActions sx={{ pb: 2, px: 3 }}>
          <Button onClick={handleCloseDeleteDialog} color="inherit" disabled={isDeleting}>Cancel</Button>
          <Button 
            onClick={confirmDelete} 
            color="error" 
            variant="contained" 
            disabled={isDeleting}
            startIcon={isDeleting ? <CircularProgress size={20} color="inherit" /> : null}
          >
            {isDeleting ? "Deleting..." : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};