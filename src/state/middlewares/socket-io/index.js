import operatorMiddleware from './operator';
import customerMiddleware from './customer';
import agentMiddleware from './agents';

export default ( { io, customerAuth, operatorAuth, agentAuth, messageFilter, timeout = undefined } ) => {
	return [
		operatorMiddleware( io.of( '/operator' ), operatorAuth, messageFilter ),
		agentMiddleware( io.of( '/agent' ), agentAuth, messageFilter ),
		customerMiddleware( {
			io: io.of( '/customer' ),
			timeout
		}, customerAuth, messageFilter )
	];
};
