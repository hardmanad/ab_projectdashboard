import React, { useState, useEffect } from 'react';
import { View, Flex, Heading, Text, ProgressCircle } from '@adobe/react-spectrum';
import FileTxt from '@spectrum-icons/workflow/FileTxt';
import FileCode from '@spectrum-icons/workflow/FileCode';
import FileData from '@spectrum-icons/workflow/FileData';
import FileTemplate from '@spectrum-icons/workflow/FileTemplate';
import Image from '@spectrum-icons/workflow/Image';
import { fetchDocuments } from '../services/workfrontApi';
import { formatDate } from '../utils/dateFormatter';
import { buildDocumentUrl } from '../utils/urlBuilder';

const getFileIcon = (extension) => {
  if (!extension) return <FileTxt size="M" />;
  const ext = extension.toLowerCase();
  if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp'].includes(ext)) return <Image size="M" />;
  if (['js', 'jsx', 'ts', 'tsx', 'html', 'css', 'json', 'xml', 'java', 'py', 'rb', 'php'].includes(ext)) return <FileCode size="M" />;
  if (['csv', 'xls', 'xlsx', 'xml', 'json'].includes(ext)) return <FileData size="M" />;
  if (['doc', 'docx', 'pdf', 'txt', 'rtf'].includes(ext)) return <FileTxt size="M" />;
  return <FileTemplate size="M" />;
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
          width: '64px',
          height: '64px',
          objectFit: 'cover',
          borderRadius: '4px'
        }}
      />
    </>
  );
};

/**
 * DocumentsSection Component
 * Displays documents attached to a project
 */
const DocumentsSection = ({ projectId, hostname, sessionToken }) => {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
          <Flex direction="column" gap="size-150">
            {documents.map(doc => (
              <View 
                key={doc.ID}
                padding="size-200"
                borderRadius="small"
                UNSAFE_style={{
                  backgroundColor: 'white',
                  border: '1px solid var(--spectrum-global-color-gray-200)',
                  transition: 'box-shadow 0.2s',
                  cursor: 'pointer'
                }}
              >
                <Flex direction="row" gap="size-200" alignItems="center">
                  {/* File Icon / Thumbnail */}
                  <View UNSAFE_style={{ color: 'var(--spectrum-global-color-gray-600)', flexShrink: 0 }}>
                    <DocumentThumbnail doc={doc} hostname={hostname} sessionToken={sessionToken} />
                  </View>
                  
                  {/* Document Info */}
                  <Flex direction="column" gap="size-50" flex={1}>
                    <a 
                      href={buildDocumentUrl(hostname, doc.ID)} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      style={{ 
                        textDecoration: 'none',
                        color: 'rgb(0, 84, 182)',
                        fontWeight: 600,
                        fontSize: '14px',
                        transition: 'text-decoration 0.2s'
                      }}
                      onMouseEnter={(e) => e.target.style.textDecoration = 'underline'}
                      onMouseLeave={(e) => e.target.style.textDecoration = 'none'}
                    >
                      {doc.name}
                    </a>
                    
                    <Flex direction="column" gap="size-50">
                      <Text UNSAFE_style={{ fontSize: '11px', color: 'var(--spectrum-global-color-gray-600)' }}>
                        Uploaded by: {doc.owner?.name || 'Unknown'}
                      </Text>
                      <Text UNSAFE_style={{ fontSize: '11px', color: 'var(--spectrum-global-color-gray-600)' }}>
                        {formatDate(doc.entryDate || doc.lastUpdateDate, true, true)}
                      </Text>
                    </Flex>
                  </Flex>
                  
                  {/* Extension Badge */}
                  {doc.ext && (
                    <View
                      padding="size-50"
                      paddingStart="size-100"
                      paddingEnd="size-100"
                      borderRadius="small"
                      UNSAFE_style={{
                        backgroundColor: 'var(--spectrum-global-color-gray-200)',
                        fontSize: '10px',
                        fontWeight: 600,
                        color: 'var(--spectrum-global-color-gray-700)',
                        textTransform: 'uppercase'
                      }}
                    >
                      {doc.ext}
                    </View>
                  )}
                </Flex>
              </View>
            ))}
          </Flex>
        )}
      </Flex>
    </View>
  );
};

export default DocumentsSection;
