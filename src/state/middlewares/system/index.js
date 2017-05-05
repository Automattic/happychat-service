import systemStatusNotifier from './system-status-notifier'
import chatStatusNotifier from './chat-status-notifier'
import loadUpdater from './load-updater'
import requestingChatMiddleware from './requesting-chat-updater';

import controllerMiddleware from './controller'
import chatAssignment from './chat-assignment'
import customerPresence from './customer-presence'
import operatorDefaultGroup from './operator-default-group'
import transferChat from './transfer-chat'
import eventMessages from './event-messages'

export default ( messageFilter, timeout = undefined, logCacheBuilder ) => ( [
	customerPresence( timeout ),
	eventMessages,
	operatorDefaultGroup,
	transferChat,
	systemStatusNotifier,
	chatStatusNotifier,
	loadUpdater,
	chatAssignment,
	requestingChatMiddleware,
	controllerMiddleware( messageFilter, logCacheBuilder )
] );
