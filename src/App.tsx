import { useEffect, useState,} from "react";

import { AmazonConnectApp } from '@amazon-connect/app';
import { AgentClient } from "@amazon-connect/contact";
import { PageLayout } from "./components/PageLayout";
import { SearchBox } from "./components/SearchBox";
import { SearchResultsView } from "./components/SearchResultsView";
import Divider  from '@mui/material/Divider';

import "./App.css";

function App() {
  const [connectProvider, setConnectProvider] = useState<AmazonConnectApp | null>(null);
  const [_contactId, setContactId] = useState<string | null>(null);
  const [searchResult, setSearchResult] = useState("");
  const [loading, setLoading] = useState<boolean>(false);
  const [connectUserId, setConnectUserId] = useState<string | null>(null);

  const searchResultChange = (value: string) =>
  {
    setSearchResult(value);
  }

  
  /**
   * Fetches the user region from the backend API.
   */

  useEffect(() => {
    //Ensure MSAL knows which account is active

    const initConnect = async () => {
      try 
      {
        
        const amazonConnectApp = AmazonConnectApp.init({
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
        setConnectProvider(amazonConnectApp.provider);
        console.log("***************After Provider successfully established.");

        // Create an Agent Client using the provider
        const agentClient = new AgentClient( amazonConnectApp.provider );
        const agentARN = await agentClient.getARN();
        console.log("Agent ARN:", agentARN);

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

  }, []);

  //console.log("Session keys:", (sessionStorage));

  return (
    <>
      {connectProvider && (
        <PageLayout userName={"Krish Pai"}>
                {loading ? (<p>Loading user preferences...</p>) : 
                  (
                    <>
                      <SearchBox  region={"SFL"}  onSearchResultChange={searchResultChange} />
                      <Divider sx={{ border: "2px solid", borderColor: "primary.dark" }} />
                      {searchResult && (<SearchResultsView searchResult={searchResult} />)}
                    </>
                  )
                }
              </PageLayout>
      )}
      </>
  );
}

export default App;
