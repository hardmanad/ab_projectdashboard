import React, { useState, useEffect } from 'react';
import { 
  Provider, 
  defaultTheme, 
  View, 
  Flex, 
  Heading,
  Divider,
  ProgressCircle,
  Text,
  ToastQueue
} from '@adobe/react-spectrum';
import { attach } from '@adobe/uix-guest';
import { extensionId } from './Constants';
import { fetchProjects, fetchStatuses } from '../services/workfrontApi';
import StatusFilter from './StatusFilter';
import ProjectList from './ProjectList';
import ProjectSummary from './ProjectSummary';
import ProjectDetails from './ProjectDetails';

/**
 * ProjectDashboardMainMenuItem Component
 * Main dashboard for viewing projects with filterable list and detailed view
 */
const ProjectDashboardMainMenuItem = () => {
  // UIX Connection state
  const [guestConnection, setGuestConnection] = useState(null);
  const [hostname, setHostname] = useState(null);
  const [sessionToken, setSessionToken] = useState(null);
  
  // Data state
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [selectedStatuses, setSelectedStatuses] = useState(['CUR']); // Default to Current projects
  const [statusesMap, setStatusesMap] = useState({}); // Map of status codes to labels
  
  // UI state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [connectionReady, setConnectionReady] = useState(false);

  // Initialize UIX connection
  useEffect(() => {
    const init = async () => {
      try {
        // Attach to the host application
        const connection = await attach({ id: extensionId });
        setGuestConnection(connection);

        // console.log('UIX Connection established');
        // console.log('Full connection object:', connection);
        // console.log('Shared context:', connection.sharedContext);
        // console.log('Configuration:', connection.configuration);
        // console.log('Host methods:', connection.host);
        // console.log('Host keys:', Object.keys(connection.host));
        
        // Wait a bit for the context to be populated
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Try to get context values using the get method
        let hostFromContext, tokenFromContext;
        
        if (connection.sharedContext && typeof connection.sharedContext.get === 'function') {
          // Get hostname
          hostFromContext = connection.sharedContext.get('hostname') || connection.sharedContext.get('host');
          
          // Try to get session token - might be in auth object or directly
          tokenFromContext = connection.sharedContext.get('sessionToken') || connection.sharedContext.get('token');
          
          // Get authentication token from auth object
          if (!tokenFromContext) {
            const authData = connection.sharedContext.get('auth');
            // console.log('Auth data:', authData);
            
            if (authData && authData.imsToken) {
              tokenFromContext = authData.imsToken;
              // console.log('Using IMS token for authentication (will be sent as Bearer token)');
            } else if (authData) {
              // Try other token fields as fallback
              tokenFromContext = authData.sessionToken || authData.token || authData.accessToken;
              // console.log('Using alternative token from auth data');
            }
          }
        }
        
        // console.log('Hostname from context:', hostFromContext);
        // console.log('Token available:', !!tokenFromContext);
        // console.log('Token type:', tokenFromContext?.startsWith('eyJ') ? 'IMS (JWT)' : 'Other');
        
        if (!hostFromContext) {
          throw new Error('Missing hostname from Workfront context. The extension may not have proper permissions or context access.');
        }
        
        if (!tokenFromContext) {
          throw new Error('Missing authentication token (IMS token) from Workfront context. Cannot make API calls.');
        }
        
        // Ensure hostname has proper protocol
        const apiHostname = hostFromContext?.startsWith('http') 
          ? hostFromContext 
          : `https://${hostFromContext}`;
        
        // console.log('API Hostname:', apiHostname);
        
        setHostname(apiHostname);
        setSessionToken(tokenFromContext || null); // null is okay, we'll use cookies
        setConnectionReady(true);

        // Listen for context changes - this might be how we get the initial context too!
        connection.addEventListener('contextchange', (event) => {
          // console.log('Context change event received:', event);
          // console.log('Event context:', event.context);
          
          let newHost, newToken;
          
          if (event.context && typeof event.context.get === 'function') {
            newHost = event.context.get('hostname') || event.context.get('host');
            newToken = event.context.get('sessionToken') || event.context.get('token');
          } else if (event.context) {
            newHost = event.context.hostname || event.context.host;
            newToken = event.context.sessionToken || event.context.token;
          }
          
          // console.log('New host from event:', newHost);
          // console.log('New token from event:', newToken);
          
          if (newHost) {
            const newApiHostname = newHost.startsWith('http') ? newHost : `https://${newHost}`;
            setHostname(newApiHostname);
            setConnectionReady(true);
          }
          if (newToken) {
            setSessionToken(newToken);
          }
        });
      } catch (err) {
        console.error('Error initializing UIX connection:', err);
        setError('Failed to connect to Workfront');
        ToastQueue.negative('Failed to connect to Workfront', { timeout: 5000 });
      }
    };

    init();
  }, []);

  // Load projects when connection is ready or filters change
  useEffect(() => {
    if (!connectionReady || !hostname || !sessionToken) {
      return;
    }

    const loadProjects = async () => {
      try {
        setLoading(true);
        setError(null);
        // console.log('Loading projects with hostname:', hostname, 'statuses:', selectedStatuses);
        const data = await fetchProjects(hostname, sessionToken, selectedStatuses);
        // console.log('Projects loaded:', data.length, 'projects');
        setProjects(data);
      } catch (err) {
        console.error('Error loading projects:', err);
        console.error('Error details:', err.message, err.stack);
        setError('Failed to load projects');
        ToastQueue.negative('Failed to load projects', { timeout: 5000 });
      } finally {
        setLoading(false);
      }
    };

    loadProjects();
  }, [connectionReady, hostname, sessionToken, selectedStatuses]);

  // Load statuses once when connection is ready
  useEffect(() => {
    if (!connectionReady || !hostname || !sessionToken) {
      return;
    }

    const loadStatuses = async () => {
      try {
        const statuses = await fetchStatuses(hostname, sessionToken);
        // Create a map of status codes to labels
        const map = {};
        statuses.forEach(status => {
          map[status.value] = status.label;
        });
        setStatusesMap(map);
      } catch (err) {
        console.error('Error loading statuses for mapping:', err);
        // Use default mapping if fetch fails
        setStatusesMap({
          'CUR': 'Current',
          'PLN': 'Planning',
          'CPL': 'Complete',
          'ONH': 'On Hold',
          'DED': 'Dead',
          'INP': 'In Progress'
        });
      }
    };

    loadStatuses();
  }, [connectionReady, hostname, sessionToken]);

  // Notify host that rendering is complete after initial load
  useEffect(() => {
    if (guestConnection && connectionReady && !loading) {
      // Call renderDone only if it exists
      if (guestConnection.host && typeof guestConnection.host.renderDone === 'function') {
        guestConnection.host.renderDone();
      }
    }
  }, [guestConnection, connectionReady, loading]);

  const handleStatusChange = (statuses) => {
    setSelectedStatuses(statuses);
    // Clear selected project when filters change
    setSelectedProject(null);
  };

  const handleProjectSelect = (project) => {
    setSelectedProject(project);
  };

  // Show loading while connecting
  if (!connectionReady) {
    return (
      <Provider theme={defaultTheme} colorScheme="light">
        <View padding="size-400">
          <Flex justifyContent="center" alignItems="center" height="100vh">
            <Flex direction="column" gap="size-200" alignItems="center">
              <ProgressCircle aria-label="Connecting to Workfront" isIndeterminate />
              <Text>Connecting to Workfront...</Text>
            </Flex>
          </Flex>
        </View>
      </Provider>
    );
  }

  return (
    <Provider theme={defaultTheme} colorScheme="light">
      <View height="100vh" UNSAFE_style={{ overflow: 'hidden' }}>
        <Flex direction="row" height="100%" width="100%">
          {/* Left Panel - Project List */}
          <View 
            width="25%" 
            height="100%"
            borderEndWidth="thin"
            borderEndColor="gray-300"
            UNSAFE_style={{ 
              display: 'flex', 
              flexDirection: 'column',
              overflow: 'hidden'
            }}
          >
            {/* Header */}
            <View 
              padding="size-200" 
              borderBottomWidth="thin"
              borderBottomColor="gray-300"
              UNSAFE_style={{ flexShrink: 0 }}
            >
              <Heading level={2} UNSAFE_style={{ fontSize: '18px', margin: 0 }}>
                Projects
              </Heading>
            </View>

            {/* Status Filter */}
            <View 
              borderBottomWidth="thin"
              borderBottomColor="gray-300"
              UNSAFE_style={{ flexShrink: 0 }}
            >
              <StatusFilter
                hostname={hostname}
                sessionToken={sessionToken}
                selectedStatuses={selectedStatuses}
                onStatusChange={handleStatusChange}
              />
            </View>

            {/* Project List */}
            <View UNSAFE_style={{ flex: 1, overflow: 'auto' }}>
              <ProjectList
                projects={projects}
                selectedProject={selectedProject}
                onProjectSelect={handleProjectSelect}
                loading={loading}
              />
            </View>
          </View>

          {/* Right Panel - Project Details or Summary */}
          <View 
            width="75%" 
            height="100%"
            UNSAFE_style={{ 
              overflow: 'auto',
              backgroundColor: 'var(--spectrum-global-color-gray-50)'
            }}
          >
            {selectedProject ? (
              <ProjectDetails
                project={selectedProject}
                hostname={hostname}
                sessionToken={sessionToken}
                statusesMap={statusesMap}
              />
            ) : (
              <ProjectSummary />
            )}
          </View>
        </Flex>
      </View>
    </Provider>
  );
};

export default ProjectDashboardMainMenuItem;
