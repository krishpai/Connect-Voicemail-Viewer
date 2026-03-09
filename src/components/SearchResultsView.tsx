import React, { useMemo, useState, useEffect, useCallback } from "react";
import { apiRequest } from "../authConfig";
import { useMsal } from "@azure/msal-react";
import { InteractionRequiredAuthError } from "@azure/msal-browser";
import { DataGrid, type GridColDef } from '@mui/x-data-grid';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import MailOutlineIcon from '@mui/icons-material/MailOutline';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PhoneIcon from '@mui/icons-material/Phone';
const API_ENDPOINT_ENTRA_AUTH = import.meta.env.VITE_API_URL_ENTRA_AUTH;
const API_ENDPOINT_CONNECT_AUTH = import.meta.env.VITE_API_URL_CONNECT_AUTH;


interface SearchResultsViewProps {
  searchResult: string | null;
  entraAuth: boolean;
}

interface MatchedObject {
  vmx3_unread?: string;
  vmx3_contact_id: string;
  vmx3_customer_number: string;
  vmx3_queue_arn: string;
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

interface GridRow extends MatchedObject {
  id: string;
  fileName: string;
}

export const SearchResultsView: React.FC<SearchResultsViewProps> = ({ searchResult, entraAuth }) => {
  const { instance, accounts } = useMsal();
  const [gridRows, setGridRows] = useState<GridRow[]>([]);
  
  // DETECT IF RUNNING IN IFRAME
  const isIframe = useMemo(() => {
    try {
      return window.self !== window.top;
    } catch (e) {
      // If cross-origin restrictions block access to window.top, it's definitely an iframe
      console.log(e);
      return true;
    }
  }, []);

  // PARSE SEARCH RESULTS
  const parsedData = useMemo(() => {
    if (!searchResult) return [];

    try {
      const searchResultObj = JSON.parse(searchResult);
      const rawData: Record<string, MatchedObject> = searchResultObj.matched_objects || {};

      return Object.entries(rawData).map(([fileName, details]) => ({
        id: details.vmx3_contact_id,
        fileName: fileName,
        ...details
      }));
    } catch (error) {
      console.error("Failed to parse searchResult JSON:", error);
      return [];
    }
  }, [searchResult]);

  // SYNC PARSED DATA TO STATE
  useEffect(() => {
    setGridRows(parsedData);
  }, [parsedData]);

  // DIAL FUNCTION
  const DialCustomer = useCallback((customerNumber: string) => {
    if (customerNumber) {
      console.log(`Dialing: ${customerNumber}`);
      //window.location.href = `tel:${customerNumber}`;
    }
  }, []);

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

      if(!isIframe)
      {
        const authResult = await instance.acquireTokenSilent({
          ...apiRequest,
          account: accounts[0],
        });
        accessToken = authResult.accessToken;
      }

      const response = await fetch(apiUrl, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      await response.json();
    } catch (error) {
      if (error instanceof InteractionRequiredAuthError) {
        instance.acquireTokenRedirect(apiRequest);
      } else {
        console.error("API Error marking as read:", error);
      }
    }
  }, [accounts, instance, entraAuth, isIframe]);

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
      field: 'vmx3_queue',
      headerName: 'Queue',
      headerAlign: 'center',
      align: 'center',
      width: 180,
      // Logic to show 'Self' instead of 'VMX3_VM_QUEUE'
      valueGetter: (value) => (value === 'VMX3_VM_QUEUE' ? 'Self' : value),
    },
    { field: 'vmx3_customer_number', headerName: 'Customer Phone', width: 132 },
    {
      field: 'dial_action',
      headerName: 'Dial',
      width: 80,
      sortable: false,
      renderCell: (params) => (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
          <Tooltip title={`Call ${params.row.vmx3_customer_number}`}>
            <IconButton 
              color="primary" 
              onClick={() => DialCustomer(params.row.vmx3_customer_number)}
              size="small"
            >
              <PhoneIcon />
            </IconButton>
          </Tooltip>
        </div>
      )
    },
    { field: 'vmx3_dialed_number', headerAlign: 'center', headerName: 'Dialed number', width: 130 },
    { field: 'vmx3_lang_value', headerAlign: 'center', align: 'center', headerName: 'Language', width: 100 },
    {
      field: 'presigned_url',
      headerName: '',
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
    }
  ], [handleMarkAsRead, DialCustomer]);

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
            columnVisibilityModel: { id: false  },
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
    </div>
  );
};