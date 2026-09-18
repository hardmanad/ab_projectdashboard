import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Flex,
  Heading,
  Text,
  ProgressCircle,
  TableView,
  TableHeader,
  TableBody,
  Column,
  Row,
  Cell
} from '@adobe/react-spectrum';
import FileTxt from '@spectrum-icons/workflow/FileTxt';
import FileCode from '@spectrum-icons/workflow/FileCode';
import FileData from '@spectrum-icons/workflow/FileData';
import FileTemplate from '@spectrum-icons/workflow/FileTemplate';
import Image from '@spectrum-icons/workflow/Image';
import { fetchDocuments } from '../services/workfrontApi';
import { formatShortDate } from '../utils/dateFormatter';
import { buildDocumentUrl } from '../utils/urlBuilder';

const ROW_HEIGHT = 40;
const HEADER_HEIGHT = 40;

const getFileIcon = (extension) => {
  if (!extension) return <FileTxt size="S" />;
  const ext = extension.toLowerCase();
  if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp'].includes(ext)) return <Image size="S" />;
  if (['js', 'jsx', 'ts', 'tsx', 'html', 'css', 'json', 'xml', 'java', 'py', 'rb', 'php'].includes(ext)) return <FileCode size="S" />;
  if (['csv', 'xls', 'xlsx', 'xml', 'json'].includes(ext)) return <FileData size="S" />;
  if (['doc', 'docx', 'pdf', 'txt', 'rtf'].includes(ext)) return <FileTxt size="S" />;
  return <FileTemplate size="S" />;
};

const DocumentThumbnail = ({ doc, hostname, sessionToken }) => {
  const [imgStatus, setImgStatus] = useState('loading');

  const canTry = doc.currentVersionID && hostname && sessionToken;

  if (!canTry || imgStatus === 'error') {
    return getFileIcon(doc.ext);
  }

  const url = `${hostname}/internal/document/thumbnail?ID=${doc.ID}&documentVersionID=${doc.currentVersionID}&size=ORIGINAL&sessionID=${encodeURIComponent(sessionToken)}`;

  return (
    <>
      {imgStatus === 'loading' && getFileIcon(doc.ext)}
      <img
        src={url}
        alt=""
        onLoad={() => setImgStatus('loaded')}
        onError={() => setImgStatus('error')}
        style={{
          display: imgStatus === 'loaded' ? 'block' : 'none',
          width: '24px',
          height: '24px',
          objectFit: 'cover',
          borderRadius: '3px'
        }}
      />
    </>
  );
};

const COLUMNS = [
  { key: 'name', label: 'Name', allowsSorting: true },
  { key: 'type', label: 'Type', allowsSorting: true },
  { key: 'connection', label: 'Connection', allowsSorting: false },
  { key: 'addedDate', label: 'Added date', allowsSorting: true },
  { key: 'creator', label: 'Creator', allowsSorting: true },
  { key: 'lastModified', label: 'Last modified', allowsSorting: true },
  { key: 'approvalStatus', label: 'Approval status', allowsSorting: false },
  { key: 'assets', label: 'Assets', allowsSorting: false },
  { key: 'linkedTo', label: 'Linked to', allowsSorting: false }
];

const SORT_VALUE_GETTERS = {
  name: (doc) => (doc.name || '').toLowerCase(),
  type: (doc) => (doc.ext || '').toLowerCase(),
  addedDate: (doc) => doc.entryDate || '',
  creator: (doc) => (doc.owner?.name || '').toLowerCase(),
  lastModified: (doc) => doc.lastUpdateDate || doc.entryDate || ''
};

/**
 * DocumentsSection Component
 * Displays documents attached to a project as a sortable grid, styled to
 * match Workfront's native Documents list.
 */
const DocumentsSection = ({ projectId, hostname, sessionToken }) => {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortDescriptor, setSortDescriptor] = useState({ column: 'addedDate', direction: 'descending' });

  useEffect(() => {
    if (!projectId || !hostname || !sessionToken) {
      return;
    }

    const loadDocuments = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchDocuments(hostname, sessionToken, projectId);
        setDocuments(data);
      } catch (err) {
        console.error('Error loading documents:', err);
        setError('Failed to load documents');
      } finally {
        setLoading(false);
      }
    };

    loadDocuments();
  }, [projectId, hostname, sessionToken]);

  const sortedDocuments = useMemo(() => {
    const getValue = SORT_VALUE_GETTERS[sortDescriptor.column];
    if (!getValue) {
      return documents;
    }

    const sorted = [...documents].sort((a, b) => {
      const valueA = getValue(a);
      const valueB = getValue(b);
      if (valueA < valueB) return -1;
      if (valueA > valueB) return 1;
      return 0;
    });

    return sortDescriptor.direction === 'descending' ? sorted.reverse() : sorted;
  }, [documents, sortDescriptor]);

  if (loading) {
    return (
      <View padding="size-300">
        <Flex justifyContent="center" alignItems="center" height="size-2000">
          <ProgressCircle aria-label="Loading documents" isIndeterminate size="S" />
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
        <Heading level={3}>Documents</Heading>

        {error && (
          <Text UNSAFE_style={{ color: 'var(--spectrum-global-color-red-600)', fontSize: '13px' }}>
            {error}
          </Text>
        )}

        {documents.length === 0 ? (
          <Text UNSAFE_style={{ fontStyle: 'italic', color: 'var(--spectrum-global-color-gray-600)' }}>
            No documents attached
          </Text>
        ) : (
          <TableView
            aria-label="Documents"
            density="compact"
            height={`${HEADER_HEIGHT + sortedDocuments.length * ROW_HEIGHT}px`}
            sortDescriptor={sortDescriptor}
            onSortChange={setSortDescriptor}
          >
            <TableHeader columns={COLUMNS}>
              {(column) => (
                <Column key={column.key} allowsSorting={column.allowsSorting} isRowHeader={column.key === 'name'}>
                  {column.label}
                </Column>
              )}
            </TableHeader>
            <TableBody items={sortedDocuments}>
              {(doc) => (
                <Row key={doc.ID}>
                  <Cell>
                    <Flex alignItems="center" gap="size-100">
                      <View UNSAFE_style={{ color: 'var(--spectrum-global-color-gray-600)', flexShrink: 0, display: 'flex' }}>
                        <DocumentThumbnail doc={doc} hostname={hostname} sessionToken={sessionToken} />
                      </View>
                      <a
                        href={buildDocumentUrl(hostname, doc.ID)}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          textDecoration: 'none',
                          color: 'rgb(0, 84, 182)'
                        }}
                      >
                        {doc.name}
                      </a>
                    </Flex>
                  </Cell>
                  <Cell>{doc.ext || ''}</Cell>
                  <Cell>{''}</Cell>
                  <Cell>{formatShortDate(doc.entryDate)}</Cell>
                  <Cell>{doc.owner?.name || ''}</Cell>
                  <Cell>{formatShortDate(doc.lastUpdateDate || doc.entryDate)}</Cell>
                  <Cell>{''}</Cell>
                  <Cell>-</Cell>
                  <Cell>{''}</Cell>
                </Row>
              )}
            </TableBody>
          </TableView>
        )}
      </Flex>
    </View>
  );
};

export default DocumentsSection;
