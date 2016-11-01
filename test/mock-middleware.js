import foreach from 'lodash/foreach'
import isMatch from 'lodash/isMatch'

export default class WatchingMiddleware {
	constructor() {
		this.actionWatchers = []
	}

	middleware() {
		if ( this.middlewareFunc ) {
			return this.middlewareFunc;
		}

		const middlewareFunc = ( ) => ( next ) => ( action ) => {
			this.lastAction = Object.assign( {}, action );
			foreach( this.actionWatchers, ( watcher ) => watcher( action ) )
			next( action );
		}
		this.middlewareFunc = middlewareFunc.bind( this );
		return this.middlewareFunc;
	}

	watch( watcher ) {
		this.actionWatchers.push( watcher );
	}

	watchForAction( actionTemplate, watcher ) {
		this.actionWatchers.push( ( action ) => {
			if ( isMatch( action, actionTemplate ) ) {
				watcher( action );
			}
		} )
	}

	watchForType( type, watcher ) {
		this.actionWatchers.push( ( action ) => {
			if ( type === action.type ) {
				watcher( action );
			}
		} );
	}
}
