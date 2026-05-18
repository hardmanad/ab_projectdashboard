/*
 * <license header>
 */

import React from "react";
import ErrorBoundary from "react-error-boundary";
import { HashRouter as Router, Routes, Route } from "react-router-dom";
import ExtensionRegistration from "./ExtensionRegistration";


import ProjectDashboard from "./ProjectDashboardMainMenuItem";
import ProjectTab from "./ProjectTab";

function App() {
  return (
    <Router>
      <ErrorBoundary onError={onError} FallbackComponent={fallbackComponent}>
        <Routes>
          <Route index element={<ExtensionRegistration />} />    
          <Route exact path="index.html" element={<ExtensionRegistration />} />  
          {/* @todo YOUR CUSTOM ROUTES SHOULD BE HERE */}          
          <Route
            exact path="project-dashboard"
            element={<ProjectDashboard />}
          />
          <Route
            exact path="project-tab"
            element={<ProjectTab />}
          />
        </Routes>
      </ErrorBoundary>
    </Router>
  )

  // error handler on UI rendering failure
  function onError(e, componentStack) {}

  // component to show if UI fails rendering
  function fallbackComponent({ componentStack, error }) {
    return (
      <React.Fragment>
        <h1 style={{ textAlign: "center", marginTop: "20px" }}>
          Phly, phly... Something went wrong :(
        </h1>
        <pre>{componentStack + "\n" + error.message}</pre>
      </React.Fragment>
    );
  }
}

export default App;
