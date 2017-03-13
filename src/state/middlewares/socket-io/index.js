import operatorMiddleware from './operator'
import chatlistMiddleware from './chatlist'
import agentMiddleware from './agents'

export default ( { io, customerAuth, operatorAuth, agentAuth, messageMiddlewares = [], timeout = undefined } ) => {
	return [
		operatorMiddleware( io.of( '/operator' ), operatorAuth, messageMiddlewares ),
		agentMiddleware( io.of( '/agent' ), agentAuth ),
		chatlistMiddleware( {
			io,
			timeout
		}, customerAuth, messageMiddlewares )
	]
}
