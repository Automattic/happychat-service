import foreach from 'lodash/forEach';
import isMatch from 'lodash/isMatch';
import reject from 'lodash/reject';

export default class WatchingMiddleware {
	constructor() {
		this.actionWatchers = { before: [], after: [] };
	}

	middleware() {
		if ( this.middlewareFunc ) {
			return this.middlewareFunc;
		}

		const middlewareFunc = ( ) => ( next ) => ( action ) => {
			this.lastAction = Object.assign( {}, action );
			foreach( this.actionWatchers.before, ( watcher ) => watcher( action ) );
			const result = next( action );
			foreach( this.actionWatchers.after, ( watcher ) => watcher( action ) );
			return result;
		};
		this.middlewareFunc = middlewareFunc.bind( this );
		return this.middlewareFunc;
	}

	watch( watcher, after = false ) {
		this.actionWatchers[ after ? 'after' : 'before' ].push( watcher );
	}

	watchForAction( actionTemplate, watcher, after = false ) {
		this.actionWatchers[ after ? 'after' : 'before' ].push( ( action ) => {
			if ( isMatch( action, actionTemplate ) ) {
				watcher( action );
			}
		} );
	}

	watchForType( type, watcher, after = false ) {
		this.actionWatchers[ after ? 'after' : 'before' ].push( ( action ) => {
			if ( type === action.type ) {
				watcher( action );
			}
		} );
	}

	watchForTypeOnce( type, watcher, after = false ) {
		const which = after ? 'after' : 'before';
		const callback = action => {
			if ( type === action.type ) {
				this.actionWatchers[ which ] = reject(
					this.actionWatchers[ which ],
					it => it === callback
				);

				watcher( action );
			}
		};
		this.actionWatchers[ which ].push( callback );
	}

}
