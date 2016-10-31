import {
	getChats
} from './selectors'

export default ( { store, events } ) => {
	return {
		findAllOpenChats: () => getChats( store.getState() ),
		on: events.on.bind( events ),
		once: events.once.bind( events ),
		store
	}
}
