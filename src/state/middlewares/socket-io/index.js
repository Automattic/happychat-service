import operatorMiddleware from './operator';
import customerMiddleware from './customer';
import agentMiddleware from './agents';

export default ( { io, customerAuth, operatorAuth, agentAuth, messageMiddlewares = [], timeout = undefined } ) => {
	return [
		operatorMiddleware( io.of( '/operator' ), operatorAuth, messageMiddlewares ),
		agentMiddleware( io.of( '/agent' ), agentAuth ),
		customerMiddleware( {
			io: io.of( '/customer' ),
			timeout
		}, customerAuth, messageMiddlewares )
	];
};
