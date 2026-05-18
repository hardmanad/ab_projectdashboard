import React, { useState, useEffect } from 'react';
import { Picker, Item, Flex, Text, View, CheckboxGroup, Checkbox } from '@adobe/react-spectrum';
import { fetchStatuses } from '../services/workfrontApi';

/**
 * StatusFilter Component
 * Provides a dropdown with checkboxes to filter projects by status
 */
const StatusFilter = ({ hostname, sessionToken, selectedStatuses, onStatusChange }) => {
  const [availableStatuses, setAvailableStatuses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!hostname || !sessionToken) {
      return;
    }

    const loadStatuses = async () => {
      try {
        setLoading(true);
        setError(null);
        const statuses = await fetchStatuses(hostname, sessionToken);
        // console.log('StatusFilter received statuses:', statuses.length, 'items');
        // console.log('StatusFilter status values:', statuses.map(s => `${s.value}:${s.label}`).join(', '));
        setAvailableStatuses(statuses);
      } catch (err) {
        console.error('Error loading statuses:', err);
        setError('Failed to load statuses');
        // Set default statuses on error
        setAvailableStatuses([
          { value: 'CUR', label: 'Current' },
          { value: 'PLN', label: 'Planning' },
          { value: 'CPL', label: 'Complete' },
          { value: 'ONH', label: 'On Hold' },
          { value: 'DED', label: 'Dead' }
        ]);
      } finally {
        setLoading(false);
      }
    };

    loadStatuses();
  }, [hostname, sessionToken]);

  const handleSelectionChange = (selected) => {
    onStatusChange(selected);
  };

  // Split statuses into two columns
  const midpoint = Math.ceil(availableStatuses.length / 2);
  const column1 = availableStatuses.slice(0, midpoint);
  const column2 = availableStatuses.slice(midpoint);

  return (
    <View padding="size-200">
      <Flex direction="column" gap="size-100">
        <Text>Filter by Status:</Text>
        <CheckboxGroup 
          value={selectedStatuses} 
          onChange={handleSelectionChange}
          isDisabled={loading}
        >
          <Flex direction="row" gap="size-300" UNSAFE_style={{ alignItems: 'flex-start' }}>
            {/* Column 1 */}
            <Flex direction="column" gap="size-75" UNSAFE_style={{ flex: '1 1 50%' }}>
              {column1.map(status => (
                <Checkbox key={status.value} value={status.value}>
                  {status.label}
                </Checkbox>
              ))}
            </Flex>
            {/* Column 2 */}
            <Flex direction="column" gap="size-75" UNSAFE_style={{ flex: '1 1 50%' }}>
              {column2.map(status => (
                <Checkbox key={status.value} value={status.value}>
                  {status.label}
                </Checkbox>
              ))}
            </Flex>
          </Flex>
        </CheckboxGroup>
        {error && (
          <Text UNSAFE_style={{ color: 'var(--spectrum-global-color-red-600)', fontSize: '12px' }}>
            {error}
          </Text>
        )}
      </Flex>
    </View>
  );
};

export default StatusFilter;
