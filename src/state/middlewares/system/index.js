import systemStatusNotifier from './system-status-notifier'
import chatStatusNotifier from './chat-status-notifier'
import loadUpdater from './load-updater'
import controllerMiddleware from './controller'

export default messageMiddlewares => ( [
	systemStatusNotifier, chatStatusNotifier, loadUpdater,
	controllerMiddleware( messageMiddlewares )
] )
