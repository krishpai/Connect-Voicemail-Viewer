import React, { useState, useEffect } from "react";
import { useMsal } from "@azure/msal-react";
import { InteractionRequiredAuthError } from "@azure/msal-browser";
import { apiRequest } from "../authConfig";
import { DateRangeSelector } from "./DateRangeSelector";
import { VMCategory } from "./VMCategory";
import { LanguageSelection } from "./LanguageSelection";
import { Box, Stack, Typography, Button } from "@mui/material";

const API_ENDPOINT_ENTRA_AUTH = import.meta.env.VITE_API_URL_ENTRA_AUTH;
const API_ENDPOINT_CONNECT_AUTH = import.meta.env.VITE_API_URL_CONNECT_AUTH;

interface SearchBoxProps {
  region: string;
  entraAuth: boolean;
  onSearchResultChange: (value: string) => void;
}

export const SearchBox: React.FC<SearchBoxProps> = ({ region, entraAuth, onSearchResultChange }) => {
  const { instance, accounts } = useMsal();
  const account = accounts[0];
  const claims = account?.idTokenClaims;

  const [vmCategory, setVMCategory] = useState<string>("ALL");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [englishChecked, setEnglishChecked] = useState<string>("true");
  const [spanishChecked, setSpanishChecked] = useState<string>("false");
  const [searchFailed, setSearchFailed] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);

  const searchClicked = async () => {
    setLoading(true);
    setSearchFailed(false);

    const langParam = (englishChecked === "true" && spanishChecked === "true") 
      ? "ALL" 
      : (spanishChecked === "true") 
        ? "es-US" 
        : (englishChecked === "true") 
          ? "en-US" 
          : "";
          
    const preferred_agent = (vmCategory === "Self") ? (claims?.preferred_username ?? "") : "";
    
    let apiUrl;

    if(entraAuth)
      apiUrl = `${API_ENDPOINT_ENTRA_AUTH}?function_code=fetch_voice_messages&vmx3_region=${vmCategory}&vmx3_preferred_agent=${preferred_agent}&vmx3_lang_value=${langParam}&start_date=${startDate}&end_date=${endDate}`;
    else
      apiUrl = `${API_ENDPOINT_CONNECT_AUTH}?function_code=fetch_voice_messages&vmx3_region=${vmCategory}&vmx3_preferred_agent=${preferred_agent}&vmx3_lang_value=${langParam}&start_date=${startDate}&end_date=${endDate}`;
    
    console.log("apiUrl: " + apiUrl)

    try {
      const authResult = await instance.acquireTokenSilent({
        ...apiRequest,
        account: accounts[0],
      });

      const accessToken = authResult.accessToken;

      if (accessToken) {
        const response = await fetch(apiUrl, { 
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        const data = await response.json();
        
        if (data.success && data.matched_objects_count > 0) {
          onSearchResultChange(JSON.stringify(data));
        } else {
          setSearchFailed(true);
          onSearchResultChange("");
        }
      }
    } catch (error) {
      if (error instanceof InteractionRequiredAuthError) {
        try {
          await instance.acquireTokenRedirect(apiRequest);
        } catch (err) {
          console.error("Interactive authentication failed:", err);
        }
      } else {
        console.error("Authentication error:", error);
      }
      onSearchResultChange("");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (region) {
      setVMCategory(region);
    }
  }, [region]);

  return (
    <Box 
      sx={{ 
        width: "100%", 
        maxWidth: "1000px", // Limits the spread on ultra-wide monitors
        margin: "0 auto",   // Centers the entire component on the screen
        p: 3 
      }}
    >
      {/* Top Section: Input Controls 
        justifyContent="center" ensures equal space on left and right 
      */}
      <Stack 
        direction={{ xs: "column", md: "row" }} 
        spacing={4} 
        alignItems="flex-start" 
        justifyContent="center"
        sx={{ width: "100%", mb: 4 }}
      >
        <DateRangeSelector 
          onStartDateChange={(val) => setStartDate(val)} 
          onEndDateChange={(val) => setEndDate(val)} 
        />
        
        <VMCategory 
          region={region} 
          vmCategory={vmCategory} 
          onVMCategoryChange={(val) => setVMCategory(val)} 
        />
        
        <LanguageSelection 
          onEnglishChange={(val) => setEnglishChecked(val)} 
          onSpanishChange={(val) => setSpanishChecked(val)} 
        />
      </Stack>

      {/* Bottom Section: Action Button & Feedback 
      */}
      <Box 
        sx={{ 
          display: "flex", 
          flexDirection: "column", 
          alignItems: "center", 
          textAlign: "center" 
        }}
      >
        <Button 
          variant="contained" 
          size="large"
          onClick={searchClicked} 
          disabled={loading}
          sx={{ minWidth: "150px", borderRadius: "8px" }}
        >
          {loading ? "Fetching..." : "Retrieve Messages"}
        </Button>

        {loading && (
          <Typography sx={{ mt: 2, color: "text.secondary", fontStyle: "italic" }}>
            Please wait, communicating with server...
          </Typography>
        )}

        {!loading && searchFailed && (
          <Typography color="error" sx={{ mt: 2, fontWeight: 500 }}>
            No voice messages found for the selected criteria.
          </Typography>
        )}
      </Box>
    </Box>
  );
};