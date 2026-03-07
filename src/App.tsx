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

import { AmazonConnectApp } from '@amazon-connect/app';
import { AgentClient } from "@amazon-connect/contact";


import "./App.css";

const API_ENDPOINT = import.meta.env.VITE_API_URL;

function App() {
  const { instance, accounts } = useMsal();
  const [searchResult, setSearchResult] = useState("");
  const [region, setRegion] = useState("");
  const [loading, setLoading] = useState<boolean>(false);
  const [_connectProvider, setConnectProvider] = useState<AmazonConnectApp | null>(null);
  const [_contactId, setContactId] = useState<string | null>(null);

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

    const initConnect = async () => {
      try {
        // Await the initialization
        const { provider } = AmazonConnectApp.init({
          onCreate: async (event) => {
            console.log('************ App initialized with context:', event.context);
            
            if (event.context.scope && "contactId" in event.context.scope) {
              // You can also set specific context data to state here
              setContactId(event.context.scope.contactId);
            }
          },
          onDestroy: async (event) => {
            console.log('App being destroyed:', event);
          },
        });

        // Save the provider to state so you can use it globally in your app
        setConnectProvider(provider);
        console.log("***************After Provider successfully established.");

        // Create an Agent Client using the provider
        const agentClient = new AgentClient({ provider });
        const name = await agentClient.getName();
        console.log("***************After agentClient.getName()");
        console.log("Agent Name:", name);

        const agentARN = await agentClient.getARN();
        console.log("Agent ARN:", agentARN);
        console.log("***************After agentClient.getARN()");
        

        // Extract user ID from ARN
        // ARN format: arn:aws:connect:region:account:instance/instance-id/agent/user-id
        const userIdMatch = agentARN.match(/\/agent\/(.+)$/);
        const userId = userIdMatch ? userIdMatch[1] : null;
  
  console.log("User ID:", userId);

      } catch (error) {
        console.error("Failed to initialize Amazon Connect SDK", error);
      }
    };
    
    initConnect();

  }, [accounts, instance, getUserRegion, accounts.length]);

  //console.log("Session keys:", (sessionStorage));

  return (
    <>
      <MsalAuthenticationTemplate interactionType={InteractionType.Redirect}
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
