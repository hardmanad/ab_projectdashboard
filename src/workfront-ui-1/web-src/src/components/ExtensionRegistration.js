/*
 * <license header>
 */

import { Text } from "@adobe/react-spectrum";
import { register } from "@adobe/uix-guest";
import { extensionId } from "./Constants";
import metadata from '../../../../app-metadata.json';
import { icon1, icon2 } from './icons';

function ExtensionRegistration() {
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
                  label: 'AppBuilder Tab',
                  icon: icon2,
                },
              ];
            },
          },
        },
      }
    });
  };
  init().catch(console.error);

  return <Text>IFrame for integration with Host (Workfront)...</Text>;
}

export default ExtensionRegistration;
