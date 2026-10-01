/*
 * <license header>
 */

import { Text } from "@adobe/react-spectrum";
import React, { useEffect } from 'react';
import { register } from "@adobe/uix-guest";
import { startContextDiagnostics } from '../utils/contextDiagnostics';
import { extensionId } from "./Constants";
import metadata from '../../../../app-metadata.json';
import { icon1, icon2, iconDocument } from './icons';

function ExtensionRegistration() {
  useEffect(() => {
    let disposed = false;
    let stopDiagnostics = () => {};
    const init = async () => {
      const guestConnection = await register({
        metadata,
        methods: {
          id: extensionId,
          mainMenu: {
            getItems() {
              return [
                {
                  id: 'project-dashboard',
                  url: '/index.html#/project-dashboard',
                  label: 'Project Dashboard',
                  icon: icon1,
                },
              // @todo YOUR HEADER BUTTONS DECLARATION SHOULD BE HERE
              ];
            },
          },
          secondaryNav: {
            PROJECT: {
              getItems() {
                return [
                  {
                    id: 'project-tab',
                    url: '/index.html#/project-tab',
                    label: 'Project Details',
                    icon: icon2,
                  },
                  {
                    id: 'custom-files-panel',
                    url: '/index.html#/custom-files',
                    label: 'Custom Documents',
                    icon: iconDocument,
                  },
                ];
              },
            },
          },
        }
      });
      if (disposed) return;
      stopDiagnostics = startContextDiagnostics(guestConnection, 'registration');
    };
    init().catch(() => console.error('Workfront registration failed.'));
    return () => {
      disposed = true;
      stopDiagnostics();
    };
  }, []);

  return <Text>IFrame for integration with Host (Workfront)...</Text>;
}

export default ExtensionRegistration;
