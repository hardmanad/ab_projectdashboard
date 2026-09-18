import React from 'react';
import { View, Flex, Heading, Text } from '@adobe/react-spectrum';
import ChevronDown from '@spectrum-icons/workflow/ChevronDown';
import { formatDate } from '../utils/dateFormatter';
import { buildPortfolioUrl, buildProgramUrl } from '../utils/urlBuilder';

/**
 * ProjectMetadata Component
 * Displays detailed metadata about a project as a grid of cards,
 * styled to match Workfront's native "Overview" section.
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
    '2': 'var(--spectrum-global-color-yellow-600)',
    '3': 'var(--spectrum-global-color-orange-600)',
    '4': 'var(--spectrum-global-color-red-600)'
  };

  const Dot = ({ color }) => (
    <View
      width="8px"
      height="8px"
      borderRadius="full"
      UNSAFE_style={{ backgroundColor: color || 'var(--spectrum-global-color-gray-400)', flexShrink: 0 }}
    />
  );

  // Label-above-value field, with an optional colored status dot before the value
  const Field = ({ label, value, isLink = false, linkUrl = '', dotColor }) => (
    <Flex direction="column" gap="size-50" UNSAFE_style={{ minWidth: 0, flex: '1 1 45%' }}>
      <Text UNSAFE_style={{ fontSize: '11px', color: 'var(--spectrum-global-color-gray-600)' }}>
        {label}
      </Text>
      {dotColor !== undefined ? (
        <Flex alignItems="center" gap="size-75">
          <Dot color={dotColor} />
          <Text UNSAFE_style={{ fontSize: '13px' }}>{value}</Text>
        </Flex>
      ) : isLink && linkUrl ? (
        <a
          href={linkUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontSize: '13px',
            textDecoration: 'none',
            color: 'rgb(0, 84, 182)',
            wordBreak: 'break-word'
          }}
          onMouseEnter={(e) => e.target.style.textDecoration = 'underline'}
          onMouseLeave={(e) => e.target.style.textDecoration = 'none'}
        >
          {value}
        </a>
      ) : (
        <Text UNSAFE_style={{ fontSize: '13px', wordBreak: 'break-word' }}>{value || 'N/A'}</Text>
      )}
    </Flex>
  );

  const FieldRow = ({ children }) => (
    <Flex direction="row" gap="size-300" wrap>
      {children}
    </Flex>
  );

  const Card = ({ title, children }) => (
    <View
      padding="size-250"
      borderRadius="medium"
      UNSAFE_style={{
        backgroundColor: 'white',
        border: '1px solid var(--spectrum-global-color-gray-200)'
      }}
    >
      <Flex direction="column" gap="size-200">
        <Text UNSAFE_style={{ fontWeight: 700, fontSize: '14px' }}>{title}</Text>
        {children}
      </Flex>
    </View>
  );

  return (
    <View
      padding="size-200"
      borderRadius="medium"
      UNSAFE_style={{ backgroundColor: 'var(--spectrum-global-color-gray-75)' }}
    >
      <Flex direction="column" gap="size-200">
        <Flex alignItems="center" gap="size-100">
          <ChevronDown size="S" />
          <Heading level={3} UNSAFE_style={{ margin: 0 }}>Overview</Heading>
        </Flex>

        <View UNSAFE_style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <Card title="Description">
            {project.description ? (
              <Text UNSAFE_style={{ fontSize: '13px', lineHeight: '1.5' }}>{project.description}</Text>
            ) : (
              <Text UNSAFE_style={{ fontSize: '13px', fontStyle: 'italic', color: 'var(--spectrum-global-color-gray-500)' }}>
                No description
              </Text>
            )}
          </Card>

          <Card title="Basic Information">
            <FieldRow>
              <Field
                label="Status"
                value={statusesMap[project.status] || project.status || 'Unknown'}
                dotColor={statusColors[project.status]}
              />
              {project.priority !== undefined && (
                <Field
                  label="Priority"
                  value={priorityLabels[project.priority] || project.priority}
                  dotColor={priorityColors[project.priority]}
                />
              )}
            </FieldRow>
          </Card>

          <Card title="Project Condition">
            <Field
              label="Condition"
              value={conditionLabels[project.condition] || project.condition || 'N/A'}
              dotColor={conditionColors[project.condition]}
            />
          </Card>

          <Card title="Organization">
            <FieldRow>
              <Field label="Project Owner" value={project.owner?.name || 'Unknown'} />
              {project.portfolio?.name && project.portfolioID && (
                <Field
                  label="Portfolio"
                  value={project.portfolio.name}
                  isLink={true}
                  linkUrl={buildPortfolioUrl(hostname, project.portfolioID)}
                />
              )}
            </FieldRow>
            {(project.program?.name || project.group?.name) && (
              <FieldRow>
                {project.program?.name && project.programID && (
                  <Field
                    label="Program"
                    value={project.program.name}
                    isLink={true}
                    linkUrl={buildProgramUrl(hostname, project.programID)}
                  />
                )}
                {project.group?.name && (
                  <Field label="Group" value={project.group.name} />
                )}
              </FieldRow>
            )}
            {project.company?.name && (
              <FieldRow>
                <Field label="Company" value={project.company.name} />
              </FieldRow>
            )}
          </Card>

          <Card title="Timeline">
            <FieldRow>
              <Field label="Entry Date" value={formatDate(project.entryDate, true, true)} />
              <Field label="Planned Start" value={formatDate(project.plannedStartDate, true, true)} />
            </FieldRow>
            <FieldRow>
              <Field
                label="Percent Complete"
                value={project.percentComplete !== undefined ? `${project.percentComplete}%` : 'N/A'}
              />
              <Field label="Planned Completion" value={formatDate(project.plannedCompletionDate, true, true)} />
            </FieldRow>
            {(project.actualStartDate || project.actualCompletionDate) && (
              <FieldRow>
                {project.actualStartDate && (
                  <Field label="Actual Start" value={formatDate(project.actualStartDate, true, true)} />
                )}
                {project.actualCompletionDate && (
                  <Field label="Actual Completion" value={formatDate(project.actualCompletionDate, true, true)} />
                )}
              </FieldRow>
            )}
          </Card>
        </View>
      </Flex>
    </View>
  );
};

export default ProjectMetadata;
