import React, { useState, useEffect } from 'react';
import { 
  Provider, 
  defaultTheme, 
  View, 
  Flex, 
  Text,
  ProgressCircle
} from '@adobe/react-spectrum';
import { attach } from '@adobe/uix-guest';
import { extensionId } from './Constants';
import { fetchProjectDetails, fetchStatuses } from '../services/workfrontApi';
import ProjectDetails from './ProjectDetails';

/**
 * ProjectTab Component
 * Custom tab that appears on project pages in Workfront
 * Displays the same project details panel as the main dashboard
 */
const ProjectTab = () => {
  const [guestConnection, setGuestConnection] = useState(null);
  const [hostname, setHostname] = useState(null);
  const [sessionToken, setSessionToken] = useState(null);
  const [projectId, setProjectId] = useState(null);
  const [project, setProject] = useState(null);
  const [statusesMap, setStatusesMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Initialize UIX connection and get context
  useEffect(() => {
    const init = async () => {
      try {
        const connection = await attach({ id: extensionId });
        setGuestConnection(connection);

        // console.log('ProjectTab: UIX Connection established');
        // console.log('ProjectTab: Full connection object:', connection);
        // console.log('ProjectTab: Shared context:', connection.sharedContext);

        // Wait a bit for context to be populated
        await new Promise(resolve => setTimeout(resolve, 500));

        // Get project ID and hostname from context
        const context = connection.sharedContext;
        // console.log('ProjectTab: Context object:', context);
        // console.log('ProjectTab: Context _map:', context._map);
        
        // For secondary nav items, the project ID is stored as 'objID'
        const projectIdFromContext = context.get('objID') || context.get('projectId') || context.get('objectId');
        const hostFromContext = context.get('hostname') || context.get('host');
        
        // console.log('ProjectTab: projectId from context:', projectIdFromContext);
        // console.log('ProjectTab: hostname from context:', hostFromContext);
        
        // Get authentication token
        let tokenFromContext = context.get('sessionToken') || context.get('token');
        if (!tokenFromContext) {
          const authData = context.get('auth');
          // console.log('ProjectTab: Auth data:', authData);
          if (authData && authData.imsToken) {
            tokenFromContext = authData.imsToken;
          }
        }
        
        // console.log('ProjectTab: Token available:', !!tokenFromContext);
        // console.log('ProjectTab: Token type:', tokenFromContext?.startsWith('eyJ') ? 'IMS (JWT)' : 'Other');

        if (!hostFromContext || !tokenFromContext || !projectIdFromContext) {
          console.error('ProjectTab: Missing context data:');
          console.error('  - hostname:', hostFromContext);
          console.error('  - token:', !!tokenFromContext);
          console.error('  - projectId:', projectIdFromContext);
          console.error('ProjectTab: Available context keys:', Array.from(context._map.keys()));
          throw new Error('Missing required context data (hostname, token, or projectId)');
        }

        const apiHostname = hostFromContext?.startsWith('http') 
          ? hostFromContext 
          : `https://${hostFromContext}`;

        // console.log('ProjectTab: Setting up with hostname:', apiHostname, 'and projectId:', projectIdFromContext);

        setHostname(apiHostname);
        setSessionToken(tokenFromContext);
        setProjectId(projectIdFromContext);

        // Notify host that rendering is complete
        if (connection.host?.renderDone) {
          connection.host.renderDone();
        }
      } catch (err) {
        console.error('Error initializing project tab:', err);
        setError('Failed to initialize: ' + err.message);
        setLoading(false);
      }
    };

    init();
  }, []);

  // Fetch project details and statuses map when context is ready
  useEffect(() => {
    if (!hostname || !sessionToken || !projectId) {
      return;
    }

    const loadProjectData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch both project details and statuses in parallel
        const [projectData, statusesData] = await Promise.all([
          fetchProjectDetails(hostname, sessionToken, projectId),
          fetchStatuses(hostname, sessionToken)
        ]);

        // Create a map of status codes to labels
        const map = {};
        statusesData.forEach(status => {
          map[status.value] = status.label;
        });

        setProject(projectData);
        setStatusesMap(map);
        setLoading(false);
      } catch (err) {
        console.error('Error loading project data:', err);
        setError('Failed to load project data: ' + err.message);
        setLoading(false);
      }
    };

    loadProjectData();
  }, [hostname, sessionToken, projectId]);

  if (loading) {
    return (
      <Provider theme={defaultTheme} colorScheme="light">
        <View padding="size-400">
          <Flex justifyContent="center" alignItems="center" height="100vh">
            <Flex direction="column" gap="size-200" alignItems="center">
              <ProgressCircle aria-label="Loading project details" isIndeterminate />
              <Text>Loading project details...</Text>
            </Flex>
          </Flex>
        </View>
      </Provider>
    );
  }

  if (error) {
    return (
      <Provider theme={defaultTheme} colorScheme="light">
        <View padding="size-400">
          <Text UNSAFE_style={{ color: 'var(--spectrum-global-color-red-600)' }}>
            {error}
          </Text>
        </View>
      </Provider>
    );
  }

  return (
    <Provider theme={defaultTheme} colorScheme="light">
      <View 
        height="100vh"
        UNSAFE_style={{ 
          overflow: 'auto',
          backgroundColor: 'var(--spectrum-global-color-gray-50)'
        }}
      >
        {project && (
          <ProjectDetails
            project={project}
            hostname={hostname}
            sessionToken={sessionToken}
            statusesMap={statusesMap}
          />
        )}
      </View>
    </Provider>
  );
};

export default ProjectTab;
