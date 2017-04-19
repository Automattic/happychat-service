import { combineReducers } from 'redux';
import chatlist from './chatlist/reducer';
import operators from './operator/reducer';
import groups from './groups/reducer';
import locales from './locales/reducer';

export default combineReducers( { operators, chatlist, groups, locales } );
