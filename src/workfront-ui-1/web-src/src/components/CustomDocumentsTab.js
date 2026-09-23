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
import { fetchCustomDocuments, fetchProjectDetails } from '../services/workfrontApi';
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

const hasAemAsset = (document) => Boolean(document.aemurn);

const AemAssetIcon = ({ className = '' }) => (
  <svg
    className={`custom-doc-aem-icon ${className}`.trim()}
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    role="img"
    aria-label="Linked AEM Asset"
  >
    <title>Linked AEM Asset</title>
    <path d="M19.75 0H4.25C1.90279 0 0 1.95158 0 4.35897V19.641C0 22.0484 1.90279 24 4.25 24H19.75C22.0972 24 24 22.0484 24 19.641V4.35897C24 1.95158 22.0972 0 19.75 0Z" fill="#FA0F00" />
    <path d="M18.6512 18.0513H15.7972C15.6733 18.0536 15.5515 18.0181 15.4474 17.9492C15.3432 17.8804 15.2613 17.7813 15.2122 17.6647L12.1122 10.2431C12.1033 10.2147 12.0859 10.19 12.0625 10.1724C12.039 10.1548 12.0107 10.1454 11.9817 10.1454C11.9526 10.1454 11.9243 10.1548 11.9009 10.1724C11.8774 10.19 11.86 10.2147 11.8512 10.2431L9.92118 14.9549C9.91056 14.9804 9.9063 15.0082 9.90877 15.0359C9.91125 15.0635 9.92039 15.0901 9.93537 15.1131C9.95035 15.1362 9.9707 15.1552 9.99459 15.1682C10.0185 15.1812 10.0451 15.1879 10.0722 15.1877H12.1942C12.2583 15.188 12.3209 15.2076 12.3742 15.2441C12.4276 15.2805 12.4693 15.3323 12.4942 15.3929L13.4232 17.5108C13.4478 17.5703 13.4577 17.635 13.4519 17.6994C13.4462 17.7637 13.425 17.8255 13.3902 17.8794C13.3554 17.9332 13.3082 17.9774 13.2527 18.008C13.1972 18.0385 13.1352 18.0545 13.0722 18.0544H5.35018C5.29215 18.0541 5.23509 18.0391 5.18408 18.0107C5.13307 17.9823 5.0897 17.9414 5.05783 17.8916C5.02596 17.8419 5.00657 17.7848 5.0014 17.7256C4.99623 17.6663 5.00543 17.6066 5.02818 17.5518L9.94218 5.55286C9.99258 5.426 10.0791 5.31764 10.1904 5.2419C10.3017 5.16617 10.4326 5.12656 10.5662 5.12824H13.4002C13.5338 5.12628 13.6649 5.16577 13.7762 5.24154C13.8876 5.31731 13.974 5.42583 14.0242 5.55286L18.9762 17.5385C18.9989 17.5931 19.0081 17.6526 19.003 17.7117C18.9979 17.7708 18.9787 17.8278 18.9471 17.8775C18.9154 17.9272 18.8723 17.9681 18.8216 17.9966C18.7709 18.0252 18.714 18.0404 18.6562 18.0411L18.6512 18.0513Z" fill="#fff" />
  </svg>
);

const DocumentPreview = ({ document, hostname, sessionToken, large = false }) => {
  const [failed, setFailed] = useState(false);
  const canLoadThumbnail = document.currentVersionID && hostname && sessionToken && !failed;

  if (!canLoadThumbnail) {
    return (
      <div className={large ? 'custom-doc-preview-icon custom-doc-preview-icon-large' : 'custom-doc-preview-icon'}>
        {getFileIcon(document.ext, large ? 'XXL' : 'S')}
      </div>
    );
  }

  const thumbnailUrl = `${hostname}/internal/document/thumbnail?ID=${document.ID}&documentVersionID=${document.currentVersionID}&size=ORIGINAL&sessionID=${encodeURIComponent(sessionToken)}`;
  return (
    <img
      className={large ? 'custom-doc-preview custom-doc-preview-large' : 'custom-doc-preview'}
      src={thumbnailUrl}
      alt=""
      onError={() => setFailed(true)}
    />
  );
};

