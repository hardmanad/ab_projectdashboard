import React from 'react';
import { ListView, Item, Flex, Text, View, ProgressCircle, Heading } from '@adobe/react-spectrum';
import FolderOpen from '@spectrum-icons/workflow/FolderOpen';

/**
 * ProjectList Component
 * Displays a selectable list of projects with name and owner
 */
const ProjectList = ({ projects, selectedProject, onProjectSelect, loading }) => {
  
  const handleSelectionChange = (keys) => {
    const selectedKey = Array.from(keys)[0];
    if (selectedKey) {
      const project = projects.find(p => p.ID === selectedKey);
      if (project) {
        onProjectSelect(project);
      }
    }
  };

  const projectCount = projects?.length || 0;

  if (loading) {
    return (
      <View UNSAFE_style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <View UNSAFE_style={{ flex: 1 }}>
          <Flex justifyContent="center" alignItems="center" height="size-3000">
            <ProgressCircle aria-label="Loading projects" isIndeterminate />
          </Flex>
        </View>
        {/* Footer with count */}
        <View 
          padding="size-200"
          borderTopWidth="thin"
          borderTopColor="gray-300"
          UNSAFE_style={{ 
            backgroundColor: 'var(--spectrum-global-color-gray-75)',
            flexShrink: 0
          }}
        >
          <Text UNSAFE_style={{ fontSize: '12px', color: 'var(--spectrum-global-color-gray-700)', fontWeight: 600 }}>
            Loading projects...
          </Text>
        </View>
      </View>
    );
  }

  if (!projects || projects.length === 0) {
    return (
      <View UNSAFE_style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <View UNSAFE_style={{ flex: 1 }} padding="size-400">
          <Flex direction="column" alignItems="center" gap="size-200" marginTop="size-600">
            <FolderOpen size="XXL" UNSAFE_style={{ color: 'var(--spectrum-global-color-gray-400)' }} />
            <Heading level={3} UNSAFE_style={{ margin: 0 }}>No Projects Found</Heading>
            <Text UNSAFE_style={{ textAlign: 'center', color: 'var(--spectrum-global-color-gray-600)' }}>
              Try adjusting your filters to see more projects.
            </Text>
          </Flex>
        </View>
        {/* Footer with count */}
        <View 
          padding="size-200"
          borderTopWidth="thin"
          borderTopColor="gray-300"
          UNSAFE_style={{ 
            backgroundColor: 'var(--spectrum-global-color-gray-75)',
            flexShrink: 0
          }}
        >
          <Text UNSAFE_style={{ fontSize: '12px', color: 'var(--spectrum-global-color-gray-700)', fontWeight: 600 }}>
            0 projects
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View UNSAFE_style={{ 
      height: '100%', 
      width: '100%',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Project List - takes remaining space */}
      <View UNSAFE_style={{ flex: 1, overflow: 'auto' }}>
        <ListView
          aria-label="Projects list"
          selectionMode="single"
          selectedKeys={selectedProject ? [selectedProject.ID] : []}
          onSelectionChange={handleSelectionChange}
          height="100%"
          width="100%"
          UNSAFE_className="hide-checkbox"
        >
          {projects.map(project => (
            <Item key={project.ID} textValue={project.name}>
              <Flex direction="column" gap="size-50">
                <Text UNSAFE_style={{ fontWeight: 600, fontSize: '14px' }}>
                  {project.name}
                </Text>
                <Text UNSAFE_style={{ fontSize: '12px', color: 'var(--spectrum-global-color-gray-700)' }}>
                  Owner: {project.owner?.name || 'Unknown'}
                </Text>
              </Flex>
            </Item>
          ))}
        </ListView>
      </View>
      
      {/* Footer - anchored at bottom */}
      <View 
        padding="size-200"
        borderTopWidth="thin"
        borderTopColor="gray-300"
        UNSAFE_style={{ 
          backgroundColor: 'var(--spectrum-global-color-gray-75)',
          flexShrink: 0
        }}
      >
        <Text UNSAFE_style={{ fontSize: '12px', color: 'var(--spectrum-global-color-gray-700)', fontWeight: 600 }}>
          {projectCount} {projectCount === 1 ? 'project' : 'projects'}
        </Text>
      </View>
    </View>
  );
};

export default ProjectList;
