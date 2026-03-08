import { useEffect, useState, useCallback} from "react";
import { MsalAuthenticationTemplate } from "@azure/msal-react";
import { AmazonConnectApp } from '@amazon-connect/app';
import { AgentClient } from "@amazon-connect/contact";
import { PageLayout } from "./components/PageLayout";
import { SearchBox } from "./components/SearchBox";
import { SearchResultsView } from "./components/SearchResultsView";
import Divider  from '@mui/material/Divider';
import { InteractionType } from "@azure/msal-browser";
import { InteractionRequiredAuthError } from "@azure/msal-browser";
import { useMsal } from "@azure/msal-react";
import { apiRequest } from "./authConfig";

import "./App.css";

const API_ENDPOINT = import.meta.env.VITE_API_URL;
const isIframe = window.self !== window.top; // Immediate check

function App() {
  const { instance, accounts } = useMsal();
  const [_connectProvider, setConnectProvider] = useState<AmazonConnectApp | null>(null);
  const [_contactId, setContactId] = useState<string | null>(null);
  const [searchResult, setSearchResult] = useState("");
  const [region, setRegion] = useState("");
  const [loading, setLoading] = useState<boolean>(false);
  const [_connectUserId, setConnectUserId] = useState<string | null>(null);
  const [sdkInitialized, setSdkInitialized] = useState<boolean>(false);
  const account = accounts[0];
  const claims = account?.idTokenClaims;

  const searchResultChange = (value: string) =>
  {
    setSearchResult(value);
  }

  /**
   * Fetches the user region from the backend API for standalone app.
   */
  const getUserRegion_Entra = useCallback(async () => {
      
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
    
    if (!isIframe && accounts.length > 0) {
      instance.setActiveAccount(accounts[0]);
      getUserRegion_Entra();
    }
    const initConnect = async () => {
      // If we aren't in an iframe, we don't even try Connect
      if (!isIframe) {
        setLoading(false);
        return;
      }
      try 
      {
        const amazonConnectApp = AmazonConnectApp.init({
          onCreate: async (event) => {
            setSdkInitialized(true); // Handshake complete
            console.log('************ App initialized with context:', JSON.stringify(event));
            
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
        setConnectProvider(amazonConnectApp.provider);

        // Create an Agent Client using the provider
        const agentClient = new AgentClient({ provider: amazonConnectApp.provider });
        const agentARN = await agentClient.getARN();
        const agentRP = await agentClient.getRoutingProfile();
        const region = agentRP.name.split('_')[1];

        console.log("Agent ARN:", agentARN);
        console.log("Agent Region :", region) ;
        console.log("Agent Routing profile :", agentRP.name) ;

        setRegion(region);

        // Extract user ID from ARN
        // ARN format: arn:aws:connect:region:account:instance/instance-id/agent/user-id
        const userIdMatch = agentARN.match(/\/agent\/(.+)$/);
        const connectUserId = userIdMatch ? userIdMatch[1] : null;

        setConnectUserId(connectUserId);
        setLoading(false);
        console.log("User ID:", connectUserId);

      } catch (error) {
        
        console.error("Failed to initialize Amazon Connect SDK", error);
      }
    };
    
    initConnect();
    

  }, [accounts, instance, getUserRegion_Entra, accounts.length]);

  // If we are in an iframe but the SDK hasn't finished its handshake yet,
  // we show a neutral loading screen to prevent the MSAL Redirect from firing.
  if (isIframe && !sdkInitialized) {
    return <p>Connecting to Agent Workspace...</p>;
  }

  return (
    <>
      {isIframe ? (
        <PageLayout userName={""}>
                {loading ? (<p>Loading user preferences...</p>) : 
                  (
                    <>
                      <SearchBox  region={region} entraAuth={false} onSearchResultChange={searchResultChange} />
                      <Divider sx={{ border: "2px solid", borderColor: "primary.dark" }} />
                      {searchResult && (<SearchResultsView searchResult={searchResult} />)}
                    </>
                  )
                }
              </PageLayout>
      )
      : (
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
                        <SearchBox  region={region}  entraAuth={true} onSearchResultChange={searchResultChange} />
                        <Divider sx={{ border: "2px solid", borderColor: "primary.dark" }} />
                        {searchResult && (<SearchResultsView searchResult={searchResult} />)}
                      </>
                    )
                  }
                </PageLayout>
              )}      
      </MsalAuthenticationTemplate>
      )}
      </>
  );
}

export default App;
