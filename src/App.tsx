import { useEffect, useState, useCallback, useRef} from "react";
import { MsalAuthenticationTemplate } from "@azure/msal-react";
import { AmazonConnectApp  } from '@amazon-connect/app';
import { AgentClient } from "@amazon-connect/contact";
import { VoiceClient, type CreateOutboundCallResult } from "@amazon-connect/voice";
import { ContactClient } from "@amazon-connect/contact";
import { PageLayout } from "./components/PageLayout";
import { SearchBox } from "./components/SearchBox";
import { SearchResultsView } from "./components/SearchResultsView";
import Divider  from '@mui/material/Divider';
import { InteractionType } from "@azure/msal-browser";
import { useMsal } from "@azure/msal-react";
import { apiRequest } from "./authConfig";
import { useAcquireTokenWithRecovery } from "./components/useAcquireTokenWithRecovery";

import "./App.css";

const API_ENDPOINT_ENTRA_AUTH = import.meta.env.VITE_API_URL_ENTRA_AUTH;
const API_ENDPOINT_CONNECT_AUTH = import.meta.env.VITE_API_URL_CONNECT_AUTH;
const isIframe = window.self !== window.top; // Immediate check

function App() {
  const { instance, accounts } = useMsal();

  // SDK & Clients State
  const [sdkInitialized, setSdkInitialized] = useState<boolean>(false);
  const [voiceClient, setVoiceClient] = useState<VoiceClient | null>(null);
  const [, setAgentClient] = useState<AgentClient | null>(null);
  const [, setConnectProvider] = useState<AmazonConnectApp| null>(null);
  const [contactClient, setContactClient] = useState<ContactClient | null>(null);

  // Business State
  const [region, setRegion] = useState("");
  const [userName, setUserName] = useState<string |null|undefined>("");
  const [searchResult, setSearchResult] = useState("");
  const [loading, setLoading] = useState<boolean>(false);
  const [, setConnectUserId] = useState<string | null>(null);
  const [, setContactId] = useState<string | null>(null);

  // Refs to prevent double-init or stale closures
  const sdkStarted = useRef(false);

  const acquireTokenWithRecovery = useAcquireTokenWithRecovery();

  /**
   * Fetches the user region from the backend API for standalone app.
   */
  const getUserRegion_Entra = useCallback(async (username:string) => {

  const apiUrl = `${API_ENDPOINT_ENTRA_AUTH}?function_code=get_region_of_user&AgentUserName=${encodeURIComponent(username)}`;

  try 
  {
    setLoading(true);

    const authResult = await acquireTokenWithRecovery({ ...apiRequest });

    // 2. Guard against missing tokens
    if (!authResult?.accessToken) 
    {
      throw new Error("Failed to acquire a valid access token.");
    }

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

    if (data?.success && data?.found) 
    {
      setRegion(data.region);
      console.log("User region identified:", data.region);
    }
  } 
  catch (error) 
  {
    console.error("Failed to fetch user region:", error);
    
  }
  finally 
  {
    setLoading(false);
  }
  // Include all stable dependencies
}, [ acquireTokenWithRecovery]);
  
  const getUserInfo_Connect = useCallback(async (connectUserId: string|null) => {
    console.log("*********** in getUserRegion_Connect");
    connectUserId = "79e4e9fe-40f7-44d1-969e-d82113792b2f";
    const apiUrl = `${API_ENDPOINT_CONNECT_AUTH}?function_code=get_user_info&AgentUserId=${connectUserId}`;
    console.log('apiUrl: ', apiUrl)
    try
    {
      const response = await fetch(apiUrl, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) 
      {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      if (data?.success && data?.found) 
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
    
    // 1. Standalone logic
    if (!isIframe && accounts.length > 0) {
      instance.setActiveAccount(accounts[0]);
      const username = accounts[0].idTokenClaims?.preferred_username;
      setUserName(username ?? "Unknown User");
      if (!username) 
      {
        console.warn("No preferred_username found in claims.");
        return;
      }
      getUserRegion_Entra(username);
    }

    // 2. Iframe / Amazon Connect logic
    if (isIframe && !sdkStarted.current) 
    {
      sdkStarted.current = true; // Guard against React 18 double-run
      
      const amazonConnectApp =  AmazonConnectApp.init({
        onCreate: async (event) => {
          setSdkInitialized(true); // Handshake complete
          console.log('************ App initialized with context:', event.context);
          
          // Create an Agent Client using the provider
          const agentClient = new AgentClient({ provider: amazonConnectApp.provider });
          const voiceClient = new VoiceClient({ provider: amazonConnectApp.provider });
          const contactClient = new ContactClient({ provider: amazonConnectApp.provider });

          setAgentClient(agentClient);
          setVoiceClient(voiceClient);
          setContactClient(contactClient);

          const agentARN = await agentClient.getARN();
          // Extract user ID from ARN
          // ARN format: arn:aws:connect:region:account:instance/instance-id/agent/user-id
          const userIdMatch = agentARN.match(/\/agent\/(.+)$/);
          const connectUserId = userIdMatch ? userIdMatch[1] : null;
          console.log("User ID:", connectUserId);
          console.log("Agent ARN:", agentARN);
          
          setConnectUserId(connectUserId);
          setLoading(false);

          if (event.context.scope && "contactId" in event.context.scope) {
            setContactId(event.context.scope.contactId);
          }
          if (connectUserId) 
          {
            getUserInfo_Connect(connectUserId);
          }
        },
        onDestroy: async (event) => {
          console.log('App being destroyed:', event);
        },
      });

        // Save the provider to state so you can use it globally in your app
      setConnectProvider(amazonConnectApp.provider);

      
    };

  }, [accounts, instance, getUserRegion_Entra, getUserInfo_Connect, accounts.length]);

  
  const makeOutboundCall  = useCallback(async (phoneNumber: string)  =>
  {
    console.log("phoneNumber: "+ phoneNumber)
    if (!contactClient || !voiceClient) return;    
    try 
    {
      const contacts = await contactClient.listContacts();
      console.log(`Active contacts: ${contacts?.length}`);
      const isBusy = contacts?.some(c => c.type === 'voice'); // Check specifically for voice

      if (isBusy )
      {
        console.log("Agent busy on an existing call, cannot initiate new call");
        return;
      }
      
      console.log("Calling  "+ phoneNumber)
      const outboundCallResult:CreateOutboundCallResult = await voiceClient.createOutboundCall(phoneNumber);
      console.log("outboundCallResult.contactId : " + outboundCallResult.contactId);    
    }
    catch (error) 
    {
      console.error("Outbound call failed:", error);
    }
  }, [contactClient, voiceClient]);

  // If we are in an iframe but the SDK hasn't finished its handshake yet,
  // we show a neutral loading screen to prevent the MSAL Redirect from firing.
  if (isIframe && !sdkInitialized) 
  {
      return <p>Connecting to Agent Workspace...</p>;
  }

  // Main UI Fragment to keep code DRY
  const renderMainContent = () => (
    <PageLayout userName={userName ?? "User"}>
      {loading ? (
        <p>Loading preferences...</p>
      ) : (
        <>
          <SearchBox 
            region={region} 
            entraAuth={!isIframe} 
            userName={userName ?? ""} 
            onSearchResultChange={setSearchResult} 
          />
          <Divider sx={{ my: 2, border: "1px solid", borderColor: "primary.dark" }} />
          {searchResult && (
            <SearchResultsView 
              searchResult={searchResult} 
              entraAuth={!isIframe} 
              onDialNumberClicked={makeOutboundCall} 
            />
          )}
        </>
      )}
    </PageLayout>
  );

  return (
    <>
      {isIframe ? ( renderMainContent())
      : (
         <MsalAuthenticationTemplate interactionType={InteractionType.Redirect}
            authenticationRequest={{
              scopes: ["openid", "profile", "api://587acb42-3a4e-4c42-9448-2842d5fc82eb/access_as_user"],
            }}
            errorComponent={({ error }) => <pre>Error: {error?.errorMessage}</pre>}
            loadingComponent={() => <span>Launching Login redirect...</span>}>
            { accounts.length &&  renderMainContent()}      
        </MsalAuthenticationTemplate>
      )}
      </>
  );
}

export default App;
