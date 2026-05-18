import React, { useEffect, useState } from 'react';
import { View, Flex, Heading, ProgressCircle, Text } from '@adobe/react-spectrum';
import ProjectMetadata from './ProjectMetadata';
import CommentsSection from './CommentsSection';
import DocumentsSection from './DocumentsSection';
import { fetchProjectDetails } from '../services/workfrontApi';
import { buildWorkfrontObjectUrl } from '../utils/urlBuilder';

/**
 * ProjectDetails Component
 * Container that displays detailed information about a selected project
 * Orchestrates the metadata, comments, and documents sections
 */
const ProjectDetails = ({ project, hostname, sessionToken, statusesMap = {} }) => {
  const [detailedProject, setDetailedProject] = useState(project);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!project || !hostname || !sessionToken) {
      return;
    }

    // If we need more detailed information, fetch it
    const loadDetailedProject = async () => {
      try {
        setLoading(true);
        setError(null);
        const details = await fetchProjectDetails(hostname, sessionToken, project.ID);
        setDetailedProject(details);
      } catch (err) {
        console.error('Error loading project details:', err);
        setError('Failed to load complete project details');
        // Use the basic project data we already have
        setDetailedProject(project);
      } finally {
        setLoading(false);
      }
    };

    loadDetailedProject();
  }, [project, hostname, sessionToken]);

  if (!project) {
    return null;
  }

  return (
    <View padding="size-400">
      <Flex direction="column" gap="size-300">
        {/* Project Header */}
        <View>
          <Heading level={1} UNSAFE_style={{ fontSize: '24px', marginBottom: '4px' }}>
            <a 
              href={buildWorkfrontObjectUrl(hostname, 'PROJ', project.ID)}
              target="_blank"
              rel="noopener noreferrer"
              style={{ 
                textDecoration: 'none', 
                color: 'rgb(0, 84, 182)',
                transition: 'text-decoration 0.2s'
              }}
              onMouseEnter={(e) => e.target.style.textDecoration = 'underline'}
              onMouseLeave={(e) => e.target.style.textDecoration = 'none'}
            >
              {detailedProject?.name || project.name}
            </a>
          </Heading>
          {(detailedProject?.referenceNumber || project.referenceNumber) && (
            <Text UNSAFE_style={{ fontSize: '13px', color: 'var(--spectrum-global-color-gray-700)', marginBottom: '8px' }}>
              <span style={{ fontWeight: 600 }}>Reference Number:</span> {detailedProject?.referenceNumber || project.referenceNumber}
            </Text>
          )}
          {loading && (
            <Flex gap="size-100" alignItems="center">
              <ProgressCircle aria-label="Loading details" isIndeterminate size="S" />
              <Text UNSAFE_style={{ fontSize: '12px', color: 'var(--spectrum-global-color-gray-600)' }}>
                Loading complete details...
              </Text>
            </Flex>
          )}
          {error && (
            <Text UNSAFE_style={{ fontSize: '12px', color: 'var(--spectrum-global-color-orange-600)' }}>
              {error} (showing basic information)
            </Text>
          )}
        </View>

        {/* Project Metadata Section */}
        <ProjectMetadata 
          project={detailedProject} 
          hostname={hostname}
          statusesMap={statusesMap}
        />

        {/* Comments Section */}
        <CommentsSection 
          projectId={project.ID}
          hostname={hostname}
          sessionToken={sessionToken}
        />

        {/* Documents Section */}
        <DocumentsSection 
          projectId={project.ID}
          hostname={hostname}
          sessionToken={sessionToken}
        />
      </Flex>
    </View>
  );
};

export default ProjectDetails;
