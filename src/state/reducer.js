import { combineReducers } from 'redux'
import chatlist from './chatlist/reducer'
import operators from './operator/reducer'

export default combineReducers( { operators, chatlist } )
