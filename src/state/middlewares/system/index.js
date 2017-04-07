import systemStatusNotifier from './system-status-notifier'
import chatStatusNotifier from './chat-status-notifier'
import loadUpdater from './load-updater'
import ignoreCapacityMiddleware from './ignore-capacity-updater';

export default [ systemStatusNotifier, chatStatusNotifier, loadUpdater, ignoreCapacityMiddleware ]
