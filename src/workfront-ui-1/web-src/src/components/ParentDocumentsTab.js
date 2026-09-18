import React, { useEffect, useMemo, useState } from 'react';
import {
  ActionButton,
  ButtonGroup,
  Flex,
  Heading,
  ProgressCircle,
  Provider,
  SearchField,
  Text,
  View,
  defaultTheme
} from '@adobe/react-spectrum';
import FileCode from '@spectrum-icons/workflow/FileCode';
import FileData from '@spectrum-icons/workflow/FileData';
import FileTemplate from '@spectrum-icons/workflow/FileTemplate';
import FileTxt from '@spectrum-icons/workflow/FileTxt';
import Image from '@spectrum-icons/workflow/Image';
import ViewGrid from '@spectrum-icons/workflow/ViewGrid';
import ViewList from '@spectrum-icons/workflow/ViewList';
import { attach } from '@adobe/uix-guest';
import { extensionId } from './Constants';
import { fetchParentDocuments, fetchProjectDetails } from '../services/workfrontApi';
import { formatShortDate } from '../utils/dateFormatter';
import { buildDocumentUrl, buildWorkfrontObjectUrl, ensureProtocol } from '../utils/urlBuilder';

const getFileIcon = (extension, size = 'M') => {
  const ext = (extension || '').toLowerCase();
  if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp'].includes(ext)) return <Image size={size} />;
  if (['js', 'jsx', 'ts', 'tsx', 'html', 'css', 'json', 'xml', 'java', 'py'].includes(ext)) return <FileCode size={size} />;
  if (['csv', 'xls', 'xlsx'].includes(ext)) return <FileData size={size} />;
  if (['doc', 'docx', 'pdf', 'txt', 'rtf'].includes(ext)) return <FileTxt size={size} />;
  return <FileTemplate size={size} />;
};

const DocumentPreview = ({ document, hostname, sessionToken, large = false }) => {
  const [failed, setFailed] = useState(false);
  const canLoadThumbnail = document.currentVersionID && hostname && sessionToken && !failed;

  if (!canLoadThumbnail) {
    return (
      <div className={large ? 'parent-doc-preview-icon parent-doc-preview-icon-large' : 'parent-doc-preview-icon'}>
        {getFileIcon(document.ext, large ? 'XXL' : 'S')}
      </div>
    );
  }

  const thumbnailUrl = `${hostname}/internal/document/thumbnail?ID=${document.ID}&documentVersionID=${document.currentVersionID}&size=ORIGINAL&sessionID=${encodeURIComponent(sessionToken)}`;
  return (
    <img
      className={large ? 'parent-doc-preview parent-doc-preview-large' : 'parent-doc-preview'}
      src={thumbnailUrl}
      alt=""
      onError={() => setFailed(true)}
    />
  );
};

