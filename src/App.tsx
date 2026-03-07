import { useEffect, useState, useCallback } from "react";
import { MsalAuthenticationTemplate } from "@azure/msal-react";
import { InteractionType } from "@azure/msal-browser";
import { useMsal } from "@azure/msal-react";
import { PageLayout } from "./components/PageLayout";
import { SearchBox } from "./components/SearchBox";
import { SearchResultsView } from "./components/SearchResultsView";
import { apiRequest } from "./authConfig";
import { InteractionRequiredAuthError } from "@azure/msal-browser";
import Divider  from '@mui/material/Divider';

import "./App.css";

const API_ENDPOINT = import.meta.env.VITE_API_URL;

function App() {
  const { instance, accounts } = useMsal();
  const [searchResult, setSearchResult] = useState("");
  const [region, setRegion] = useState("");
  const [loading, setLoading] = useState<boolean>(false);

  const account = accounts[0];
  const claims = account?.idTokenClaims;

  const searchResultChange = (value: string) =>
  {
    setSearchResult(value);
  }

  /**
   * Fetches the user region from the backend API.
   */
  const getUserRegion = useCallback(async () => {
      
      if (accounts.length === 0) return;

      const currentAccount = accounts[0];
      const username = currentAccount.idTokenClaims?.preferred_username;

      if (!username) 
      {
        console.warn("No preferred_username found in claims.");
        return;
      }

      const apiUrl = `${API_ENDPOINT}?function_code=get_region_of_user&AgentUserName=${encodeURIComponent(username)}`;

      try 
      {
        setLoading(true);

        const authResult = await instance.acquireTokenSilent({
          ...apiRequest,
          account: currentAccount,
        });

        // 4. Call the API
        const response = await fetch(apiUrl, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${authResult.accessToken}`,
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) 
        {
          throw new Error(`API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();

        // 5. Update State based on API logic (success and found > 0)
        if (data && data.success && data.found) 
        {
          setRegion(data.region);
          console.log("User region identified:", data.region);
        }
      } 
      catch (error) 
      {
        // 6. Handle MSAL Interaction Requirement
        if (error instanceof InteractionRequiredAuthError) 
        {
          instance.acquireTokenRedirect(apiRequest);
        } 
        else 
        {
          console.error("Failed to fetch user region:", error);
        }
      } 
      finally 
      {
        setLoading(false);
      }
    }, [instance, accounts]);


  useEffect(() => {
    //Ensure MSAL knows which account is active
    const currentAccount = accounts[0];
    if (!instance.getActiveAccount()) {
      instance.setActiveAccount(currentAccount);
    }

    if (accounts.length > 0) {
      getUserRegion();
    }
  }, [accounts, instance, getUserRegion, accounts.length]);

  //console.log("Session keys:", (sessionStorage));

  return (
    <>
      <MsalAuthenticationTemplate interactionType={InteractionType.Popup}
        authenticationRequest={{
          scopes: ["openid", "profile", "api://c1b01858-bb4d-4855-b870-ab24df705688/access_as_user"],
        }}
        errorComponent={({ error }) => <pre>Error: {error?.errorMessage}</pre>}
        loadingComponent={() => <span>Launching Login redirect...</span>}>
          {account && (
            <PageLayout userName={claims?.preferred_username ?? "Unknown User"}>
              {loading ? (<p>Loading user preferences...</p>) : 
                (
                  <>
                    <SearchBox  region={region}  onSearchResultChange={searchResultChange} />
                    <Divider sx={{ border: "2px solid", borderColor: "primary.dark" }} />
                    {searchResult && (<SearchResultsView searchResult={searchResult} />)}
                  </>
                )
              }
            </PageLayout>
          )}      
      </MsalAuthenticationTemplate>
    </>
  );
}

export default App;
