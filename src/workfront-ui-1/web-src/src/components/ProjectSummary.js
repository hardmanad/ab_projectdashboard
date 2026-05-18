import React from 'react';
import { View, Flex, Heading, Text } from '@adobe/react-spectrum';

/**
 * ProjectSummary Component
 * Displays a simple message when no project is selected
 */
const ProjectSummary = () => {
  return (
    <View padding="size-400">
      <Flex 
        direction="column" 
        gap="size-200" 
        alignItems="center" 
        justifyContent="center"
        UNSAFE_style={{ minHeight: '400px' }}
      >
        <Heading level={2} UNSAFE_style={{ textAlign: 'center', color: 'var(--spectrum-global-color-gray-700)' }}>
          Welcome to Project Dashboard
        </Heading>
        <Text UNSAFE_style={{ textAlign: 'center', fontSize: '16px', color: 'var(--spectrum-global-color-gray-600)' }}>
          Select a project from the list on the left to view its details
        </Text>
      </Flex>
    </View>
  );
};

export default ProjectSummary;
