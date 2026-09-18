import React, { useState, useEffect, useMemo } from 'react';
import { View, Flex, Heading, Text, ActionButton, ProgressCircle, Checkbox } from '@adobe/react-spectrum';
import User from '@spectrum-icons/workflow/User';
import { fetchComments, fetchJournalEntries, fetchObjectName } from '../services/workfrontApi';
import { formatRelativeTime, formatShortDateTime, parseWorkfrontDate } from '../utils/dateFormatter';
import { buildWorkfrontObjectUrl } from '../utils/urlBuilder';
import { describeJournalEntry, getJournalEntryDocument } from '../utils/journalFormatter';

const OBJECT_TYPE_LABELS = {
  'PROJ': 'project',
  'TASK': 'task',
  'OPTASK': 'issue',
  'DOCU': 'document',
  'TMPL': 'template',
  'TTSK': 'template task',
  'USER': 'user'
};

/**
 * CommentsSection Component
 * Displays comments/notes for a project, with pagination, and an optional
 * "Show System Updates" feed of system-generated journal entries (status
 * changes, condition/health updates, document uploads, etc.)
 */
const CommentsSection = ({ projectId, hostname, sessionToken }) => {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const LIMIT = 10;

  const [showSystemUpdates, setShowSystemUpdates] = useState(false);
  const [journalEntries, setJournalEntries] = useState([]);
  const [journalLoading, setJournalLoading] = useState(false);
  const [journalError, setJournalError] = useState(null);
  const [journalProjectId, setJournalProjectId] = useState(null);

  // Cache of resolved names for note target objects that aren't already
  // expanded on the note itself (e.g. documents), keyed by "objCode:objID"
  const [resolvedNames, setResolvedNames] = useState({});

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

  // Clear stale system updates when the selected project changes
  useEffect(() => {
    setJournalEntries([]);
    setJournalProjectId(null);
    setJournalError(null);
  }, [projectId]);

  // Lazily load system updates only once the checkbox is checked
  useEffect(() => {
    if (!showSystemUpdates || !projectId || !hostname || !sessionToken) {
      return;
    }
    if (journalProjectId === projectId) {
      return;
    }

    const loadJournalEntries = async () => {
      try {
        setJournalLoading(true);
        setJournalError(null);
        const data = await fetchJournalEntries(hostname, sessionToken, projectId);
        setJournalEntries(data);
        setJournalProjectId(projectId);
      } catch (err) {
        console.error('Error loading system updates:', err);
        setJournalError('Failed to load system updates');
      } finally {
        setJournalLoading(false);
      }
    };

    loadJournalEntries();
  }, [showSystemUpdates, projectId, hostname, sessionToken, journalProjectId]);

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
    return comment.entryDate || comment.noteDate || comment.lastUpdateDate || comment.createdDate;
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

    const label = OBJECT_TYPE_LABELS[objCode] || (objCode ? objCode.toLowerCase() : 'item');

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

  // Resolve the display name for any note target that isn't already covered by a
  // cheap field expansion above (e.g. documents), so links show a real name instead of "View"
  useEffect(() => {
    if (!hostname || !sessionToken) {
      return;
    }

    const needed = [];
    const seen = new Set();
    comments.forEach(comment => {
      const context = getNoteContext(comment);
      if (context.isProject || !context.objID || context.name) {
        return;
      }
      const key = `${context.objCode}:${context.objID}`;
      if (seen.has(key) || resolvedNames[key] !== undefined) {
        return;
      }
      seen.add(key);
      needed.push({ key, objCode: context.objCode, objID: context.objID });
    });

    if (needed.length === 0) {
      return;
    }

    let cancelled = false;

    (async () => {
      const results = await Promise.all(needed.map(async ({ key, objCode, objID }) => {
        try {
          const name = await fetchObjectName(hostname, sessionToken, objCode, objID);
          return [key, name];
        } catch (err) {
          console.error('Error resolving object name:', err);
          return [key, null];
        }
      }));

      if (!cancelled) {
        setResolvedNames(prev => {
          const next = { ...prev };
          results.forEach(([key, name]) => { next[key] = name; });
          return next;
        });
      }
    })();

    return () => { cancelled = true; };
    // resolvedNames intentionally excluded: read for dedup only, not a re-trigger condition
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comments, hostname, sessionToken]);

  // Merge comments with system updates (when enabled) into a single, date-sorted feed
  const feedItems = useMemo(() => {
    const commentItems = comments.map(comment => ({
      key: `comment-${comment.ID}`,
      type: 'comment',
      date: getCommentDate(comment),
      data: comment
    }));

    const journalItems = showSystemUpdates
      ? journalEntries.map(entry => ({
          key: `journal-${entry.ID}`,
          type: 'system',
          date: entry.entryDate,
          data: entry
        }))
      : [];

    return [...commentItems, ...journalItems].sort(
      (a, b) => parseWorkfrontDate(b.date) - parseWorkfrontDate(a.date)
    );
  }, [comments, journalEntries, showSystemUpdates]);

  const renderComment = (comment) => {
    const context = getNoteContext(comment);
    const commentDate = getCommentDate(comment);
    const displayName = context.name || resolvedNames[`${context.objCode}:${context.objID}`];

    return (
      <View
        padding="size-200"
        borderRadius="medium"
        UNSAFE_style={{
          backgroundColor: 'white',
          border: '1px solid var(--spectrum-global-color-gray-200)',
          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.06)'
        }}
      >
        <Flex direction="column" gap="size-100">
          {/* Object Context - "Update on the {type} {name}" */}
          <Text UNSAFE_style={{ fontSize: '12px', color: 'var(--spectrum-global-color-gray-600)' }}>
            Update on the {context.type}
            {!context.isProject && context.objID && (
              <>
                {' '}
                <a
                  href={buildWorkfrontObjectUrl(hostname, context.objCode, context.objID)}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    textDecoration: 'none',
                    color: 'rgb(0, 84, 182)'
                  }}
                >
                  {displayName || 'View'}
                </a>
              </>
            )}
          </Text>

          {/* Comment Header - avatar, name, timestamp */}
          <Flex alignItems="center" gap="size-100">
            <View
              width="size-400"
              height="size-400"
              borderRadius="large"
              UNSAFE_style={{
                backgroundColor: 'var(--spectrum-global-color-gray-300)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <User size="S" UNSAFE_style={{ color: 'var(--spectrum-global-color-gray-700)' }} />
            </View>
            <Text UNSAFE_style={{ fontWeight: 600, fontSize: '13px' }}>
              {comment.owner?.name || 'Unknown User'}
            </Text>
            <Text UNSAFE_style={{ fontSize: '12px', color: 'var(--spectrum-global-color-gray-600)' }}>
              &middot; {formatShortDateTime(commentDate)}
            </Text>
          </Flex>

          {/* Comment Text */}
          <Text UNSAFE_style={{ fontSize: '13px', lineHeight: '1.5' }}>
            {comment.noteText || '(No text)'}
          </Text>
        </Flex>
      </View>
    );
  };

  const renderSystemUpdate = (entry) => {
    const docTarget = getJournalEntryDocument(entry);

    return (
      <Flex
        alignItems="baseline"
        gap="size-75"
        wrap
        UNSAFE_style={{ paddingTop: '2px', paddingBottom: '2px' }}
      >
        <Text UNSAFE_style={{ fontWeight: 600, fontSize: '12px', color: 'var(--spectrum-global-color-gray-700)' }}>
          {entry.editedBy?.name || 'Workfront'}
        </Text>
        <Text UNSAFE_style={{ fontSize: '12px', color: 'var(--spectrum-global-color-gray-600)' }}>
          {docTarget ? (
            <>
              uploaded{' '}
              <a
                href={buildWorkfrontObjectUrl(hostname, docTarget.objCode, docTarget.objID)}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'rgb(0, 84, 182)', textDecoration: 'none' }}
              >
                {entry.aux1 || 'a file'}
              </a>
            </>
          ) : describeJournalEntry(entry)}
        </Text>
        <Text UNSAFE_style={{ fontSize: '11px', color: 'var(--spectrum-global-color-gray-500)' }}>
          &middot; {formatRelativeTime(entry.entryDate)}
        </Text>
      </Flex>
    );
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

        <Checkbox
          isSelected={showSystemUpdates}
          onChange={setShowSystemUpdates}
        >
          Show System Updates
        </Checkbox>

        {error && (
          <Text UNSAFE_style={{ color: 'var(--spectrum-global-color-red-600)', fontSize: '13px' }}>
            {error}
          </Text>
        )}

        {journalError && (
          <Text UNSAFE_style={{ color: 'var(--spectrum-global-color-red-600)', fontSize: '13px' }}>
            {journalError}
          </Text>
        )}

        {journalLoading && (
          <Flex alignItems="center" gap="size-100">
            <ProgressCircle aria-label="Loading system updates" isIndeterminate size="S" />
            <Text UNSAFE_style={{ fontSize: '12px', color: 'var(--spectrum-global-color-gray-600)' }}>
              Loading system updates...
            </Text>
          </Flex>
        )}

        {feedItems.length === 0 ? (
          <Text UNSAFE_style={{ fontStyle: 'italic', color: 'var(--spectrum-global-color-gray-600)' }}>
            No comments yet
          </Text>
        ) : (
          <Flex direction="column" gap="size-200">
            {feedItems.map(item => (
              <React.Fragment key={item.key}>
                {item.type === 'comment' ? renderComment(item.data) : renderSystemUpdate(item.data)}
              </React.Fragment>
            ))}
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
