import { useEffect, useState,} from "react";

import { AmazonConnectApp } from '@amazon-connect/app';
import { AgentClient } from "@amazon-connect/contact";


import "./App.css";

function App() {
  const [_connectProvider, setConnectProvider] = useState<AmazonConnectApp | null>(null);
  const [_contactId, setContactId] = useState<string | null>(null);


  /**
   * Fetches the user region from the backend API.
   */

  useEffect(() => {
    //Ensure MSAL knows which account is active

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

  }, []);

  //console.log("Session keys:", (sessionStorage));

  return (
    <>
      
    </>
  );
}

export default App;
