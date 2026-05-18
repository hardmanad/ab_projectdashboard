import React, { useState, useEffect } from 'react';
import { View, Flex, Heading, Text, ActionButton, ProgressCircle } from '@adobe/react-spectrum';
import { fetchComments } from '../services/workfrontApi';
import { formatDate, formatRelativeTime } from '../utils/dateFormatter';
import { buildWorkfrontObjectUrl } from '../utils/urlBuilder';

/**
 * CommentsSection Component
 * Displays comments/notes for a project with pagination
 */
const CommentsSection = ({ projectId, hostname, sessionToken }) => {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const LIMIT = 10;

  useEffect(() => {
    if (!projectId || !hostname || !sessionToken) {
      return;
    }

    const loadComments = async () => {
      try {
        setLoading(true);
        setError(null);
        setOffset(0);
        const data = await fetchComments(hostname, sessionToken, projectId, LIMIT, 0);
        setComments(data);
        setHasMore(data.length >= LIMIT);
      } catch (err) {
        console.error('Error loading comments:', err);
        setError('Failed to load comments');
      } finally {
        setLoading(false);
      }
    };

    loadComments();
  }, [projectId, hostname, sessionToken]);

  const loadMoreComments = async () => {
    try {
      setLoadingMore(true);
      const newOffset = offset + LIMIT;
      const data = await fetchComments(hostname, sessionToken, projectId, LIMIT, newOffset);
      setComments([...comments, ...data]);
      setOffset(newOffset);
      setHasMore(data.length >= LIMIT);
    } catch (err) {
      console.error('Error loading more comments:', err);
      setError('Failed to load more comments');
    } finally {
      setLoadingMore(false);
    }
  };

  // Helper function to get the date from a comment (try multiple field names)
  const getCommentDate = (comment) => {
    const date = comment.entryDate || comment.noteDate || comment.lastUpdateDate || comment.createdDate;
    
    // Log the first comment's date info for debugging
    // if (comments.indexOf(comment) === 0) {
    //   console.log('First comment date fields:', {
    //     entryDate: comment.entryDate,
    //     noteDate: comment.noteDate,
    //     lastUpdateDate: comment.lastUpdateDate,
    //     createdDate: comment.createdDate,
    //     selectedDate: date
    //   });
    // }
    
    return date;
  };

  // Helper function to get note context label and link
  const getNoteContext = (comment) => {
    let objCode = comment.noteObjCode;
    let objID = comment.objID;
    
    // If noteObjCode is null, determine the object type from the ID fields
    if (!objCode) {
      if (comment.opTaskID) {
        objCode = 'OPTASK';
        objID = comment.opTaskID;
      } else if (comment.taskID) {
        objCode = 'TASK';
        objID = comment.taskID;
      } else if (comment.projectID) {
        objCode = 'PROJ';
        objID = comment.projectID;
      }
    }
    
    const labels = {
      'PROJ': 'Project',
      'TASK': 'Task',
      'OPTASK': 'Issue',
      'TMPL': 'Template',
      'TTSK': 'Template Task',
      'USER': 'User'
    };
    
    const label = labels[objCode] || objCode || 'Unknown';
    
    // Get the object name from the expanded fields
    let objectName = '';
    if (objCode === 'PROJ' && comment.project) {
      objectName = comment.project.name;
    } else if (objCode === 'TASK' && comment.task) {
      objectName = comment.task.name;
    } else if (objCode === 'OPTASK' && comment.opTask) {
      objectName = comment.opTask.name;
    }
    
    return {
      type: label,
      objCode: objCode,
      objID: objID,
      name: objectName,
      isProject: objCode === 'PROJ'
    };
  };

  if (loading) {
    return (
      <View padding="size-300">
        <Flex justifyContent="center" alignItems="center" height="size-2000">
          <ProgressCircle aria-label="Loading comments" isIndeterminate size="S" />
        </Flex>
      </View>
    );
  }

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
        <Heading level={3}>Comments & Notes</Heading>

        {error && (
          <Text UNSAFE_style={{ color: 'var(--spectrum-global-color-red-600)', fontSize: '13px' }}>
            {error}
          </Text>
        )}

        {comments.length === 0 ? (
          <Text UNSAFE_style={{ fontStyle: 'italic', color: 'var(--spectrum-global-color-gray-600)' }}>
            No comments yet
          </Text>
        ) : (
          <Flex direction="column" gap="size-200">
            {comments.map(comment => {
              const context = getNoteContext(comment);
              const commentDate = getCommentDate(comment);
              
              return (
                <View 
                  key={comment.ID}
                  padding="size-200"
                  borderRadius="small"
                  UNSAFE_style={{
                    backgroundColor: 'white',
                    border: '1px solid var(--spectrum-global-color-gray-200)'
                  }}
                >
                  <Flex direction="column" gap="size-100">
                    {/* Comment Header */}
                    <Flex justifyContent="space-between" alignItems="center">
                      <Text UNSAFE_style={{ fontWeight: 600, fontSize: '13px' }}>
                        {comment.owner?.name || 'Unknown User'}
                      </Text>
                      <Text 
                        UNSAFE_style={{ 
                          fontSize: '11px', 
                          color: 'var(--spectrum-global-color-gray-600)',
                          fontStyle: 'italic'
                        }}
                      >
                        {formatRelativeTime(commentDate)}
                      </Text>
                    </Flex>
                    
                    {/* Object Context - Show what this note is on */}
                    <Flex alignItems="center" gap="size-100">
                      <Text UNSAFE_style={{ fontSize: '11px', color: 'var(--spectrum-global-color-gray-600)' }}>
                        On:
                      </Text>
                      <View
                        paddingStart="size-75"
                        paddingEnd="size-75"
                        paddingTop="size-25"
                        paddingBottom="size-25"
                        borderRadius="small"
                        UNSAFE_style={{
                          backgroundColor: 'var(--spectrum-global-color-gray-200)',
                          fontSize: '10px',
                          fontWeight: 600,
                          color: 'var(--spectrum-global-color-gray-800)'
                        }}
                      >
                        {context.type}
                      </View>
                      {/* Show link for non-project objects (Task, Issue, etc.) */}
                      {!context.isProject && context.objID && (
                        <a 
                          href={buildWorkfrontObjectUrl(hostname, context.objCode, context.objID)}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ 
                            fontSize: '11px', 
                            textDecoration: 'none',
                            color: 'rgb(0, 84, 182)',
                            transition: 'text-decoration 0.2s'
                          }}
                          onMouseEnter={(e) => e.target.style.textDecoration = 'underline'}
                          onMouseLeave={(e) => e.target.style.textDecoration = 'none'}
                        >
                          {context.name || 'View'}
                        </a>
                      )}
                      {/* For project notes, just show the badge - no name or link needed */}
                    </Flex>
                    
                    {/* Comment Text */}
                    <Text UNSAFE_style={{ fontSize: '13px', lineHeight: '1.5' }}>
                      {comment.noteText || '(No text)'}
                    </Text>
                    
                    {/* Full Date */}
                    <Text 
                      UNSAFE_style={{ 
                        fontSize: '11px', 
                        color: 'var(--spectrum-global-color-gray-500)',
                        marginTop: '4px'
                      }}
                    >
                      {formatDate(commentDate, true, true)}
                    </Text>
                  </Flex>
                </View>
              );
            })}
          </Flex>
        )}

        {/* Load More Button */}
        {hasMore && comments.length > 0 && (
          <Flex justifyContent="center" marginTop="size-200">
            <ActionButton 
              onPress={loadMoreComments}
              isDisabled={loadingMore}
            >
              {loadingMore ? 'Loading...' : 'Load More Comments'}
            </ActionButton>
          </Flex>
        )}
      </Flex>
    </View>
  );
};

export default CommentsSection;