const CustomDocumentSection = ({ parent, documents, viewMode, hostname, sessionToken }) => {
  const parentUrl = parent.ID ? buildWorkfrontObjectUrl(hostname, parent.objCode, parent.ID) : '';

  return (
    <section className="custom-doc-section" aria-labelledby={`${parent.objCode}-documents-heading`}>
      <div className="custom-doc-section-heading">
        <div>
          <Heading id={`${parent.objCode}-documents-heading`} level={2} marginBottom="size-50">
            {parent.label} documents
          </Heading>
          {parent.ID ? (
            <a className="custom-doc-parent-link" href={parentUrl} target="_blank" rel="noopener noreferrer">
              {parent.name || `Open ${parent.label.toLowerCase()}`}
            </a>
          ) : (
            <Text UNSAFE_className="custom-doc-muted">This project is not assigned to a {parent.label.toLowerCase()}.</Text>
          )}
        </div>
        {parent.ID && <Text UNSAFE_className="custom-doc-count">{documents.length} {documents.length === 1 ? 'document' : 'documents'}</Text>}
      </div>

      {parent.ID && documents.length === 0 && (
        <div className="custom-doc-empty">No documents are attached to this {parent.label.toLowerCase()}.</div>
      )}

      {parent.ID && documents.length > 0 && viewMode === 'list' && (
        <div className="custom-doc-table-wrap">
          <table className="custom-doc-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Added date</th>
                <th>Creator</th>
                <th>Last modified</th>
                <th>Linked to</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((document) => (
                <tr key={document.ID}>
                  <td>
                    <div className="custom-doc-name-cell">
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
                  <td>{hasAemAsset(document) && <AemAssetIcon />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {parent.ID && documents.length > 0 && viewMode === 'grid' && (
        <div className="custom-doc-grid">
          {documents.map((document) => (
            <a
              className="custom-doc-card"
              href={buildDocumentUrl(hostname, document.ID)}
              target="_blank"
              rel="noopener noreferrer"
              key={document.ID}
            >
              <div className="custom-doc-card-preview">
                <DocumentPreview document={document} hostname={hostname} sessionToken={sessionToken} large />
                {hasAemAsset(document) && <AemAssetIcon className="custom-doc-aem-icon-overlay" />}
              </div>
              <div className="custom-doc-card-details">
                <span className="custom-doc-card-name" title={document.name}>{document.name}</span>
                <span className="custom-doc-card-type">{(document.ext || 'File').toUpperCase()}</span>
              </div>
            </a>
          ))}
        </div>
      )}
    </section>
  );
};

const CustomDocumentsTab = () => {
  const [hostname, setHostname] = useState('');
  const [sessionToken, setSessionToken] = useState('');
  const [projectId, setProjectId] = useState('');
  const [project, setProject] = useState(null);
  const [documents, setDocuments] = useState({ PORT: [], PRGM: [], PROJ: [] });
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
        console.error('Error initializing Custom Documents:', err);
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
          { objCode: 'PRGM', ID: projectData.programID || projectData.program?.ID },
          { objCode: 'PROJ', ID: projectId }
        ];
        const results = await Promise.all(parents.map(async (parent) => (
          parent.ID ? fetchCustomDocuments(hostname, sessionToken, parent.objCode, parent.ID) : []
        )));

        setProject(projectData);
        setDocuments({ PORT: results[0], PRGM: results[1], PROJ: results[2] });
      } catch (err) {
        console.error('Error loading custom documents:', err);
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
    return { PORT: filter(documents.PORT), PRGM: filter(documents.PRGM), PROJ: filter(documents.PROJ) };
  }, [documents, searchText]);

  const parents = [
    { objCode: 'PORT', label: 'Portfolio', ID: project?.portfolioID || project?.portfolio?.ID, name: project?.portfolio?.name },
    { objCode: 'PRGM', label: 'Program', ID: project?.programID || project?.program?.ID, name: project?.program?.name },
    { objCode: 'PROJ', label: 'Project', ID: projectId, name: project?.name }
  ];
  const totalDocuments = documents.PORT.length + documents.PRGM.length + documents.PROJ.length;

  return (
    <Provider theme={defaultTheme} colorScheme="light">
      <main className="custom-doc-page">
        <div className="custom-doc-page-header">
          <div>
            <Heading level={1} marginBottom="size-50">Custom Documents</Heading>
            <Text UNSAFE_className="custom-doc-muted">Documents attached to this project, its portfolio, and its program</Text>
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

        <div className="custom-doc-toolbar">
          <SearchField
            aria-label="Search custom documents"
            placeholder="Search documents"
            value={searchText}
            onChange={setSearchText}
            width="size-3600"
          />
          <Text UNSAFE_className="custom-doc-count">{totalDocuments} {totalDocuments === 1 ? 'document' : 'documents'}</Text>
        </div>

        {loading && (
          <Flex justifyContent="center" alignItems="center" height="size-3000" gap="size-150">
            <ProgressCircle aria-label="Loading custom documents" isIndeterminate />
            <Text>Loading custom documents...</Text>
          </Flex>
        )}

        {!loading && error && (
          <View padding="size-300" UNSAFE_className="custom-doc-error">Unable to load custom documents: {error}</View>
        )}

        {!loading && !error && parents.map((parent) => (
          <CustomDocumentSection
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

export default CustomDocumentsTab;