const ParentDocumentSection = ({ parent, documents, viewMode, hostname, sessionToken }) => {
  const parentUrl = parent.ID ? buildWorkfrontObjectUrl(hostname, parent.objCode, parent.ID) : '';

  return (
    <section className="parent-doc-section" aria-labelledby={`${parent.objCode}-documents-heading`}>
      <div className="parent-doc-section-heading">
        <div>
          <Heading id={`${parent.objCode}-documents-heading`} level={2} marginBottom="size-50">
            {parent.label} documents
          </Heading>
          {parent.ID ? (
            <a className="parent-doc-parent-link" href={parentUrl} target="_blank" rel="noopener noreferrer">
              {parent.name || `Open ${parent.label.toLowerCase()}`}
            </a>
          ) : (
            <Text UNSAFE_className="parent-doc-muted">This project is not assigned to a {parent.label.toLowerCase()}.</Text>
          )}
        </div>
        {parent.ID && <Text UNSAFE_className="parent-doc-count">{documents.length} {documents.length === 1 ? 'document' : 'documents'}</Text>}
      </div>

      {parent.ID && documents.length === 0 && (
        <div className="parent-doc-empty">No documents are attached to this {parent.label.toLowerCase()}.</div>
      )}

      {parent.ID && documents.length > 0 && viewMode === 'list' && (
        <div className="parent-doc-table-wrap">
          <table className="parent-doc-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Added date</th>
                <th>Creator</th>
                <th>Last modified</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((document) => (
                <tr key={document.ID}>
                  <td>
                    <div className="parent-doc-name-cell">
                      <DocumentPreview document={document} hostname={hostname} sessionToken={sessionToken} />
                      <a href={buildDocumentUrl(hostname, document.ID)} target="_blank" rel="noopener noreferrer">
                        {document.name}
                      </a>
                    </div>
                  </td>
                  <td>{(document.ext || '').toUpperCase()}</td>
                  <td>{formatShortDate(document.entryDate)}</td>
                  <td>{document.owner?.name || ''}</td>
                  <td>{formatShortDate(document.lastUpdateDate || document.entryDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {parent.ID && documents.length > 0 && viewMode === 'grid' && (
        <div className="parent-doc-grid">
          {documents.map((document) => (
            <a
              className="parent-doc-card"
              href={buildDocumentUrl(hostname, document.ID)}
              target="_blank"
              rel="noopener noreferrer"
              key={document.ID}
            >
              <div className="parent-doc-card-preview">
                <DocumentPreview document={document} hostname={hostname} sessionToken={sessionToken} large />
              </div>
              <div className="parent-doc-card-details">
                <span className="parent-doc-card-name" title={document.name}>{document.name}</span>
                <span className="parent-doc-card-type">{(document.ext || 'File').toUpperCase()}</span>
              </div>
            </a>
          ))}
        </div>
      )}
    </section>
  );
};

const ParentDocumentsTab = () => {
  const [hostname, setHostname] = useState('');
  const [sessionToken, setSessionToken] = useState('');
  const [projectId, setProjectId] = useState('');
  const [project, setProject] = useState(null);
  const [documents, setDocuments] = useState({ PORT: [], PRGM: [] });
  const [viewMode, setViewMode] = useState('list');
  const [searchText, setSearchText] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const initialize = async () => {
      try {
        const connection = await attach({ id: extensionId });
        await new Promise(resolve => setTimeout(resolve, 500));
        const context = connection.sharedContext;
        const auth = context.get('auth');
        const contextHostname = context.get('hostname');
        const contextToken = context.get('sessionToken') || context.get('token') || auth?.imsToken;
        const contextProjectId = context.get('objID') || context.get('projectId') || context.get('objectId');

        if (!contextHostname || !contextToken || !contextProjectId) {
          throw new Error('Workfront did not provide the project context required by this tab.');
        }

        setHostname(ensureProtocol(contextHostname));
        setSessionToken(contextToken);
        setProjectId(contextProjectId);
        connection.host?.renderDone?.();
      } catch (err) {
        console.error('Error initializing Parent Documents:', err);
        setError(err.message);
        setLoading(false);
      }
    };

    initialize();
  }, []);

  useEffect(() => {
    if (!hostname || !sessionToken || !projectId) return;

    const loadDocuments = async () => {
      try {
        setLoading(true);
        setError('');
        const projectData = await fetchProjectDetails(hostname, sessionToken, projectId);
        const parents = [
          { objCode: 'PORT', ID: projectData.portfolioID || projectData.portfolio?.ID },
          { objCode: 'PRGM', ID: projectData.programID || projectData.program?.ID }
        ];
        const results = await Promise.all(parents.map(async (parent) => (
          parent.ID ? fetchParentDocuments(hostname, sessionToken, parent.objCode, parent.ID) : []
        )));

        setProject(projectData);
        setDocuments({ PORT: results[0], PRGM: results[1] });
      } catch (err) {
        console.error('Error loading parent documents:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadDocuments();
  }, [hostname, sessionToken, projectId]);

  const filteredDocuments = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    if (!query) return documents;
    const filter = (items) => items.filter((document) => (
      [document.name, document.ext, document.owner?.name].some(value => (value || '').toLowerCase().includes(query))
    ));
    return { PORT: filter(documents.PORT), PRGM: filter(documents.PRGM) };
  }, [documents, searchText]);

  const parents = [
    { objCode: 'PORT', label: 'Portfolio', ID: project?.portfolioID || project?.portfolio?.ID, name: project?.portfolio?.name },
    { objCode: 'PRGM', label: 'Program', ID: project?.programID || project?.program?.ID, name: project?.program?.name }
  ];
  const totalDocuments = documents.PORT.length + documents.PRGM.length;

  return (
    <Provider theme={defaultTheme} colorScheme="light">
      <main className="parent-doc-page">
        <div className="parent-doc-page-header">
          <div>
            <Heading level={1} marginBottom="size-50">Parent Documents</Heading>
            <Text UNSAFE_className="parent-doc-muted">Documents attached to this project's portfolio and program</Text>
          </div>
          <ButtonGroup aria-label="Document view">
            <ActionButton isQuiet={viewMode !== 'list'} isSelected={viewMode === 'list'} onPress={() => setViewMode('list')} aria-label="List view">
              <ViewList />
            </ActionButton>
            <ActionButton isQuiet={viewMode !== 'grid'} isSelected={viewMode === 'grid'} onPress={() => setViewMode('grid')} aria-label="Thumbnail view">
              <ViewGrid />
            </ActionButton>
          </ButtonGroup>
        </div>

        <div className="parent-doc-toolbar">
          <SearchField
            aria-label="Search parent documents"
            placeholder="Search documents"
            value={searchText}
            onChange={setSearchText}
            width="size-3600"
          />
          <Text UNSAFE_className="parent-doc-count">{totalDocuments} {totalDocuments === 1 ? 'document' : 'documents'}</Text>
        </div>

        {loading && (
          <Flex justifyContent="center" alignItems="center" height="size-3000" gap="size-150">
            <ProgressCircle aria-label="Loading parent documents" isIndeterminate />
            <Text>Loading parent documents...</Text>
          </Flex>
        )}

        {!loading && error && (
          <View padding="size-300" UNSAFE_className="parent-doc-error">Unable to load parent documents: {error}</View>
        )}

        {!loading && !error && parents.map((parent) => (
          <ParentDocumentSection
            key={parent.objCode}
            parent={parent}
            documents={filteredDocuments[parent.objCode]}
            viewMode={viewMode}
            hostname={hostname}
            sessionToken={sessionToken}
          />
        ))}
      </main>
    </Provider>
  );
};

export default ParentDocumentsTab;