import React, { useMemo, useState, useEffect, useCallback } from "react";
import { apiRequest } from "../authConfig";
import { useMsal } from "@azure/msal-react";
import { InteractionRequiredAuthError } from "@azure/msal-browser";
import { DataGrid, type GridColDef } from '@mui/x-data-grid';
import Tooltip from '@mui/material/Tooltip';
import MailOutlineIcon from '@mui/icons-material/MailOutline';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

const API_ENDPOINT = import.meta.env.VITE_API_URL;

interface SearchResultsViewProps {
  searchResult: string | null;
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

export const SearchResultsView: React.FC<SearchResultsViewProps> = ({ searchResult }) => {
  const { instance, accounts } = useMsal();
  const [gridRows, setGridRows] = useState<GridRow[]>([]);

  // 1. PARSE SEARCH RESULTS
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

  // 2. SYNC PARSED DATA TO STATE
  useEffect(() => {
    setGridRows(parsedData);
  }, [parsedData]);

  // 3. UPDATER FUNCTION
  const handleMarkAsRead = useCallback(async (contactId: string, fileName: string) => {
    // Optimistically update the UI
    setGridRows(prevRows =>
      prevRows.map(row =>
        row.id === contactId ? { ...row, vmx3_unread: 'N' } : row
      )
    );

    const apiUrl = `${API_ENDPOINT}?function_code=mark_voice_message_read&vmx3_file_name=${fileName}`;

    try {
      const authResult = await instance.acquireTokenSilent({
        ...apiRequest,
        account: accounts[0],
      });

      const response = await fetch(apiUrl, {
        headers: { Authorization: `Bearer ${authResult.accessToken}` }
      });
      await response.json();
    } catch (error) {
      if (error instanceof InteractionRequiredAuthError) {
        instance.acquireTokenRedirect(apiRequest);
      } else {
        console.error("API Error marking as read:", error);
      }
    }
  }, [accounts, instance]);

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
  ], [handleMarkAsRead]);

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
            columnVisibilityModel: { id: false },
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