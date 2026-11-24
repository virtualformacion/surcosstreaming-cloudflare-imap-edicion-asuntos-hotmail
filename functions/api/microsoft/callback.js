import {connect} from 'cloudflare:sockets';
import {microsoftCallback} from '../../../lib/microsoft-handler.js';
import {testMailbox} from '../../../lib/imap-mail.js';
export function onRequest(context){return microsoftCallback(context,(box,credential)=>testMailbox(connect,box,credential));}
