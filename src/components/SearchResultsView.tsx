import React, { useMemo, useState, useEffect, useCallback } from "react";
import { apiRequest } from "../authConfig";
import { useMsal} from "@azure/msal-react";
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
  vmx3_unread?: string; // This is the field we will update to 'N'
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

/**
 * COMPONENT
 */
export const SearchResultsView: React.FC<SearchResultsViewProps> = ({ searchResult }) => {
  
  const { instance, accounts } = useMsal();

  // 1. STATE TO HOLD ROWS
  const [gridRows, setGridRows] = useState<GridRow[]>([]);
  

  // 2. PARSE SEARCH RESULTS: Use useMemo to safey parse data based on prop changes
  const parsedData = useMemo(() => {
    if (!searchResult) {
      return [];
    }

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

  // 3. SYNC PARSED DATA TO STATE: Safe place to update state based on prop changes
  useEffect(() => {
    setGridRows(parsedData);
  }, [parsedData]);

  // 4. UPDATER FUNCTION: Wrapped in useCallback to stabilize the reference
const handleMarkAsRead = useCallback(async (contactId: string, fileName: string) => {
      
      console.log(`Action: Marking ${contactId} as 'N', fileName ${fileName} `);
      
      // Update the row state directly
      setGridRows(prevRows => 
        prevRows.map(row => 
          row.id === contactId 
            ? { ...row, vmx3_unread: 'N' } // Update the value here
            : row
        )
      );
      
      const apiUrl = `${API_ENDPOINT}?function_code=mark_voice_message_read&vmx3_file_name=${fileName}`;

      try 
      {
        let accessToken = "";

        const authResult = await instance.acquireTokenSilent({
          ...apiRequest,
          account: accounts[0],
        });

        accessToken = authResult.accessToken;

        if (accessToken) 
        {
          console.log("Calling API:", apiUrl);
          console.log("accessToken:", accessToken);

          // Example Fetch call with the Token
          const response = await fetch(apiUrl, { headers: { Authorization: `Bearer ${accessToken}` }});
          const data = await response.json();
          
          let data_str = "";
          if(data && data.success)
          {
            data_str = data.success ? JSON.stringify(data): "";
            console.log("data_str:", data_str)
          }
        }
      } 
      catch (error) 
      {
        if (error instanceof InteractionRequiredAuthError) 
        {
            // Fall back to interactive method
            try 
            {
              await instance.acquireTokenRedirect(apiRequest);
            } 
            catch (error) 
            {
              console.error("Interactive authentication failed:", error);
          
            }
        } 
        else 
        {
          console.error("Authentication error:", error);
          
        }
      }
  
  }, [accounts, instance]); // Stable dependency array

  // 5. COLUMNS DEFINITION
  const columns = useMemo<GridColDef<GridRow>[]>(() => [
    { field: 'id', filterable: false, headerName: 'Contact ID', width: 150 },
    { 
      field: 'vmx3_unread', 
      filterable: false,
      headerName: '', 
      width: 80,
      renderCell: (params) => {
        // Look at the current data in the row, not just the initial render value
        const isNew = params.row.vmx3_unread === 'Y';
        
        return (
          <Tooltip title={isNew ? "Unread" : "Played"}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              {isNew ? (
                <MailOutlineIcon color="primary" />
              ) : (
                <CheckCircleIcon color="action" />
              )}
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

        // Format the Date part: Mar 2, 2026
        const datePart = date.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });

        // Format the Time part: 08:38:19 PM
        const timePart = date.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        });

        return `${datePart} at ${timePart}`;
      },
    },
    { field: 'vmx3_queue', headerAlign: 'center', align: 'center', headerName: 'Queue', width: 180 },
    { field: 'vmx3_customer_number', headerName: 'Customer Phone', width: 132 },
    { field: 'vmx3_dialed_number', headerAlign: 'center',headerName: 'Dialed number', width: 130 },
    { field: 'vmx3_lang_value',headerAlign: 'center', align: 'center', headerName: 'Language', width: 100 },
    { 
      field: 'presigned_url', 
      filterable: false,
      headerName: '', 
      headerAlign: 'center',
      width: 320,
      renderCell: (params) => {
        const onAudioComplete = () => {
          handleMarkAsRead(params.row.vmx3_contact_id, params.row.fileName);
        };

        return (
          <div style={{ display: 'flex', alignItems: 'center', height: '100%' }}>
            <audio 
              controls 
              src={params.value} 
              onEnded={onAudioComplete} 
              style={{ height: '30px', outline: 'none' }}
            >
              Your browser does not support audio.
            </audio>
          </div>
        );
      }
    }
  ], [handleMarkAsRead]); // Stable dependency

  // Early return if no results
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
        pageSizeOptions={[10]} 
        initialState={{
          pagination: { 
            paginationModel: { pageSize: 10 } 
          },
          // Ensure columnVisibilityModel is defined correctly or removed if unnecessary
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