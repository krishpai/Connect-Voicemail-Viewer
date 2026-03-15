import React, { useMemo, useState, useEffect, useCallback } from "react";
import { apiRequest } from "../authConfig";
import { DataGrid, type GridColDef } from '@mui/x-data-grid';
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

interface SearchResultsViewProps 
{
  searchResult: string | null;
  entraAuth: boolean;
  userName: string | null | undefined;
  vmx3Admin: string | null | undefined;
  onDialNumberClicked: (value: string) => void;
}

interface MatchedObject 
{
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
  presigned_url: string;
}

interface GridRow extends MatchedObject 
{
  id: string;
  fileName: string;
  
}


const isIframe = window.self !== window.top; // Immediate check

export const SearchResultsView: React.FC<SearchResultsViewProps> = ({ searchResult, userName, entraAuth, vmx3Admin, onDialNumberClicked }) => {
  const [gridRows, setGridRows] = useState<GridRow[]>([]);
  const acquireTokenWithRecovery = useAcquireTokenWithRecovery();
  
   // MODAL & LOADING STATE
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ id: string, fileName: string } | null>(null);

  
  // PARSE SEARCH RESULTS
  const parsedData = useMemo(() => {
    if (!searchResult) return [];

    try 
    {
      const searchResultObj = JSON.parse(searchResult);
      const rawData: Record<string, MatchedObject> = searchResultObj.matched_objects || {};
      const loggedInUser = userName ?? "User";
      
      Object.values(rawData).forEach((item) => {
        if (item.vmx3_target === "agent" && item.vmx3_preferred_agent === loggedInUser) 
        {
          item.vmx3_queue_name = "Self";
        }
      });
      

      console.log("Current User from Props: " + loggedInUser);


      return Object.entries(rawData).map(([fileName, details]) => ({
        id: details.vmx3_contact_id,
        fileName: fileName,
        ...details
      }));
    } catch (error) {
      console.error("Failed to parse searchResult JSON:", error);
      return [];
    }
  }, [searchResult, userName]);

  // SYNC PARSED DATA TO STATE
  useEffect(() => {
    setGridRows(parsedData);
  }, [parsedData]);

  // DIAL FUNCTION
  const DialCustomer = useCallback((customerNumber: string) => {
    if (customerNumber) {
      console.log(`Dialing: ${customerNumber}`);
      onDialNumberClicked(customerNumber);
    }
  }, [onDialNumberClicked]);

  // UPDATER FUNCTION
  const handleMarkAsRead = useCallback(async (contactId: string, fileName: string) => {
    // Optimistically update the UI
    setGridRows(prevRows =>
      prevRows.map(row =>
        row.id === contactId ? { ...row, vmx3_unread: 'N' } : row
      )
    );
    
    let apiUrl;
    if(entraAuth)
      apiUrl = `${API_ENDPOINT_ENTRA_AUTH}?function_code=mark_voice_message_read&vmx3_file_name=${fileName}`;
    else
      apiUrl = `${API_ENDPOINT_CONNECT_AUTH}?function_code=mark_voice_message_read&vmx3_file_name=${fileName}`;

    try 
    {
      let accessToken = "None";

      if(entraAuth)
      {
        const authResult = await acquireTokenWithRecovery({ ...apiRequest });
        if (!authResult?.accessToken) 
        {
          throw new Error("Failed to acquire a valid access token.");
        }
        accessToken = authResult.accessToken;
      }

      const response = await fetch(apiUrl, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      await response.json();
    }
    catch (error) 
    {
      console.error("API Error marking as read:", error);
    }
  }, [entraAuth, acquireTokenWithRecovery]);

  // DELETE MODAL HANDLERS
  const handleOpenDeleteDialog = useCallback((contactId: string, fileName: string) => {
    setItemToDelete({ id: contactId, fileName: fileName });
    setDeleteDialogOpen(true);
  }, []);

  const handleCloseDeleteDialog = () => {
    if (isDeleting) return; 
    setDeleteDialogOpen(false);
    setItemToDelete(null);
  };
  
  // DELETE FUNCTION
  const confirmDelete = useCallback(async () => {
    if (!itemToDelete) return;
    const { id: contactId, fileName } = itemToDelete;

    setIsDeleting(true);

    const apiUrl = entraAuth 
      ? `${API_ENDPOINT_ENTRA_AUTH}?function_code=delete_voice_message&vmx3_file_name=${fileName}`
      : `${API_ENDPOINT_CONNECT_AUTH}?function_code=delete_voice_message&vmx3_file_name=${fileName}`;

    try 
    {
      let accessToken = "None";
      if (entraAuth) {
        const authResult = await acquireTokenWithRecovery({ ...apiRequest });
        if (!authResult?.accessToken) 
        {
          throw new Error("Failed to acquire a valid access token.");
        }
        accessToken = authResult.accessToken;
      }

      const response = await fetch(apiUrl, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      if (!response.ok) throw new Error("Failed to delete");

      setGridRows(prevRows => prevRows.filter(row => row.id !== contactId));
      setDeleteDialogOpen(false);
      setItemToDelete(null);
    }
    catch (error) 
    {
      console.error("API Error deleting voicemail:", error);
      alert("Failed to delete voicemail. Please try again.");
    }
    finally 
    {
      setIsDeleting(false);
    }
  }, [itemToDelete, entraAuth, acquireTokenWithRecovery ]);

  


  // 4. COLUMNS DEFINITION
  const columns = useMemo<GridColDef<GridRow>[]>(() => [
    { field: 'id', headerName: 'Contact ID', width: 150 },
    {
      field: 'vmx3_unread',
      headerName: '',
      width: 80,
      renderCell: (params) => {
        const isNew = params.row.vmx3_unread === 'Y';
        return (
          <Tooltip title={isNew ? "Unread" : "Played"}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              {isNew ? <MailOutlineIcon color="primary" /> : <CheckCircleIcon color="action" />}
            </div>
          </Tooltip>
        );
      }
    },
    {
      field: 'vmx3_timestamp',
      headerName: 'Date',
      headerAlign: 'center',
      width: 200,
      valueFormatter: (value: string) => {
        if (!value) return '';
        const date = new Date(value);
        const datePart = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const timePart = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
        return `${datePart} at ${timePart}`;
      },
    },
    {
      field: 'vmx3_queue_name',
      headerName: 'Queue',
      headerAlign: 'center',
      width: 210,
      // Logic to show 'Self' instead of 'VMX3_VM_QUEUE'
      valueGetter: (value) => (value === 'VMX3_VM_QUEUE' ? 'Self' : value),
    },
    { field: 'vmx3_customer_number', headerName: 'Customer Phone', width: 132 },
    { field: 'vmx3_dialed_number', headerAlign: 'center', headerName: 'Dialed number', width: 130 },
    { field: 'vmx3_lang_value', headerAlign: 'center', align: 'center', headerName: 'Language', width: 100 },
    {
      field: 'presigned_url',
      headerName: 'Listen',
      headerAlign: 'center',
      width: 320,
      renderCell: (params) => (
        <div style={{ display: 'flex', alignItems: 'center', height: '100%' }}>
          <audio
            controls
            src={params.value}
            onEnded={() => handleMarkAsRead(params.row.vmx3_contact_id, params.row.fileName)}
            style={{ height: '30px', outline: 'none' }}
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
      width: 100,
      sortable: false, // Usually best to disable sorting on long text icons
      renderCell: (params) => (
        /* We wrap the component in a flex container 
          to ensure vertical and horizontal centering 
        */
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
      renderCell: (params) => {
        const canDelete = vmx3Admin === 'Y';
        if (!canDelete) return null;

        return (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <Tooltip title="Delete Voicemail">
              <IconButton 
                color="default" 
                size="small"
                onClick={() => handleOpenDeleteDialog(params.row.vmx3_contact_id, params.row.fileName)}
              >
                <DeleteIcon />
              </IconButton>
            </Tooltip>
          </div>
        );
      }
    }
  ], [handleMarkAsRead, DialCustomer, vmx3Admin, handleOpenDeleteDialog ]);

  if (!searchResult) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#666', fontSize: '1.1rem' }}>
        No search performed. Enter criteria above to see results.
      </div>
    );
  }

  return (
    <div style={{ height: 600, width: '100%', paddingTop: '20px' }}>
      <DataGrid
        rows={gridRows}
        columns={columns}
        rowHeight={65}
        initialState={{
          pagination: { paginationModel: { pageSize: 10 } },
          columns: {
            columnVisibilityModel: { id: false, dial_action:isIframe  },
          },
        }}
        sx={{
          '& .MuiDataGrid-columnHeader': {
            backgroundColor: '#2e2c2c33 !important',
            color: 'black !important',
          },
          '& .MuiDataGrid-columnHeaderTitle': { fontWeight: 'bold' },
        }}
        slots={{
          noRowsOverlay: () => (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'gray' }}>
              No matching recordings found.
            </div>
          ),
        }}
      />
      {/* DELETE CONFIRMATION DIALOG */}
      <Dialog
        open={deleteDialogOpen}
        onClose={handleCloseDeleteDialog}
        aria-labelledby="delete-dialog-title"
      >
        <DialogTitle id="delete-dialog-title">Confirm Deletion</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to permanently delete this voicemail? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ pb: 2, px: 3 }}>
          <Button onClick={handleCloseDeleteDialog} color="inherit" disabled={isDeleting}>
            Cancel
          </Button>
          <Button 
            onClick={confirmDelete} 
            color="error" 
            variant="contained" 
            autoFocus
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