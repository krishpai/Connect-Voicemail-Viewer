import { useEffect, useState, useCallback} from "react";
import { MsalAuthenticationTemplate } from "@azure/msal-react";
import { AmazonConnectApp  } from '@amazon-connect/app';
import { AgentClient } from "@amazon-connect/contact";
import { VoiceClient } from "@amazon-connect/voice";
import { ContactClient } from "@amazon-connect/contact";
import { PageLayout } from "./components/PageLayout";
import { SearchBox } from "./components/SearchBox";
import { SearchResultsView } from "./components/SearchResultsView";
import Divider  from '@mui/material/Divider';
import { InteractionType } from "@azure/msal-browser";
import { InteractionRequiredAuthError } from "@azure/msal-browser";
import { useMsal } from "@azure/msal-react";
import { apiRequest } from "./authConfig";

import "./App.css";

const API_ENDPOINT_ENTRA_AUTH = import.meta.env.VITE_API_URL_ENTRA_AUTH;
const API_ENDPOINT_CONNECT_AUTH = import.meta.env.VITE_API_URL_CONNECT_AUTH;

const isIframe = window.self !== window.top; // Immediate check

function App() {
  const { instance, accounts } = useMsal();
  const [_connectProvider, setConnectProvider] = useState<AmazonConnectApp| null>(null);
  const [_contactId, setContactId] = useState<string | null>(null);
  const [searchResult, setSearchResult] = useState("");
  const [region, setRegion] = useState("");
  const [loading, setLoading] = useState<boolean>(false);
  const [_connectUserId, setConnectUserId] = useState<string | null>(null);
  const [sdkInitialized, setSdkInitialized] = useState<boolean>(false);
  const [_voiceClient, setVoiceClient] = useState<VoiceClient | null>(null);
  const [_agentClient, setAgentClient] = useState<AgentClient | null>(null);
  const [_contactClient, setContactClient] = useState<ContactClient | null>(null);
  const [userName, setUserName] = useState<string |null|undefined>(null);
  

  const account = accounts[0];
  
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
      setUserName(username);

      if (!username) 
      {
        console.warn("No preferred_username found in claims.");
        return;
      }

      const apiUrl = `${API_ENDPOINT_ENTRA_AUTH}?function_code=get_region_of_user&AgentUserName=${encodeURIComponent(username)}`;

      try 
      {
        setLoading(true);

        
        const authResult = await instance.acquireTokenSilent({
          ...apiRequest,
          account: currentAccount,
        });

        const accessToken = authResult.accessToken;

        const response = await fetch(apiUrl, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) 
        {
          throw new Error(`API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();

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
  
  const getUserInfo_Connect = useCallback(async (connectUserId: string|null) => {
    console.log("*********** in getUserRegion_Connect");
    connectUserId = "79e4e9fe-40f7-44d1-969e-d82113792b2f";
    const apiUrl = `${API_ENDPOINT_CONNECT_AUTH}?function_code=get_user_info&AgentUserId=${connectUserId}`;
    console.log('apiUrl: ', apiUrl)
    try
    {
      const accessToken = 'None';

      const response = await fetch(apiUrl, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) 
        {
          throw new Error(`API error: ${response.status} ${response.statusText}`);
        }

      const data = await response.json();
      if (data && data.success && data.found) 
      {
        setRegion(data.region);
        setUserName(data.userName);

        console.log("User name identified:", data.userName);
        console.log("User region identified:", data.region);
      }
      else
      {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }
    }
    catch (error) 
    {
      console.log('error: ', error)
      setRegion("ALL");
      setUserName("Unknown user");
    }

  }, [])     

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
        const amazonConnectApp =  AmazonConnectApp.init({
          onCreate: async (event) => {
            setSdkInitialized(true); // Handshake complete
            console.log('************ App initialized with context:', event.context);
            
            // Create an Agent Client using the provider
            const agentClient = new AgentClient({ provider: amazonConnectApp.provider });
            setAgentClient(agentClient);
            const agentARN = await agentClient.getARN();
            const agentRP = await agentClient.getRoutingProfile();
            // Extract user ID from ARN
            // ARN format: arn:aws:connect:region:account:instance/instance-id/agent/user-id
            const userIdMatch = agentARN.match(/\/agent\/(.+)$/);
            const connectUserId = userIdMatch ? userIdMatch[1] : null;
            setConnectUserId(connectUserId);

            const region = agentRP.name.split('_')[1];
            setRegion(region);

            const voiceClient = new VoiceClient({ provider: amazonConnectApp.provider });
            setVoiceClient(voiceClient);
            
            const contactClient = new ContactClient({ provider: amazonConnectApp.provider });
            setContactClient(contactClient);
            
            setLoading(false);
            console.log("User ID:", connectUserId);
            console.log("Agent ARN:", agentARN);
            console.log("Agent Region :", region) ;
            console.log("Agent Routing profile :", agentRP.name) ;            

            if (event.context.scope && "contactId" in event.context.scope) {
              setContactId(event.context.scope.contactId);
            }

            getUserInfo_Connect(connectUserId);
          },
          onDestroy: async (event) => {
            console.log('App being destroyed:', event);
          },
        });

        // Save the provider to state so you can use it globally in your app
        setConnectProvider(amazonConnectApp.provider);

      } catch (error) {
        
        console.error("Failed to initialize Amazon Connect SDK", error);
      }
    };
    
    initConnect();
    

  }, [accounts, instance, getUserRegion_Entra, getUserInfo_Connect, accounts.length]);

  

  // If we are in an iframe but the SDK hasn't finished its handshake yet,
  // we show a neutral loading screen to prevent the MSAL Redirect from firing.
  if (isIframe && !sdkInitialized) 
  {
      return <p>Connecting to Agent Workspace...</p>;
  }

  return (
    <>
      {isIframe ? (
        <PageLayout userName={userName ?? "Unknown User"}>
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
                <PageLayout userName={userName ?? "Unknown User"}>
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
