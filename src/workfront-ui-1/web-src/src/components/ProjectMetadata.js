import React from 'react';
import { View, Flex, Heading, Text, Divider } from '@adobe/react-spectrum';
import { formatDate } from '../utils/dateFormatter';
import { buildPortfolioUrl, buildProgramUrl } from '../utils/urlBuilder';

/**
 * ProjectMetadata Component
 * Displays detailed metadata about a project
 */
const ProjectMetadata = ({ project, hostname, statusesMap = {} }) => {
  if (!project) {
    return null;
  }

  const statusColors = {
    'CUR': 'var(--spectrum-global-color-green-600)',
    'PLN': 'var(--spectrum-global-color-blue-600)',
    'CPL': 'var(--spectrum-global-color-gray-600)',
    'ONH': 'var(--spectrum-global-color-orange-600)',
    'DED': 'var(--spectrum-global-color-red-600)',
    'INP': 'var(--spectrum-global-color-blue-600)'
  };

  const conditionColors = {
    'GD': 'var(--spectrum-global-color-green-600)',   // On Target
    'OT': 'var(--spectrum-global-color-green-600)',   // On Target (alternate code)
    'ON': 'var(--spectrum-global-color-green-600)',   // On Target
    'CA': 'var(--spectrum-global-color-orange-600)',  // At Risk
    'AR': 'var(--spectrum-global-color-orange-600)',  // At Risk (alternate code)
    'ER': 'var(--spectrum-global-color-red-600)',     // In Trouble
    'IT': 'var(--spectrum-global-color-red-600)',     // In Trouble (alternate code)
    'LI': 'var(--spectrum-global-color-blue-600)'     // Limited
  };

  const conditionLabels = {
    'GD': 'On Target',
    'OT': 'On Target',
    'ON': 'On Target',
    'CA': 'At Risk',
    'AR': 'At Risk',
    'ER': 'In Trouble',
    'IT': 'In Trouble',
    'LI': 'Limited'
  };

  const priorityLabels = {
    '0': 'None',
    '1': 'Low',
    '2': 'Normal',
    '3': 'High',
    '4': 'Urgent'
  };

  const priorityColors = {
    '0': 'var(--spectrum-global-color-gray-400)',
    '1': 'var(--spectrum-global-color-blue-400)',
    '2': 'var(--spectrum-global-color-green-600)',
    '3': 'var(--spectrum-global-color-orange-600)',
    '4': 'var(--spectrum-global-color-red-600)'
  };

  // Two-column field component for tighter layout
  const Field = ({ label, value, isLink = false, linkUrl = '' }) => (
    <Flex alignItems="flex-start" gap="size-100" UNSAFE_style={{ minWidth: '0', flex: '1 1 45%' }}>
      <Text UNSAFE_style={{ fontWeight: 600, color: 'var(--spectrum-global-color-gray-700)', whiteSpace: 'nowrap' }}>
        {label}:
      </Text>
      {isLink && linkUrl ? (
        <a 
          href={linkUrl} 
          target="_blank" 
          rel="noopener noreferrer" 
          style={{ 
            textDecoration: 'none',
            color: 'rgb(0, 84, 182)',
            transition: 'text-decoration 0.2s',
            wordBreak: 'break-word'
          }}
          onMouseEnter={(e) => e.target.style.textDecoration = 'underline'}
          onMouseLeave={(e) => e.target.style.textDecoration = 'none'}
        >
          {value}
        </a>
      ) : (
        <Text UNSAFE_style={{ wordBreak: 'break-word' }}>{value || 'N/A'}</Text>
      )}
    </Flex>
  );

  const Badge = ({ text, color }) => (
    <View
      padding="size-75"
      paddingStart="size-150"
      paddingEnd="size-150"
      borderRadius="medium"
      UNSAFE_style={{
        backgroundColor: color || 'var(--spectrum-global-color-gray-200)',
        display: 'inline-block',
        color: 'white',
        fontSize: '12px',
        fontWeight: 600
      }}
    >
      {text}
    </View>
  );

  return (
    <View 
      padding="size-300" 
      borderRadius="medium"
      UNSAFE_style={{ 
        backgroundColor: 'var(--spectrum-global-color-gray-50)',
        border: '1px solid var(--spectrum-global-color-gray-300)'
      }}
    >
      <Flex direction="column" gap="size-200">
        <Heading level={3}>Project Details</Heading>
        
        <Divider size="S" />

        {/* Status, Condition, and Priority */}
        <Flex direction="row" gap="size-200" alignItems="center" wrap>
          <Text UNSAFE_style={{ fontWeight: 600, color: 'var(--spectrum-global-color-gray-700)' }}>
            Status:
          </Text>
          <Badge 
            text={statusesMap[project.status] || project.status || 'Unknown'} 
            color={statusColors[project.status]} 
          />
          
          {project.condition && (
            <>
              <Text UNSAFE_style={{ fontWeight: 600, color: 'var(--spectrum-global-color-gray-700)', marginLeft: '20px' }}>
                Condition:
              </Text>
              <Badge 
                text={conditionLabels[project.condition] || project.condition} 
                color={conditionColors[project.condition]} 
              />
            </>
          )}
          
          {project.priority !== undefined && (
            <>
              <Text UNSAFE_style={{ fontWeight: 600, color: 'var(--spectrum-global-color-gray-700)', marginLeft: '20px' }}>
                Priority:
              </Text>
              <Badge 
                text={priorityLabels[project.priority] || project.priority} 
                color={priorityColors[project.priority]} 
              />
            </>
          )}
        </Flex>

        <Divider size="S" />

        {/* Timeline Section - Two Column Layout */}
        <Heading level={4} UNSAFE_style={{ fontSize: '14px', marginTop: '8px', marginBottom: '8px' }}>
          Timeline
        </Heading>
        
        <Flex direction="row" gap="size-200" wrap UNSAFE_style={{ rowGap: '8px' }}>
          {/* Row 1 */}
          <Field 
            label="Entry Date" 
            value={formatDate(project.entryDate, true, true)} 
          />
          <Field 
            label="Planned Start" 
            value={formatDate(project.plannedStartDate, true, true)} 
          />
          
          {/* Row 2 */}
          <Field 
            label="Percent Complete" 
            value={project.percentComplete !== undefined ? `${project.percentComplete}%` : 'N/A'} 
          />
          <Field 
            label="Planned Completion" 
            value={formatDate(project.plannedCompletionDate, true, true)} 
          />
          
          {/* Row 3 (if actuals exist) */}
          {project.actualStartDate && (
            <Field 
              label="Actual Start" 
              value={formatDate(project.actualStartDate, true, true)} 
            />
          )}
          {project.actualCompletionDate && (
            <Field 
              label="Actual Completion" 
              value={formatDate(project.actualCompletionDate, true, true)} 
            />
          )}
        </Flex>

        <Divider size="S" marginTop="size-150" />

        {/* Organization Section - Two Column Layout */}
        <Heading level={4} UNSAFE_style={{ fontSize: '14px', marginTop: '8px', marginBottom: '8px' }}>
          Organization
        </Heading>
        
        <Flex direction="row" gap="size-200" wrap UNSAFE_style={{ rowGap: '8px' }}>
          <Field 
            label="Project Owner" 
            value={project.owner?.name || 'Unknown'} 
          />
          {project.portfolio?.name && project.portfolioID && (
            <Field 
              label="Portfolio" 
              value={project.portfolio.name}
              isLink={true}
              linkUrl={buildPortfolioUrl(hostname, project.portfolioID)}
            />
          )}
          {project.program?.name && project.programID && (
            <Field 
              label="Program" 
              value={project.program.name}
              isLink={true}
              linkUrl={buildProgramUrl(hostname, project.programID)}
            />
          )}
          {project.group?.name && (
            <Field 
              label="Group" 
              value={project.group.name}
            />
          )}
          {project.company?.name && (
            <Field 
              label="Company" 
              value={project.company.name}
            />
          )}
        </Flex>

        {project.description && (
          <>
            <Divider size="S" marginTop="size-150" />
            <Heading level={4} UNSAFE_style={{ fontSize: '14px', marginTop: '8px', marginBottom: '4px' }}>
              Description
            </Heading>
            <Text UNSAFE_style={{ fontSize: '13px', lineHeight: '1.5' }}>
              {project.description}
            </Text>
          </>
        )}
      </Flex>
    </View>
  );
};

export default ProjectMetadata;
