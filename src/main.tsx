import React from "react";
import { createRoot } from "react-dom/client";
import * as msal from "@azure/msal-browser";
import { MsalProvider } from "@azure/msal-react";
import { msalConfig } from "./authConfig.ts";

import App from "./App.tsx";
import "bootstrap/dist/css/bootstrap.min.css";
import "./index.css";

/**
 * MSAL should be instantiated outside of the component tree to prevent it
 * from being re-instantiated on re-renders.
 *
 * What it exposes to child components: Looking at the source, MsalProvider tracks inProgress (interaction status)
 * and accounts state, and listens to MSAL events to keep those in sync — so hooks like useMsal, useAccount, and components
 * like AuthenticatedTemplate / UnauthenticatedTemplate all work automatically underneath it.
 */

/*msalInstance --> fully configured authentication engine that knows how to log users in, store tokens, refresh tokens silently, and call APIs*/
const msalInstance = new msal.PublicClientApplication(msalConfig);

console.log("Before sync:", msalInstance.getActiveAccount());

const container = document.getElementById("root") as HTMLElement;
const root = createRoot(container);

root.render(
  <React.StrictMode>
    <MsalProvider instance={msalInstance}>
      <App />
    </MsalProvider>
  </React.StrictMode>,
);

/**
 * All components underneath MsalProvider will have access to the PublicClientApplication instance
 * via context as well as all hooks and components provided by @azure/msal-react.
 * */
