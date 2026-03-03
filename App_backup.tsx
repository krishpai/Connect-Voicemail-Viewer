import { MsalAuthenticationTemplate, useIsAuthenticated } from "@azure/msal-react";
import { InteractionType } from "@azure/msal-browser";
//import { useState } from "react";
/*
import reactLogo from "./assets/react.svg";
import viteLogo from "/vite.svg";
*/
import "./App.css";

function App() {
  // const isAuthenticated = useIsAuthenticated();

  return (
    <>
      {/* 1. Use the template to handle the "In-Between" and "Protected" states */}
      <MsalAuthenticationTemplate
        interactionType={InteractionType.Popup} // Changed from Redirect
        authenticationRequest={{
          scopes: ["openid", "profile", "api://83a81f6b-6e2f-404f-8435-8686d019806d/access_as_user"],
        }}
        errorComponent={({ error }) => <pre>Error: {error?.errorMessage}</pre>}
        loadingComponent={() => <span>Launching Login Popup...</span>}
      >
        {/* This only renders once login is successful */}
        <p>You are authenticated!!!!</p>
      </MsalAuthenticationTemplate>

      {/* 2. Manual check if you want to show a specific message for unauthenticated users */}
      {/*!isAuthenticated && <p style={{ marginTop: "20px", color: "gray" }}>Please complete the sign-in in the popup window.</p>*/}
    </>
  );
}

export default App;
